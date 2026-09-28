import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { FormRenderer } from "@hardikrastogi/react";
import type { FormDefinition } from "@hardikrastogi/core";
import { BuilderProvider, useBuilder } from "./context";
import { Palette, PALETTE_DRAG_PREFIX } from "./Palette";
import { Canvas, CANVAS_DROPPABLE_ID } from "./Canvas";
import { Inspector } from "./Inspector";
import { TopBar, type IndicatorState, type PublishState } from "./TopBar";
import { useAutosaveWithoutHost, useLocalBackup } from "./use-autosave";
import type { FieldTypeMeta } from "./store";

export interface PublishResult {
  /** Absolute or root-relative URL where the published form can be viewed. */
  url: string;
  /** Host-defined identifier for the published form; handed back to onUnpublish. */
  slug?: string;
}

export interface BuilderProps {
  /** Starting form definition — pass a blank one from createBlankDefinition() for a new form. */
  initialDefinition: FormDefinition;
  /** Where to autosave to localStorage. Defaults to the form's id. */
  storageKey?: string;
  /**
   * Called only when the person clicks the builder's own Save button — never
   * automatically. Provide this to persist to your backend on demand; throw
   * to show "Could not save". Omit it entirely to fall back to a fully
   * automatic, localStorage-only save (no Save button shown) — useful for a
   * standalone/demo builder with nowhere else to persist to.
   *
   * Either way, edits are continuously backed up to localStorage in the
   * background so a refresh, a closed tab, or a crashed browser recovers
   * exactly where editing left off; that backup is separate from, and not a
   * substitute for, actually calling this to save.
   */
  onSave?: (definition: FormDefinition) => Promise<void>;
  /**
   * Called when the user clicks Publish. The host app does the actual save
   * (an API call, typically) and resolves with the public URL. Omit this
   * prop to hide the Publish button entirely — used in the demo/preview
   * context that has nothing to publish to.
   */
  onPublish?: (definition: FormDefinition) => Promise<PublishResult>;
  /**
   * Called when the user clicks Unpublish, with the result of the last
   * publish. Omit to hide the Unpublish button. Unpublishing is reversible —
   * clicking Publish again brings the form back.
   */
  onUnpublish?: (published: PublishResult) => Promise<void>;
  /**
   * If the form is already published when the builder opens (for example the
   * host remembered it from a previous visit), pass that here so the live
   * link, Share, and Unpublish are available immediately.
   */
  initialPublished?: PublishResult | null;
}

interface BuilderInnerProps {
  storageKey: string;
  onSave?: BuilderProps["onSave"];
  onPublish?: BuilderProps["onPublish"];
  onUnpublish?: BuilderProps["onUnpublish"];
  initialPublished?: PublishResult | null;
}

function BuilderInner({ storageKey, onSave, onPublish, onUnpublish, initialPublished }: BuilderInnerProps) {
  const definition = useBuilder((s) => s.definition);
  const mode = useBuilder((s) => s.mode);
  const isDirty = useBuilder((s) => s.isDirty);
  const markSaved = useBuilder((s) => s.markSaved);
  const addField = useBuilder((s) => s.addField);
  const reorderFields = useBuilder((s) => s.reorderFields);

  // Two mutually exclusive modes, both hooks always called (rules of hooks) but
  // only one ever actually does anything, gated by whether onSave was given:
  //   - onSave given: crash-recovery backup only: see BuilderProvider's own
  //     read of this same key, and handleSave below for the real save.
  //   - onSave omitted: localStorage IS the save, exactly as before.
  useLocalBackup(storageKey, definition, isDirty && Boolean(onSave));
  const autoSaveState = useAutosaveWithoutHost(storageKey, definition, isDirty && !onSave, markSaved);

  const [manualSaveState, setManualSaveState] = useState<"idle" | "saving" | "error">("idle");
  async function handleSave() {
    if (!onSave) return;
    setManualSaveState("saving");
    try {
      await onSave(definition);
      markSaved();
      setManualSaveState("idle");
    } catch {
      setManualSaveState("error");
    }
  }
  // "saving"/"error" reflect the last Save click directly. Otherwise: any
  // edit since the last successful save is "dirty" (unsaved), never silently
  // shown as "saved" just because nothing has failed yet.
  const indicatorState: IndicatorState = !onSave
    ? autoSaveState
    : manualSaveState !== "idle"
      ? manualSaveState
      : isDirty
        ? "dirty"
        : "saved";

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [published, setPublished] = useState<PublishResult | null>(initialPublished ?? null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [unpublished, setUnpublished] = useState(false);
  const publishedUrl = published?.url ?? null;

  async function handlePublish() {
    if (!onPublish) return;
    setPublishState("publishing");
    setPublishError(null);
    try {
      const result = await onPublish(definition);
      setPublished(result);
      setUnpublished(false);
      setPublishState("idle");
    } catch (err) {
      setPublishState("error");
      setPublishError(err instanceof Error && err.message ? err.message : "Could not publish. Please try again.");
    }
  }

  async function handleUnpublish() {
    if (!onUnpublish || !published) return;
    setPublishState("unpublishing");
    setPublishError(null);
    try {
      await onUnpublish(published);
      setPublished(null);
      setUnpublished(true);
      setPublishState("idle");
    } catch (err) {
      setPublishState("error");
      setPublishError(err instanceof Error && err.message ? err.message : "Could not unpublish. Please try again.");
    }
  }

  function resolveShareUrl(): string {
    if (typeof window === "undefined") return publishedUrl!;
    try {
      return new URL(publishedUrl!, window.location.origin).toString();
    } catch {
      // window.location.origin isn't always a valid base (e.g. "null" for
      // about:blank/sandboxed contexts) — fall back to the raw URL rather
      // than fail the whole share action over a cosmetic absolute-vs-relative
      // difference.
      return publishedUrl!;
    }
  }

  async function handleShare() {
    if (!publishedUrl) return;
    const shareUrl = resolveShareUrl();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: definition.name, url: shareUrl });
          return;
        } catch {
          // user cancelled the share sheet — fall through to clipboard copy
        }
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch (err) {
      setPublishError(err instanceof Error && err.message ? err.message : "Could not copy the link.");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
      const meta = active.data.current?.meta as FieldTypeMeta | undefined;
      if (meta) addField(meta);
      return;
    }

    const overId = String(over.id);
    if (overId !== CANVAS_DROPPABLE_ID && overId !== activeId) {
      reorderFields(activeId, overId);
    }
  }

  return (
    <div className="fb-root">
      <TopBar
        saveState={indicatorState}
        onSave={onSave ? handleSave : undefined}
        onPublish={onPublish ? handlePublish : undefined}
        onUnpublish={onUnpublish ? handleUnpublish : undefined}
        unpublished={unpublished}
        publishState={publishState}
        publishedUrl={publishedUrl}
        publishError={publishError}
        onShare={handleShare}
      />
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="fb-layout" data-mode={mode}>
          {mode === "edit" ? (
            <>
              <aside className="fb-panel fb-panel-left" aria-label="Field palette">
                <Palette />
              </aside>
              <div className="fb-panel fb-panel-center">
                <Canvas />
              </div>
              <aside className="fb-panel fb-panel-right" aria-label="Inspector">
                <Inspector />
              </aside>
            </>
          ) : (
            <div className="fb-panel fb-panel-preview">
              <FormRenderer definition={definition} />
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}

export function Builder({ initialDefinition, storageKey, onSave, onPublish, onUnpublish, initialPublished }: BuilderProps) {
  const key = storageKey ?? `formora-builder:${initialDefinition.id}`;
  return (
    <BuilderProvider initialDefinition={initialDefinition} storageKey={key}>
      <BuilderInner
        storageKey={key}
        onSave={onSave}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        initialPublished={initialPublished}
      />
    </BuilderProvider>
  );
}

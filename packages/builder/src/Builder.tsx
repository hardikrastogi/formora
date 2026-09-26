import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { FormRenderer } from "@hardikrastogi/react";
import type { FormDefinition } from "@hardikrastogi/core";
import { BuilderProvider, useBuilder } from "./context";
import { Palette, PALETTE_DRAG_PREFIX } from "./Palette";
import { Canvas, CANVAS_DROPPABLE_ID } from "./Canvas";
import { Inspector } from "./Inspector";
import { TopBar, type PublishState } from "./TopBar";
import { useAutosave } from "./use-autosave";
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
   * Host-supplied autosave. When given, edits are sent here (debounced)
   * instead of to localStorage, and the save indicator reflects its result.
   * Throw to show "Could not save".
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

  const saveState = useAutosave(storageKey, definition, isDirty, markSaved, onSave);
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
        saveState={saveState}
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
  return (
    <BuilderProvider initialDefinition={initialDefinition}>
      <BuilderInner
        storageKey={storageKey ?? `formora-builder:${initialDefinition.id}`}
        onSave={onSave}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        initialPublished={initialPublished}
      />
    </BuilderProvider>
  );
}

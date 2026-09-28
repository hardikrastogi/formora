import { useBuilder } from "./context";

export type PublishState = "idle" | "publishing" | "unpublishing" | "error";
/** "dirty" only applies when a host provides onSave: edits exist that haven't been saved yet. */
export type IndicatorState = "saved" | "saving" | "error" | "dirty";

export interface TopBarProps {
  saveState: IndicatorState;
  /** Provide to show a Save button; the indicator then reflects manual saves instead of autosaving. */
  onSave?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  unpublished?: boolean;
  publishState?: PublishState;
  publishedUrl?: string | null;
  publishError?: string | null;
  onShare?: () => void;
}

export function TopBar({
  saveState,
  onSave,
  onPublish,
  onUnpublish,
  unpublished,
  publishState,
  publishedUrl,
  publishError,
  onShare,
}: TopBarProps) {
  const name = useBuilder((s) => s.definition.name);
  const setFormName = useBuilder((s) => s.setFormName);
  const mode = useBuilder((s) => s.mode);
  const setMode = useBuilder((s) => s.setMode);
  const undo = useBuilder((s) => s.undo);
  const redo = useBuilder((s) => s.redo);
  const canUndo = useBuilder((s) => s.past.length > 0);
  const canRedo = useBuilder((s) => s.future.length > 0);
  const select = useBuilder((s) => s.select);
  const hasSelection = useBuilder((s) => s.selectedFieldId !== null);
  const busy = publishState === "publishing" || publishState === "unpublishing";

  return (
    <div className="fb-topbar">
      <div className="fb-topbar-row">
        <input
          className="fb-form-name"
          value={name}
          onChange={(e) => setFormName(e.target.value)}
          aria-label="Form name"
        />
        <div className="fb-topbar-actions">
          <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo">
            Undo
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo">
            Redo
          </button>
          <button type="button" onClick={() => select(null)} disabled={!hasSelection}>
            Theme
          </button>
          <div className="fb-mode-toggle" role="group" aria-label="View mode">
            <button type="button" aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>
              Edit
            </button>
            <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>
              Preview
            </button>
          </div>
          {onSave ? (
            <button type="button" onClick={onSave} disabled={saveState === "saving"}>
              {saveState === "saving" ? "Saving…" : "Save"}
            </button>
          ) : null}
          {onPublish ? (
            <button type="button" onClick={onPublish} disabled={busy}>
              {publishState === "publishing" ? "Publishing…" : publishedUrl ? "Republish" : "Publish"}
            </button>
          ) : null}
          {onUnpublish && publishedUrl ? (
            <button type="button" onClick={onUnpublish} disabled={busy}>
              {publishState === "unpublishing" ? "Unpublishing…" : "Unpublish"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onShare}
            disabled={!publishedUrl}
            title={publishedUrl ? "Copy the share link" : "Publish the form first"}
          >
            Share
          </button>
          <span className="fb-save-state" role="status">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "error"
                ? "Could not save"
                : saveState === "dirty"
                  ? "Unsaved changes"
                  : "Saved"}
          </span>
        </div>
      </div>
      {publishError ? (
        <p className="fb-publish-error" role="alert">
          {publishError}
        </p>
      ) : null}
      {publishedUrl ? (
        <p className="fb-publish-url">
          Live at <a href={publishedUrl}>{publishedUrl}</a>
        </p>
      ) : unpublished ? (
        <p className="fb-publish-url">Unpublished. The link no longer accepts responses. Publish again to bring it back.</p>
      ) : null}
    </div>
  );
}

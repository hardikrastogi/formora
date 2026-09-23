import { useBuilder } from "./context";

export function TopBar({ saveState }: { saveState: "saved" | "saving" | "error" }) {
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

  return (
    <div className="fb-topbar">
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
        <button type="button" disabled title="Sharing arrives with hosted forms">
          Share
        </button>
        <span className="fb-save-state" role="status">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Could not save" : "Saved"}
        </span>
      </div>
    </div>
  );
}

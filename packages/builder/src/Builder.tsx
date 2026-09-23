import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { FormRenderer } from "@hardikrastogi/react";
import type { FormDefinition } from "@hardikrastogi/core";
import { BuilderProvider, useBuilder } from "./context";
import { Palette, PALETTE_DRAG_PREFIX } from "./Palette";
import { Canvas, CANVAS_DROPPABLE_ID } from "./Canvas";
import { Inspector } from "./Inspector";
import { TopBar } from "./TopBar";
import { useAutosave } from "./use-autosave";
import type { FieldTypeMeta } from "./store";

export interface BuilderProps {
  /** Starting form definition — pass a blank one from createBlankDefinition() for a new form. */
  initialDefinition: FormDefinition;
  /** Where to autosave to localStorage. Defaults to the form's id. */
  storageKey?: string;
}

function BuilderInner({ storageKey }: { storageKey: string }) {
  const definition = useBuilder((s) => s.definition);
  const mode = useBuilder((s) => s.mode);
  const isDirty = useBuilder((s) => s.isDirty);
  const markSaved = useBuilder((s) => s.markSaved);
  const addField = useBuilder((s) => s.addField);
  const reorderFields = useBuilder((s) => s.reorderFields);

  const saveState = useAutosave(storageKey, definition, isDirty, markSaved);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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
      <TopBar saveState={saveState} />
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

export function Builder({ initialDefinition, storageKey }: BuilderProps) {
  return (
    <BuilderProvider initialDefinition={initialDefinition}>
      <BuilderInner storageKey={storageKey ?? `formora-builder:${initialDefinition.id}`} />
    </BuilderProvider>
  );
}

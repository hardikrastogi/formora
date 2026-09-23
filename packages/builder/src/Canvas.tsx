import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FieldConfig } from "@hardikrastogi/core";
import { useBuilder } from "./context";

export const CANVAS_DROPPABLE_ID = "canvas";

function fieldOrder(rows: { columns: { fieldId: string }[] }[]): string[] {
  return rows.flatMap((row) => row.columns.map((c) => c.fieldId));
}

function SortableFieldRow({ field }: { field: FieldConfig }) {
  const selectedFieldId = useBuilder((s) => s.selectedFieldId);
  const select = useBuilder((s) => s.select);
  const removeField = useBuilder((s) => s.removeField);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const selected = selectedFieldId === field.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="fb-canvas-row"
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
    >
      <button
        type="button"
        className="fb-drag-handle"
        aria-label={`Reorder ${field.label}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <button
        type="button"
        className="fb-canvas-field"
        aria-pressed={selected}
        onClick={() => select(field.id)}
      >
        <span className="fb-canvas-field-label">
          {field.label}
          {field.required && <span aria-hidden="true"> *</span>}
        </span>
        <span className="fb-canvas-field-type">{field.type}</span>
      </button>
      <button
        type="button"
        className="fb-canvas-delete"
        aria-label={`Delete ${field.label}`}
        onClick={() => removeField(field.id)}
      >
        ✕
      </button>
    </div>
  );
}

export function Canvas() {
  const definition = useBuilder((s) => s.definition);
  const select = useBuilder((s) => s.select);
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });
  const order = fieldOrder(definition.layout.rows);
  const byId = new Map(definition.fields.map((f) => [f.id, f]));

  return (
    <div
      ref={setNodeRef}
      className="fb-canvas"
      data-over={isOver || undefined}
      aria-label="Form canvas"
      onClick={(e) => {
        if (e.target === e.currentTarget) select(null);
      }}
    >
      {order.length === 0 ? (
        <div className="fb-canvas-empty">Drag a field here, or click a field in the palette to add it.</div>
      ) : (
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {order.map((fieldId) => {
            const field = byId.get(fieldId);
            return field ? <SortableFieldRow key={fieldId} field={field} /> : null;
          })}
        </SortableContext>
      )}
    </div>
  );
}

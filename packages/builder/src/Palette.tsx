import { Command } from "cmdk";
import { useDraggable } from "@dnd-kit/core";
import { FIELD_CATALOG, FIELD_CATEGORIES } from "./field-catalog";
import { useBuilder } from "./context";
import type { FieldTypeMeta } from "./store";

export const PALETTE_DRAG_PREFIX = "palette:";

function PaletteItem({ meta }: { meta: FieldTypeMeta }) {
  const addField = useBuilder((s) => s.addField);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: PALETTE_DRAG_PREFIX + meta.type,
    data: { kind: "palette", meta },
  });

  return (
    <Command.Item
      ref={setNodeRef}
      value={meta.type}
      keywords={[meta.label, meta.category]}
      onSelect={() => addField(meta)}
      className="fb-palette-item"
      data-dragging={isDragging || undefined}
      aria-label={`Add ${meta.label} field`}
      {...attributes}
      {...listeners}
    >
      {meta.label}
    </Command.Item>
  );
}

// A cmdk-powered palette: arrow keys highlight an item, Enter adds it, same
// as clicking — on top of the drag-and-drop this already had. Kept docked in
// the sidebar (not a popup) so the available fields stay visible at a glance,
// which a modal command palette would hide behind a keystroke.
export function Palette() {
  return (
    <Command className="fb-palette" label="Field palette" loop>
      <Command.Input placeholder="Search fields" aria-label="Search fields" className="fb-palette-search" />
      <Command.List className="fb-palette-list">
        <Command.Empty className="fb-palette-empty">No fields match your search.</Command.Empty>
        {FIELD_CATEGORIES.map((category) => (
          <Command.Group key={category} heading={category} className="fb-palette-group">
            {FIELD_CATALOG.filter((f) => f.category === category).map((meta) => (
              <PaletteItem key={meta.type} meta={meta} />
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command>
  );
}

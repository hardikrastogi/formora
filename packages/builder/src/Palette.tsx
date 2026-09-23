import { useState } from "react";
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
    <button
      ref={setNodeRef}
      type="button"
      className="fb-palette-item"
      data-dragging={isDragging || undefined}
      onClick={() => addField(meta)}
      aria-label={`Add ${meta.label} field`}
      {...attributes}
      {...listeners}
    >
      {meta.label}
    </button>
  );
}

export function Palette() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? FIELD_CATALOG.filter((f) => f.label.toLowerCase().includes(q)) : FIELD_CATALOG;

  return (
    <div className="fb-palette" aria-label="Field palette">
      <input
        type="search"
        placeholder="Search fields"
        aria-label="Search fields"
        className="fb-palette-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {FIELD_CATEGORIES.map((category) => {
        const items = filtered.filter((f) => f.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} className="fb-palette-group">
            <h2 className="fb-palette-heading">{category}</h2>
            <div className="fb-palette-grid">
              {items.map((meta) => (
                <PaletteItem key={meta.type} meta={meta} />
              ))}
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <p className="fb-palette-empty">No fields match &quot;{query}&quot;.</p>}
    </div>
  );
}

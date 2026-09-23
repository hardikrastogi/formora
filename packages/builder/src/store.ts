import { create } from "zustand";
import { produce } from "immer";
import type { FieldConfig, FormDefinition } from "@hardikrastogi/core";

const HISTORY_LIMIT = 50;

export interface FieldTypeMeta {
  type: string;
  label: string;
  category: string;
  create: () => Pick<FieldConfig, "label"> & Partial<Omit<FieldConfig, "id" | "type" | "label">>;
}

interface BuilderState {
  definition: FormDefinition;
  selectedFieldId: string | null;
  mode: "edit" | "preview";
  past: FormDefinition[];
  future: FormDefinition[];
  isDirty: boolean;
}

interface BuilderActions {
  loadDefinition: (definition: FormDefinition) => void;
  setFormName: (name: string) => void;
  addField: (meta: FieldTypeMeta) => string;
  removeField: (fieldId: string) => void;
  updateField: (fieldId: string, patch: Partial<FieldConfig>) => void;
  reorderFields: (fieldId: string, overFieldId: string) => void;
  setFieldSpan: (fieldId: string, span: number) => void;
  select: (fieldId: string | null) => void;
  setMode: (mode: "edit" | "preview") => void;
  setTheme: (patch: Partial<FormDefinition["theme"]>) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

export type BuilderStore = BuilderState & BuilderActions;

function nextFieldId(definition: FormDefinition, type: string): string {
  const existing = new Set(definition.fields.map((f) => f.id));
  let n = 1;
  let id = `${type}_${n}`;
  while (existing.has(id)) {
    n += 1;
    id = `${type}_${n}`;
  }
  return id;
}

function withoutFieldFromLayout(definition: FormDefinition, fieldId: string): FormDefinition["layout"] {
  const rows = definition.layout.rows
    .map((row) => ({ ...row, columns: row.columns.filter((c) => c.fieldId !== fieldId) }))
    .filter((row) => row.columns.length > 0);
  return { rows };
}

function touch(draft: FormDefinition) {
  draft.updatedAt = new Date().toISOString();
}

export function createBuilderStore(initial: FormDefinition) {
  return create<BuilderStore>((set, get) => {
    function commit(recipe: (draft: FormDefinition) => void) {
      set((state) => {
        const nextDefinition = produce(state.definition, (draft) => {
          recipe(draft);
          touch(draft);
        });
        const past = [...state.past, state.definition].slice(-HISTORY_LIMIT);
        return { definition: nextDefinition, past, future: [], isDirty: true };
      });
    }

    return {
      definition: initial,
      selectedFieldId: null,
      mode: "edit",
      past: [],
      future: [],
      isDirty: false,

      loadDefinition: (definition) =>
        set({ definition, selectedFieldId: null, past: [], future: [], isDirty: false }),

      setFormName: (name) => commit((draft) => { draft.name = name; }),

      addField: (meta) => {
        const state = get();
        const id = nextFieldId(state.definition, meta.type);
        const base = meta.create();
        commit((draft) => {
          draft.fields.push({
            id,
            type: meta.type,
            required: false,
            defaultProps: {},
            ...base,
          });
          draft.layout.rows.push({ id: `row_${id}`, columns: [{ span: 12, fieldId: id }] });
        });
        set({ selectedFieldId: id });
        return id;
      },

      removeField: (fieldId) => {
        commit((draft) => {
          draft.fields = draft.fields.filter((f) => f.id !== fieldId);
          draft.layout = withoutFieldFromLayout(draft, fieldId);
          draft.logic.visibility = draft.logic.visibility.filter((r) => r.targetFieldId !== fieldId);
        });
        if (get().selectedFieldId === fieldId) set({ selectedFieldId: null });
      },

      updateField: (fieldId, patch) =>
        commit((draft) => {
          const field = draft.fields.find((f) => f.id === fieldId);
          if (field) Object.assign(field, patch);
        }),

      reorderFields: (fieldId, overFieldId) => {
        if (fieldId === overFieldId) return;
        commit((draft) => {
          const rows = draft.layout.rows;
          const fromIndex = rows.findIndex((r) => r.columns.some((c) => c.fieldId === fieldId));
          const toIndex = rows.findIndex((r) => r.columns.some((c) => c.fieldId === overFieldId));
          if (fromIndex === -1 || toIndex === -1) return;
          const [moved] = rows.splice(fromIndex, 1);
          rows.splice(toIndex, 0, moved);
        });
      },

      setFieldSpan: (fieldId, span) =>
        commit((draft) => {
          for (const row of draft.layout.rows) {
            const col = row.columns.find((c) => c.fieldId === fieldId);
            if (col) col.span = Math.min(12, Math.max(1, span));
          }
        }),

      select: (fieldId) => set({ selectedFieldId: fieldId }),
      setMode: (mode) => set({ mode }),

      setTheme: (patch) =>
        commit((draft) => {
          draft.theme = { ...draft.theme, ...patch };
        }),

      undo: () => {
        const state = get();
        const previous = state.past[state.past.length - 1];
        if (!previous) return;
        set({
          definition: previous,
          selectedFieldId: previous.fields.some((f) => f.id === state.selectedFieldId) ? state.selectedFieldId : null,
          past: state.past.slice(0, -1),
          future: [state.definition, ...state.future].slice(0, HISTORY_LIMIT),
          isDirty: true,
        });
      },

      redo: () => {
        const state = get();
        const [next, ...rest] = state.future;
        if (!next) return;
        set({
          definition: next,
          selectedFieldId: next.fields.some((f) => f.id === state.selectedFieldId) ? state.selectedFieldId : null,
          past: [...state.past, state.definition].slice(-HISTORY_LIMIT),
          future: rest,
          isDirty: true,
        });
      },

      markSaved: () => set({ isDirty: false }),
    };
  });
}

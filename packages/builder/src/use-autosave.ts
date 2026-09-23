import { useEffect, useRef, useState } from "react";
import type { FormDefinition } from "@hardikrastogi/core";

export type SaveState = "saved" | "saving" | "error";

/**
 * Stands in for the Phase 5 backend autosave: persists to localStorage on a
 * short debounce so refreshing the builder doesn't lose work. Swap the body
 * of `persist` for a real PATCH request once a server exists.
 */
export function useAutosave(
  storageKey: string,
  definition: FormDefinition,
  isDirty: boolean,
  markSaved: () => void,
): SaveState {
  const [state, setState] = useState<SaveState>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(definition));
        setState("saved");
        markSaved();
      } catch {
        setState("error");
      }
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [definition, isDirty, storageKey, markSaved]);

  return state;
}

export function loadFromStorage(storageKey: string): FormDefinition | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as FormDefinition) : null;
  } catch {
    return null;
  }
}

import { useEffect, useRef, useState } from "react";
import type { FormDefinition } from "@hardikrastogi/core";

export type SaveState = "saved" | "saving" | "error";

/**
 * Persists the definition on a short debounce. With `onSave` (a host-supplied
 * async function, typically a PATCH to a server) it saves there; without it,
 * it falls back to localStorage so the builder still works standalone.
 */
export function useAutosave(
  storageKey: string,
  definition: FormDefinition,
  isDirty: boolean,
  markSaved: () => void,
  onSave?: (definition: FormDefinition) => Promise<void>,
): SaveState {
  const [state, setState] = useState<SaveState>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(definition);
  latest.current = definition;
  // Kept in a ref so an inline (non-memoized) onSave doesn't restart the debounce every render.
  const save = useRef(onSave);
  save.current = onSave;

  useEffect(() => {
    if (!isDirty) return;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        if (save.current) {
          await save.current(definition);
          // Edits made while the request was in flight are not saved yet:
          // leave the state dirty so the next debounce picks them up.
          if (latest.current !== definition) return;
        } else {
          window.localStorage.setItem(storageKey, JSON.stringify(definition));
        }
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

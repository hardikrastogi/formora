import { useEffect, useRef, useState } from "react";
import type { FormDefinition } from "@hardikrastogi/core";

export type SaveState = "saved" | "saving" | "error";

/**
 * A short-debounced backup to localStorage, so a refresh, a closed tab, or a
 * crashed browser recovers exactly where editing left off. This runs
 * unconditionally — with or without a host-supplied `onSave` — because it is
 * not "the save": it is crash recovery for whatever hasn't been saved yet.
 *
 * It never calls a host function and never fails loudly: a full or disabled
 * localStorage just means no crash recovery for this session, not a broken
 * editor.
 */
export function useLocalBackup(storageKey: string, definition: FormDefinition, isDirty: boolean): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(definition));
      } catch {
        // Storage full, disabled, or unavailable (private browsing in some
        // browsers) — silently give up on crash recovery for this session.
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [definition, isDirty, storageKey]);
}

/**
 * Only used when the host gives no `onSave` at all (a standalone/demo
 * builder with nowhere else to persist to). In that case localStorage *is*
 * the save, so this drives the "Saved"/"Saving…" indicator and clears the
 * dirty flag — the same automatic behaviour the builder has always had
 * without a host backend. The moment a host provides `onSave`, saving
 * becomes a deliberate action (a Save button) instead: see Builder.tsx.
 */
export function useAutosaveWithoutHost(
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

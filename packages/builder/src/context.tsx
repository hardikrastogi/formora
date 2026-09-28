import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import type { FormDefinition } from "@hardikrastogi/core";
import { createBuilderStore, type BuilderStore } from "./store";
import { loadFromStorage } from "./use-autosave";

type Store = ReturnType<typeof createBuilderStore>;

const BuilderContext = createContext<Store | null>(null);

export function BuilderProvider({
  initialDefinition,
  storageKey,
  children,
}: {
  initialDefinition: FormDefinition;
  /**
   * When a local backup exists under this key (unsaved edits from this same
   * browser — see use-autosave.ts), it starts the store instead of
   * `initialDefinition`. This is what lets a refresh, a closed tab, or a
   * crashed browser resume exactly where editing left off, ahead of
   * whatever was last explicitly saved to the server.
   */
  storageKey: string;
  children: ReactNode;
}) {
  const storeRef = useRef<Store | null>(null);
  if (!storeRef.current) {
    const restored = loadFromStorage(storageKey);
    storeRef.current = createBuilderStore(restored ?? initialDefinition, Boolean(restored));
  }
  return <BuilderContext.Provider value={storeRef.current}>{children}</BuilderContext.Provider>;
}

export function useBuilder<T>(selector: (state: BuilderStore) => T): T {
  const store = useContext(BuilderContext);
  if (!store) throw new Error("useBuilder must be used inside a <BuilderProvider>");
  return useStore(store, selector);
}

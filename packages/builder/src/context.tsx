import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import type { FormDefinition } from "@hardikrastogi/core";
import { createBuilderStore, type BuilderStore } from "./store";

type Store = ReturnType<typeof createBuilderStore>;

const BuilderContext = createContext<Store | null>(null);

export function BuilderProvider({
  initialDefinition,
  children,
}: {
  initialDefinition: FormDefinition;
  children: ReactNode;
}) {
  const storeRef = useRef<Store | null>(null);
  storeRef.current ??= createBuilderStore(initialDefinition);
  return <BuilderContext.Provider value={storeRef.current}>{children}</BuilderContext.Provider>;
}

export function useBuilder<T>(selector: (state: BuilderStore) => T): T {
  const store = useContext(BuilderContext);
  if (!store) throw new Error("useBuilder must be used inside a <BuilderProvider>");
  return useStore(store, selector);
}

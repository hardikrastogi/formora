import type { Metadata } from "next";
import { BuilderPage } from "./builder-page";

export const metadata: Metadata = {
  title: "Builder",
  description: "Drag-and-drop authoring UI for building a Formora FormDefinition.",
};

export default function Page() {
  return <BuilderPage />;
}

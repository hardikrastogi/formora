import type { Metadata } from "next";
import { Playground } from "@/components/playground";

export const metadata: Metadata = {
  title: "Playground",
  description: "Edit a Formora FormDefinition as JSON and watch the form render live.",
};

export default function PlaygroundPage() {
  return <Playground />;
}

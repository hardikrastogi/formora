import { FieldPluginRegistry } from "@hardikrastogi/core";
import { checkboxPlugin } from "./fields/checkbox";
import { numberPlugin } from "./fields/number";
import { radioPlugin } from "./fields/radio";
import { selectPlugin } from "./fields/select";
import { datePlugin, emailPlugin, textPlugin, textareaPlugin } from "./fields/text-like";
import type { ReactFieldPlugin } from "./types";

export const defaultFieldPlugins: ReactFieldPlugin[] = [
  textPlugin,
  emailPlugin,
  numberPlugin,
  selectPlugin,
  datePlugin,
  checkboxPlugin,
  radioPlugin,
  textareaPlugin,
];

/** A fresh registry holding the 8 built-in field types. Register your own on top of it. */
export function createDefaultRegistry(): FieldPluginRegistry {
  const registry = new FieldPluginRegistry();
  for (const plugin of defaultFieldPlugins) registry.register(plugin);
  return registry;
}

export const defaultRegistry = createDefaultRegistry();

import { FieldPluginRegistry } from "@hardikrastogi/core";
import { checkboxPlugin } from "./fields/checkbox";
import { countryPlugin, currencyPlugin } from "./fields/locale";
import { numberPlugin } from "./fields/number";
import { radioPlugin } from "./fields/radio";
import { ratingPlugin } from "./fields/rating";
import { selectPlugin } from "./fields/select";
import { datePlugin, emailPlugin, textPlugin, textareaPlugin, timePlugin, urlPlugin } from "./fields/text-like";
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
  urlPlugin,
  timePlugin,
  ratingPlugin,
  countryPlugin,
  currencyPlugin,
];

/** A fresh registry holding the 13 built-in field types. Register your own on top of it. */
export function createDefaultRegistry(): FieldPluginRegistry {
  const registry = new FieldPluginRegistry();
  for (const plugin of defaultFieldPlugins) registry.register(plugin);
  return registry;
}

export const defaultRegistry = createDefaultRegistry();

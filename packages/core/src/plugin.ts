import type { z } from "zod";

export interface FieldValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Editor/Renderer are typed as `unknown` here so core stays framework-agnostic
 * (no React import). @hardikrastogi/react re-exports this interface with the
 * slots typed as real React component types.
 */
export interface FieldTypePlugin<TProps = Record<string, unknown>> {
  type: string;
  schema: z.ZodTypeAny;
  defaultProps: TProps;
  Editor?: unknown;
  Renderer?: unknown;
  validate?: (value: unknown, props: TProps) => FieldValidationResult;
}

export class FieldPluginRegistry {
  private plugins = new Map<string, FieldTypePlugin>();

  register(plugin: FieldTypePlugin): void {
    if (this.plugins.has(plugin.type)) {
      throw new Error(`Field type "${plugin.type}" is already registered`);
    }
    this.plugins.set(plugin.type, plugin);
  }

  get(type: string): FieldTypePlugin | undefined {
    return this.plugins.get(type);
  }

  has(type: string): boolean {
    return this.plugins.has(type);
  }

  list(): FieldTypePlugin[] {
    return Array.from(this.plugins.values());
  }
}

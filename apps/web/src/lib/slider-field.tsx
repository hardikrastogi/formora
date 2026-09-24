"use client";

import { z } from "zod";
import type { FieldRendererProps, ReactFieldPlugin } from "@hardikrastogi/react";

function SliderInput(p: FieldRendererProps) {
  const min = typeof p.props.min === "number" ? p.props.min : 0;
  const max = typeof p.props.max === "number" ? p.props.max : 10;
  const current = typeof p.value === "number" ? p.value : min;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <input
        id={p.inputId}
        type="range"
        min={min}
        max={max}
        value={current}
        disabled={p.disabled}
        aria-invalid={p.invalid || undefined}
        aria-describedby={p.describedBy}
        onChange={(e) => p.onChange(Number(e.target.value))}
        onBlur={p.onBlur}
        style={{ flex: 1 }}
      />
      <output htmlFor={p.inputId} style={{ minWidth: "2ch", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {current}
      </output>
    </div>
  );
}

export const sliderPlugin: ReactFieldPlugin = {
  type: "slider",
  schema: z.number(),
  defaultProps: { min: 0, max: 10 },
  emptyValue: 0,
  labelKind: "control",
  Renderer: SliderInput,
};

"use client";

import { z } from "zod";
import type { FieldRendererProps, ReactFieldPlugin } from "@hardikrastogi/react";

function RatingInput(p: FieldRendererProps) {
  const max = typeof p.props.max === "number" ? p.props.max : 5;
  const current = typeof p.value === "number" ? p.value : 0;

  return (
    <div
      id={p.inputId}
      role="radiogroup"
      tabIndex={-1}
      aria-labelledby={p.labelId}
      aria-invalid={p.invalid || undefined}
      aria-describedby={p.describedBy}
      style={{ display: "flex", gap: "0.25rem" }}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={current === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          disabled={p.disabled}
          onClick={() => p.onChange(n)}
          onBlur={p.onBlur}
          style={{
            background: "none",
            border: 0,
            padding: 0,
            fontSize: "1.75rem",
            lineHeight: 1,
            cursor: "pointer",
            color: n <= current ? "#f59e0b" : "#94a3b8",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export const ratingPlugin: ReactFieldPlugin = {
  type: "rating",
  schema: z.number().int().min(1),
  defaultProps: { max: 5 },
  labelKind: "group",
  Renderer: RatingInput,
};

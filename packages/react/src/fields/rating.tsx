import { z } from "zod";
import { cx, type FieldRendererProps, type ReactFieldPlugin } from "../types";

function RatingInput(p: FieldRendererProps) {
  const max = typeof p.props.max === "number" ? p.props.max : 5;
  const current = typeof p.value === "number" ? p.value : 0;

  return (
    <div
      id={p.inputId}
      className={cx("df-rating", p.classNames.input)}
      role="radiogroup"
      tabIndex={-1}
      aria-labelledby={p.labelId}
      aria-invalid={p.invalid || undefined}
      aria-describedby={p.describedBy}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          className="df-rating-star"
          aria-checked={current === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          disabled={p.disabled}
          data-filled={n <= current || undefined}
          onClick={() => p.onChange(n)}
          onBlur={p.onBlur}
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

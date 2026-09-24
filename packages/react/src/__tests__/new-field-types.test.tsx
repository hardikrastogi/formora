import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormDefinitionInput } from "@hardikrastogi/core";
import { FormRenderer } from "../FormRenderer";

const NOW = "2026-01-01T00:00:00.000Z";

function definition(overrides: Partial<FormDefinitionInput> = {}): FormDefinitionInput {
  return {
    id: "form_1",
    name: "Test form",
    schemaVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    fields: [],
    layout: { rows: [] },
    theme: {},
    logic: { visibility: [], calculated: [] },
    ...overrides,
  };
}

describe("url field", () => {
  it("renders as a url input and rejects a malformed value", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <FormRenderer
        definition={definition({
          fields: [{ id: "site", type: "url", label: "Website", required: true }],
          layout: { rows: [{ id: "r", columns: [{ span: 12, fieldId: "site" }] }] },
        })}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText(/Website/)).toHaveAttribute("type", "url");
    await user.type(screen.getByLabelText(/Website/), "not-a-url");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText(/Enter a valid URL/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts a well-formed URL", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <FormRenderer
        definition={definition({
          fields: [{ id: "site", type: "url", label: "Website" }],
          layout: { rows: [{ id: "r", columns: [{ span: 12, fieldId: "site" }] }] },
        })}
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText("Website"), "https://formora.dev");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ site: "https://formora.dev" }));
  });
});

describe("time field", () => {
  it("renders as a time input", () => {
    render(
      <FormRenderer
        definition={definition({
          fields: [{ id: "start", type: "time", label: "Start time" }],
          layout: { rows: [{ id: "r", columns: [{ span: 12, fieldId: "start" }] }] },
        })}
      />,
    );
    expect(screen.getByLabelText("Start time")).toHaveAttribute("type", "time");
  });
});

describe("rating field", () => {
  it("renders the configured number of stars and submits the chosen rating", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <FormRenderer
        definition={definition({
          fields: [{ id: "score", type: "rating", label: "Rate us", required: true, defaultProps: { max: 3 } }],
          layout: { rows: [{ id: "r", columns: [{ span: 12, fieldId: "score" }] }] },
        })}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    await user.click(screen.getByRole("radio", { name: "2 stars" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ score: 2 }));
  });

  it("blocks submit when a required rating is never chosen", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <FormRenderer
        definition={definition({
          fields: [{ id: "score", type: "rating", label: "Rate us", required: true }],
          layout: { rows: [{ id: "r", columns: [{ span: 12, fieldId: "score" }] }] },
        })}
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText('"Rate us" is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("country field", () => {
  it("renders a select with a real default country list and submits the ISO code", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <FormRenderer
        definition={definition({
          fields: [{ id: "nation", type: "country", label: "Country" }],
          layout: { rows: [{ id: "r", columns: [{ span: 12, fieldId: "nation" }] }] },
        })}
        onSubmit={onSubmit}
      />,
    );

    const select = screen.getByLabelText("Country") as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(50);
    await user.selectOptions(select, "IN");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ nation: "IN" }));
  });

  it("lets a field override the default option list", () => {
    render(
      <FormRenderer
        definition={definition({
          fields: [
            { id: "nation", type: "country", label: "Country", defaultProps: { options: ["Wakanda"] } },
          ],
          layout: { rows: [{ id: "r", columns: [{ span: 12, fieldId: "nation" }] }] },
        })}
      />,
    );
    const select = screen.getByLabelText("Country") as HTMLSelectElement;
    expect(select.options.length).toBe(2); // placeholder + the one override
    expect(screen.getByText("Wakanda")).toBeInTheDocument();
  });
});

describe("currency field", () => {
  it("renders a select with a real default currency list and submits the code", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <FormRenderer
        definition={definition({
          fields: [{ id: "money", type: "currency", label: "Currency" }],
          layout: { rows: [{ id: "r", columns: [{ span: 12, fieldId: "money" }] }] },
        })}
        onSubmit={onSubmit}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Currency"), "INR");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ money: "INR" }));
  });
});

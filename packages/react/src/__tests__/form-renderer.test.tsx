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
    fields: [
      { id: "first_name", type: "text", label: "First name", required: true },
      { id: "last_name", type: "text", label: "Last name" },
      { id: "email", type: "email", label: "Email", required: true },
      { id: "age", type: "number", label: "Age", validation: { min: 18 } },
      {
        id: "country",
        type: "select",
        label: "Country",
        defaultProps: { options: ["India", { label: "United States", value: "us" }] },
      },
      {
        id: "plan",
        type: "radio",
        label: "Plan",
        defaultProps: { options: ["Free", "Pro"] },
      },
      { id: "bio", type: "textarea", label: "Bio" },
      { id: "birthday", type: "date", label: "Birthday" },
      { id: "agree", type: "checkbox", label: "I agree", required: true },
    ],
    layout: {
      rows: [
        {
          id: "r1",
          columns: [
            { span: 6, fieldId: "first_name" },
            { span: 6, fieldId: "last_name" },
          ],
        },
        { id: "r2", columns: [{ span: 12, fieldId: "email" }] },
        {
          id: "r3",
          columns: [
            { span: 4, fieldId: "age" },
            { span: 8, fieldId: "country" },
          ],
        },
        { id: "r4", columns: [{ span: 12, fieldId: "plan" }] },
        { id: "r5", columns: [{ span: 12, fieldId: "bio" }] },
        { id: "r6", columns: [{ span: 12, fieldId: "birthday" }] },
        { id: "r7", columns: [{ span: 12, fieldId: "agree" }] },
      ],
    },
    theme: {},
    logic: { visibility: [], calculated: [] },
    ...overrides,
  };
}

describe("FormRenderer", () => {
  it("renders every field type from the definition with accessible labels", () => {
    render(<FormRenderer definition={definition()} />);
    expect(screen.getByLabelText(/First name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("type", "email");
    expect(screen.getByLabelText(/Age/)).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bio")).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByLabelText("Birthday")).toHaveAttribute("type", "date");
    expect(screen.getByRole("checkbox", { name: /I agree/ })).toBeInTheDocument();
  });

  it("maps layout spans to the grid", () => {
    const { container } = render(<FormRenderer definition={definition()} />);
    const firstRow = container.querySelector(".df-row")!;
    const spans = Array.from(firstRow.children).map((el) => (el as HTMLElement).style.getPropertyValue("--df-span"));
    expect(spans).toEqual(["6", "6"]);
  });

  it("blocks submit and shows errors when required fields are empty", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<FormRenderer definition={definition()} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText('"First name" is required')).toBeInTheDocument();
    expect(screen.getByText('"Email" is required')).toBeInTheDocument();
    expect(screen.getByText('"I agree" is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/First name/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/First name/)).toHaveFocus();
  });

  it("rejects a malformed email and an out-of-range number", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<FormRenderer definition={definition()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/First name/), "Hardik");
    await user.type(screen.getByLabelText(/Email/), "not-an-email");
    await user.type(screen.getByLabelText(/Age/), "12");
    await user.click(screen.getByRole("checkbox", { name: /I agree/ }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText('"Age" must be at least 18')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits clean, correctly typed answers when everything is valid", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<FormRenderer definition={definition()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/First name/), "Hardik");
    await user.type(screen.getByLabelText(/Email/), "hardik@example.com");
    await user.type(screen.getByLabelText(/Age/), "25");
    await user.selectOptions(screen.getByLabelText("Country"), "us");
    await user.click(screen.getByRole("radio", { name: "Pro" }));
    await user.type(screen.getByLabelText("Bio"), "Building Formora");
    await user.type(screen.getByLabelText("Birthday"), "1999-05-20");
    await user.click(screen.getByRole("checkbox", { name: /I agree/ }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      first_name: "Hardik",
      email: "hardik@example.com",
      age: 25,
      country: "us",
      plan: "Pro",
      bio: "Building Formora",
      birthday: "1999-05-20",
      agree: true,
    });
  });

  it("shows a message and keeps the form usable when onSubmit throws", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Server said no"));
    const user = userEvent.setup();
    render(<FormRenderer definition={definition({ fields: [{ id: "note", type: "text", label: "Note" }], layout: { rows: [] } })} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Server said no")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("renders fields missing from the layout instead of dropping them", () => {
    render(<FormRenderer definition={definition({ layout: { rows: [] } })} />);
    expect(screen.getByLabelText(/First name/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /I agree/ })).toBeInTheDocument();
  });

  it("shows a placeholder for an unregistered field type", () => {
    render(
      <FormRenderer
        definition={definition({
          fields: [{ id: "sig", type: "signature", label: "Signature" }],
          layout: { rows: [{ id: "r", columns: [{ span: 12, fieldId: "sig" }] }] },
        })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent('Unsupported field type "signature"');
  });

  it("explains why an invalid definition cannot render", () => {
    const bad = definition({ fields: [{ id: "a.b", type: "text", label: "Bad id" }], layout: { rows: [] } });
    render(<FormRenderer definition={bad} />);
    expect(screen.getByRole("alert")).toHaveTextContent("This form definition is invalid");
    expect(screen.getByRole("alert")).toHaveTextContent("fields.0.id");
  });

  it("applies theme tokens and per-field style as CSS variables", () => {
    const { container } = render(
      <FormRenderer
        definition={definition({
          theme: { colors: { primary: "#ff0000" }, radius: "lg", density: "spacious", font: "Inter" },
          fields: [{ id: "n", type: "text", label: "N", style: { textColor: "#00ff00", radius: "full" } }],
          layout: { rows: [{ id: "r", columns: [{ span: 12, fieldId: "n" }] }] },
        })}
      />,
    );
    const form = container.querySelector("form")!;
    expect(form.style.getPropertyValue("--df-primary")).toBe("#ff0000");
    expect(form.style.getPropertyValue("--df-radius")).toBe("12px");
    expect(form.style.getPropertyValue("--df-gap")).toBe("1.5rem");
    expect(form.style.getPropertyValue("--df-font")).toContain("Inter");
    const field = container.querySelector(".df-field") as HTMLElement;
    expect(field.style.getPropertyValue("--df-field-text")).toBe("#00ff00");
    expect(field.style.getPropertyValue("--df-field-radius")).toBe("9999px");
  });

  it("lets consumers add class names per slot", () => {
    const { container } = render(
      <FormRenderer definition={definition()} classNames={{ form: "my-form", input: "my-input", submit: "my-submit" }} />,
    );
    expect(container.querySelector("form")).toHaveClass("df-form", "my-form");
    expect(screen.getByLabelText(/First name/)).toHaveClass("df-input", "my-input");
    expect(screen.getByRole("button", { name: "Submit" })).toHaveClass("df-submit", "my-submit");
  });

  it("pre-fills answers from defaultValues", () => {
    render(<FormRenderer definition={definition()} defaultValues={{ first_name: "Asha", agree: true }} />);
    expect(screen.getByLabelText(/First name/)).toHaveValue("Asha");
    expect(screen.getByRole("checkbox", { name: /I agree/ })).toBeChecked();
  });
});

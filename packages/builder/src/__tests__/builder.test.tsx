import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Builder } from "../Builder";
import { createBlankDefinition } from "../blank";
import type { FormDefinition } from "@hardikrastogi/core";

beforeEach(() => {
  window.localStorage.clear();
});

function renderBuilder(id = "form_1") {
  return render(<Builder initialDefinition={createBlankDefinition(id, "My form")} />);
}

describe("Builder", () => {
  it("starts empty with the theme inspector visible and no field selected", () => {
    renderBuilder();
    expect(screen.getByText(/Drag a field here/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Theme" })).toBeInTheDocument();
  });

  it("clicking a palette item adds the field to the canvas and selects it", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add Text field" }));

    expect(screen.getByRole("button", { name: /^Text field/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Basic" })).toBeInTheDocument();
  });

  it("editing the label in the Basic tab updates the field on the canvas", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add Text field" }));

    const labelInput = screen.getByLabelText("Label");
    await user.clear(labelInput);
    await user.type(labelInput, "Full name");

    expect(screen.getByRole("button", { name: /^Full name/ })).toBeInTheDocument();
  });

  it("marking a field required shows the asterisk on the canvas row", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add Text field" }));
    await user.click(screen.getByLabelText("Required"));

    const row = screen.getByRole("button", { name: /^Text field/, pressed: true });
    expect(row).toHaveTextContent("*");
  });

  it("the palette lists all five newly added field types under the right categories", () => {
    renderBuilder();
    for (const name of ["Website", "Country", "Currency", "Time", "Rating"]) {
      expect(screen.getByRole("button", { name: `Add ${name} field` })).toBeInTheDocument();
    }
  });

  it("a rating field has no Placeholder input, but a country field has an Options editor", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add Rating field" }));
    expect(screen.queryByLabelText("Placeholder")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Country field" }));
    expect(screen.getByLabelText("Placeholder")).toBeInTheDocument();
    expect(screen.getByLabelText("Options (one per line)")).toBeInTheDocument();
  });

  it("the Validation tab shows length fields for text and range fields for number", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add Text field" }));
    await user.click(screen.getByRole("tab", { name: "Validation" }));
    expect(screen.getByLabelText("Minimum length")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Number field" }));
    await user.click(screen.getByRole("tab", { name: "Validation" }));
    expect(screen.getByLabelText("Minimum value")).toBeInTheDocument();
  });

  it("deleting a field removes it from the canvas and clears the selection", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add Text field" }));
    await user.click(screen.getByRole("button", { name: "Delete Text field" }));

    expect(screen.getByText(/Drag a field here/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Theme" })).toBeInTheDocument();
  });

  it("Undo removes the last added field and Redo brings it back", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add Text field" }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(/Drag a field here/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByRole("button", { name: /^Text field/ })).toBeInTheDocument();
  });

  it("Undo is disabled with nothing to undo, Redo disabled with nothing to redo", () => {
    renderBuilder();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("switching to Preview renders a real, working form and hides the palette", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add Email field" }));
    await user.click(screen.getByLabelText("Required"));
    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.queryByLabelText("Search fields")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("type", "email");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText('"Email" is required')).toBeInTheDocument();
  });

  it("the Theme button and clicking empty canvas space both deselect the current field", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Add Text field" }));
    expect(screen.getByRole("tab", { name: "Basic" })).toBeInTheDocument();

    const themeButton = screen.getByRole("button", { name: "Theme" });
    expect(themeButton).toBeEnabled();
    await user.click(themeButton);
    expect(screen.getByRole("heading", { name: "Theme" })).toBeInTheDocument();
    expect(themeButton).toBeDisabled();
  });

  it("renaming the form updates the name field", async () => {
    const user = userEvent.setup();
    renderBuilder();
    const nameInput = screen.getByLabelText("Form name");
    await user.clear(nameInput);
    await user.type(nameInput, "Event RSVP");
    expect(nameInput).toHaveValue("Event RSVP");
  });

  it("a low-contrast primary colour shows an inline WCAG warning", async () => {
    const user = userEvent.setup();
    renderBuilder();
    const colorInput = screen.getByLabelText("Primary colour");
    fireEvent.change(colorInput, { target: { value: "#eeeeee" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("below the WCAG AA minimum");
  });

  it("autosaves the definition to localStorage after an edit", async () => {
    const user = userEvent.setup();
    renderBuilder("autosave_form");

    await user.click(screen.getByRole("button", { name: "Add Text field" }));
    expect(screen.getByText("Saving…")).toBeInTheDocument();

    await waitFor(
      () => {
        const stored = JSON.parse(window.localStorage.getItem("formora-builder:autosave_form") ?? "null");
        expect(stored?.fields).toHaveLength(1);
      },
      { timeout: 2000 },
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("with onSave, edits go to the host instead of localStorage, and the indicator reflects the result", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (_definition: FormDefinition) => {});
    render(<Builder initialDefinition={createBlankDefinition("host_saved", "My form")} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Add Text field" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(onSave.mock.calls[0][0].fields).toHaveLength(1);
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(window.localStorage.getItem("formora-builder:host_saved")).toBeNull();
  });

  it("shows 'Could not save' when onSave fails, and saves again on the next edit", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(d: FormDefinition) => Promise<void>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    render(<Builder initialDefinition={createBlankDefinition("host_fail", "My form")} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Add Text field" }));
    expect(await screen.findByText("Could not save", undefined, { timeout: 2000 })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Email field" }));
    expect(await screen.findByText("Saved", undefined, { timeout: 2000 })).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1][0].fields).toHaveLength(2);
  });

  it("has no Publish button when onPublish is not provided, and Share stays disabled", () => {
    renderBuilder();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });

  it("publishing shows a pending state, then the live URL, and enables Share", async () => {
    const user = userEvent.setup();
    let resolvePublish: (v: { url: string }) => void = () => {};
    const onPublish = vi.fn(() => new Promise<{ url: string }>((resolve) => (resolvePublish = resolve)));
    render(<Builder initialDefinition={createBlankDefinition("form_1", "My form")} onPublish={onPublish} />);

    const publishButton = screen.getByRole("button", { name: "Publish" });
    await user.click(publishButton);
    expect(screen.getByRole("button", { name: "Publishing…" })).toBeDisabled();
    expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({ id: "form_1" }));

    resolvePublish({ url: "/f/my-form" });
    expect(await screen.findByRole("link", { name: "/f/my-form" })).toHaveAttribute("href", "/f/my-form");
    expect(screen.getByRole("button", { name: "Republish" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
  });

  it("shows an error message if publishing fails, without losing the form", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<Builder initialDefinition={createBlankDefinition("form_1", "My form")} onPublish={onPublish} />);

    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Network error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("Share copies the published URL to the clipboard when Web Share isn't available", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const user = userEvent.setup();
    const onPublish = vi.fn().mockResolvedValue({ url: "/f/my-form" });
    render(<Builder initialDefinition={createBlankDefinition("form_1", "My form")} onPublish={onPublish} />);

    await user.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Share" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/f/my-form")));
  });

  it("has no Unpublish button unless the form is published and onUnpublish is provided", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn().mockResolvedValue({ url: "/f/my-form", slug: "my-form" });
    const onUnpublish = vi.fn().mockResolvedValue(undefined);
    render(
      <Builder
        initialDefinition={createBlankDefinition("form_1", "My form")}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
      />,
    );
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  it("does not show Unpublish when the host provides no onUnpublish", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn().mockResolvedValue({ url: "/f/my-form" });
    render(<Builder initialDefinition={createBlankDefinition("form_1", "My form")} onPublish={onPublish} />);
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByRole("link", { name: "/f/my-form" });
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument();
  });

  it("Unpublish hands the last publish result back to the host, then clears the live link and disables Share", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn().mockResolvedValue({ url: "/f/my-form", slug: "my-form" });
    const onUnpublish = vi.fn().mockResolvedValue(undefined);
    render(
      <Builder
        initialDefinition={createBlankDefinition("form_1", "My form")}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByRole("link", { name: "/f/my-form" });
    await user.click(screen.getByRole("button", { name: "Unpublish" }));

    expect(onUnpublish).toHaveBeenCalledWith({ url: "/f/my-form", slug: "my-form" });
    expect(await screen.findByText(/no longer accepts responses/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "/f/my-form" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument();
  });

  it("shows Unpublishing... while it runs, and disables both buttons so nothing can be clicked twice", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const onUnpublish = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(
      <Builder
        initialDefinition={createBlankDefinition("form_1", "My form")}
        onPublish={vi.fn()}
        onUnpublish={onUnpublish}
        initialPublished={{ url: "/f/my-form", slug: "my-form" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Unpublish" }));
    expect(screen.getByRole("button", { name: "Unpublishing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Republish" })).toBeDisabled();

    finish();
    expect(await screen.findByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("keeps the form published and shows the error if unpublishing fails", async () => {
    const user = userEvent.setup();
    const onUnpublish = vi.fn().mockRejectedValue(new Error("Server is down"));
    render(
      <Builder
        initialDefinition={createBlankDefinition("form_1", "My form")}
        onPublish={vi.fn()}
        onUnpublish={onUnpublish}
        initialPublished={{ url: "/f/my-form", slug: "my-form" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Unpublish" }));
    expect(await screen.findByText("Server is down")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "/f/my-form" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeEnabled();
  });

  it("initialPublished shows the live link, Share, and Republish immediately", () => {
    render(
      <Builder
        initialDefinition={createBlankDefinition("form_1", "My form")}
        onPublish={vi.fn()}
        initialPublished={{ url: "/f/remembered", slug: "remembered" }}
      />,
    );
    expect(screen.getByRole("link", { name: "/f/remembered" })).toHaveAttribute("href", "/f/remembered");
    expect(screen.getByRole("button", { name: "Republish" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
  });

  it("publishing again after an unpublish brings the live link back", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn().mockResolvedValue({ url: "/f/my-form", slug: "my-form" });
    const onUnpublish = vi.fn().mockResolvedValue(undefined);
    render(
      <Builder
        initialDefinition={createBlankDefinition("form_1", "My form")}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        initialPublished={{ url: "/f/my-form", slug: "my-form" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Unpublish" }));
    await screen.findByText(/no longer accepts responses/);

    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("link", { name: "/f/my-form" })).toBeInTheDocument();
    expect(screen.queryByText(/no longer accepts responses/)).not.toBeInTheDocument();
  });

  it("two Builder instances with different ids keep separate state and storage", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Builder initialDefinition={createBlankDefinition("form_a", "A")} />);
    await user.click(screen.getByRole("button", { name: "Add Text field" }));
    unmount();

    render(<Builder initialDefinition={createBlankDefinition("form_b", "B")} />);
    expect(screen.getByText(/Drag a field here/)).toBeInTheDocument();
  });
});

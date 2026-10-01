import { expect, test } from "@playwright/test";
import { openNewBuilder } from "./auth-helpers";

test.beforeEach(async ({ page }) => {
  await openNewBuilder(page);
});

test("adding fields from the palette places them on the canvas in order", async ({ page }) => {
  await page.getByRole("option", { name: "Add Text field" }).click();
  await page.getByRole("option", { name: "Add Email field" }).click();

  const rows = page.locator(".fb-canvas-field-label");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveText("Text field");
  await expect(rows.nth(1)).toHaveText("Email");
});

test("selecting a field opens the inspector and editing the label updates the canvas", async ({ page }) => {
  await page.getByRole("option", { name: "Add Text field" }).click();
  await page.getByRole("tab", { name: "Basic" }).waitFor();

  const label = page.getByLabel("Label");
  await label.fill("Full name");
  await expect(page.locator(".fb-canvas-field-label")).toHaveText("Full name");
});

test("marking a field required adds an asterisk, and the Validation tab matches the field type", async ({ page }) => {
  await page.getByRole("option", { name: "Add Text field" }).click();
  await page.getByLabel("Required").click();
  await expect(page.locator(".fb-canvas-row")).toContainText("*");

  await page.getByRole("tab", { name: "Validation" }).click();
  await expect(page.getByLabel("Minimum length")).toBeVisible();
});

test("deleting a field returns the canvas to its empty state", async ({ page }) => {
  await page.getByRole("option", { name: "Add Text field" }).click();
  await page.getByRole("button", { name: "Delete Text field" }).click();
  await expect(page.getByText(/Drag a field here/)).toBeVisible();
});

test("Undo and Redo move the field list backward and forward", async ({ page }) => {
  await page.getByRole("option", { name: "Add Text field" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(/Drag a field here/)).toBeVisible();

  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.locator(".fb-canvas-field-label")).toHaveText("Text field");
});

test("the Theme button returns to theme settings after a field was selected", async ({ page }) => {
  await page.getByRole("option", { name: "Add Text field" }).click();
  await expect(page.getByRole("tab", { name: "Basic" })).toBeVisible();

  await page.getByRole("button", { name: "Theme" }).click();
  await expect(page.getByRole("heading", { name: "Theme" })).toBeVisible();
});

test("Preview renders a real, working, validated form built from the current fields", async ({ page }) => {
  await page.getByRole("option", { name: "Add Email field" }).click();
  await page.getByLabel("Required").click();
  await page.getByRole("button", { name: "Preview" }).click();

  await expect(page.getByRole("button", { name: "Search fields" })).toHaveCount(0);
  const email = page.getByLabel(/Email/);
  await expect(email).toHaveAttribute("type", "email");

  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText('"Email" is required')).toBeVisible();
});

test("a low-contrast primary colour shows an inline WCAG warning", async ({ page }) => {
  await page.getByLabel("Primary colour").fill("#eeeeee");
  await expect(page.getByText(/below the WCAG AA minimum/)).toBeVisible();
});

test("unsaved work survives a reload via the browser's own local storage, without ever hitting the server", async ({
  page,
}) => {
  // No Save click, and no request to /api/drafts should ever happen here —
  // reload-recovery is now a browser-only concern, separate from the
  // deliberate, explicit Save that persists to the account.
  let draftRequestSeen = false;
  page.on("request", (r) => {
    if (r.url().includes("/api/drafts/")) draftRequestSeen = true;
  });

  await page.getByLabel("Form name").fill("Reloaded form");
  await page.getByRole("option", { name: "Add Text field" }).click();
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  // The local backup is debounced (400ms) — wait for it to actually land before
  // reloading, or the reload can race ahead of the pending write and lose it.
  const id = new URL(page.url()).pathname.split("/").pop();
  await page.waitForFunction(
    (key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw).name ?? null) : null;
    },
    `formora-builder:${id}`,
    { timeout: 2000 },
  );

  await page.reload();
  await page.waitForSelector(".fb-root");
  await expect(page.getByLabel("Form name")).toHaveValue("Reloaded form");
  await expect(page.locator(".fb-canvas-field-label")).toHaveText("Text field");
  // Recovered work is still unsaved — it must not silently look "Saved".
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  expect(draftRequestSeen).toBe(false);
});

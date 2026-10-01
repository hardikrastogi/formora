import { expect, test } from "@playwright/test";
import { signIn, uniqueEmail } from "./auth-helpers";

const STAMP = "2026-01-01T00:00:00.000Z";

function definition(id: string, theme: Record<string, unknown>) {
  return {
    id,
    name: "Accent Border Test",
    schemaVersion: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    fields: [{ id: "name", type: "text", label: "Name", required: false }],
    layout: { rows: [{ id: "r1", columns: [{ span: 12, fieldId: "name" }] }] },
    theme,
    logic: { visibility: [], calculated: [] },
  };
}

function uniqueSlug(name: string): string {
  return `e2e-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test.describe("Theme accent border/heading: opt-in only, not on by default", () => {
  test("a form with no theme customization shows no border and no heading underline", async ({ page }) => {
    const slug = uniqueSlug("no-accent");
    await signIn(page.request, uniqueEmail("no-accent"));
    await page.request.post("/api/forms/publish", { data: { definition: definition(slug, {}) } });

    await page.goto(`/f/${slug}`);
    const form = page.locator(".df-form");
    await expect(form).toHaveCSS("border-width", "0px");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveCSS("border-bottom-width", "0px");
  });

  test("setting a primary colour alone (without accentBorder) still shows no border", async ({ page }) => {
    const slug = uniqueSlug("primary-only");
    await signIn(page.request, uniqueEmail("primary-only"));
    await page.request.post("/api/forms/publish", {
      data: { definition: definition(slug, { colors: { primary: "#ff0000" } }) },
    });

    await page.goto(`/f/${slug}`);
    await expect(page.locator(".df-form")).toHaveCSS("border-width", "0px");
  });

  test("accentBorder: true shows the form border and the heading underline in the primary colour", async ({
    page,
  }) => {
    const slug = uniqueSlug("accent-on");
    await signIn(page.request, uniqueEmail("accent-on"));
    await page.request.post("/api/forms/publish", {
      data: { definition: definition(slug, { accentBorder: true, colors: { primary: "#ff0000" } }) },
    });

    await page.goto(`/f/${slug}`);
    const form = page.locator(".df-form");
    await expect(form).toHaveCSS("border-width", "1px");
    await expect(form).toHaveCSS("border-color", "rgb(255, 0, 0)");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveCSS("border-bottom-width", "3px");
  });
});

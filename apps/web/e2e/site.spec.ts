import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const DOCS = [
  ["/docs", "Introduction"],
  ["/docs/installation", "Installation"],
  ["/docs/quickstart", "Quickstart"],
  ["/docs/form-definition", "FormDefinition"],
  ["/docs/field-types", "Field types"],
  ["/docs/theming", "Theming"],
  ["/docs/custom-fields", "Custom field types"],
  ["/docs/builder", "Builder"],
  ["/docs/api", "API reference"],
] as const;

test("home page introduces the product and links to docs and playground", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Forms as data." })).toBeVisible();
  await page.getByRole("link", { name: "Try the playground" }).click();
  await expect(page).toHaveURL(/\/playground$/);
  await page.goto("/");
  await page.getByRole("link", { name: "Read the docs" }).click();
  await expect(page).toHaveURL(/\/docs$/);
});

for (const [path, heading] of DOCS) {
  test("docs page " + path + " renders its heading", async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Docs" }).getByRole("link", { name: heading, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
}

test("docs sidebar navigates between pages", async ({ page }) => {
  await page.goto("/docs");
  await page.getByRole("navigation", { name: "Docs" }).getByRole("link", { name: "Theming" }).click();
  await expect(page).toHaveURL(/\/docs\/theming$/);
  await expect(page.getByRole("heading", { level: 1, name: "Theming" })).toBeVisible();
});

for (const path of ["/", "/docs", "/docs/quickstart", "/docs/form-definition", "/playground", "/builder"]) {
  test("no automatically detectable accessibility violations on " + path, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const summary = results.violations.map((v) => v.id + ": " + v.nodes.map((n) => n.target.join(" ")).join(" | "));
    expect(summary).toEqual([]);
  });
}

test.describe("phone-sized screen", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  for (const path of ["/", "/playground", ...DOCS.map(([docPath]) => docPath)]) {
    test(path + " does not scroll sideways", async ({ page }) => {
      await page.goto(path);
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(fits).toBe(true);
    });
  }
});

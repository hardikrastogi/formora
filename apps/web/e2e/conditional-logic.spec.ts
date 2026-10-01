import { ObjectId } from "mongodb";
import { expect, test } from "@playwright/test";
import { openNewBuilder, signIn, uniqueEmail, withDb } from "./auth-helpers";

const STAMP = "2026-01-01T00:00:00.000Z";

function definition(id: string) {
  return {
    id,
    name: "Conditional Logic Test",
    schemaVersion: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    fields: [
      { id: "has_company", type: "checkbox", label: "Do you have a company?", required: false },
      { id: "company_name", type: "text", label: "Company name", required: true },
      { id: "seats", type: "number", label: "Seats", required: false },
      { id: "price_per_seat", type: "number", label: "Price per seat", required: false },
      { id: "total", type: "number", label: "Total", required: false },
    ],
    layout: {
      rows: [
        { id: "r1", columns: [{ span: 12, fieldId: "has_company" }] },
        { id: "r2", columns: [{ span: 12, fieldId: "company_name" }] },
        { id: "r3", columns: [{ span: 4, fieldId: "seats" }] },
        { id: "r4", columns: [{ span: 4, fieldId: "price_per_seat" }] },
        { id: "r5", columns: [{ span: 4, fieldId: "total" }] },
      ],
    },
    theme: {},
    logic: {
      visibility: [
        {
          targetFieldId: "company_name",
          match: "all",
          conditions: [{ fieldId: "has_company", operator: "equals", value: true }],
        },
      ],
      calculated: [{ targetFieldId: "total", inputs: ["seats", "price_per_seat"], formula: "seats * price_per_seat" }],
    },
  };
}

function uniqueId(name: string): string {
  return `e2e-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test.describe("Conditional logic: visibleIf and calculated fields", () => {
  test("the public form hides/shows a field live and computes a read-only total live", async ({ page }) => {
    const slug = uniqueId("public-logic");
    await signIn(page.request, uniqueEmail("public-logic"));
    await page.request.post("/api/forms/publish", { data: { definition: definition(slug) } });

    await page.goto(`/f/${slug}`);
    await expect(page.getByLabel("Company name")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Do you have a company?" }).check();
    await expect(page.getByLabel("Company name")).toBeVisible();
    await page.getByRole("checkbox", { name: "Do you have a company?" }).uncheck();
    await expect(page.getByLabel("Company name")).toHaveCount(0);

    const total = page.getByLabel("Total");
    await expect(total).toBeDisabled();
    await page.getByLabel("Seats").fill("4");
    await page.getByLabel("Price per seat").fill("9");
    await expect(total).toHaveValue("36");

    // Submitting is blocked by nothing — company_name is hidden, so not required.
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Your submission has been recorded.")).toBeVisible();

    const stored = await withDb(async (db) => {
      const form = await db.collection("forms").findOne({ slug });
      return db.collection("submissions").findOne({ formId: form!._id });
    });
    expect(stored!.answers.total).toBe(36);
    expect(stored!.answers.company_name).toBeUndefined();
  });

  test("the required field becomes enforced once its condition makes it visible", async ({ page }) => {
    const slug = uniqueId("required-logic");
    await signIn(page.request, uniqueEmail("required-logic"));
    await page.request.post("/api/forms/publish", { data: { definition: definition(slug) } });

    await page.goto(`/f/${slug}`);
    await page.getByRole("checkbox", { name: "Do you have a company?" }).check();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText('"Company name" is required')).toBeVisible();

    await page.getByLabel("Company name").fill("Acme");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Your submission has been recorded.")).toBeVisible();
  });

  test("the server recomputes the calculated field, ignoring a forged submitted value", async ({ request }) => {
    const slug = uniqueId("forged-calc");
    await signIn(request, uniqueEmail("forged-calc"));
    await request.post("/api/forms/publish", { data: { definition: definition(slug) } });

    const res = await request.post(`/api/forms/${slug}/submit`, {
      data: {
        answers: { has_company: false, seats: 2, price_per_seat: 5, total: 999999 },
        idempotencyKey: "k1",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();

    const stored = await withDb((db) => db.collection("submissions").findOne({ _id: new ObjectId(body.submissionId) }));
    expect(stored!.answers.total).toBe(10);
  });

  test("the server never requires the hidden field, even if it's missing entirely from the posted answers", async ({
    request,
  }) => {
    const slug = uniqueId("server-hidden");
    await signIn(request, uniqueEmail("server-hidden"));
    await request.post("/api/forms/publish", { data: { definition: definition(slug) } });

    const res = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { has_company: false }, idempotencyKey: "k1" },
    });
    expect(res.status()).toBe(201);
  });

  test("the builder's Logic tab round-trips through publish: hidden field not required, calculated field overwritten", async ({
    page,
  }) => {
    await openNewBuilder(page, "logic-builder");
    await page.getByRole("button", { name: "Add Checkbox field" }).click();
    await page.getByRole("button", { name: "Add Text field" }).click();
    await page.getByRole("tab", { name: "Basic" }).click();
    await page.getByLabel("Required").check();
    await page.getByRole("tab", { name: "Logic" }).click();
    await page.getByRole("checkbox", { name: "Only show this field conditionally" }).check();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    const href = (await page.locator(".fb-publish-url a").getAttribute("href"))!;

    await page.goto(href);
    await expect(page.getByLabel(/Text field/)).toHaveCount(0);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Your submission has been recorded.")).toBeVisible();
  });
});

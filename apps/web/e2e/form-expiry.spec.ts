import { expect, test } from "@playwright/test";
import { openNewBuilder, withDb } from "./auth-helpers";

const STAMP = "2026-01-01T00:00:00.000Z";

function definition(id: string) {
  return {
    id,
    name: "Expiry Test Form",
    schemaVersion: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    fields: [{ id: "name", type: "text", label: "Name", required: false }],
    layout: { rows: [{ id: "r1", columns: [{ span: 12, fieldId: "name" }] }] },
    theme: {},
    logic: { visibility: [], calculated: [] },
  };
}

test.describe("Phase 5: form close date", () => {
  test("a future close date lets the form accept responses; a past one closes it immediately", async ({
    page,
    request,
  }) => {
    await openNewBuilder(page, "expiry-future");
    const slug = await page.evaluate(() => location.pathname.split("/").pop());

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const publishOk = await page.request.post("/api/forms/publish", {
      data: { definition: definition(slug!), closesAt: future },
    });
    expect(publishOk.status()).toBe(200);
    expect((await publishOk.json()).closesAt).toBe(future);

    const submitOk = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: {}, idempotencyKey: "k1" },
    });
    expect(submitOk.status()).toBe(201);

    const past = new Date(Date.now() - 60 * 1000).toISOString();
    const republish = await page.request.post("/api/forms/publish", {
      data: { definition: definition(slug!), closesAt: past },
    });
    expect(republish.status()).toBe(200);

    const submitAfterClose = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: {}, idempotencyKey: "k2" },
    });
    expect(submitAfterClose.status()).toBe(410);
  });

  test("the public page shows a closed message instead of the form once past the close date", async ({
    page,
  }) => {
    await openNewBuilder(page, "expiry-page");
    const slug = await page.evaluate(() => location.pathname.split("/").pop());
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    await page.request.post("/api/forms/publish", { data: { definition: definition(slug!), closesAt: past } });

    await page.goto(`/f/${slug}`);
    await expect(page.getByText(/This form closed to new responses on/)).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveCount(0);
  });

  test("republishing without mentioning closesAt keeps the existing one; sending null clears it", async ({
    page,
  }) => {
    await openNewBuilder(page, "expiry-keep");
    const slug = await page.evaluate(() => location.pathname.split("/").pop());
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await page.request.post("/api/forms/publish", { data: { definition: definition(slug!), closesAt: future } });

    // No closesAt key at all: unchanged.
    const kept = await page.request.post("/api/forms/publish", { data: { definition: definition(slug!) } });
    expect((await kept.json()).closesAt).toBe(future);

    // Explicit null: cleared.
    const cleared = await page.request.post("/api/forms/publish", {
      data: { definition: definition(slug!), closesAt: null },
    });
    expect((await cleared.json()).closesAt).toBeNull();

    const stored = await withDb(async (db) => {
      const form = await db.collection("forms").findOne({ slug });
      return form?.closesAt ?? null;
    });
    expect(stored).toBeNull();
  });

  test("an invalid closesAt value is rejected", async ({ page }) => {
    await openNewBuilder(page, "expiry-invalid");
    const slug = await page.evaluate(() => location.pathname.split("/").pop());
    const bad = await page.request.post("/api/forms/publish", {
      data: { definition: definition(slug!), closesAt: "not-a-date" },
    });
    expect(bad.status()).toBe(422);

    const wrongType = await page.request.post("/api/forms/publish", {
      data: { definition: definition(slug!), closesAt: 12345 },
    });
    expect(wrongType.status()).toBe(422);
  });

  test("the builder UI sets a close date on publish, shown on reload and on the dashboard", async ({ page }) => {
    await openNewBuilder(page, "expiry-ui");
    const builderUrl = page.url();
    const saved = page.waitForResponse((r) => r.url().includes("/api/drafts/") && r.request().method() === "PUT");
    await page.getByLabel("Form name").fill("Expiry UI Test");
    await page.getByRole("button", { name: "Add Text field" }).click();
    expect((await saved).ok()).toBe(true);

    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localValue = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
    await page.getByLabel("Closes").fill(localValue);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(page.getByLabel("Closes")).toHaveValue(localValue);

    await page.goto("/dashboard");
    await expect(page.getByText(/Closes \d/)).toBeVisible();

    // Clearing it and republishing removes the close date. A fresh navigation
    // (not goBack) so the builder's state is freshly mounted from the server,
    // not a soft-navigated instance that might hold a stale onPublish closure.
    await page.goto(builderUrl);
    await page.getByRole("button", { name: "Clear" }).click();
    // Explicitly wait for the publish response, not just the UI settling — the definition
    // is unchanged on this republish (only closesAt), which made the "Live at" text update
    // race ahead of the request actually completing.
    const republish = page.waitForResponse(
      (r) => r.url().includes("/api/forms/publish") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Republish" }).click();
    expect((await republish).ok()).toBe(true);
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByLabel("Closes")).toHaveValue("");
  });
});

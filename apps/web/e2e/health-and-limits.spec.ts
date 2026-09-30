import { expect, test } from "@playwright/test";
import { latestLink, openNewBuilder, signIn, uniqueEmail, withDb } from "./auth-helpers";

const STAMP = "2026-01-01T00:00:00.000Z";

function definition(id: string) {
  return {
    id,
    name: "Limits Test Form",
    schemaVersion: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    fields: [{ id: "name", type: "text", label: "Name", required: false }],
    layout: { rows: [{ id: "r1", columns: [{ span: 12, fieldId: "name" }] }] },
    theme: {},
    logic: { visibility: [], calculated: [] },
  };
}

function uniqueId(name: string): string {
  return `e2e-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function uniqueIp(): string {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

test.describe("Phase 5 hardening: health endpoints, maxResponses, limitOneResponsePerRespondent", () => {
  test("GET /api/health reports ok with no dependencies", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("GET /api/ready reports ok when the database is reachable", async ({ request }) => {
    const res = await request.get("/api/ready");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("maxResponses caps submissions via the API, and can be set, kept, and cleared through publish", async ({
    playwright,
    baseURL,
    request,
  }) => {
    const creator = await playwright.request.newContext({ baseURL });
    await signIn(creator, uniqueEmail("maxresp"));
    const slug = uniqueId("maxresp");

    const published = await creator.post("/api/forms/publish", {
      data: { definition: definition(slug), maxResponses: 1 },
    });
    expect(published.status()).toBe(200);
    expect((await published.json()).maxResponses).toBe(1);

    const first = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: {}, idempotencyKey: "k1" },
    });
    expect(first.status()).toBe(201);
    const second = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: {}, idempotencyKey: "k2" },
    });
    expect(second.status()).toBe(410);

    // No maxResponses key at all: unchanged.
    const kept = await creator.post("/api/forms/publish", { data: { definition: definition(slug) } });
    expect((await kept.json()).maxResponses).toBe(1);

    // Explicit null: cleared, and a third submission now succeeds.
    const cleared = await creator.post("/api/forms/publish", {
      data: { definition: definition(slug), maxResponses: null },
    });
    expect((await cleared.json()).maxResponses).toBeNull();
    const third = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: {}, idempotencyKey: "k3" },
    });
    expect(third.status()).toBe(201);

    await creator.dispose();
  });

  test("maxResponses rejects zero, negative, and non-integer values", async ({ playwright, baseURL }) => {
    const creator = await playwright.request.newContext({ baseURL });
    await signIn(creator, uniqueEmail("maxrespbad"));
    const slug = uniqueId("maxrespbad");
    for (const bad of [0, -1, 1.5, "5"]) {
      const res = await creator.post("/api/forms/publish", { data: { definition: definition(slug), maxResponses: bad } });
      expect(res.status()).toBe(422);
    }
    await creator.dispose();
  });

  test("limitOneResponsePerRespondent cannot be enabled on an anyone-mode form", async ({ playwright, baseURL }) => {
    const creator = await playwright.request.newContext({ baseURL });
    await signIn(creator, uniqueEmail("limitone-bad"));
    const slug = uniqueId("limitone-bad");
    const res = await creator.post("/api/forms/publish", {
      data: { definition: definition(slug), accessMode: "anyone", limitOneResponsePerRespondent: true },
    });
    expect(res.status()).toBe(422);
    await creator.dispose();
  });

  test("limitOneResponsePerRespondent blocks a second submission from the same verified identity", async ({
    playwright,
    baseURL,
    browser,
  }) => {
    const creator = await playwright.request.newContext({ baseURL });
    await signIn(creator, uniqueEmail("limitone-ok"));
    const slug = uniqueId("limitone-ok");
    const published = await creator.post("/api/forms/publish", {
      data: { definition: definition(slug), accessMode: "verified_email", limitOneResponsePerRespondent: true },
    });
    expect(published.status()).toBe(200);
    expect((await published.json()).limitOneResponsePerRespondent).toBe(true);

    const respondentEmail = uniqueEmail("limitone-respondent");
    const ip = uniqueIp();

    // Verify once, submit once, in one browser.
    const context1 = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
    const page1 = await context1.newPage();
    await page1.goto(`/f/${slug}`);
    await page1.getByLabel("Your email address").fill(respondentEmail);
    await page1.getByRole("button", { name: "Email me a link" }).click();
    const link1 = await latestLink(respondentEmail);
    await page1.goto(link1);
    await page1.getByRole("button", { name: "Continue to form" }).click();
    await page1.getByLabel("Name").fill("first response");
    await page1.getByRole("button", { name: "Submit" }).click();
    await expect(page1.getByText("Your submission has been recorded.")).toBeVisible();
    await context1.close();

    // Both verifications deliberately reuse the same email; clear its 60-second
    // resend cooldown so the second one isn't itself rate-limited, which would
    // otherwise just mask this test's actual point behind an unrelated 429.
    await withDb((db) => db.collection("verificationchallenges").deleteMany({ email: respondentEmail }));

    // A second browser, re-verifying the SAME email, must not be able to submit again.
    const context2 = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": uniqueIp() } });
    const page2 = await context2.newPage();
    await page2.goto(`/f/${slug}`);
    await page2.getByLabel("Your email address").fill(respondentEmail);
    await page2.getByRole("button", { name: "Email me a link" }).click();
    const link2 = await latestLink(respondentEmail);
    await page2.goto(link2);
    await page2.getByRole("button", { name: "Continue to form" }).click();
    await page2.getByLabel("Name").fill("second attempt");
    await page2.getByRole("button", { name: "Submit" }).click();
    await expect(page2.getByText(/already submitted a response/)).toBeVisible();
    await context2.close();

    await creator.dispose();
  });

  test("the builder UI sets max responses and the one-per-respondent toggle, both persisted", async ({ page }) => {
    await openNewBuilder(page, "limits-ui");
    await page.getByLabel("Form name").fill("Limits UI Test");
    await page.getByRole("button", { name: "Add Text field" }).click();

    const checkbox = page.getByRole("checkbox", { name: "Only one response per respondent" });
    await expect(checkbox).toBeDisabled();

    await page.getByLabel("Who can respond").selectOption("verified_email");
    await expect(checkbox).toBeEnabled();
    await checkbox.check();
    await page.getByLabel("Max responses").fill("50");

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(page.getByLabel("Max responses")).toHaveValue("50");
    await expect(page.getByRole("checkbox", { name: "Only one response per respondent" })).toBeChecked();

    // Switching back to anyone force-clears the one-per-respondent flag, in the UI too.
    await page.getByLabel("Who can respond").selectOption("anyone");
    await expect(page.getByRole("checkbox", { name: "Only one response per respondent" })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Only one response per respondent" })).toBeDisabled();
  });
});

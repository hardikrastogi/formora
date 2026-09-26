import { expect, test, type APIRequestContext } from "@playwright/test";

const STAMP = "2026-01-01T00:00:00.000Z";

function uniqueSlug(name: string): string {
  return `e2e-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function contactDefinition(id: string) {
  return {
    id,
    name: "E2E Contact Form",
    schemaVersion: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    fields: [
      { id: "name", type: "text", label: "Name", required: true },
      { id: "email", type: "email", label: "Email", required: true },
    ],
    layout: {
      rows: [
        { id: "r1", columns: [{ span: 12, fieldId: "name" }] },
        { id: "r2", columns: [{ span: 12, fieldId: "email" }] },
      ],
    },
    theme: {},
    logic: { visibility: [], calculated: [] },
  };
}

async function publish(request: APIRequestContext, slug: string) {
  const res = await request.post("/api/forms/publish", { data: { definition: contactDefinition(slug), slug } });
  expect(res.ok()).toBe(true);
  return res.json() as Promise<{ slug: string; url: string }>;
}

// These hit the same MongoDB across every Playwright worker, so each test
// uses its own randomly-generated slug — never the builder's shared demo
// slug — to stay isolated from tests running in parallel.
test.describe("Phase 5a: publish, submit, and hosting API", () => {
  test("publishing returns a working public URL, and the page has OG tags", async ({ request, page }) => {
    const slug = uniqueSlug("basic");
    const { url } = await publish(request, slug);
    expect(url).toBe(`/f/${slug}`);

    await page.goto(url);
    await expect(page.getByRole("heading", { name: "E2E Contact Form" })).toBeVisible();
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "E2E Contact Form");
  });

  test("submitting without required fields is rejected by the server, not just the browser", async ({ request }) => {
    const slug = uniqueSlug("required");
    await publish(request, slug);

    const res = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: {}, idempotencyKey: "k1" },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.errors.name).toBeTruthy();
    expect(body.errors.email).toBeTruthy();
  });

  test("a malformed email is rejected server-side even when a client would never have sent it", async ({ request }) => {
    const slug = uniqueSlug("emailcheck");
    await publish(request, slug);

    const res = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { name: "Ada", email: "not-an-email" }, idempotencyKey: "k1" },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.errors.email).toEqual(["Enter a valid email address"]);
  });

  test("a valid submission succeeds and is retrievable exactly once", async ({ request }) => {
    const slug = uniqueSlug("valid");
    await publish(request, slug);

    const res = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { name: "Ada", email: "ada@example.com" }, idempotencyKey: "k1" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.submissionId).toBeTruthy();
  });

  test("retrying the same submission (same idempotency key) never creates a duplicate", async ({ request }) => {
    const slug = uniqueSlug("idempotent");
    await publish(request, slug);
    const payload = { answers: { name: "Ada", email: "ada@example.com" }, idempotencyKey: "same-key" };

    const first = await request.post(`/api/forms/${slug}/submit`, { data: payload });
    const second = await request.post(`/api/forms/${slug}/submit`, { data: payload });
    expect(first.status()).toBe(201);
    expect(second.status()).toBe(201);

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(secondBody.submissionId).toBe(firstBody.submissionId);
  });

  test("a different idempotency key on the same answers creates a separate submission", async ({ request }) => {
    const slug = uniqueSlug("distinctkeys");
    await publish(request, slug);
    const answers = { name: "Ada", email: "ada@example.com" };

    const first = await request.post(`/api/forms/${slug}/submit`, { data: { answers, idempotencyKey: "key-a" } });
    const second = await request.post(`/api/forms/${slug}/submit`, { data: { answers, idempotencyKey: "key-b" } });

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(secondBody.submissionId).not.toBe(firstBody.submissionId);
  });

  test("unpublishing rejects new submissions but the public page for a never-published slug 404s", async ({
    request,
    page,
  }) => {
    const slug = uniqueSlug("unpublish");
    await publish(request, slug);

    const unpublishRes = await request.post(`/api/forms/${slug}/unpublish`);
    expect(unpublishRes.ok()).toBe(true);

    const submitRes = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { name: "Ada", email: "ada@example.com" }, idempotencyKey: "after-unpublish" },
    });
    expect(submitRes.status()).toBe(410);

    const pageRes = await page.goto(`/f/${slug}`);
    expect(pageRes?.status()).toBe(404);

    const neverPublishedRes = await page.goto(`/f/${uniqueSlug("never-existed")}`);
    expect(neverPublishedRes?.status()).toBe(404);
  });

  test("republishing the same slug creates a new version without breaking the old one's submission link", async ({
    request,
  }) => {
    const slug = uniqueSlug("republish");
    await publish(request, slug);
    const submitRes = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { name: "Ada", email: "ada@example.com" }, idempotencyKey: "v1-submission" },
    });
    expect(submitRes.status()).toBe(201);

    // Republish with an extra required field — a genuinely different definition.
    const updated = contactDefinition(slug);
    updated.fields.push({ id: "phone", type: "text", label: "Phone", required: true });
    updated.layout.rows.push({ id: "r3", columns: [{ span: 12, fieldId: "phone" }] });
    const republishRes = await request.post("/api/forms/publish", { data: { definition: updated, slug } });
    expect(republishRes.ok()).toBe(true);

    // The new version now requires "phone" — the old submission is untouched,
    // but a new one against the current version must include it.
    const missingPhone = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { name: "Bo", email: "bo@example.com" }, idempotencyKey: "v2-missing-phone" },
    });
    expect(missingPhone.status()).toBe(422);

    const withPhone = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { name: "Bo", email: "bo@example.com", phone: "555" }, idempotencyKey: "v2-with-phone" },
    });
    expect(withPhone.status()).toBe(201);
  });
});

test.describe.serial("Phase 5a: builder UI publishes and shares a real link", () => {
  test("Publish shows the live URL in the builder, and the link actually works", async ({ page }) => {
    await page.goto("/builder");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector(".fb-root");

    await page.getByLabel("Form name").fill("Builder UI Publish Test");
    await page.getByRole("button", { name: "Add Text field" }).click();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });

    const href = await page.locator(".fb-publish-url a").getAttribute("href");
    expect(href).toMatch(/^\/f\//);

    const publicPage = await page.context().newPage();
    const res = await publicPage.goto(href!);
    expect(res?.ok()).toBe(true);
    await expect(publicPage.getByRole("heading", { name: "Builder UI Publish Test" })).toBeVisible();
  });

  test("Unpublish really stops the link, survives a page reload, and Publish brings it back", async ({ page }) => {
    await page.goto("/builder");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector(".fb-root");

    await page.getByLabel("Form name").fill("Unpublish Flow Test");
    await page.getByRole("button", { name: "Add Text field" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    const href = (await page.locator(".fb-publish-url a").getAttribute("href"))!;
    const slug = href.replace("/f/", "");

    // The published state must survive a reload, or Unpublish would vanish the moment you refresh.
    await page.reload();
    await page.waitForSelector(".fb-root");
    await expect(page.getByText(/^Live at/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();

    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/no longer accepts responses/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share" })).toBeDisabled();

    // ...and it is genuinely off for the outside world, not just hidden in the builder.
    const closedPage = await page.context().newPage();
    expect((await closedPage.goto(href))?.status()).toBe(404);
    const submit = await page.request.post(`/api/forms/${slug}/submit`, {
      data: { answers: {}, idempotencyKey: "after-ui-unpublish" },
    });
    expect(submit.status()).toBe(410);

    // Unpublished state also survives a reload (no stale "Live at" link and no Unpublish button).
    await page.reload();
    await page.waitForSelector(".fb-root");
    await expect(page.getByText(/^Live at/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    expect((await closedPage.goto(href))?.status()).toBe(200);
  });
});

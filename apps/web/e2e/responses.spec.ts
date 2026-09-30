import { expect, test } from "@playwright/test";
import { openNewBuilder, signIn, uniqueEmail } from "./auth-helpers";

const STAMP = "2026-01-01T00:00:00.000Z";

function definition(id: string) {
  return {
    id,
    name: "Responses Test Form",
    schemaVersion: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    fields: [
      { id: "name", type: "text", label: "Name", required: false },
      { id: "notes", type: "text", label: "Notes", required: false },
    ],
    layout: { rows: [{ id: "r1", columns: [{ span: 6, fieldId: "name" }, { span: 6, fieldId: "notes" }] }] },
    theme: {},
    logic: { visibility: [], calculated: [] },
  };
}

function uniqueId(name: string): string {
  return `e2e-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function submit(request: import("@playwright/test").APIRequestContext, slug: string, name: string, key: string) {
  const res = await request.post(`/api/forms/${slug}/submit`, {
    data: { answers: { name, notes: "" }, idempotencyKey: key },
  });
  expect(res.status()).toBe(201);
}

test.describe("Phase 5d: response dashboard", () => {
  test("lists responses, newest first by default, with a working search box", async ({ page }) => {
    await signIn(page.request, uniqueEmail("resplist"));
    const slug = uniqueId("resplist");
    await page.request.post("/api/forms/publish", { data: { definition: definition(slug) } });

    await submit(page.request, slug, "Alice", "k1");
    await submit(page.request, slug, "Bob", "k2");

    await page.goto(`/forms/${slug}/responses`);
    await expect(page.getByText("2 responses")).toBeVisible();
    const items = page.locator("ul li");
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText("Bob"); // newest first

    await page.getByLabel("Search responses").fill("alice");
    await expect(page.locator("ul li")).toHaveCount(1);
    await expect(page.locator("ul li")).toContainText("Alice");

    await page.getByLabel("Search responses").fill("nobody-matches-this");
    await expect(page.getByText("No responses match your search.")).toBeVisible();
  });

  test("sort toggle flips the order", async ({ page }) => {
    await signIn(page.request, uniqueEmail("respsort"));
    const slug = uniqueId("respsort");
    await page.request.post("/api/forms/publish", { data: { definition: definition(slug) } });
    await submit(page.request, slug, "First", "k1");
    await submit(page.request, slug, "Second", "k2");

    await page.goto(`/forms/${slug}/responses`);
    await expect(page.locator("ul li").first()).toContainText("Second");

    await page.getByRole("button", { name: "Newest first" }).click();
    await expect(page.locator("ul li").first()).toContainText("First");
  });

  test("pagination loads more responses via cursor", async ({ playwright, baseURL }) => {
    const creator = await playwright.request.newContext({ baseURL });
    await signIn(creator, uniqueEmail("resppage"));
    const slug = uniqueId("resppage");
    await creator.post("/api/forms/publish", { data: { definition: definition(slug) } });
    for (let i = 0; i < 3; i++) {
      await submit(creator, slug, `Respondent ${i}`, `k${i}`);
    }

    // A small limit forces pagination with only 3 real responses.
    const first = await creator.get(`/api/forms/${slug}/responses?limit=2`);
    const firstBody = await first.json();
    expect(firstBody.responses).toHaveLength(2);
    expect(firstBody.nextCursor).not.toBeNull();
    expect(firstBody.totalCount).toBe(3);

    const second = await creator.get(`/api/forms/${slug}/responses?limit=2&cursor=${firstBody.nextCursor}`);
    const secondBody = await second.json();
    expect(secondBody.responses).toHaveLength(1);
    expect(secondBody.nextCursor).toBeNull();

    // No overlap between pages.
    const firstIds = new Set(firstBody.responses.map((r: { id: string }) => r.id));
    expect(firstIds.has(secondBody.responses[0].id)).toBe(false);

    await creator.dispose();
  });

  test("the detail view shows full answers, labelled, against the version actually answered", async ({ page }) => {
    await signIn(page.request, uniqueEmail("respdetail"));
    const slug = uniqueId("respdetail");
    await page.request.post("/api/forms/publish", { data: { definition: definition(slug) } });
    const res = await page.request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { name: "Detail Test", notes: "some notes" }, idempotencyKey: "k1" },
    });
    const { submissionId } = await res.json();

    await page.goto(`/forms/${slug}/responses/${submissionId}`);
    await expect(page.getByText("Name")).toBeVisible();
    await expect(page.getByText("Detail Test")).toBeVisible();
    await expect(page.getByText("Notes", { exact: true })).toBeVisible();
    await expect(page.getByText("some notes")).toBeVisible();
  });

  test("export streams a CSV with the expected header and rows", async ({ playwright, baseURL }) => {
    const creator = await playwright.request.newContext({ baseURL });
    await signIn(creator, uniqueEmail("respexport"));
    const slug = uniqueId("respexport");
    await creator.post("/api/forms/publish", { data: { definition: definition(slug) } });
    await submit(creator, slug, "Export Me", "k1");

    const res = await creator.get(`/api/forms/${slug}/responses/export`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toContain(`${slug}-responses.csv`);
    const body = await res.text();
    const lines = body.trim().split("\r\n");
    expect(lines[0]).toBe("Name,Notes,Submitted at,Last edited at,Revision,Verified respondent");
    expect(lines[1]).toContain("Export Me");

    await creator.dispose();
  });

  test("a non-owner cannot list, view, or export another creator's responses", async ({ playwright, baseURL, page }) => {
    const owner = await playwright.request.newContext({ baseURL });
    await signIn(owner, uniqueEmail("respowner"));
    const slug = uniqueId("respowner");
    await owner.post("/api/forms/publish", { data: { definition: definition(slug) } });
    const submitRes = await owner.post(`/api/forms/${slug}/submit`, {
      data: { answers: { name: "Private", notes: "" }, idempotencyKey: "k1" },
    });
    const { submissionId } = await submitRes.json();

    const stranger = await playwright.request.newContext({ baseURL });
    await signIn(stranger, uniqueEmail("respstranger"));

    expect((await stranger.get(`/api/forms/${slug}/responses`)).status()).toBe(404);
    expect((await stranger.get(`/api/forms/${slug}/responses/${submissionId}`)).status()).toBe(404);
    expect((await stranger.get(`/api/forms/${slug}/responses/export`)).status()).toBe(404);

    // The pages themselves 404 for a signed-in non-owner too, not just the API.
    await page.context().addCookies(await stranger.storageState().then((s) => s.cookies));
    const listPage = await page.goto(`/forms/${slug}/responses`);
    expect(listPage?.status()).toBe(404);
    const detailPage = await page.goto(`/forms/${slug}/responses/${submissionId}`);
    expect(detailPage?.status()).toBe(404);

    await owner.dispose();
    await stranger.dispose();
  });

  test("signed-out visitors are sent to sign in, not shown any response data", async ({ page }) => {
    await page.goto(`/forms/${uniqueId("nosuchform")}/responses`);
    await expect(page).toHaveURL(/\/signin/);
  });

  test("the dashboard links to a published form's responses", async ({ page }) => {
    await openNewBuilder(page, "resplink");
    await page.getByRole("button", { name: "Add Text field" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });

    await page.getByRole("link", { name: "All my forms" }).click();
    await expect(page.getByRole("link", { name: "Responses" })).toBeVisible();
  });
});

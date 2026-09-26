import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { latestLink, openNewBuilder, signIn, uniqueEmail } from "./auth-helpers";

const STAMP = "2026-01-01T00:00:00.000Z";

function definition(id: string, name = "Owned form") {
  return {
    id,
    name,
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

test.describe("Phase 5b: creator accounts", () => {
  test("the builder and dashboard send signed-out visitors to sign in", async ({ page }) => {
    await page.goto("/builder/new");
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByRole("heading", { name: "Sign in to Formora" })).toBeVisible();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("signing in with an emailed link works from the real form, and the link is single-use", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("magic");
    await page.goto("/signin?next=/dashboard");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    const link = await latestLink(email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "My forms" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign out" })).toBeVisible();

    // A second browser using the same link must not get in: it was consumed.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(link);
    const session = await otherPage.request.get("/api/auth/session");
    expect((await session.json())?.user).toBeUndefined();
    await other.close();
  });

  test("an invalid email is rejected before any link is sent", async ({ page }) => {
    await page.goto("/signin");
    // The header's Sign in link only appears once the page has hydrated, so the form is live by then.
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Sign in" })).toBeVisible();
    // Skip the browser's own email check so the server-side check is what gets exercised.
    await page.locator("form").evaluate((form: HTMLFormElement) => (form.noValidate = true));
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });

  test("a signed-in visitor is never redirected off-site through the next parameter", async ({ page }) => {
    await signIn(page.request, uniqueEmail("redirect"));
    await page.goto("/signin?next=//evil.example.com");
    await expect(page).toHaveURL(/localhost:\d+\/dashboard$/);
  });

  test("publishing, unpublishing and saving drafts all require being signed in", async ({ request }) => {
    const publish = await request.post("/api/forms/publish", { data: { definition: definition("anon-form") } });
    expect(publish.status()).toBe(401);
    expect((await request.post("/api/forms/anything/unpublish")).status()).toBe(401);
    const save = await request.put("/api/drafts/anon-form", { data: { definition: definition("anon-form") } });
    expect(save.status()).toBe(401);
  });

  test("only the owner can republish or unpublish a form, and drafts are private", async ({ playwright, baseURL }) => {
    const ownerReq = await playwright.request.newContext({ baseURL });
    const otherReq = await playwright.request.newContext({ baseURL });
    await signIn(ownerReq, uniqueEmail("owner"));
    await signIn(otherReq, uniqueEmail("intruder"));
    const id = uniqueId("ownership");

    const first = await ownerReq.post("/api/forms/publish", { data: { definition: definition(id) } });
    expect(first.ok()).toBe(true);

    // The intruder cannot take over the link, switch it off, or read its draft.
    const takeover = await otherReq.post("/api/forms/publish", { data: { definition: definition(id, "Hijacked") } });
    expect(takeover.status()).toBe(403);
    expect((await otherReq.post(`/api/forms/${id}/unpublish`)).status()).toBe(404);

    await ownerReq.put(`/api/drafts/${id}`, { data: { definition: definition(id) } });
    expect((await otherReq.get(`/api/drafts/${id}`)).status()).toBe(404);
    expect((await ownerReq.get(`/api/drafts/${id}`)).status()).toBe(200);

    // The public page still shows the owner's version, not the hijack attempt.
    const publicPage = await ownerReq.get(`/f/${id}`);
    expect(await publicPage.text()).toContain("Owned form");

    // The owner still can.
    expect((await ownerReq.post(`/api/forms/${id}/unpublish`)).ok()).toBe(true);
    expect((await ownerReq.post("/api/forms/publish", { data: { definition: definition(id) } })).ok()).toBe(true);

    await ownerReq.dispose();
    await otherReq.dispose();
  });

  test("a draft must match its URL id, and an invalid id is refused", async ({ request }) => {
    await signIn(request, uniqueEmail("draft"));
    const mismatch = await request.put("/api/drafts/one-id", { data: { definition: definition("another-id") } });
    expect(mismatch.status()).toBe(422);
    const bad = await request.put("/api/drafts/Bad_ID!", { data: { definition: definition("Bad_ID!") } });
    expect(bad.status()).toBe(400);
  });

  test("a new form appears on the dashboard once saved, and reopens from there", async ({ page }) => {
    await openNewBuilder(page, "dash");
    const saved = page.waitForResponse((r) => r.url().includes("/api/drafts/") && r.request().method() === "PUT");
    await page.getByLabel("Form name").fill("Dashboard listing test");
    expect((await saved).ok()).toBe(true);

    await page.getByRole("link", { name: "All my forms" }).click();
    await page.getByRole("link", { name: "Dashboard listing test" }).click();
    await expect(page.getByLabel("Form name")).toHaveValue("Dashboard listing test");
  });

  test("autosave failures are shown, not swallowed", async ({ page }) => {
    await openNewBuilder(page, "failsave");
    await page.route("**/api/drafts/**", (route) => route.fulfill({ status: 500, body: "{}" }));
    await page.getByLabel("Form name").fill("Will not save");
    await expect(page.getByText("Could not save")).toBeVisible();
  });

  test("no automatically detectable accessibility violations on the builder and dashboard", async ({ page }) => {
    await openNewBuilder(page, "a11y");
    for (const path of [page.url(), "/dashboard"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).analyze();
      const summary = results.violations.map((v) => v.id + ": " + v.nodes.map((n) => n.target.join(" ")).join(" | "));
      expect(summary).toEqual([]);
    }
  });
});


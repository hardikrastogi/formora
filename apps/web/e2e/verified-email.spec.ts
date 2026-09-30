import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { closeBuilderSettings, latestLink, openBuilderSettings, openNewBuilder, signIn, uniqueEmail, withDb } from "./auth-helpers";

// Just the part of Playwright's fixture these helpers use.
type Playwright = { request: { newContext(options?: { baseURL?: string }): Promise<APIRequestContext> } };

const STAMP = "2026-01-01T00:00:00.000Z";
const SECRET_LABEL = "Confidential detail";

function definition(id: string) {
  return {
    id,
    name: "Verified Form",
    schemaVersion: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    fields: [{ id: "detail", type: "text", label: SECRET_LABEL, required: true }],
    layout: { rows: [{ id: "r1", columns: [{ span: 12, fieldId: "detail" }] }] },
    theme: {},
    logic: { visibility: [], calculated: [] },
  };
}

// Lowercase only: the server slugifies whatever id it's given (see lib/slug.ts),
// so a mixed-case id here would silently stop matching the URLs built from it.
function uniqueId(name: string): string {
  return `e2e-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`.toLowerCase();
}

// Each test gets its own "network address" so the per-address rate limit never crosses tests.
function uniqueIp(): string {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

async function creatorPublishes(
  request: APIRequestContext,
  slug: string,
  accessMode?: "anyone" | "verified_email",
) {
  const res = await request.post("/api/forms/publish", { data: { definition: definition(slug), accessMode } });
  expect(res.ok()).toBe(true);
}

/** A creator in their own context publishes a verified-email form. */
async function publishedVerifiedForm(playwright: Playwright, baseURL: string | undefined, name: string) {
  const creator = await playwright.request.newContext({ baseURL });
  await signIn(creator, uniqueEmail("creator"));
  const slug = uniqueId(name);
  await creatorPublishes(creator, slug, "verified_email");
  return { creator, slug };
}

function tokenOf(link: string): string {
  return new URL(link).searchParams.get("token")!;
}

/** Runs the whole verification through the API and leaves the cookie on `respondent`. */
async function verify(respondent: APIRequestContext, slug: string, email: string, ip: string) {
  const asked = await respondent.post(`/api/forms/${slug}/verify/request`, {
    data: { email },
    headers: { "x-forwarded-for": ip },
  });
  expect(asked.status()).toBe(200);
  const token = tokenOf(await latestLink(email));
  const confirmed = await respondent.post(`/api/forms/${slug}/verify/confirm`, { data: { token } });
  expect(confirmed.status()).toBe(200);
  return token;
}

test.describe("Phase 5c: verified-email respondents", () => {
  test("an unverified visitor sees only the email step; the questions are never sent", async ({
    playwright,
    baseURL,
    page,
  }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "gate");

    const res = await page.goto(`/f/${slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Verified Form" })).toBeVisible();
    await expect(page.getByLabel("Your email address")).toBeVisible();
    expect(await page.content()).not.toContain(SECRET_LABEL);
    await creator.dispose();
  });

  test("submitting without verifying is refused by the server", async ({ playwright, baseURL, request }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "nocookie");
    const res = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { detail: "x" }, idempotencyKey: "k1" },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).code).toBe("verification_required");
    await creator.dispose();
  });

  test("the full flow: email, link, Continue to form, fill, submit, stored against the verified identity", async ({
    playwright,
    baseURL,
    browser,
  }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "flow");
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": uniqueIp() } });
    const page = await context.newPage();
    const email = uniqueEmail("respondent").toUpperCase();

    await page.goto(`/f/${slug}`);
    // No site nav on a public form page by design — it shows only the form
    // itself, the way opening a Google Forms link never shows Google's own site.
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    await page.getByLabel("Your email address").fill(email);
    await page.getByRole("button", { name: "Email me a link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    const link = await latestLink(email.toLowerCase());
    await page.goto(link);
    // Opening the link alone must not consume it.
    await expect(page.getByRole("button", { name: "Continue to form" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to form" }).click();

    await expect(page).toHaveURL(new RegExp(`/f/${slug}$`));
    await expect(page.getByText(`Email verified as`)).toBeVisible();
    await page.getByLabel(new RegExp(SECRET_LABEL)).fill("my answer");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Your submission has been recorded.")).toBeVisible();

    const stored = await withDb(async (db) => {
      const form = await db.collection("forms").findOne({ slug });
      const submission = await db.collection("submissions").findOne({ formId: form!._id });
      const identity = await db
        .collection("respondentidentities")
        .findOne({ normalizedValue: email.toLowerCase() });
      return { submission, identity };
    });
    expect(stored.identity).toBeTruthy();
    expect(stored.submission?.respondentIdentityId).toBe(String(stored.identity!._id));
    await context.close();
    await creator.dispose();
  });

  test("loading the emailed page does not use up the link, but pressing Continue does, exactly once", async ({
    playwright,
    baseURL,
    request,
  }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "single");
    const email = uniqueEmail("single");
    const ip = uniqueIp();
    await request.post(`/api/forms/${slug}/verify/request`, { data: { email }, headers: { "x-forwarded-for": ip } });
    const link = await latestLink(email);

    // A mail scanner opening the link twice with plain GETs changes nothing.
    expect((await request.get(link)).status()).toBe(200);
    expect((await request.get(link)).status()).toBe(200);

    const token = tokenOf(link);
    expect((await request.post(`/api/forms/${slug}/verify/confirm`, { data: { token } })).status()).toBe(200);
    const again = await request.post(`/api/forms/${slug}/verify/confirm`, { data: { token } });
    expect(again.status()).toBe(410);
    await creator.dispose();
  });

  test("an expired link is refused", async ({ playwright, baseURL, request }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "expired");
    const email = uniqueEmail("expired");
    await request.post(`/api/forms/${slug}/verify/request`, {
      data: { email },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const token = tokenOf(await latestLink(email));

    await withDb((db) =>
      db.collection("verificationchallenges").updateMany({ email }, { $set: { expiresAt: new Date(0) } }),
    );
    const res = await request.post(`/api/forms/${slug}/verify/confirm`, { data: { token } });
    expect(res.status()).toBe(410);
    await creator.dispose();
  });

  test("a link for one form does not verify another, and a made-up token is refused", async ({
    playwright,
    baseURL,
    request,
  }) => {
    const first = await publishedVerifiedForm(playwright, baseURL, "formA");
    const second = await publishedVerifiedForm(playwright, baseURL, "formB");
    const email = uniqueEmail("cross");
    await request.post(`/api/forms/${first.slug}/verify/request`, {
      data: { email },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const token = tokenOf(await latestLink(email));

    expect((await request.post(`/api/forms/${second.slug}/verify/confirm`, { data: { token } })).status()).toBe(410);
    const fake = "a".repeat(43);
    expect((await request.post(`/api/forms/${first.slug}/verify/confirm`, { data: { token: fake } })).status()).toBe(
      410,
    );
    expect((await request.post(`/api/forms/${first.slug}/verify/confirm`, { data: { token: "short" } })).status()).toBe(
      400,
    );
    await first.creator.dispose();
    await second.creator.dispose();
  });

  test("a forged or reused cookie cannot submit", async ({ playwright, baseURL }) => {
    const first = await publishedVerifiedForm(playwright, baseURL, "cookieA");
    const second = await publishedVerifiedForm(playwright, baseURL, "cookieB");
    const respondent = await playwright.request.newContext({ baseURL });
    await verify(respondent, first.slug, uniqueEmail("cookie"), uniqueIp());

    // Works for the form it was issued for...
    const ok = await respondent.post(`/api/forms/${first.slug}/submit`, {
      data: { answers: { detail: "x" }, idempotencyKey: "good" },
    });
    expect(ok.status()).toBe(201);

    const cookies = (await respondent.storageState()).cookies;
    const issued = cookies.find((c) => c.name.startsWith("fr_"))!;
    const [identity, formId, expires, signature] = issued.value.split(".");

    async function submitWith(slug: string, name: string, value: string) {
      const stranger = await playwright.request.newContext({ baseURL });
      const res = await stranger.post(`/api/forms/${slug}/submit`, {
        data: { answers: { detail: "x" }, idempotencyKey: `try-${Math.random()}` },
        headers: { cookie: `${name}=${value}` },
      });
      await stranger.dispose();
      return res.status();
    }

    // ...but not with a different identity, a later expiry, or a signature copied from elsewhere.
    expect(await submitWith(first.slug, issued.name, `${"0".repeat(24)}.${formId}.${expires}.${signature}`)).toBe(401);
    expect(await submitWith(first.slug, issued.name, `${identity}.${formId}.${Number(expires) + 999999}.${signature}`)).toBe(401);
    expect(await submitWith(first.slug, issued.name, "garbage")).toBe(401);
    // ...and a cookie earned on one form is useless on another.
    const secondFormId = await withDb(async (db) => String((await db.collection("forms").findOne({ slug: second.slug }))!._id));
    expect(await submitWith(second.slug, `fr_${secondFormId}`, issued.value)).toBe(401);

    await respondent.dispose();
    await first.creator.dispose();
    await second.creator.dispose();
  });

  test("asking again too soon is refused with a wait time; other addresses are unaffected", async ({
    playwright,
    baseURL,
    request,
  }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "cooldown");
    const ip = uniqueIp();
    const email = uniqueEmail("cool");
    const headers = { "x-forwarded-for": ip };

    expect((await request.post(`/api/forms/${slug}/verify/request`, { data: { email }, headers })).status()).toBe(200);
    const second = await request.post(`/api/forms/${slug}/verify/request`, { data: { email }, headers });
    expect(second.status()).toBe(429);
    expect(Number(second.headers()["retry-after"])).toBeGreaterThan(0);

    const other = uniqueEmail("other");
    expect((await request.post(`/api/forms/${slug}/verify/request`, { data: { email: other }, headers })).status()).toBe(
      200,
    );
    await creator.dispose();
  });

  test("an address is capped per hour even when the wait between requests is respected", async ({
    playwright,
    baseURL,
    request,
  }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "hourly");
    const email = uniqueEmail("hourly");
    const formId = await withDb(async (db) => (await db.collection("forms").findOne({ slug }))!._id);
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    await withDb((db) =>
      db.collection("verificationchallenges").insertMany(
        Array.from({ length: 5 }, (_, i) => ({
          formId,
          email,
          tokenHash: `seed-${slug}-${i}`,
          expiresAt: new Date(tenMinutesAgo),
          usedAt: null,
          ipHash: "seed",
          createdAt: new Date(tenMinutesAgo - i * 1000),
        })),
      ),
    );

    const res = await request.post(`/api/forms/${slug}/verify/request`, {
      data: { email },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    expect(res.status()).toBe(429);
    await creator.dispose();
  });

  test("one network address is capped across different email addresses", async ({ playwright, baseURL, request }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "ipcap");
    const headers = { "x-forwarded-for": uniqueIp() };

    for (let i = 0; i < 20; i++) {
      const res = await request.post(`/api/forms/${slug}/verify/request`, {
        data: { email: uniqueEmail(`ip${i}`) },
        headers,
      });
      expect(res.status()).toBe(200);
    }
    const blocked = await request.post(`/api/forms/${slug}/verify/request`, {
      data: { email: uniqueEmail("ip-over") },
      headers,
    });
    expect(blocked.status()).toBe(429);
    await creator.dispose();
  });

  test("bad input and non-verified forms are rejected cleanly", async ({ playwright, baseURL, request }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "input");
    const headers = { "x-forwarded-for": uniqueIp() };
    expect((await request.post(`/api/forms/${slug}/verify/request`, { data: { email: "nope" }, headers })).status()).toBe(422);
    expect((await request.post(`/api/forms/${slug}/verify/request`, { data: {}, headers })).status()).toBe(422);

    const openSlug = uniqueId("open");
    await creatorPublishes(creator, openSlug, "anyone");
    const res = await request.post(`/api/forms/${openSlug}/verify/request`, {
      data: { email: uniqueEmail("x") },
      headers,
    });
    expect(res.status()).toBe(404);
    expect((await request.post(`/api/forms/${uniqueId("missing")}/verify/request`, { data: { email: "a@b.co" }, headers })).status()).toBe(404);

    const badMode = await creator.post("/api/forms/publish", {
      data: { definition: definition(uniqueId("bad")), accessMode: "everyone" },
    });
    expect(badMode.status()).toBe(422);
    await creator.dispose();
  });

  test("switching a form back to anyone opens it up, and republishing without a mode keeps the current one", async ({
    playwright,
    baseURL,
    request,
  }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "switch");
    await creatorPublishes(creator, slug); // no accessMode given
    const stillLocked = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { detail: "x" }, idempotencyKey: "k1" },
    });
    expect(stillLocked.status()).toBe(401);

    await creatorPublishes(creator, slug, "anyone");
    const open = await request.post(`/api/forms/${slug}/submit`, {
      data: { answers: { detail: "x" }, idempotencyKey: "k2" },
    });
    expect(open.status()).toBe(201);
    await creator.dispose();
  });

  test("the creator can choose the access mode in the builder, and the public link then asks for a verified email", async ({
    page,
    browser,
  }) => {
    await openNewBuilder(page, "modeui");
    await page.getByLabel("Form name").fill("Chosen In Builder");
    await page.getByRole("button", { name: "Add Text field" }).click();
    await openBuilderSettings(page);
    await page.getByLabel("Who can respond").selectOption("verified_email");
    await closeBuilderSettings(page);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    const href = (await page.locator(".fb-publish-url a").getAttribute("href"))!;

    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(href);
    await expect(visitorPage.getByLabel("Your email address")).toBeVisible();
    await visitor.close();

    // Reopening the builder remembers the choice.
    await page.reload();
    await openBuilderSettings(page);
    await expect(page.getByLabel("Who can respond")).toHaveValue("verified_email");
  });

  test("no automatically detectable accessibility violations on the email step and the Continue page", async ({
    playwright,
    baseURL,
    page,
    request,
  }) => {
    const { creator, slug } = await publishedVerifiedForm(playwright, baseURL, "a11y");
    await page.goto(`/f/${slug}`);
    await page.waitForLoadState("networkidle");
    let results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);

    const email = uniqueEmail("a11y");
    await request.post(`/api/forms/${slug}/verify/request`, {
      data: { email },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    await page.goto(await latestLink(email));
    await page.waitForLoadState("networkidle");
    results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await creator.dispose();
  });
});

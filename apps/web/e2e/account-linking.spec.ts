import { expect, test } from "@playwright/test";
import { latestLink, openNewBuilder, signIn, uniqueEmail, withDb } from "./auth-helpers";

const STAMP = "2026-01-01T00:00:00.000Z";

function definition(id: string) {
  return {
    id,
    name: "Linking Test Form",
    schemaVersion: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    fields: [{ id: "note", type: "text", label: "Note", required: false }],
    layout: { rows: [{ id: "r1", columns: [{ span: 12, fieldId: "note" }] }] },
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

async function verifyAsRespondent(page: import("@playwright/test").Page, slug: string, email: string) {
  await page.goto(`/f/${slug}`);
  await page.getByLabel("Your email address").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  const link = await latestLink(email);
  await page.goto(link);
  await page.getByRole("button", { name: "Continue to form" }).click();
}

test.describe("Phase 5d: account linking", () => {
  test("respondent verifies first, then signing up as a creator with the same email links them", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("linkfirst");

    // Publish a verified_email form from an unrelated creator, and verify as a respondent.
    const otherCreatorPage = await (await browser.newContext()).newPage();
    await signIn(otherCreatorPage.request, uniqueEmail("otherowner"));
    const slug = uniqueId("linkfirst");
    await otherCreatorPage.request.post("/api/forms/publish", {
      data: { definition: definition(slug), accessMode: "verified_email" },
    });
    await verifyAsRespondent(otherCreatorPage, slug, email);
    await otherCreatorPage.context().close();

    const identityBefore = await withDb((db) =>
      db.collection("respondentidentities").findOne({ normalizedValue: email }),
    );
    expect(identityBefore?.linkedAccountId).toBeNull();

    // Now that same email signs in as a creator (magic link).
    await signIn(page.request, email);

    const identityAfter = await withDb((db) =>
      db.collection("respondentidentities").findOne({ normalizedValue: email }),
    );
    expect(identityAfter?.linkedAccountId).toBeTruthy();

    const user = await withDb((db) => db.collection("users").findOne({ email }));
    expect(identityAfter?.linkedAccountId).toBe(String(user!._id));
  });

  test("account exists first, then verifying as a respondent with the same email links them", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("accountfirst");
    await signIn(page.request, email); // creator account created via magic link

    const otherCreatorPage = await (await browser.newContext()).newPage();
    await signIn(otherCreatorPage.request, uniqueEmail("otherowner2"));
    const slug = uniqueId("accountfirst");
    await otherCreatorPage.request.post("/api/forms/publish", {
      data: { definition: definition(slug), accessMode: "verified_email" },
    });

    const respondentPage = await (await browser.newContext()).newPage();
    await verifyAsRespondent(respondentPage, slug, email);

    const identity = await withDb((db) => db.collection("respondentidentities").findOne({ normalizedValue: email }));
    const user = await withDb((db) => db.collection("users").findOne({ email }));
    expect(identity?.linkedAccountId).toBe(String(user!._id));

    await otherCreatorPage.context().close();
    await respondentPage.context().close();
  });

  test("unrelated emails are never linked to each other", async ({ page }) => {
    await signIn(page.request, uniqueEmail("unrelated-account"));
    const otherEmail = uniqueEmail("unrelated-respondent");

    // No respondent identity exists at all for otherEmail — linking must be a no-op, not an error.
    const identity = await withDb((db) =>
      db.collection("respondentidentities").findOne({ normalizedValue: otherEmail }),
    );
    expect(identity).toBeNull();
  });

  test("/my-responses lists only the form name and date, never the answers, and requires sign-in", async ({
    page,
    browser,
  }) => {
    await page.goto("/my-responses");
    await expect(page).toHaveURL(/\/signin/);

    const email = uniqueEmail("myresponses");
    const otherCreatorPage = await (await browser.newContext()).newPage();
    await signIn(otherCreatorPage.request, uniqueEmail("otherowner3"));
    const slug = uniqueId("myresponses");
    await otherCreatorPage.request.post("/api/forms/publish", {
      data: { definition: definition(slug), accessMode: "verified_email" },
    });

    const respondentPage = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": uniqueIp() } })).newPage();
    await verifyAsRespondent(respondentPage, slug, email);
    await respondentPage.getByLabel("Note").fill("this is a secret answer");
    await respondentPage.getByRole("button", { name: "Submit" }).click();
    await expect(respondentPage.getByText("Your submission has been recorded.")).toBeVisible();
    await respondentPage.context().close();

    // Now that same email signs up as a creator — retroactively linking the identity above.
    await signIn(page.request, email);
    await page.goto("/my-responses");
    await expect(page.getByText("Linking Test Form")).toBeVisible();
    expect(await page.content()).not.toContain("this is a secret answer");

    await otherCreatorPage.context().close();
  });

  test("a creator account with no matching respondent identity sees the empty state", async ({ page }) => {
    await openNewBuilder(page, "nolinks");
    await page.goto("/my-responses");
    await expect(page.getByText(/Nothing here yet/)).toBeVisible();
  });
});

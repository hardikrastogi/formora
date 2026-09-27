import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { latestLink, signIn, uniqueEmail } from "./auth-helpers";

function tokenOf(link: string): string {
  return new URL(link).searchParams.get("token")!;
}

// Every test gets its own "network address" so the per-IP rate limit in
// requestAccountToken (shared across signup and reset) never fires just
// because several tests run back to back without a real one. Applied both to
// the page (so in-browser form submissions carry it) and to raw API calls.
function uniqueIp(): string {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

test.describe("Phase 5b-2: password signup, login, and reset", () => {
  test.beforeEach(async ({ context }) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  });

  test("sign up, verify, then log in with the chosen password", async ({ page, request }) => {
    const email = uniqueEmail("pwsignup");
    const ip = { headers: { "x-forwarded-for": uniqueIp() } };

    await page.goto("/signup");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("correct-horse-1");
    await page.getByLabel("Confirm password").fill("correct-horse-1");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    const link = await latestLink(email);
    await page.goto(link);
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Your email is verified")).toBeVisible();

    await page.goto("/signin");
    const loginForm = page.getByRole("form", { name: "Log in with password" });
    await loginForm.getByLabel("Email address").fill(email);
    await loginForm.getByLabel("Password").fill("correct-horse-1");
    await loginForm.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "My forms" })).toBeVisible();

    // The signup link is single-use.
    const replay = await request.post("/api/account/verify", { data: { token: tokenOf(link) }, ...ip });
    expect(replay.status()).toBe(410);
  });

  test("wrong password, and an unverified/unknown email, are both refused", async ({ page }) => {
    const email = uniqueEmail("pwwrong");
    await page.goto("/signup");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("correct-horse-1");
    await page.getByLabel("Confirm password").fill("correct-horse-1");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    // Never verified — the account doesn't exist yet as far as login is concerned.

    await page.goto("/signin");
    const loginForm = page.getByRole("form", { name: "Log in with password" });
    await loginForm.getByLabel("Email address").fill(email);
    await loginForm.getByLabel("Password").fill("correct-horse-1");
    await loginForm.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/signin/);
  });

  test("signing up again with an already-verified email is rejected", async ({ request }) => {
    const email = uniqueEmail("pwdupe");
    const ip = { headers: { "x-forwarded-for": uniqueIp() } };
    const first = await request.post("/api/account/signup", { data: { email, password: "correct-horse-1" }, ...ip });
    expect(first.status()).toBe(200);
    await request.post("/api/account/verify", { data: { token: tokenOf(await latestLink(email)) }, ...ip });

    const second = await request.post("/api/account/signup", {
      data: { email, password: "another-password-2" },
      ...ip,
    });
    expect(second.status()).toBe(409);
  });

  test("a magic-link-only account can add a password via signup, and both methods then work", async ({
    browser,
    request,
  }) => {
    const email = uniqueEmail("upgrade");
    const ip = { headers: { "x-forwarded-for": uniqueIp() } };
    // Establish the account the magic-link way first (this also verifies the email), using its
    // own short-lived context so the session cookie never reaches the page used below.
    const magicLinkContext = await browser.newContext();
    await signIn(magicLinkContext.request, email);
    await magicLinkContext.close();

    const signup = await request.post("/api/account/signup", {
      data: { email, password: "correct-horse-1" },
      ...ip,
    });
    expect(signup.status()).toBe(200);
    await request.post("/api/account/verify", { data: { token: tokenOf(await latestLink(email)) }, ...ip });

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/signin");
    const loginForm = page.getByRole("form", { name: "Log in with password" });
    await loginForm.getByLabel("Email address").fill(email);
    await loginForm.getByLabel("Password").fill("correct-horse-1");
    await loginForm.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await context.close();
  });

  test("weak passwords and mismatched confirmation are rejected before any email is sent", async ({
    page,
    request,
  }) => {
    const ip = { headers: { "x-forwarded-for": uniqueIp() } };
    const short = await request.post("/api/account/signup", {
      data: { email: uniqueEmail("short"), password: "short" },
      ...ip,
    });
    expect(short.status()).toBe(422);

    const badEmail = await request.post("/api/account/signup", {
      data: { email: "nope", password: "longenough1" },
      ...ip,
    });
    expect(badEmail.status()).toBe(422);

    await page.goto("/signup");
    await page.getByLabel("Email address").fill(uniqueEmail("mismatch"));
    await page.getByLabel("Password", { exact: true }).fill("correct-horse-1");
    await page.getByLabel("Confirm password").fill("different-password");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText("Passwords don't match.")).toBeVisible();
  });

  test("an expired or already-used signup link is refused", async ({ request }) => {
    const email = uniqueEmail("expiredsignup");
    const ip = { headers: { "x-forwarded-for": uniqueIp() } };
    await request.post("/api/account/signup", { data: { email, password: "correct-horse-1" }, ...ip });
    const token = tokenOf(await latestLink(email));

    const ok = await request.post("/api/account/verify", { data: { token }, ...ip });
    expect(ok.status()).toBe(200);
    const again = await request.post("/api/account/verify", { data: { token }, ...ip });
    expect(again.status()).toBe(410);
    expect((await request.post("/api/account/verify", { data: { token: "short" }, ...ip })).status()).toBe(400);
  });

  test("forgot password: reset link changes the password, old password stops working, link is single-use", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("reset");
    const ip = { headers: { "x-forwarded-for": uniqueIp() } };
    await request.post("/api/account/signup", { data: { email, password: "original-password-1" }, ...ip });
    await request.post("/api/account/verify", { data: { token: tokenOf(await latestLink(email)) }, ...ip });

    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    const resetLink = await latestLink(email);
    await page.goto(resetLink);
    await page.getByLabel("New password", { exact: true }).fill("brand-new-password-2");
    await page.getByLabel("Confirm new password").fill("brand-new-password-2");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Your password has been changed.")).toBeVisible();

    await page.goto("/signin");
    const loginForm = page.getByRole("form", { name: "Log in with password" });
    await loginForm.getByLabel("Email address").fill(email);
    await loginForm.getByLabel("Password").fill("original-password-1");
    await loginForm.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();

    // Only fix the password, matching what a real user would do — the email field
    // must still hold what was typed before, not have been silently cleared by the
    // failed submission (React resets a form's uncontrolled fields on action
    // completion unless the inputs are kept controlled, as password-login-form.tsx does).
    await loginForm.getByLabel("Password").fill("brand-new-password-2");
    await loginForm.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // The reset link itself was single-use.
    const replay = await request.post("/api/account/reset", {
      data: { token: tokenOf(resetLink), password: "yet-another-3" },
      ...ip,
    });
    expect(replay.status()).toBe(410);
  });

  test("forgot password never reveals whether the address exists or has a password", async ({ page, request }) => {
    const ip = { headers: { "x-forwarded-for": uniqueIp() } };
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(uniqueEmail("neverexisted"));
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    // A magic-link-only account (no password) also gets the same silent 200, and no email.
    const magicOnly = uniqueEmail("magiconlyreset");
    const magicLinkContext = await page.context().browser()!.newContext();
    await signIn(magicLinkContext.request, magicOnly);
    await magicLinkContext.close();
    const res = await request.post("/api/account/forgot-password", { data: { email: magicOnly }, ...ip });
    expect(res.status()).toBe(200);

    const badToken = await request.post("/api/account/reset", {
      data: { token: "short", password: "longenough1" },
      ...ip,
    });
    expect(badToken.status()).toBe(400);
  });

  test("Google button is hidden when GOOGLE_CLIENT_ID/SECRET aren't configured", async ({ page }) => {
    // The e2e server runs without Google credentials set.
    await page.goto("/signin");
    await expect(page.getByRole("button", { name: /Continue with Google/i })).toHaveCount(0);
    await page.goto("/signup");
    await expect(page.getByRole("button", { name: /Sign up with Google/i })).toHaveCount(0);
  });

  test("no automatically detectable accessibility violations on signup, forgot-password, and verify pages", async ({
    page,
    request,
  }) => {
    const ip = { headers: { "x-forwarded-for": uniqueIp() } };
    await page.goto("/signup");
    expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

    await page.goto("/forgot-password");
    expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

    const email = uniqueEmail("a11yverify");
    await request.post("/api/account/signup", { data: { email, password: "correct-horse-1" }, ...ip });
    await page.goto(await latestLink(email));
    expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
  });
});

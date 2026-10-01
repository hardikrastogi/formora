import { ObjectId } from "mongodb";
import { expect, test } from "@playwright/test";
import { latestLink, signIn, uniqueEmail, withDb } from "./auth-helpers";

function uniqueIp(): string {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

async function signUpWithPassword(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/signup");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  const link = await latestLink(email);
  await page.goto(link);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Your email is verified")).toBeVisible();
}

async function sessionUserId(page: import("@playwright/test").Page): Promise<string> {
  const session = await (await page.request.get("/api/auth/session")).json();
  return session.user.id as string;
}

test.describe("Account settings", () => {
  test.beforeEach(async ({ context }) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  });

  test("signed-out visitors are sent to sign in", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("shows the current email, and a magic-link-only account has no password to remove", async ({ page }) => {
    const email = uniqueEmail("acctview");
    await signIn(page.request, email);
    await page.goto("/account");
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("No password set.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove password" })).toHaveCount(0);
  });

  test("changing email sends a confirmation link to the new address, which updates the account once clicked", async ({
    page,
  }) => {
    const email = uniqueEmail("acctemail");
    await signIn(page.request, email);
    const newEmail = uniqueEmail("acctemail-new");

    await page.goto("/account");
    await page.getByLabel("New email address").fill(newEmail);
    await page.getByRole("button", { name: "Change email" }).click();
    await expect(page.getByText(`Check ${newEmail}`)).toBeVisible();

    // The account is untouched until the link is actually clicked.
    const stillOld = await withDb((db) => db.collection("users").findOne({ email }));
    expect(stillOld).not.toBeNull();

    const link = await latestLink(newEmail);
    await page.goto(link);
    await page.getByRole("button", { name: "Confirm email change" }).click();
    await expect(page.getByText(`Your email is now ${newEmail}`)).toBeVisible();

    const updated = await withDb((db) => db.collection("users").findOne({ email: newEmail }));
    expect(updated).not.toBeNull();
    const oldGone = await withDb((db) => db.collection("users").findOne({ email }));
    expect(oldGone).toBeNull();
  });

  test("an email already used by another account is refused, both at request time and at confirm time", async ({
    page,
  }) => {
    const takenEmail = uniqueEmail("acct-taken");
    await signIn(page.request, takenEmail);

    const email = uniqueEmail("acct-requester");
    await signIn(page.request, email);
    await page.goto("/account");
    await page.getByLabel("New email address").fill(takenEmail);
    await page.getByRole("button", { name: "Change email" }).click();
    await expect(page.getByText("That email address is already in use.")).toBeVisible();
  });

  test("removing a password only works once one is actually set", async ({ page }) => {
    const email = uniqueEmail("acctpw");
    await signUpWithPassword(page, email, "correct-horse-1");
    await page.goto("/signin");
    const loginForm = page.getByRole("form", { name: "Log in with password" });
    await loginForm.getByLabel("Email address").fill(email);
    await loginForm.getByLabel("Password").fill("correct-horse-1");
    await loginForm.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/account");
    await expect(page.getByRole("button", { name: "Remove password" })).toBeVisible();
    await page.getByRole("button", { name: "Remove password" }).click();
    await expect(page.getByText("No password set.")).toBeVisible();

    // Calling the endpoint again refuses — there's nothing left to remove.
    const again = await page.request.post("/api/account/password/remove");
    expect(again.status()).toBe(422);
  });

  test("disconnecting Google is refused when nothing is connected, and removes the link when it is", async ({
    page,
  }) => {
    const email = uniqueEmail("acctgoogle");
    await signIn(page.request, email);

    const notConnected = await page.request.post("/api/account/google/disconnect");
    expect(notConnected.status()).toBe(422);

    const userId = await sessionUserId(page);
    await withDb((db) =>
      db.collection("accounts").insertOne({
        userId: new ObjectId(userId),
        provider: "google",
        providerAccountId: `fake-${Date.now()}`,
        type: "oauth",
      }),
    );

    const info = await (await page.request.get("/api/account")).json();
    expect(info.hasGoogle).toBe(true);

    const disconnected = await page.request.post("/api/account/google/disconnect");
    expect(disconnected.status()).toBe(200);

    const after = await (await page.request.get("/api/account")).json();
    expect(after.hasGoogle).toBe(false);
  });
});

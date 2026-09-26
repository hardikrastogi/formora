import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { MongoClient } from "mongodb";

// The tests talk to the same database the dev server uses (EMAIL_TRANSPORT=console
// stores every sign-in email in `dev_email_outbox`), so read the same URI.
function mongoUri(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  try {
    const env = readFileSync(join(__dirname, "..", ".env.local"), "utf-8");
    const match = env.match(/^MONGODB_URI=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    // fall through to the local default
  }
  return "mongodb://127.0.0.1:27017/formora_dev";
}

export function uniqueEmail(name: string): string {
  return `e2e-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export async function latestLink(email: string): Promise<string> {
  const client = await new MongoClient(mongoUri()).connect();
  try {
    const outbox = client.db().collection("dev_email_outbox");
    for (let attempt = 0; attempt < 40; attempt++) {
      const doc = await outbox.findOne({ to: email }, { sort: { createdAt: -1 } });
      if (doc) return doc.url as string;
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally {
    await client.close();
  }
  throw new Error(`No sign-in email arrived for ${email}`);
}

/**
 * Signs in through the real magic-link flow: request a link, "open the email",
 * follow the link. The session cookie lands on `request`'s cookie jar, which a
 * Playwright page in the same context shares.
 */
export async function signIn(request: APIRequestContext, email: string): Promise<void> {
  const csrf = (await (await request.get("/api/auth/csrf")).json()) as { csrfToken: string };
  const send = await request.post("/api/auth/signin/email", {
    form: { csrfToken: csrf.csrfToken, email, callbackUrl: "/dashboard" },
  });
  expect(send.ok()).toBe(true);

  const link = await latestLink(email);
  const opened = await request.get(link);
  expect(opened.ok()).toBe(true);

  const session = (await (await request.get("/api/auth/session")).json()) as { user?: { email?: string } };
  expect(session.user?.email).toBe(email);
}

/** Signs in as a brand-new creator and opens the builder on a fresh, empty form. */
export async function openNewBuilder(page: Page, name = "builder"): Promise<void> {
  await signIn(page.request, uniqueEmail(name));
  await page.goto("/builder/new");
  await page.waitForSelector(".fb-root");
}

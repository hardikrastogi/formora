import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openNewBuilder, withDb } from "./auth-helpers";

test.describe("Phase 5: public form page and editable responses", () => {
  test("a published form's public page has no site header, footer, or nav", async ({ page }) => {
    await openNewBuilder(page, "nochrome");
    await page.getByRole("button", { name: "Add Text field" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    const href = (await page.locator(".fb-publish-url a").getAttribute("href"))!;

    await page.goto(href);
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Formora" })).toHaveCount(0);
  });

  test("refreshing after submitting shows the confirmation again, not a blank form", async ({ page }) => {
    await openNewBuilder(page, "refresh-after-submit");
    await page.getByRole("button", { name: "Add Text field" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    const href = (await page.locator(".fb-publish-url a").getAttribute("href"))!;

    const visitor = await page.context().browser()!.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(href);
    await visitorPage.getByLabel("Text field").fill("my first answer");
    await visitorPage.getByRole("button", { name: "Submit" }).click();
    await expect(visitorPage.getByText("Your submission has been recorded.")).toBeVisible();

    await visitorPage.reload();
    await expect(visitorPage.getByText("Your submission has been recorded.")).toBeVisible();
    await expect(visitorPage.getByLabel("Text field")).toHaveCount(0);
    await visitor.close();
  });

  test("Edit your response reopens the form pre-filled, and saving updates the same submission", async ({
    page,
  }) => {
    await openNewBuilder(page, "edit-response");
    await page.getByRole("button", { name: "Add Text field" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    const href = (await page.locator(".fb-publish-url a").getAttribute("href"))!;
    const slug = new URL(href, page.url()).pathname.split("/").pop()!;

    const visitor = await page.context().browser()!.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(href);
    await visitorPage.getByLabel("Text field").fill("original answer");
    await visitorPage.getByRole("button", { name: "Submit" }).click();
    await expect(visitorPage.getByText("Your submission has been recorded.")).toBeVisible();

    await visitorPage.getByRole("button", { name: "Edit your response" }).click();
    await expect(visitorPage.getByLabel("Text field")).toHaveValue("original answer");
    await visitorPage.getByLabel("Text field").fill("updated answer");
    await visitorPage.getByRole("button", { name: "Save changes" }).click();
    await expect(visitorPage.getByText("Your submission has been recorded.")).toBeVisible();

    // Still one submission — the edit updated it, not created a second one.
    const submissions = await withDb(async (db) => {
      const form = await db.collection("forms").findOne({ slug });
      return db.collection("submissions").find({ formId: form!._id }).toArray();
    });
    expect(submissions).toHaveLength(1);
    expect(submissions[0].answers.text_1).toBe("updated answer");
    expect(submissions[0].revisionNumber).toBe(2);

    // Reopening the same browser again shows the updated answer, not stale data.
    await visitorPage.reload();
    await visitorPage.getByRole("button", { name: "Edit your response" }).click();
    await expect(visitorPage.getByLabel("Text field")).toHaveValue("updated answer");
    await visitor.close();
  });

  test("a second, unrelated browser sees a blank form, never someone else's submission", async ({ page }) => {
    await openNewBuilder(page, "isolated");
    await page.getByRole("button", { name: "Add Text field" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    const href = (await page.locator(".fb-publish-url a").getAttribute("href"))!;

    const first = await page.context().browser()!.newContext();
    const firstPage = await first.newPage();
    await firstPage.goto(href);
    await firstPage.getByLabel("Text field").fill("answer A");
    await firstPage.getByRole("button", { name: "Submit" }).click();
    await expect(firstPage.getByText("Your submission has been recorded.")).toBeVisible();

    const second = await page.context().browser()!.newContext();
    const secondPage = await second.newPage();
    await secondPage.goto(href);
    await expect(secondPage.getByLabel("Text field")).toBeVisible();
    await expect(secondPage.getByText("Your submission has been recorded.")).toHaveCount(0);

    await first.close();
    await second.close();
  });

  test("a forged or unknown submissionId/editToken is refused, and never overwrites anything", async ({
    page,
    request,
  }) => {
    await openNewBuilder(page, "forged-edit");
    await page.getByRole("button", { name: "Add Text field" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    const href = (await page.locator(".fb-publish-url a").getAttribute("href"))!;
    const slug = new URL(href, page.url()).pathname.split("/").pop()!;

    const lookupBad = await request.post(`/api/forms/${slug}/submission/lookup`, {
      data: { submissionId: "000000000000000000000000", editToken: "a".repeat(43) },
    });
    expect(lookupBad.status()).toBe(404);

    const updateBad = await request.post(`/api/forms/${slug}/submission/update`, {
      data: { submissionId: "000000000000000000000000", editToken: "a".repeat(43), answers: { text_1: "hacked" } },
    });
    expect(updateBad.status()).toBe(404);

    expect((await request.post(`/api/forms/${slug}/submission/lookup`, { data: { submissionId: "x" } })).status()).toBe(
      404,
    );
  });

  test("editing is refused once the form is closed", async ({ page, request }) => {
    await openNewBuilder(page, "edit-after-close");
    await page.getByRole("button", { name: "Add Text field" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    const href = (await page.locator(".fb-publish-url a").getAttribute("href"))!;
    const slug = new URL(href, page.url()).pathname.split("/").pop()!;

    const visitor = await page.context().browser()!.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(href);
    await visitorPage.getByLabel("Text field").fill("before close");
    await visitorPage.getByRole("button", { name: "Submit" }).click();
    await expect(visitorPage.getByText("Your submission has been recorded.")).toBeVisible();

    const stored = await visitorPage.evaluate(
      (key) => window.localStorage.getItem(key),
      `formora-submission:${slug}`,
    );
    const { submissionId, editToken } = JSON.parse(stored!);

    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/no longer accepts responses/)).toBeVisible();

    const res = await request.post(`/api/forms/${slug}/submission/update`, {
      data: { submissionId, editToken, answers: { text_1: "after close" } },
    });
    expect(res.status()).toBe(410);
    await visitor.close();
  });

  test("no automatically detectable accessibility violations on the public form and its confirmation", async ({
    page,
  }) => {
    await openNewBuilder(page, "a11y-public");
    await page.getByRole("button", { name: "Add Text field" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/^Live at/)).toBeVisible({ timeout: 10000 });
    const href = (await page.locator(".fb-publish-url a").getAttribute("href"))!;

    const visitor = await page.context().browser()!.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(href);
    await visitorPage.waitForLoadState("networkidle");
    expect((await new AxeBuilder({ page: visitorPage }).analyze()).violations.map((v) => v.id)).toEqual([]);

    await visitorPage.getByLabel("Text field").fill("answer");
    await visitorPage.getByRole("button", { name: "Submit" }).click();
    await expect(visitorPage.getByText("Your submission has been recorded.")).toBeVisible();
    expect((await new AxeBuilder({ page: visitorPage }).analyze()).violations.map((v) => v.id)).toEqual([]);
    await visitor.close();
  });
});

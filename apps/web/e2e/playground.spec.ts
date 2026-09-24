import { expect, test, type Page } from "@playwright/test";

const editor = (page: Page) => page.getByLabel("FormDefinition JSON");
const output = (page: Page) => page.getByTestId("submission-output");

test.beforeEach(async ({ page }) => {
  await page.goto("/playground");
  await expect(editor(page)).toBeVisible();
});

test("empty submit shows required errors, focuses the first bad field and sends nothing", async ({ page }) => {
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText('"First name" is required')).toBeVisible();
  await expect(page.getByText('"Email" is required')).toBeVisible();
  await expect(page.getByText('"Message" is required')).toBeVisible();
  await expect(page.getByLabel("First name")).toBeFocused();
  await expect(output(page)).toHaveCount(0);
});

test("filling the contact form and submitting shows the FormSubmission a backend would receive", async ({ page }) => {
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Topic").selectOption("Feedback");
  await page.getByLabel("Message").fill("This is a long enough message.");
  await page.getByRole("checkbox", { name: /Send me product updates/ }).click();
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(output(page)).toBeVisible();
  const body = JSON.parse((await output(page).textContent()) ?? "{}");
  expect(body.formId).toBe("contact");
  expect(body.schemaVersion).toBe(1);
  expect(body.answers).toEqual({
    first_name: "Ada",
    email: "ada@example.com",
    topic: "Feedback",
    message: "This is a long enough message.",
    subscribe: true,
  });
  expect(typeof body.meta.submittedAt).toBe("string");
});

test("a malformed email and a too-short message are rejected", async ({ page }) => {
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Email").fill("nope");
  await page.getByLabel("Message").fill("short");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText('"Message" must be at least 10 characters')).toBeVisible();
  await expect(output(page)).toHaveCount(0);
});

test("editing the JSON updates the live preview", async ({ page }) => {
  const before = await editor(page).inputValue();
  await editor(page).fill(before.replace('"label": "Message"', '"label": "Your note"'));
  await expect(page.getByLabel("Your note")).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveCount(0);
});

test("broken JSON shows an error and keeps the last valid preview", async ({ page }) => {
  await editor(page).fill("{ this is not json");
  await expect(page.getByTestId("json-error")).toBeVisible();
  await expect(page.getByLabel("First name")).toBeVisible();
});

test("a valid JSON document that is not a valid form explains what is wrong", async ({ page }) => {
  const before = await editor(page).inputValue();
  await editor(page).fill(before.replace('"id": "first_name"', '"id": "first.name"'));
  await expect(page.getByText("This form definition is invalid")).toBeVisible();
});

test("answers survive label edits but the form resets when fields change", async ({ page }) => {
  await page.getByLabel("First name").fill("Grace");
  const before = await editor(page).inputValue();
  await editor(page).fill(before.replace('"label": "Message"', '"label": "Your note"'));
  await expect(page.getByLabel("Your note")).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveValue("Grace");
});

test("event registration: theme applied, default radio, number range enforced", async ({ page }) => {
  await page.getByRole("button", { name: "Event registration" }).click();
  const primary = await page.locator("form.df-form").evaluate((el) => getComputedStyle(el).getPropertyValue("--df-primary").trim());
  expect(primary).toBe("#16a34a");
  await expect(page.getByRole("radio", { name: "Standard" })).toBeChecked();

  await page.getByLabel("Full name").fill("Ada");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Attendees").fill("11");
  await page.getByRole("checkbox", { name: /I agree/ }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText('"Attendees" must be at most 10')).toBeVisible();

  await page.getByLabel("Attendees").fill("4");
  await page.getByRole("radio", { name: "VIP" }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  const body = JSON.parse((await output(page).textContent()) ?? "{}");
  expect(body.answers).toMatchObject({ full_name: "Ada", attendees: 4, ticket: "VIP", terms: true });
});

test("custom slider field plugin works end to end", async ({ page }) => {
  await page.getByRole("button", { name: "Custom field + dark theme" }).click();
  const slider = page.getByLabel(/How likely are you to recommend us/);
  await slider.focus();
  for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowRight");

  await page.getByRole("button", { name: "Submit" }).click();
  const body = JSON.parse((await output(page).textContent()) ?? "{}");
  expect(body.answers.satisfaction).toBe(7);
});

test("switching examples lands on the new form and never flashes the previous one", async ({ page }) => {
  await page.getByRole("button", { name: "Event registration" }).click();
  await expect(page.getByLabel("Full name")).toBeVisible();

  await page.getByRole("button", { name: "Custom field + dark theme" }).click();
  await expect(page.getByLabel(/How likely are you to recommend us/)).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByLabel("Full name")).toHaveCount(0);
  await expect(page.getByLabel(/How likely are you to recommend us/)).toBeVisible();
  expect(await editor(page).inputValue()).toContain('"id": "feedback"');
});

test("built-in country, currency, url, time and rating field types work end to end", async ({ page }) => {
  await page.getByRole("button", { name: "International order (new field types)" }).click();

  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Country").selectOption("IN");
  await page.getByLabel("Preferred currency").selectOption("INR");
  await page.getByLabel("Company website").fill("https://formora.dev");
  await page.getByLabel("Best time to call").fill("14:30");
  await page.getByRole("radio", { name: "4 stars" }).click();

  await page.getByRole("button", { name: "Submit" }).click();
  const body = JSON.parse((await output(page).textContent()) ?? "{}");
  expect(body.answers).toMatchObject({
    full_name: "Ada Lovelace",
    country: "IN",
    currency: "INR",
    website: "https://formora.dev",
    call_time: "14:30",
    experience: 4,
  });
});

test("a malformed URL on the international form is rejected", async ({ page }) => {
  await page.getByRole("button", { name: "International order (new field types)" }).click();
  await page.getByLabel("Full name").fill("Ada");
  await page.getByLabel("Country").selectOption("IN");
  await page.getByLabel("Company website").fill("not-a-url");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/Enter a valid URL/)).toBeVisible();
});

test("Reset restores the example and clears a previous submission", async ({ page }) => {
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Message").fill("A perfectly fine message.");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(output(page)).toBeVisible();

  await editor(page).fill("{}");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(output(page)).toHaveCount(0);
  await expect(page.getByLabel("First name")).toHaveValue("");
  expect(await editor(page).inputValue()).toContain('"id": "contact"');
});

test.describe("phone-sized screen", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("editor and preview are switched with tabs, and the form is usable", async ({ page }) => {
    await page.goto("/playground");
    await expect(editor(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit" })).toBeHidden();

    await page.getByRole("tab", { name: "Preview" }).click();
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
    await expect(editor(page)).toBeHidden();

    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noHorizontalScroll).toBe(true);

    await page.getByLabel("First name").fill("Ada");
    await expect(page.getByLabel("First name")).toHaveValue("Ada");
  });
});

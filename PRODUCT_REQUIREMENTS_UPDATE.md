# Formora Product Requirements Update

## Purpose

This document records the agreed product updates for Formora. It is intended to be self-contained so it can be shared with another developer or AI assistant without needing the original conversation.

Formora should work as an independent alternative to Google Forms. A creator builds and publishes a form, shares it through WhatsApp, email, SMS, or another application, and respondents open the shared link to complete the exact published form.

Respondents must not be forced to create a Formora account before filling a form.

---

## Confirmed Product Decisions

1. The form creator chooses one of three respondent access modes:
   - `anyone`
   - `verified_email`
   - `verified_phone`
2. Formora account pages will offer normal sign-up/sign-in and an optional “Continue with Google” method.
3. If a verified respondent creates an account later, their dashboard will show historical submission summaries containing only the form name and submission date.
4. A respondent may edit a previous response only when the form creator has enabled response editing for that form.
5. Form creators can view the complete responses to forms they own through a scalable dashboard.

---

## Roles

### Form creator

A registered Formora user who creates, publishes, shares, and manages a form and its responses.

### Respondent

A person who opens a published form and submits answers. A respondent may be anonymous, email-verified, or phone-verified depending on the form's access mode. They do not need a Formora account.

### Registered respondent

A previous respondent who later creates a Formora account and verifies the same email address or phone number used for an earlier verified submission.

---

## Form Publishing and Sharing

Each published form receives a stable link such as:

```text
https://formora.example/f/party-rsvp
```

The creator can copy this link or share it through any application. The published page must render the exact saved form definition and schema version.

The public form page should include link-preview metadata so links shared through WhatsApp, email clients, and social applications have a useful title and description.

Unpublishing a form should prevent new responses without deleting the form or its existing submissions.

---

## Respondent Access Modes

### Anyone

The respondent opens the link and immediately sees the form. No account, email verification, or phone verification is required.

Flow:

```text
Open shared link
→ View form
→ Fill answers
→ Submit
→ See confirmation
```

Anonymous responses cannot automatically be connected to an account created later because Formora has no verified identity to use for matching.

### Verified email

The respondent must prove control of an email address before accessing the form.

Flow:

```text
Open shared link
→ Enter email address
→ Receive a secure magic link
→ Select “Continue to form”
→ Return to the same form
→ Fill and submit
```

### Verified phone

The respondent must prove control of a phone number before accessing the form.

Flow:

```text
Open shared link
→ Enter phone number with country code
→ Receive a one-time code by SMS
→ Enter and verify the code
→ View the same form
→ Fill and submit
```

These flows are passwordless identity verification. They should not be described as two-factor authentication unless another independent authentication factor is also required.

---

## Submission Confirmation

After a successful submission, show a dialog or dedicated success state containing:

> Your submission has been recorded.

The interface must not show this message until the server has validated and persisted the submission successfully.

Repeated clicks and network retries must not create accidental duplicate submissions. Use an idempotency mechanism or equivalent server-side protection.

---

## Account Creation and Historical Submission Linking

A verified respondent identity must exist separately from a full Formora account.

When a person later registers and verifies the same normalized email address or phone number, Formora can link that respondent identity to the new account. It must never link submissions based only on an email address or phone number entered into a normal form answer field.

After linking, the new user's dashboard shows a “Your responses” section. Each entry shows only:

- Form name
- Submission date

Example:

```text
Your responses

Party RSVP                 19 September 2026
Customer Feedback          11 September 2026
```

The account-linking interface should explain that previous responses were found through the person's verified email address or phone number.

---

## Response Editing

Each form has a creator-controlled setting:

```text
allowResponseEditing: boolean
```

When disabled, submitted answers are final.

When enabled, an authenticated or re-verified respondent can open their previous response and update it. The server must confirm ownership of the response before allowing access or changes.

Recommended stored timestamps and revision information:

```text
submittedAt
updatedAt
revisionNumber
```

Important edits should be auditable. At minimum, retain when the response changed and which verified respondent changed it. A full answer history can be added if product or compliance needs require it.

Anonymous responses normally cannot be edited later unless Formora issues the respondent a secure, revocable edit token. This can be treated as a separate feature because losing the token means losing access.

---

## Creator Response Dashboard

The creator must be able to see responses only for forms they own or have been explicitly authorized to manage.

The dashboard should provide:

- Total response count
- Recent response activity
- Paginated response list
- Search, filtering, and sorting
- Submission date and respondent verification type
- An openable response details drawer or page
- Complete submitted answers in the details view
- CSV/Excel export

The application must support forms with hundreds of thousands of responses. It must not fetch or render every response at once.

Required scaling approach:

- Server-side cursor pagination
- Indexed database queries
- A stable sort order
- Virtualized rendering where useful
- Asynchronous export jobs for large datasets
- Authorization checks on both list and detail endpoints

Useful database indexes include:

```text
formId + submittedAt
formId + responseId
respondentIdentityId + submittedAt
accountId or ownerId + formId
```

---

## Suggested Data Model

The exact database implementation may change, but the concepts should remain separate.

### Account

```text
id
name
verifiedEmails[]
verifiedPhones[]
authenticationMethods[]
createdAt
updatedAt
```

### RespondentIdentity

```text
id
type: email | phone
normalizedValue
verifiedAt
linkedAccountId (optional)
createdAt
```

Sensitive identity values should be encrypted where recovery is required. A normalized keyed hash can be stored separately for safe lookup and matching.

### Form

```text
id
ownerAccountId
slug
published
accessMode: anyone | verified_email | verified_phone
allowResponseEditing
currentSchemaVersion
createdAt
updatedAt
```

### Submission

```text
id
formId
schemaVersion
respondentIdentityId (optional for anyone mode)
answers
submittedAt
updatedAt
revisionNumber
```

Each submission must remain connected to the form schema version used when it was submitted.

---

## Authentication and Delivery Providers

Creator accounts support ordinary sign-up/sign-in and optional Google OAuth.

Respondent verification is separate from creator account authentication. Email magic links and SMS codes require delivery infrastructure even though respondents do not need Google accounts.

Recommended implementation order:

1. Implement `anyone` access.
2. Implement verified email with magic links.
3. Add verified phone after rate limiting, country-code normalization, cost controls, and an SMS-provider abstraction are ready.

Keep email and SMS delivery behind provider interfaces so vendors can be changed without rewriting the product flow.

---

## Security and Abuse Requirements

- Verification tokens must be random, short-lived, single-use, and stored safely.
- Do not store raw OTPs or raw reusable tokens.
- Add expiry times, resend cooldowns, maximum verification attempts, and IP/identity rate limits.
- Preserve the intended form identifier through verification and reject unsafe external redirect URLs.
- Protect against submission replay and accidental duplicates.
- Check creator ownership on every response query and export.
- Check verified respondent ownership before showing or editing a previous response.
- Avoid exposing email addresses and phone numbers in URLs, logs, analytics events, or client-visible IDs.
- Record security-relevant account linking and response editing events.
- Provide privacy messaging explaining how verified contact information connects past submissions to a future account.

---

## Acceptance Criteria

### Publishing

- A creator can publish a form and receive a stable shareable link.
- Opening the link displays the exact published form version.
- An unpublished form rejects new submissions gracefully.

### Access modes

- The creator can select `anyone`, `verified_email`, or `verified_phone`.
- Anyone-mode respondents never need to create an account.
- Verified respondents return to the intended form after successful verification.
- Invalid, expired, reused, or over-attempted verification credentials are rejected.

### Submission

- Answers are validated on the server against the correct form schema version.
- A successful submission is persisted before confirmation is displayed.
- The respondent sees “Your submission has been recorded.”
- Duplicate network retries do not create unintended duplicate responses.

### Historical linking

- Creating an account with the same verified email/phone links eligible historical submissions.
- Unverified answer fields never trigger identity linking.
- The dashboard summary exposes only the form name and submission date.

### Editing

- Respondents cannot edit when the creator has disabled editing.
- Respondents can edit their own response after authentication or re-verification when editing is enabled.
- Respondents cannot open or edit another person's response.
- Update timestamps and revision information change after a successful edit.

### Creator dashboard

- Only authorized creators can list or open a form's responses.
- Response lists remain usable with hundreds of thousands of records through pagination.
- Complete answers open in a details view.
- Large exports run asynchronously instead of loading the entire dataset into a browser request.

---

## Implementation Notes and Remaining Technical Choices

The product behaviour above is decided. These implementation choices can be made when the relevant phase begins:

- Email delivery provider or SMTP service
- SMS delivery provider
- Local sign-up method: password, email magic link, or both
- Exact retention policy for verification attempts and audit records
- Whether anonymous submissions receive optional secure edit links in a later release
- Export file retention period and download authorization mechanism

These choices should not change the confirmed user experience or authorization rules in this document.

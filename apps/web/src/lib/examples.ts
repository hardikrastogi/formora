import type { FormDefinitionInput } from "@hardikrastogi/core";

const STAMP = "2026-01-01T00:00:00.000Z";

export interface Example {
  id: string;
  name: string;
  definition: FormDefinitionInput;
}

const contact: FormDefinitionInput = {
  id: "contact",
  name: "Contact form",
  schemaVersion: 1,
  createdAt: STAMP,
  updatedAt: STAMP,
  fields: [
    { id: "first_name", type: "text", label: "First name", required: true, defaultProps: { placeholder: "Ada" } },
    { id: "last_name", type: "text", label: "Last name", defaultProps: { placeholder: "Lovelace" } },
    { id: "email", type: "email", label: "Email", required: true, description: "We only use this to reply." },
    {
      id: "topic",
      type: "select",
      label: "Topic",
      defaultProps: { placeholder: "Choose a topic", options: ["Question", "Feedback", "Bug report"] },
    },
    {
      id: "message",
      type: "textarea",
      label: "Message",
      required: true,
      validation: { minLength: 10, maxLength: 500 },
      defaultProps: { rows: 4 },
    },
    { id: "subscribe", type: "checkbox", label: "Send me product updates" },
  ],
  layout: {
    rows: [
      {
        id: "row_name",
        columns: [
          { span: 6, fieldId: "first_name" },
          { span: 6, fieldId: "last_name" },
        ],
      },
      { id: "row_email", columns: [{ span: 12, fieldId: "email" }] },
      { id: "row_topic", columns: [{ span: 12, fieldId: "topic" }] },
      { id: "row_message", columns: [{ span: 12, fieldId: "message" }] },
      { id: "row_subscribe", columns: [{ span: 12, fieldId: "subscribe" }] },
    ],
  },
  theme: {},
  logic: { visibility: [], calculated: [] },
};

const event: FormDefinitionInput = {
  id: "event-registration",
  name: "Event registration",
  schemaVersion: 1,
  createdAt: STAMP,
  updatedAt: STAMP,
  fields: [
    { id: "full_name", type: "text", label: "Full name", required: true },
    { id: "email", type: "email", label: "Email", required: true },
    {
      id: "attendees",
      type: "number",
      label: "Attendees",
      required: true,
      validation: { min: 1, max: 10 },
      description: "Between 1 and 10.",
    },
    {
      id: "ticket",
      type: "radio",
      label: "Ticket type",
      defaultProps: { options: ["Standard", "VIP"], defaultValue: "Standard" },
    },
    { id: "event_date", type: "date", label: "Preferred date" },
    { id: "terms", type: "checkbox", label: "I agree to the event terms", required: true },
  ],
  layout: {
    rows: [
      { id: "r1", columns: [{ span: 12, fieldId: "full_name" }] },
      {
        id: "r2",
        columns: [
          { span: 8, fieldId: "email" },
          { span: 4, fieldId: "attendees" },
        ],
      },
      {
        id: "r3",
        columns: [
          { span: 6, fieldId: "ticket" },
          { span: 6, fieldId: "event_date" },
        ],
      },
      { id: "r4", columns: [{ span: 12, fieldId: "terms" }] },
    ],
  },
  theme: { colors: { primary: "#16a34a" }, radius: "lg", density: "spacious" },
  logic: { visibility: [], calculated: [] },
};

const custom: FormDefinitionInput = {
  id: "feedback",
  name: "Custom field and dark theme",
  schemaVersion: 1,
  createdAt: STAMP,
  updatedAt: STAMP,
  fields: [
    { id: "name", type: "text", label: "Your name" },
    { id: "rating", type: "rating", label: "How was it?", required: true, defaultProps: { max: 5 } },
    {
      id: "comment",
      type: "textarea",
      label: "Comment",
      style: { borderColor: "#22d3ee", radius: "lg" },
    },
  ],
  layout: {
    rows: [
      { id: "r1", columns: [{ span: 12, fieldId: "name" }] },
      { id: "r2", columns: [{ span: 12, fieldId: "rating" }] },
      { id: "r3", columns: [{ span: 12, fieldId: "comment" }] },
    ],
  },
  theme: {
    colors: { primary: "#22d3ee", background: "#0f172a", text: "#e2e8f0" },
    radius: "md",
    font: "Georgia",
    density: "comfortable",
  },
  logic: { visibility: [], calculated: [] },
};

export const EXAMPLES: Example[] = [
  { id: "contact", name: "Contact form", definition: contact },
  { id: "event", name: "Event registration", definition: event },
  { id: "custom", name: "Custom field + dark theme", definition: custom },
];

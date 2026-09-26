// Plain regex constants, no JSX/React import — shared between the client
// field components and the server-safe validation entry point, so the
// two never drift apart.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

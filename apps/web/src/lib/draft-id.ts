const DRAFT_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function isValidDraftId(id: string): boolean {
  return DRAFT_ID.test(id);
}

/** A fresh, unguessable form id. It doubles as the default public link name, so it must not collide. */
export function newDraftId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const tail = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
  return `form-${tail}`;
}

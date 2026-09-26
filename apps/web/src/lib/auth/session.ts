import { auth } from "@/auth";

/** The signed-in creator's account id, or null. For route handlers and server pages. */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

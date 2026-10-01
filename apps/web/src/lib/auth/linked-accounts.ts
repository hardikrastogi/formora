import { ObjectId } from "mongodb";
import { getMongoClient } from "@/lib/db/mongo-client";

/**
 * Reads and writes the same `accounts` collection the Auth.js MongoDB
 * adapter owns — one row per linked OAuth provider (just Google, here).
 */

interface LinkedAccount {
  userId: ObjectId;
  provider: string;
}

async function accounts() {
  const client = await getMongoClient();
  return client.db().collection<LinkedAccount>("accounts");
}

export async function hasGoogleLinked(userId: string): Promise<boolean> {
  if (!ObjectId.isValid(userId)) return false;
  const found = await (await accounts()).findOne({ userId: new ObjectId(userId), provider: "google" });
  return found !== null;
}

/** Returns true if a linked Google account was actually removed. */
export async function disconnectGoogle(userId: string): Promise<boolean> {
  if (!ObjectId.isValid(userId)) return false;
  const result = await (await accounts()).deleteOne({ userId: new ObjectId(userId), provider: "google" });
  return result.deletedCount > 0;
}

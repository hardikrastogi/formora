import { ObjectId } from "mongodb";
import { getMongoClient } from "@/lib/db/mongo-client";

/**
 * Reads and writes the same `users` collection the Auth.js MongoDB adapter
 * owns (native driver, not Mongoose — the adapter isn't a Mongoose model).
 * `passwordHash` is an extra field Auth.js itself never looks at; the
 * Credentials provider is the only thing that reads it.
 */

export interface AccountUser {
  _id: ObjectId;
  email: string;
  emailVerified: Date | null;
  passwordHash?: string | null;
  name?: string | null;
}

async function users() {
  const client = await getMongoClient();
  return client.db().collection<AccountUser>("users");
}

export async function findUserByEmail(email: string): Promise<AccountUser | null> {
  return (await users()).findOne({ email });
}

export async function findUserById(id: string): Promise<AccountUser | null> {
  if (!ObjectId.isValid(id)) return null;
  return (await users()).findOne({ _id: new ObjectId(id) });
}

/**
 * Finishes a password signup: creates the account if the email has never
 * been seen, or attaches a password to an existing (e.g. magic-link-only)
 * account. Either way `emailVerified` ends up set, since reaching this point
 * always came from a clicked, single-use verification link.
 */
export async function upsertVerifiedPasswordUser(email: string, passwordHash: string): Promise<AccountUser> {
  const collection = await users();
  const now = new Date();
  await collection.updateOne(
    { email },
    { $set: { passwordHash, emailVerified: now }, $setOnInsert: { email } },
    { upsert: true },
  );
  const user = await collection.findOne({ email });
  if (!user) throw new Error("Failed to create the account.");
  return user;
}

export async function setUserPassword(email: string, passwordHash: string): Promise<void> {
  await (await users()).updateOne({ email }, { $set: { passwordHash } });
}

export async function clearUserPassword(userId: string): Promise<void> {
  if (!ObjectId.isValid(userId)) return;
  await (await users()).updateOne({ _id: new ObjectId(userId) }, { $unset: { passwordHash: "" } });
}

/** Used once a "change-email" token is confirmed — the new address has already been proven. */
export async function setUserEmail(userId: string, newEmail: string): Promise<void> {
  if (!ObjectId.isValid(userId)) return;
  await (await users()).updateOne({ _id: new ObjectId(userId) }, { $set: { email: newEmail, emailVerified: new Date() } });
}

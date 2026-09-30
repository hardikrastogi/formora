import { MongoClient } from "mongodb";
import { getEnv } from "@/lib/env";

// Auth.js's MongoDB adapter wants a native driver client, not a Mongoose
// connection. Same database and URI; cached on globalThis for the same
// hot-reload reason as connect.ts.
type GlobalWithClient = typeof globalThis & { _mongoClientPromise?: Promise<MongoClient> };
const g = globalThis as GlobalWithClient;

export function getMongoClient(): Promise<MongoClient> {
  g._mongoClientPromise ??= new MongoClient(getEnv().MONGODB_URI).connect();
  return g._mongoClientPromise;
}

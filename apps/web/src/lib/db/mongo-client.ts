import { MongoClient } from "mongodb";

// Auth.js's MongoDB adapter wants a native driver client, not a Mongoose
// connection. Same database and URI; cached on globalThis for the same
// hot-reload reason as connect.ts.
type GlobalWithClient = typeof globalThis & { _mongoClientPromise?: Promise<MongoClient> };
const g = globalThis as GlobalWithClient;

export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to apps/web/.env.local (see .env.example).");
  }
  g._mongoClientPromise ??= new MongoClient(uri).connect();
  return g._mongoClientPromise;
}

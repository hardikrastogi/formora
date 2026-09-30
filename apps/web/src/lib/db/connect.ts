import mongoose from "mongoose";
import { getEnv } from "@/lib/env";

// Cached on globalThis so Next.js's dev-mode hot reload doesn't open a
// new connection on every file change.
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

type GlobalWithMongoose = typeof globalThis & { _mongooseCache?: MongooseCache };

const globalWithMongoose = globalThis as GlobalWithMongoose;
const cache: MongooseCache = globalWithMongoose._mongooseCache ?? { conn: null, promise: null };
globalWithMongoose._mongooseCache = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(getEnv().MONGODB_URI);
  cache.conn = await cache.promise;
  return cache.conn;
}

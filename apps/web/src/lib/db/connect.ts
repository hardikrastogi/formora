import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

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
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to apps/web/.env.local (see .env.example).");
  }
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(MONGODB_URI);
  cache.conn = await cache.promise;
  return cache.conn;
}

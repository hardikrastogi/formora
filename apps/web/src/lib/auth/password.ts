import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 8;

export function isValidPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH && password.length <= 200;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

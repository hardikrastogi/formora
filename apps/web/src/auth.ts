import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getMongoClient } from "@/lib/db/mongo-client";
import { sendMagicLink } from "@/lib/auth/send-magic-link";
import { findUserByEmail } from "@/lib/auth/users";
import { verifyPassword } from "@/lib/auth/password";

// Google is optional: only registered when both env vars are set, so a
// deployment without Google OAuth configured doesn't crash `/signin` or the
// build. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.
const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// Passing a function makes Auth.js build its config lazily, per request, so
// nothing tries to reach MongoDB while `next build` is collecting pages.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: MongoDBAdapter(getMongoClient()),
  // The Credentials provider cannot hand its sign-ins to the adapter (there is
  // no inherent unique id to key a database session on), so Auth.js requires
  // JWT sessions the moment any Credentials provider is registered. This
  // applies to every provider, not just Credentials — Google and Email
  // sign-ins now also get a JWT-backed session instead of a `sessions` row.
  // The adapter is still used for its other job: storing users, linked
  // Google accounts, and email-provider verification tokens.
  session: { strategy: "jwt" },
  providers: [
    {
      id: "email",
      type: "email",
      name: "Email",
      from: "Formora",
      maxAge: 15 * 60,
      options: {},
      sendVerificationRequest: async ({ identifier, url }) => sendMagicLink(identifier, url),
    },
    Credentials({
      id: "credentials",
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : null;
        const password = typeof credentials?.password === "string" ? credentials.password : null;
        if (!email || !password) return null;

        const user = await findUserByEmail(email);
        if (!user?.passwordHash || !user.emailVerified) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        return { id: String(user._id), email: user.email };
      },
    }),
    // Auth.js v5's built-in providers auto-read AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET
    // by default, NOT the GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET names this app
    // documents in .env.example — passing them explicitly is what makes our
    // chosen names actually take effect instead of silently sending "undefined".
    ...(googleConfigured
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
  ],
  pages: { signIn: "/signin", verifyRequest: "/signin/check-email" },
  callbacks: {
    // Runs on every sign-in and every subsequent request. `user` is only
    // present right after sign-in; carry the id forward on the token itself
    // (`token.sub` already holds it by default for every provider here).
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
}));

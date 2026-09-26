import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getMongoClient } from "@/lib/db/mongo-client";
import { sendMagicLink } from "@/lib/auth/send-magic-link";

// Passing a function makes Auth.js build its config lazily, per request, so
// nothing tries to reach MongoDB while `next build` is collecting pages.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: MongoDBAdapter(getMongoClient()),
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
  ],
  pages: { signIn: "/signin", verifyRequest: "/signin/check-email" },
  callbacks: {
    // Expose the account id so route handlers can check ownership.
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
}));

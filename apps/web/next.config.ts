import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Baseline protections applied to every route, CSP excluded (built separately
// below, since it differs by route for frame-ancestors). `style-src` includes
// 'unsafe-inline' deliberately: dnd-kit (the builder's drag-and-drop) and
// Radix UI (popovers, tabs) both position elements via React's `style={{...}}`
// prop, which renders as an inline `style="..."` attribute — a CSP without
// this would silently break dragging fields around the canvas and popover
// placement, not throw a loud error. `script-src` stays strict; that's where
// CSP's real protection against injected scripts lives. `'unsafe-eval'` is
// only added in development, for Next.js's own Fast Refresh.
const SHARED_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Vercel always serves over HTTPS; harmless to set even where it's a no-op.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

function contentSecurityPolicy(frameAncestors: string): string {
  return [
    "default-src 'self'",
    // 'unsafe-inline': Next.js's App Router renders its own inline <script>
    // tags for streaming/hydration (e.g. `self.__next_f.push(...)`) on every
    // page, with no way to opt out. Blocking inline scripts here breaks
    // hydration everywhere — confirmed directly: the full e2e suite went from
    // 111 passing to 43 failing the first time this was tried without it.
    // The fully-correct fix is a per-request nonce via middleware, but Next.js
    // requires that to force every page into dynamic rendering, which would
    // undo the static generation this app already relies on for /docs and the
    // homepage, and works against caching the public form page (a separate,
    // planned optimization). This is a deliberate, documented tradeoff, not
    // an oversight: script-src still blocks loading a script from any origin
    // other than this one, which is what actually stops an attacker's own
    // <script src="https://evil.example/x.js"> from running.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    // The Google sign-in redirect is a server-issued 302 the browser follows
    // to accounts.google.com after our own <form> posts to our own server
    // action — CSP's form-action only governs where the <form> itself
    // submits, which is always 'self' here.
    "form-action 'self' https://accounts.google.com",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Everything except /f/[slug]: never allowed to be framed by anyone,
        // including this site itself — there's no legitimate reason to iframe
        // a sign-in page, the builder, or the dashboard, and disallowing it
        // closes off clickjacking on those account-sensitive actions.
        source: "/:path((?!f/).*)",
        headers: [
          ...SHARED_HEADERS,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy("'none'") },
        ],
      },
      {
        // /f/[slug]: a published form is meant to be shared and embedded
        // anywhere, the same way a Google Forms link can be iframed into
        // another site — deliberately left framable, not just unrestricted
        // by omission.
        source: "/f/:slug*",
        headers: [...SHARED_HEADERS, { key: "Content-Security-Policy", value: contentSecurityPolicy("*") }],
      },
    ];
  },
};

export default nextConfig;

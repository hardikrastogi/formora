import { SiteHeader } from "@/components/site-header";

/**
 * Everything on the actual Formora product/docs site gets this shell — the
 * header and footer. The public form pages under /f/[slug] deliberately sit
 * outside this route group so a respondent sees only the form itself, the
 * same way opening a Google Forms link never shows Google's own site chrome.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="site-footer border-t py-6 text-center text-sm text-muted-foreground">
        Formora is open source under the MIT license.
      </footer>
    </div>
  );
}

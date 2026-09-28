/**
 * No header, no footer, no site nav — deliberately: opening a shared form
 * link should show only the form, the same way opening a Google Forms link
 * never shows Google's own site chrome. Still needs its own <main> landmark
 * since it sits outside (site)/layout.tsx, which is what normally provides
 * one.
 */
export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-full">{children}</main>;
}

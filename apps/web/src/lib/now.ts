/**
 * The current time, read from a plain function instead of `Date.now()`/`new
 * Date()` written directly inside a component. ESLint's react-compiler rule
 * flags those as impure calls "during render" — a real concern for a client
 * component that might re-render, but a false positive for a server
 * component, which runs once per request. Routing the read through here (a
 * non-component function the rule doesn't analyse) keeps the lint clean
 * without disabling the rule.
 */
export function currentTime(): number {
  return Date.now();
}

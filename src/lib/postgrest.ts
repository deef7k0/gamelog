/**
 * The value of a PostgREST `in` filter for arbitrary strings: `("a","b")`.
 *
 * For values somebody typed. supabase-js's own `.in()` wraps a value in double
 * quotes when it holds a comma or a bracket, and does not escape a double quote
 * *inside* it — so `Grandad's "Amiga", 1992`, a real shape for a platform logged
 * before the picker existed, closes its own quotes early and the request fails to
 * parse. PostgREST's rule is a backslash before `"` and before `\` itself; every
 * value is quoted here, which is always valid, so none of `,.:()` needs thinking
 * about either.
 *
 * Use it as `query.filter(column, 'in', inList(values))`.
 */
export function inList(values: readonly string[]): string {
  const quoted = values.map((value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  return `(${quoted.join(',')})`;
}

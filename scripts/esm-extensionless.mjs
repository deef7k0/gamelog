/**
 * Resolve extensionless relative imports, the way Metro does.
 *
 * `@material/material-color-utilities` ships pure ESM whose internal imports
 * omit `.js` ("./dynamiccolor/dynamic_color"). Metro resolves that happily and
 * Node's ESM resolver does not, so the library works in the app and cannot be
 * imported by a plain `node` test without this hook. It appends `.js` and
 * retries, and only after the real resolver has already failed — so nothing
 * that resolves normally goes anywhere near it.
 *
 * `.ts` is tried second, for the app's own modules: Metro resolves
 * `../constants/progress` to `progress.ts`, and a pure module under test should
 * not have to spell its imports differently from the rest of `src/`. The `@/`
 * alias is still not resolved here — a module a test imports reaches its
 * neighbours by relative path, as `lib/api/` already does.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXTENSIONS = ['.js', '.ts'];

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && context.parentURL && !/\.[cm]?[jt]s$/.test(specifier)) {
      for (const extension of EXTENSIONS) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) return next(`${specifier}${extension}`, context);
      }
    }
    throw error;
  }
}

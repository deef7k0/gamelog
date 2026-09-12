/**
 * Resolve extensionless relative imports, the way Metro does.
 *
 * `@material/material-color-utilities` ships pure ESM whose internal imports
 * omit `.js` ("./dynamiccolor/dynamic_color"). Metro resolves that happily and
 * Node's ESM resolver does not, so the library works in the app and cannot be
 * imported by a plain `node` test without this hook. It appends `.js` and
 * retries, and only after the real resolver has already failed — so nothing
 * that resolves normally goes anywhere near it.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && context.parentURL && !specifier.endsWith('.js')) {
      const candidate = new URL(`${specifier}.js`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return next(`${specifier}.js`, context);
    }
    throw error;
  }
}

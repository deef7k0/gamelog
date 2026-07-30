/**
 * Linked gaming accounts.
 *
 * Import from here rather than reaching into `steam/` — the point of the
 * abstraction is that screens do not name a provider unless the user chose one.
 */

export * from './types';
export * from './format';
export { allProviders, configuredProviders, getProvider, requireProvider } from './registry';
export { steamProvider, SteamProvider } from './steam/provider';

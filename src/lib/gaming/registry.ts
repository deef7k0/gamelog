import { steamProvider } from './steam/provider';
import type { GamingAccountProvider, GamingProviderId } from './types';

/**
 * Provider registry.
 *
 * The only place that knows which providers exist. Screens ask for a provider by
 * id and render from its `capabilities`, so adding Xbox means appending one entry
 * here — no screen gains a conditional.
 *
 * Order is the order sections appear when a user has several accounts linked.
 */
const PROVIDERS: GamingAccountProvider[] = [
  steamProvider,
  // Future: xboxProvider, playstationProvider, epicProvider, gogProvider,
  // battlenetProvider, riotProvider, ubisoftProvider.
];

export function allProviders(): readonly GamingAccountProvider[] {
  return PROVIDERS;
}

/** Providers this deployment has credentials for. */
export function configuredProviders(): GamingAccountProvider[] {
  return PROVIDERS.filter((provider) => provider.isConfigured());
}

export function getProvider(id: GamingProviderId): GamingAccountProvider | null {
  return PROVIDERS.find((provider) => provider.id === id) ?? null;
}

/**
 * Throwing variant, for call sites where a missing provider is a programming
 * error rather than a runtime possibility.
 */
export function requireProvider(id: GamingProviderId): GamingAccountProvider {
  const provider = getProvider(id);
  if (!provider) throw new Error(`No gaming provider registered for "${id}".`);
  return provider;
}

/**
 * Everything that talks to Supabase.
 *
 * Split by domain, re-exported here so callers keep importing from
 * `@/lib/api` regardless of which file a function lives in.
 */
export * from './awards';
export * from './core';
export * from './diary';
export * from './discover';
export * from './engagement';
export * from './events';
export * from './friends';
export * from './gaming';
export * from './wall';
export * from './lists';
export * from './notifications';
export * from './songs';
export * from './soundtracks';
export * from './storage';
export * from './types';

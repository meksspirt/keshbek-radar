import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (
  import.meta.env.VITE_SUPABASE_URL ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ??
  ''
).trim();

const rawAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  ''
).trim();

function isPlaceholderValue(value: string): boolean {
  return (
    !value ||
    value.includes('your-project-ref') ||
    value.includes('your-supabase-') ||
    value === 'undefined'
  );
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function isPrivilegedSupabaseKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) {
    return true;
  }
  const parts = key.split('.');
  if (parts.length !== 3) {
    return false;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded =
      typeof globalThis.atob === 'function' ? globalThis.atob(padded) : '';
    if (!decoded) {
      return false;
    }
    const payload = JSON.parse(decoded) as { role?: unknown };
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

export function isValidSupabaseClientConfig(url: string, key: string): boolean {
  return (
    !isPlaceholderValue(url) &&
    !isPlaceholderValue(key) &&
    isValidHttpsUrl(url) &&
    !isPrivilegedSupabaseKey(key)
  );
}

export const isSupabaseConfigured = isValidSupabaseClientConfig(rawUrl, rawAnonKey);

let clientInstance: SupabaseClient | null = null;
let pendingPasswordRecovery = false;
const recoveryListeners = new Set<() => void>();

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    clientInstance.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        pendingPasswordRecovery = true;
        recoveryListeners.forEach((listener) => listener());
      }
    });
  }
  return clientInstance;
}

export function subscribeToPasswordRecovery(listener: () => void): () => void {
  recoveryListeners.add(listener);
  if (pendingPasswordRecovery) {
    listener();
  }
  return () => {
    recoveryListeners.delete(listener);
  };
}

export function clearPendingPasswordRecovery(): void {
  pendingPasswordRecovery = false;
}

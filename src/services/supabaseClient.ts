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

export const isSupabaseConfigured =
  !isPlaceholderValue(rawUrl) &&
  !isPlaceholderValue(rawAnonKey) &&
  rawUrl.startsWith('https://');

let clientInstance: SupabaseClient | null = null;

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
  }
  return clientInstance;
}

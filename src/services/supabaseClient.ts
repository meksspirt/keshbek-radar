import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

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

/**
 * Supabase client singleton
 * Used only for Google OAuth — the app's primary auth is handled by the Flask backend.
 *
 * Required env vars (create frontend/.env.local):
 *   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<your-anon-key>
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. ' +
    'Google sign-in will be unavailable.'
  );
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = !!supabase;

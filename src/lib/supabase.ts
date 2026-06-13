import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables! Check your .env file.');
}

export const JWT_KEY = 'ailympics_jwt';

// Inject the wallet JWT into every request automatically.
// This is more reliable than supabase.auth.setSession for custom JWTs.
export const supabase = createClient(
  supabaseUrl      || 'https://placeholder.supabase.co',
  supabaseAnonKey  || 'placeholder-anon-key',
  {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (url, options = {}) => {
        const token = localStorage.getItem(JWT_KEY);
        const headers = new Headers((options as RequestInit).headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(url, { ...(options as RequestInit), headers });
      },
    },
  },
);

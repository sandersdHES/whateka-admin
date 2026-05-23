import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Did you create .env from .env.example?',
  );
}

// NOTE : on ne passe pas <Database> a createClient car @supabase/supabase-js
// 2.x exige une forme tres precise du Database type pour resoudre les
// overloads insert()/update() ; le helper Insert: Partial<...> casse la
// resolution generique (`never` propagation). Les types DB restent
// utilisables individuellement via Tables<>, TablesInsert<>, etc. depuis
// src/lib/database.types.ts pour annoter les state locaux.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

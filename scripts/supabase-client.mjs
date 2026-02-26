/**
 * Shared Supabase client for scripts.
 * Loads credentials from .env — never hardcode secrets.
 *
 * Usage:
 *   import { supabase } from './supabase-client.mjs';
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Error: Missing Supabase credentials.");
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.");
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export { SUPABASE_URL, SUPABASE_KEY };

import type { SupabaseClient } from "@supabase/supabase-js";

export type { SupabaseClient };

/** Unwraps a Supabase result, throwing on error */
export function throwIfError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

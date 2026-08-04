import { createAdminClient } from "@/lib/supabase/admin";

// Fixed-window counter backed by the `check_rate_limit` Postgres function,
// which owns the `rate_limits` table (bucket_key, window_start, count) and
// is only executable by the service-role key — see the
// rate_limit_function/rate_limit_function_restrict_execute migrations.
//
// Fails open: if the limiter itself errors (e.g. a transient DB issue), the
// action it's guarding is allowed rather than blocked, so an outage in this
// table never takes down login/password-reset/comments.
export async function checkRateLimit(
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) return true;
  return data === true;
}

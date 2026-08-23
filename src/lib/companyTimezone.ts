import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCompanyTimezone(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string> {
  const { data } = await supabase
    .from("companies")
    .select("timezone")
    .eq("id", companyId)
    .single();
  return data?.timezone || "UTC";
}

"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidHexColor } from "@/lib/color";

const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

async function requireCompanyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "company_admin" || !profile.company_id) return null;
  return { supabase, companyId: profile.company_id };
}

export async function updateCompanyTheme(
  _prevState: unknown,
  formData: FormData,
) {
  const t = await getTranslations("settings.theming.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) return { error: t("unauthorized") };

  const primaryColor = String(formData.get("primaryColor") ?? "");
  const accentColor = String(formData.get("accentColor") ?? "");
  if (!isValidHexColor(primaryColor) || !isValidHexColor(accentColor)) {
    return { error: t("invalidColor") };
  }

  const update: Record<string, unknown> = {
    theme_config: { primaryColor, accentColor },
  };

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!ALLOWED_LOGO_TYPES.includes(logo.type)) {
      return { error: t("invalidLogoType") };
    }
    if (logo.size > MAX_LOGO_BYTES) {
      return { error: t("logoTooLarge") };
    }

    const ext = logo.type === "image/svg+xml" ? "svg" : logo.type.split("/")[1];
    const path = `${ctx.companyId}/logo-${Date.now()}.${ext}`;
    const adminClient = createAdminClient();
    const { error: uploadError } = await adminClient.storage
      .from("company-logos")
      .upload(path, Buffer.from(await logo.arrayBuffer()), {
        contentType: logo.type,
        upsert: false,
      });
    if (uploadError) return { error: t("logoUploadFailed") };

    const { data: publicUrl } = adminClient.storage
      .from("company-logos")
      .getPublicUrl(path);
    update.logo_url = publicUrl.publicUrl;
  }

  const { error } = await ctx.supabase
    .from("companies")
    .update(update)
    .eq("id", ctx.companyId);

  if (error) return { error: t("saveFailed") };

  revalidatePath("/dashboard/theming");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function resetCompanyTheme(
  _prevState: unknown,
  _formData: FormData,
) {
  const t = await getTranslations("settings.theming.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) return { error: t("unauthorized") };

  const { error } = await ctx.supabase
    .from("companies")
    .update({ theme_config: {} })
    .eq("id", ctx.companyId);

  if (error) return { error: t("saveFailed") };

  revalidatePath("/dashboard/theming");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

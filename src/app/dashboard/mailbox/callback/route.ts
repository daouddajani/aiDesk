import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrigin } from "@/lib/url";
import {
  exchangeCodeForTokens,
  getGraphMailboxEmail,
} from "@/lib/microsoftGraph";

export async function GET(request: NextRequest) {
  const origin = await getOrigin();
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("mailbox_oauth_state")?.value;
  cookieStore.delete("mailbox_oauth_state");

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/dashboard/mailbox?error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      `${origin}/dashboard/mailbox?error=${encodeURIComponent("The connection request was invalid or expired. Please try again.")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "company_admin" || !profile.company_id) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  try {
    const redirectUri = `${origin}/dashboard/mailbox/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const mailboxEmail = await getGraphMailboxEmail(tokens.access_token);

    const adminClient = createAdminClient();
    const { error } = await adminClient.rpc("set_company_mailbox_secret", {
      p_company_id: profile.company_id,
      p_secret: tokens.refresh_token,
      p_mailbox_email: mailboxEmail,
      p_provider: "microsoft",
    });

    if (error) {
      return NextResponse.redirect(
        `${origin}/dashboard/mailbox?error=${encodeURIComponent("Could not save the mailbox connection. Please try again.")}`,
      );
    }

    // Seed the polling cursor at "now" so the first poll only picks up mail
    // that arrives after connecting, not the entire mailbox history.
    await supabase
      .from("companies")
      .update({ mailbox_last_synced_at: new Date().toISOString() })
      .eq("id", profile.company_id);
  } catch {
    return NextResponse.redirect(
      `${origin}/dashboard/mailbox?error=${encodeURIComponent("Microsoft authorization failed. Please try again.")}`,
    );
  }

  return NextResponse.redirect(`${origin}/dashboard/mailbox?connected=1`);
}

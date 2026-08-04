import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// `requestHeaders` carries the CSP nonce (see src/middleware.ts) through to
// rendering — passed separately from `request` because the cookie-forwarding
// dance below rebuilds the response from `request` itself, which would
// otherwise drop the nonce header.
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
) {
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the session cookie if expired. Do not run logic between
  // createServerClient and getUser() — it can desync the session cookie.
  await supabase.auth.getUser();

  return supabaseResponse;
}

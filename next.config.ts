import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Stop advertising the framework/version to would-be attackers.
  poweredByHeader: false,
  experimental: {
    // Default (true) memoizes every fetch — including Supabase's signed-URL
    // minting calls — across dev-only Hot Module Replacement refreshes, so
    // an attachment link can keep serving an increasingly stale token until
    // it genuinely expires ("exp" JWT check fails on click). Disabling this
    // means each render re-mints a fresh signed URL, at the cost of a few
    // more Supabase calls during local dev.
    serverComponentsHmrCache: false,
  },
};

export default withNextIntl(nextConfig);

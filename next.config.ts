import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Stop advertising the framework/version to would-be attackers.
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);

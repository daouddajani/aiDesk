"use client";

import { useEffect } from "react";
import { FallbackCard } from "@/components/FallbackCard";
import "./globals.css";

// Only fires if the root layout itself throws, so it can't rely on
// NextIntlClientProvider (which lives in that layout) — hardcoded English
// copy and its own <html>/<body>, per Next.js's global-error requirements.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" dir="ltr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <FallbackCard
          title="Something went wrong"
          description="An unexpected error occurred. You can try again, or head back to safety."
          homeLabel="Go home"
          homeHref="/"
          retry={{ label: "Try again", onRetry: reset }}
        />
      </body>
    </html>
  );
}

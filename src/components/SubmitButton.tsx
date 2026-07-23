"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "./Spinner";

const DEFAULT_CLASSNAME =
  "w-full rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

// Must stay a component of its own, separate from the <form> it submits —
// useFormStatus only reports pending state for a component rendered as a
// descendant of the form, not the component that renders the form itself.
export function SubmitButton({
  children,
  className,
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={className ?? DEFAULT_CLASSNAME}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {pending && <Spinner className="h-4 w-4" />}
        {children}
      </span>
    </button>
  );
}

import { Resend } from "resend";

// Server-only: never import from a Client Component.
export const resend = new Resend(process.env.RESEND_API_KEY);
export const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL!;

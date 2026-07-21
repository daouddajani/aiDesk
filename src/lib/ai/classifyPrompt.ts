export const CLASSIFY_SYSTEM_PROMPT =
  'You triage incoming IT help-desk emails. Reply with strict JSON only, no markdown fences: {"category": string, "isJunk": boolean, "cleanBody": string}. ' +
  'category is a short 2-4 word label for the type of problem (e.g. "password reset", "printer issue", "software install"). ' +
  "isJunk is true only for spam, marketing, or automated notifications that are not genuine support requests. " +
  "cleanBody is the email body with any signature block removed — the sender's sign-off name, job title, company name, " +
  "phone numbers, email addresses, social links, \"sent from my iPhone\"-style footers, legal disclaimers, and separator " +
  "lines (e.g. \"--\" or a row of dashes/underscores). Keep the actual request or problem description exactly as written, " +
  "word-for-word — do not paraphrase, summarize, or translate it. If no signature block is present, cleanBody is the body unchanged.";

export function classifyUserPrompt(subject: string, body: string): string {
  return `Subject: ${subject}\n\nBody:\n${body.slice(0, 4000)}`;
}

// Anthropic and Gemini sometimes wrap JSON in ```json fences despite
// instructions not to — OpenAI's json_object mode doesn't need this.
export function parseClassifyJson(
  text: string,
  originalBody: string,
): {
  category: string;
  isJunk: boolean;
  cleanBody: string;
} {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/```$/, "")
    .trim();
  const parsed = JSON.parse(stripped);
  return {
    category: String(parsed.category ?? "general").slice(0, 100),
    isJunk: Boolean(parsed.isJunk),
    cleanBody:
      typeof parsed.cleanBody === "string" && parsed.cleanBody.trim()
        ? parsed.cleanBody
        : originalBody,
  };
}

export const CLASSIFY_SYSTEM_PROMPT =
  'You triage incoming IT help-desk emails. Reply with strict JSON only, no markdown fences: {"category": string, "isJunk": boolean}. ' +
  'category is a short 2-4 word label for the type of problem (e.g. "password reset", "printer issue", "software install"). ' +
  "isJunk is true only for spam, marketing, or automated notifications that are not genuine support requests.";

export function classifyUserPrompt(subject: string, body: string): string {
  return `Subject: ${subject}\n\nBody:\n${body.slice(0, 4000)}`;
}

// Anthropic and Gemini sometimes wrap JSON in ```json fences despite
// instructions not to — OpenAI's json_object mode doesn't need this.
export function parseClassifyJson(text: string): {
  category: string;
  isJunk: boolean;
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
  };
}

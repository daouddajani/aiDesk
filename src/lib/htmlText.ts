const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp);/g,
      (_, name) => NAMED_ENTITIES[name],
    );
}

// Block-level tags become newlines before the rest are stripped — otherwise
// every paragraph/div/line collapses into one flat line, which destroys the
// structure quote-chain detection (stripQuotedReply) relies on to find
// boundary lines like "On ... wrote:" or "From: ... Sent: ... To: ...".
export function stripHtml(html: string): string {
  const withBreaks = html
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(withBreaks)
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

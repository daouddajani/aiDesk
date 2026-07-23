// Cuts an email body at the first line that looks like the start of a
// quoted reply chain (the previous message(s) a mail client appends below
// the sender's new text) — Gmail/Apple Mail "On ... wrote:", Outlook's
// "From: / Sent: / To: / Subject:" header block, "-----Original Message-----"
// / "-----Forwarded message-----" separators, and classic "> " quoted lines.
// Deterministic and free — runs regardless of whether AI is configured,
// unlike the AI's cleanBody (which only strips signature blocks).
export function stripQuotedReply(text: string): string {
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (
      /^-{2,}\s*(original message|forwarded message)\s*-{2,}$/i.test(line) ||
      /^on .{0,250}\bwrote:$/i.test(line) ||
      /^>/.test(line)
    ) {
      const before = lines.slice(0, i).join("\n").trim();
      return before || text.trim();
    }

    if (/^from:\s*\S/i.test(line)) {
      const next = lines.slice(i + 1, i + 5).map((l) => l.trim());
      if (
        next.some((l) => /^sent:\s*\S/i.test(l)) &&
        next.some((l) => /^to:\s*\S/i.test(l))
      ) {
        const before = lines.slice(0, i).join("\n").trim();
        return before || text.trim();
      }
    }
  }

  return text.trim();
}

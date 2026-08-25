export type ExtractedInlineImage = {
  filename: string;
  mimeType: string;
  content: Buffer;
};

// Pasting an image directly into an Outlook (or similar) compose body,
// rather than attaching it as a file, produces a bare
// <img src="data:image/png;base64,...">  with no separate MIME part at
// all — invisible to both Graph's attachments API and mailparser's
// .attachments list, and silently deleted by stripHtml()'s tag-stripping.
// This pulls those out of the raw HTML before that happens.
const DATA_URI_IMG_REGEX =
  /<img\b[^>]*\bsrc\s*=\s*(["'])data:(image\/[a-zA-Z0-9.+-]+)(?:;[a-zA-Z0-9=._-]+)*;base64,([A-Za-z0-9+/=\s]+?)\1[^>]*>/gi;

export function extractInlineImages(html: string): ExtractedInlineImage[] {
  const images: ExtractedInlineImage[] = [];
  let index = 0;

  for (const match of html.matchAll(DATA_URI_IMG_REGEX)) {
    const mimeType = match[2].toLowerCase();
    const base64 = match[3].replace(/\s+/g, "");
    if (!base64) continue;

    const content = Buffer.from(base64, "base64");
    if (content.length === 0) continue;

    index += 1;
    const extension =
      mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
    images.push({
      filename: `pasted-image-${index}.${extension}`,
      mimeType,
      content,
    });
  }

  return images;
}

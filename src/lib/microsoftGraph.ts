import { stripHtml } from "@/lib/htmlText";

const AUTHORITY = "https://login.microsoftonline.com";

// offline_access is required to get a refresh_token back from the token
// endpoint instead of just a short-lived access_token.
const GRAPH_SCOPES = "offline_access Mail.Read Mail.Send User.Read";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function buildMicrosoftAuthorizeUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("MICROSOFT_CLIENT_ID"),
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: GRAPH_SCOPES,
    state,
  });

  return `${AUTHORITY}/${requireEnv("MICROSOFT_TENANT_ID")}/oauth2/v2.0/authorize?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: requireEnv("MICROSOFT_CLIENT_ID"),
    client_secret: requireEnv("MICROSOFT_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: GRAPH_SCOPES,
  });

  const response = await fetch(
    `${AUTHORITY}/${requireEnv("MICROSOFT_TENANT_ID")}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(`Microsoft token exchange failed: ${await response.text()}`);
  }

  return response.json();
}

// Microsoft rotates the refresh_token on every use — callers must persist
// the new one returned here or the connection breaks after this call.
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: requireEnv("MICROSOFT_CLIENT_ID"),
    client_secret: requireEnv("MICROSOFT_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: GRAPH_SCOPES,
  });

  const response = await fetch(
    `${AUTHORITY}/${requireEnv("MICROSOFT_TENANT_ID")}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(`Microsoft token refresh failed: ${await response.text()}`);
  }

  return response.json();
}

export async function getGraphMailboxEmail(
  accessToken: string,
): Promise<string | null> {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.mail ?? data.userPrincipalName ?? null;
}

export type GraphMessage = {
  id: string;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  receivedDateTime: string;
  bodyText: string;
  conversationId: string | null;
  inferenceClassification: "focused" | "other" | null;
  hasAttachments: boolean;
};

// Reads only the Inbox folder, so mail Microsoft's own spam filter has
// already routed to Junk Email never reaches us. Paginated via
// @odata.nextLink, capped at 10 pages (500 messages) per poll as a safety
// bound rather than following it indefinitely.
export async function listNewInboxMessages(
  accessToken: string,
  sinceIso: string,
): Promise<GraphMessage[]> {
  const select =
    "id,subject,from,receivedDateTime,body,conversationId,inferenceClassification,hasAttachments";
  let url: string | null =
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages" +
    `?$filter=${encodeURIComponent(`receivedDateTime gt ${sinceIso}`)}` +
    `&$select=${select}&$orderby=receivedDateTime asc&$top=50`;

  const messages: GraphMessage[] = [];
  let pages = 0;

  while (url && pages < 10) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Graph list messages failed: ${await response.text()}`);
    }
    const data = await response.json();

    for (const m of data.value ?? []) {
      messages.push({
        id: m.id,
        subject: m.subject ?? null,
        fromName: m.from?.emailAddress?.name ?? null,
        fromEmail: m.from?.emailAddress?.address ?? null,
        receivedDateTime: m.receivedDateTime,
        bodyText:
          m.body?.contentType === "html"
            ? stripHtml(m.body.content ?? "")
            : (m.body?.content ?? ""),
        conversationId: m.conversationId ?? null,
        inferenceClassification: m.inferenceClassification ?? null,
        hasAttachments: Boolean(m.hasAttachments),
      });
    }

    url = data["@odata.nextLink"] ?? null;
    pages += 1;
  }

  return messages;
}

export type GraphAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  contentBytes: string; // base64
  contentId: string | null;
  isInline: boolean;
};

export async function listMessageAttachments(
  accessToken: string,
  messageId: string,
): Promise<GraphAttachment[]> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  type RawAttachment = {
    "@odata.type"?: string;
    name?: string;
    contentType?: string;
    size?: number;
    contentBytes?: string;
    contentId?: string;
    isInline?: boolean;
  };

  return (data.value ?? [])
    .filter(
      (a: RawAttachment) =>
        a["@odata.type"] === "#microsoft.graph.fileAttachment" &&
        a.contentBytes,
    )
    .map((a: RawAttachment) => ({
      filename: a.name ?? "attachment",
      mimeType: a.contentType ?? "application/octet-stream",
      size: a.size ?? 0,
      contentBytes: a.contentBytes as string,
      contentId: a.contentId ?? null,
      isInline: a.isInline === true,
    }));
}

import { createAdminClient } from "@/lib/supabase/admin";

// Agents are invited by email only (no full_name collection), so most
// profiles have a null full_name — fall back to their email rather than a
// bare "Unnamed", which reads like the ticket has no assignee at all.
export async function buildAgentNameMap(
  agents: { id: string; full_name: string | null }[],
): Promise<Map<string, string>> {
  const adminClient = createAdminClient();
  const { data: usersPage } = await adminClient.auth.admin.listUsers();
  const emailById = new Map(
    (usersPage?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );

  return new Map(
    agents.map((a) => [
      a.id,
      a.full_name ?? emailById.get(a.id) ?? "Unnamed",
    ]),
  );
}

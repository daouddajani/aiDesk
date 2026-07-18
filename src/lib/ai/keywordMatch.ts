import type { AgentSkills } from "./types";

// Keyword/tag matching against agent skills, per app.md — only reach for
// embeddings-based similarity here if this proves too weak in practice.
// Shared across all providers since it's a local computation, not an API call.
export function matchAgentByKeyword(
  category: string,
  agents: AgentSkills[],
): string | null {
  const needle = category.toLowerCase().trim();
  if (!needle) return null;
  const needleWords = needle.split(/\s+/).filter(Boolean);

  let bestAgentId: string | null = null;
  let bestScore = 0;

  for (const agent of agents) {
    let score = 0;
    for (const rawSkill of agent.skills) {
      const skill = rawSkill.toLowerCase().trim();
      if (!skill) continue;
      if (skill === needle) score += 3;
      else if (needle.includes(skill) || skill.includes(needle)) score += 2;
      else if (needleWords.some((w) => skill.includes(w) || w.includes(skill)))
        score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAgentId = agent.id;
    }
  }

  return bestScore > 0 ? bestAgentId : null;
}

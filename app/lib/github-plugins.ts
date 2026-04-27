// Curated list of live GitHub-hosted plugins surfaced on the showcase.
// Each entry is a real plugin repo a team uses in production. Clicking a
// card opens the builder with the Connect Repo dialog pre-filled — saves
// commit straight back to the source.

export interface GitHubPluginCard {
  id: string;
  /** owner/repo as accepted by parseRepoUrl */
  repo: string;
  /** Branch to load. Default 'main'. */
  branch?: string;
  /** Display title on the card. */
  title: string;
  /** 1–2 sentence description visible on the card. */
  description: string;
  /** Owning team / org for grouping or attribution. */
  team: string;
  /** Optional badge text e.g. 'private repo — org OAuth approval required'. */
  badge?: string;
}

export const GITHUB_PLUGINS: GitHubPluginCard[] = [
  {
    id: 'cc-dpa-policy-analysis',
    repo: 'global-trade-alert/cc-dpa-policy-analysis-team',
    title: 'DPA Policy Analysis Team',
    description:
      'Digital Policy Alert analytical pipeline. Used by the DPA team to research, classify, and brief on digital regulation worldwide. Edit prompts and ship improvements straight back to the repo.',
    team: 'global-trade-alert',
    badge: 'private — org OAuth approval needed',
  },
  {
    id: 'cc-gta-policy-analysis',
    repo: 'global-trade-alert/cc-gta-policy-analysis-team',
    title: 'GTA Policy Analysis Team',
    description:
      'Global Trade Alert analytical pipeline. Used by the GTA team to evaluate trade-policy interventions, draft briefings, and verify claims. Edit prompts and ship improvements straight back to the repo.',
    team: 'global-trade-alert',
    badge: 'private — org OAuth approval needed',
  },
];

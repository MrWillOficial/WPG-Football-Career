export const API_FOOTBALL_PROVIDER = {
  id: 'api-football',
  provider: 'API-Football / API-Sports',
  baseUrl: 'https://v3.football.api-sports.io',
  season: 2026,
  leagueResolver: '/leagues?country=Brazil&season=2026&search={series}',
  endpoints: {
    coverage: '/leagues?country=Brazil&season=2026&search={series}',
    teams: '/teams?league={leagueId}&season=2026',
    playersByLeague: '/players?league={leagueId}&season=2026&page={page}',
    playersByTeam: '/players?team={teamId}&season=2026&page={page}',
  },
  requiredEnv: 'API_FOOTBALL_KEY',
  status: 'adapter_ready_key_required',
};

export function buildApiFootballUrl(path) {
  return `${API_FOOTBALL_PROVIDER.baseUrl}${path}`;
}

export const DADOS_FUTEBOL_PROVIDER = {
  id: 'dados-futebol',
  provider: 'Dados Futebol',
  baseUrl: 'https://api.dadosfutebol.com.br/v1',
  season: 2026,
  status: 'candidate_primary_brazil_provider_key_required',
  notes: 'Brazil-focused API with clubs, players, lineups, matches and statistics. Use as enrichment/secondary source; CBF remains identity authority.',
  requiredEnv: 'DADOS_FUTEBOL_API_KEY',
};

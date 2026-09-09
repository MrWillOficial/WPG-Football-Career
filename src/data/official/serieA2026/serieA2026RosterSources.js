export const SERIE_A_2026_ROSTER_SOURCES = [
  ['athletico_paranaense','Athletico Paranaense - PR','20052'],
  ['atletico_mineiro','Atlético Mineiro - MG','62194'],
  ['bahia','Bahia - BA','61377'],
  ['botafogo','Botafogo - RJ','60175'],
  ['chapecoense','Chapecoense - SC','20086'],
  ['corinthians','Corinthians - SP','20001'],
  ['coritiba','Coritiba SAF - PR','61590'],
  ['cruzeiro','Cruzeiro - MG','59849'],
  ['flamengo','Flamengo - RJ','20016'],
  ['fluminense','Fluminense - RJ','20014'],
  ['gremio','Grêmio - RS','20013'],
  ['internacional','Internacional - RS','20011'],
  ['mirassol','Mirassol - SP','20385'],
  ['palmeiras','Palmeiras - SP','20002'],
  ['red_bull_bragantino','Red Bull Bragantino - SP','20007'],
  ['remo','Remo - PA','20022'],
  ['santos','Santos FC - SP','20008'],
  ['sao_paulo','São Paulo - SP','20005'],
  ['vasco','Vasco da Gama Saf - RJ','60646'],
  ['vitoria','Vitória - BA','20018'],
].map(([id, name, cbfTeamId]) => ({
  id,
  name,
  seasonYear: 2026,
  competition: 'serie_a_2026',
  provider: 'CBF',
  status: 'official_source_verified_pending_full_roster_import',
  cbfTeamId,
  url: `https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-a/2026/${cbfTeamId}?tab=atletas`,
  scope: 'registered_players_and_current_club',
}));

export const SERIE_A_2026_EXPECTED_CLUB_IDS = SERIE_A_2026_ROSTER_SOURCES.map((x) => x.id);

export function validateSerieA2026RosterSources(records = SERIE_A_2026_ROSTER_SOURCES) {
  const ids = records.map((x) => x.id);
  return {
    expectedClubs: 20,
    registeredClubs: records.length,
    missing: SERIE_A_2026_EXPECTED_CLUB_IDS.filter((id) => !ids.includes(id)),
    unexpected: ids.filter((id) => !SERIE_A_2026_EXPECTED_CLUB_IDS.includes(id)),
    duplicateFree: new Set(ids).size === ids.length,
    allOfficialSourcesPresent: records.every((x) => x.provider === 'CBF' && x.url && x.cbfTeamId),
    valid: records.length === 20 && new Set(ids).size === 20 && records.every((x) => x.provider === 'CBF' && x.url && x.cbfTeamId),
  };
}

export const SERIE_A_2026_ROSTER_SOURCE_CHECK = validateSerieA2026RosterSources();

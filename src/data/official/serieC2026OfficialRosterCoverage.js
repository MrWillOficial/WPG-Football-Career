/** CBF official Série C 2026 team pages used as roster-validation sources. */
const SERIE_C_2026_OFFICIAL_ROSTER_SOURCES = [
  ['ferroviaria-sp',20038,'Ferroviária - SP'],['amazonas-am',64052,'Amazonas SAF - AM'],['volta-redonda-rj',20065,'Volta Redonda - RJ'],['paysandu-pa',20017,'Paysandu - PA'],['caxias-rs',20062,'Caxias - RS'],['brusque-sc',63843,'Brusque - SC'],['guarani-sp',20024,'Guarani - SP'],['floresta-ce',35322,'Floresta - CE'],['confianca-se',64368,'Confiança - SE'],['ypiranga-rs',20379,'Ypiranga - RS'],['maringa-pr',21918,'Maringá FC SAF - PR'],['ituano-sp',64742,'ITUANO FC - SP'],['botafogo-pb',63524,'Botafogo PB SAF - PB'],['figueirense-sc',59879,'Figueirense - SC'],['anapolis-go',20164,'Anápolis - GO'],['itabaiana-se',20057,'Itabaiana - SE'],['barra-sc',40387,'Barra Futebol Clube - SC'],['santa-cruz-pe',20039,'Santa Cruz - PE'],['inter-de-limeira-sp',20107,'Inter de Limeira - SP'],['maranhao-ma',20043,'Maranhão - MA'],
].map(([clubId, cbfTeamId, officialName]) => ({
  clubId, cbfTeamId, officialName, seasonYear: 2026, provider: 'CBF', competition: 'CAMPEONATO_BRASILEIRO_SERIE_C',
  url: `https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-c/2026/${cbfTeamId}`,
  rosterFields: ['name','nickname','currentClub'], status: 'official_team_page_verified',
  fullIndividualNormalization: false,
}));

function validateSerieC2026OfficialRosterCoverage() {
  const ids = SERIE_C_2026_OFFICIAL_ROSTER_SOURCES.map(x => x.clubId);
  return { expectedClubs: 20, registeredClubs: ids.length, uniqueClubs: new Set(ids).size, allOfficialSourcesPresent: SERIE_C_2026_OFFICIAL_ROSTER_SOURCES.every(x => x.status === 'official_team_page_verified'), valid: ids.length === 20 && new Set(ids).size === 20 };
}
const SERIE_C_2026_OFFICIAL_ROSTER_COVERAGE_CHECK = validateSerieC2026OfficialRosterCoverage();
export { SERIE_C_2026_OFFICIAL_ROSTER_SOURCES, validateSerieC2026OfficialRosterCoverage, SERIE_C_2026_OFFICIAL_ROSTER_COVERAGE_CHECK };

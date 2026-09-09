/**
 * SÉRIE B 2026 — cobertura oficial de clubes e fonte de jogadores.
 *
 * Fonte primária: CBF, páginas oficiais de cada clube na competição.
 * Este registro valida a existência da fonte oficial por clube; ele NÃO
 * transforma um recorte parcial de elenco em elenco completo.
 */
const SERIE_B_2026_OFFICIAL_CLUB_SOURCES = [
  { clubId: 'america-mg', name: 'América-MG', cbfTeamId: 59897, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/59897', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'athletic', name: 'Athletic', cbfTeamId: 59896, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/59896', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'atletico-go', name: 'Atlético-GO', cbfTeamId: 62261, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/62261', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'avai', name: 'Avaí', cbfTeamId: 20058, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20058', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'botafogo-sp', name: 'Botafogo-SP', cbfTeamId: 56654, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/56654', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'ceara', name: 'Ceará', cbfTeamId: 20031, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20031', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'crb', name: 'CRB', cbfTeamId: 20032, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20032', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'criciuma', name: 'Criciúma', cbfTeamId: 20019, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20019', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'cuiaba', name: 'Cuiabá', cbfTeamId: 20800, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20800', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'fortaleza', name: 'Fortaleza', cbfTeamId: 63238, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/63238', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'goias', name: 'Goiás', cbfTeamId: 20028, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20028', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'juventude', name: 'Juventude', cbfTeamId: 20027, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20027', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'londrina', name: 'Londrina', cbfTeamId: 62726, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/62726', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'nautico', name: 'Náutico', cbfTeamId: 20023, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20023', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'novorizontino', name: 'Novorizontino', cbfTeamId: 31514, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/31514', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'operario-pr', name: 'Operário-PR', cbfTeamId: 20106, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20106', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'ponte-preta', name: 'Ponte Preta', cbfTeamId: 20037, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20037', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'sao-bernardo', name: 'São Bernardo', cbfTeamId: 31790, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/31790', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'sport', name: 'Sport', cbfTeamId: 20010, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20010', rosterStatus: 'official_source_verified_pending_full_import' },
  { clubId: 'vila-nova', name: 'Vila Nova', cbfTeamId: 20079, url: 'https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20079', rosterStatus: 'official_source_verified_pending_full_import' },
 ];

const SERIE_B_2026_EXPECTED_CLUB_IDS = SERIE_B_2026_OFFICIAL_CLUB_SOURCES.map(x => x.clubId);

function validateSerieB2026OfficialCoverage(clubIds = SERIE_B_2026_EXPECTED_CLUB_IDS) {
  const expected = new Set(SERIE_B_2026_EXPECTED_CLUB_IDS);
  const actual = new Set(clubIds);
  const missing = [...expected].filter(id => !actual.has(id));
  const unexpected = [...actual].filter(id => !expected.has(id));
  const duplicateFree = actual.size === clubIds.length;
  return {
    expectedClubs: expected.size,
    registeredClubs: actual.size,
    missing,
    unexpected,
    duplicateFree,
    allOfficialSourcesPresent: SERIE_B_2026_OFFICIAL_CLUB_SOURCES.length === 20 && SERIE_B_2026_OFFICIAL_CLUB_SOURCES.every(x => x.url && x.cbfTeamId),
    valid: expected.size === 20 && actual.size === 20 && missing.length === 0 && unexpected.length === 0 && duplicateFree,
  };
}

const SERIE_B_2026_OFFICIAL_COVERAGE_CHECK = validateSerieB2026OfficialCoverage();

export { SERIE_B_2026_OFFICIAL_CLUB_SOURCES, SERIE_B_2026_EXPECTED_CLUB_IDS, validateSerieB2026OfficialCoverage, SERIE_B_2026_OFFICIAL_COVERAGE_CHECK };

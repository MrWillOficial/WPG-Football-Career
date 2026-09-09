/**
 * Registro de cobertura oficial de participação dos clubes nas competições
 * nacionais 2026. A fonte aqui valida MEMBRESIA/competição; não afirma que o
 * elenco individual já foi importado. Elenco só pode ser ativado quando cada
 * jogador tiver fonte oficial individual/registro de competição.
 */
import { SERIE_A_2026_CLUBS, SERIE_B_2026_CLUBS } from '../competitions/brazil2026.js';
import { SERIE_C_2026_CLUBS } from '../competitions/serieC2026.js';
import { SERIE_D_2026_CLUB_IDS } from '../competitions/serieD2026.js';

const CBF_SOURCES_2026 = {
  serie_a_2026: 'https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026',
  serie_b_2026: 'https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-b/2026',
  serie_c_2026: 'https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-c/2026',
  serie_d_2026: 'https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-d/2026',
};

function stripD(id) { return id.includes('::') ? id.split('::')[1] : id; }
function makeRecords(competition, clubs) {
  return clubs.map(clubId => ({
    competition, clubId: stripD(clubId), seasonYear: 2026,
    provider: 'CBF', url: CBF_SOURCES_2026[competition],
    status: 'official_competition_membership',
    rosterStatus: 'pending_full_official_import',
  }));
}

const OFFICIAL_COMPETITION_COVERAGE_2026 = {
  serie_a_2026: makeRecords('serie_a_2026', SERIE_A_2026_CLUBS),
  serie_b_2026: makeRecords('serie_b_2026', SERIE_B_2026_CLUBS),
  serie_c_2026: makeRecords('serie_c_2026', SERIE_C_2026_CLUBS),
  serie_d_2026: makeRecords('serie_d_2026', SERIE_D_2026_CLUB_IDS),
};

function validateCompetitionCoverage2026() {
  const expected = { serie_a_2026: 20, serie_b_2026: 20, serie_c_2026: 20, serie_d_2026: 96 };
  const result = {};
  for (const [key, count] of Object.entries(expected)) {
    const rows = OFFICIAL_COMPETITION_COVERAGE_2026[key] || [];
    const ids = rows.map(r => r.clubId);
    result[key] = { expected: count, registered: ids.length, unique: new Set(ids).size, officialSources: rows.every(r => r.status === 'official_competition_membership'), valid: ids.length === count && new Set(ids).size === count && rows.every(r => r.status === 'official_competition_membership') };
  }
  result.valid = Object.values(result).every(v => v && typeof v === 'object' && v.valid);
  return result;
}

const OFFICIAL_COMPETITION_COVERAGE_2026_CHECK = validateCompetitionCoverage2026();

export { CBF_SOURCES_2026, OFFICIAL_COMPETITION_COVERAGE_2026, validateCompetitionCoverage2026, OFFICIAL_COMPETITION_COVERAGE_2026_CHECK };

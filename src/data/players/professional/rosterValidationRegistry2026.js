/**
 * Registro de validação de fonte para elencos profissionais 2026.
 * A validação da página do clube NÃO significa que todos os campos individuais
 * já foram normalizados no banco do jogo.
 */
import { SERIE_B_2026_OFFICIAL_CLUB_SOURCES } from '../../official/serieB2026OfficialCoverage.js';
import { SERIE_C_2026_OFFICIAL_ROSTER_SOURCES } from '../../official/serieC2026OfficialRosterCoverage.js';

const ROSTER_VALIDATION_2026 = {
  serie_b_2026: SERIE_B_2026_OFFICIAL_CLUB_SOURCES.map(x => ({ ...x, validatedFields: ['name','nickname','currentClub'] })),
  serie_c_2026: SERIE_C_2026_OFFICIAL_ROSTER_SOURCES.map(x => ({ ...x, validatedFields: ['name','nickname','currentClub'] })),
  serie_a_2026: [],
  serie_d_2026: [],
};

function validateRosterSourceRegistry2026() {
  const b = ROSTER_VALIDATION_2026.serie_b_2026;
  const c = ROSTER_VALIDATION_2026.serie_c_2026;
  return {
    serieB: { clubs: b.length, unique: new Set(b.map(x => x.clubId)).size, valid: b.length === 20 && new Set(b.map(x => x.clubId)).size === 20 },
    serieC: { clubs: c.length, unique: new Set(c.map(x => x.clubId)).size, valid: c.length === 20 && new Set(c.map(x => x.clubId)).size === 20 },
    individualImportActivated: false,
    valid: b.length === 20 && c.length === 20,
  };
}

const ROSTER_VALIDATION_2026_CHECK = validateRosterSourceRegistry2026();
export { ROSTER_VALIDATION_2026, validateRosterSourceRegistry2026, ROSTER_VALIDATION_2026_CHECK };

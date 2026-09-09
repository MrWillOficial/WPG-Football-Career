import { CompetitionEngineV2 } from '../competition/CompetitionEngineV2.js';
import { buildSerieA2026Definition, buildSerieB2026Definition } from '../../data/competitions/brazil2026.js';
import { buildSerieC2026Definition } from '../../data/competitions/serieC2026.js';
import { buildSerieD2026Definition } from '../../data/competitions/serieD2026.js';
import { SERIE_D_2026_CLUBS_MAP } from '../../data/competitions/serieD2026.js';
import { SERIE_C_2026_CLUBS_MAP } from '../../data/competitions/serieC2026.js';
import { SERIE_A_2026_CLUBS_MAP, SERIE_B_2026_CLUBS_MAP } from '../../data/competitions/brazil2026.js';

const DEFINITIONS = {
  serie_a_2026: buildSerieA2026Definition,
  serie_b_2026: buildSerieB2026Definition,
  serie_c_2026: buildSerieC2026Definition,
  serie_d_2026: buildSerieD2026Definition,
};
const MAPS = {
  serie_a_2026: SERIE_A_2026_CLUBS_MAP,
  serie_b_2026: SERIE_B_2026_CLUBS_MAP,
  serie_c_2026: SERIE_C_2026_CLUBS_MAP,
  serie_d_2026: SERIE_D_2026_CLUBS_MAP,
};

function hashSeed(value) { let h = 2166136261 >>> 0; for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619); return h >>> 0; }
function rngFor(seed, key) { let s = (hashSeed(`${seed}:${key}`) || 1) >>> 0; return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; }; }
function poisson(rng, lambda) { const L = Math.exp(-lambda); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
function score(rng, home, away) {
  const h = Math.max(0.45, Math.min(2.7, 1.25 + ((home.overall || 60) - (away.overall || 60)) / 55));
  const a = Math.max(0.35, Math.min(2.35, 1.15 + ((away.overall || 60) - (home.overall || 60)) / 60));
  return { gh: poisson(rng, h), ga: poisson(rng, a) };
}

function simulateOfficialWorldSeason(family, clubIds, seed = 2026) {
  const makeDefinition = DEFINITIONS[family];
  if (!makeDefinition) return { valid: false, reason: 'unsupported_family' };
  const definition = makeDefinition(clubIds);
  const clubsMap = MAPS[family] || {};
  const resultsProvider = stage => (fixturesOrPairs, legFormat) => {
    const rng = rngFor(seed, stage.id);
    if (stage.type !== 'knockout') {
      return fixturesOrPairs.map(f => {
        const h = clubsMap[f.homeId] || { overall: 60 }, a = clubsMap[f.awayId] || { overall: 60 };
        return { ...f, ...score(rng, h, a) };
      });
    }
    return fixturesOrPairs.map(pair => {
      const [homeId, awayId] = pair;
      const h1 = clubsMap[homeId] || { overall: 60 }, a1 = clubsMap[awayId] || { overall: 60 };
      if (legFormat === 'single') {
        const sc = score(rng, h1, a1);
        return { score: sc, penaltyWinner: sc.gh === sc.ga ? pair[Math.floor(rng() * 2)] : null };
      }
      const leg1 = score(rng, h1, a1);
      const leg2 = score(rng, a1, h1);
      return { leg1, leg2, penaltyWinner: (leg1.gh + leg2.gh) === (leg1.ga + leg2.ga) ? pair[Math.floor(rng() * 2)] : null };
    });
  };
  const resolved = CompetitionEngineV2.resolveCompetitionSeason(definition, resultsProvider);
  return { valid: true, ...resolved };
}

function applyOfficialWorldOutcomes(clubDivision, family, resolved) {
  const next = { ...clubDivision };
  const promo = resolved.outcomes?.promotion || { clubIds: [], targetFamily: null };
  const releg = resolved.outcomes?.relegation || { clubIds: [], targetFamily: null };
  promo.clubIds.forEach(id => { if (promo.targetFamily) next[id] = promo.targetFamily; });
  releg.clubIds.forEach(id => { if (releg.targetFamily) next[id] = releg.targetFamily; });
  return next;
}

function advanceOfficialWorldDivisions(clubDivision, excludeFamily, seed = 2026) {
  let next = { ...clubDivision };
  const families = ['serie_a_2026', 'serie_b_2026', 'serie_c_2026', 'serie_d_2026'];
  families.filter(f => f !== excludeFamily).forEach((family, index) => {
    const ids = Object.keys(next).filter(id => next[id] === family);
    if (ids.length === 0) return;
    const result = simulateOfficialWorldSeason(family, ids, seed + index * 1009);
    if (result.valid) next = applyOfficialWorldOutcomes(next, family, result);
  });
  return next;
}

export { simulateOfficialWorldSeason, advanceOfficialWorldDivisions, applyOfficialWorldOutcomes };

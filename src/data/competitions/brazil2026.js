import { CompetitionEngineV2, runCompetitionEngineV2SelfCheck } from '../../engines/competition/CompetitionEngineV2.js';
import { CLUBS, CLUBS_MAP, SERIE_D_CLUBS, makeCompetitionConfig, makeSerieDConfig } from '../_mock/mockData.js';
import { SERIE_C_2026_CLUBS, SERIE_C_2026_CLUBS_MAP, buildSerieC2026Definition, runSerieC2026DemoSelfCheck } from './serieC2026.js';
import { SERIE_D_2026_CLUBS_MAP, buildSerieD2026Definition, runSerieD2026DemoSelfCheck } from './serieD2026.js';
import { buildCopaDoBrasil2026Definition, runCopaDoBrasil2026SelfCheck } from './copaDoBrasil2026.js';
import { SERIE_D_2026_CLUB_IDS } from './serieD2026.js';
/* ============================================================================
   SÉRIE B 2026 e SÉRIE A 2026 — DADOS OFICIAIS (Wikipédia PT citando CBF,
   Metropoles, CNN Brasil, confirmados em 2026). Cadeia de desempate
   IDÊNTICA pras duas (pts→vitórias→saldo→gols→confronto direto→cartões→
   sorteio), confirmada pela própria CBF via Wikipédia. Série A é a mais
   simples de todas: liga pura, 38 rodadas, sem mata-mata/playoff nenhum.
   Série B tem liga + playoff de acesso (3ºx6º, 4ºx5º) — mando e desempate
   do playoff NUNCA usam campanha computada: o próprio seed já é a resposta
   (3º sempre superior a 6º na tabela original), então quem manda a volta e
   quem vence o empate agregado é sempre o melhor posicionado do par, sem
   pênaltis — confirmado por múltiplas fontes da CBF.
============================================================================ */
const SERIE_A_2026_CLUBS = [
  'Atlético-MG', 'Bahia', 'Botafogo', 'Bragantino', 'Corinthians', 'Cruzeiro', 'Flamengo', 'Fluminense',
  'Grêmio', 'Internacional', 'Mirassol', 'Palmeiras', 'Santos', 'São Paulo', 'Vasco', 'Vitória',
  'Athletico-PR', 'Chapecoense', 'Coritiba', 'Remo',
];
const SERIE_B_2026_CLUBS = [
  'América-MG', 'Athletic', 'Atlético-GO', 'Avaí', 'Botafogo-SP', 'Ceará', 'CRB', 'Criciúma', 'Cuiabá',
  'Fortaleza', 'Goiás', 'Juventude', 'Londrina', 'Náutico', 'Novorizontino', 'Operário-PR', 'Ponte Preta',
  'São Bernardo', 'Sport', 'Vila Nova',
];
function makeBrasileiraoClubsMap(names) {
  return Object.fromEntries(names.map(name => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return [name, { id: name, name, overall: 70 + (hash % 9), color: `hsl(${hue}, 45%, 32%)` }]; // sintético, nunca dado oficial
  }));
}
const SERIE_A_2026_CLUBS_MAP = makeBrasileiraoClubsMap(SERIE_A_2026_CLUBS);
const SERIE_B_2026_CLUBS_MAP = makeBrasileiraoClubsMap(SERIE_B_2026_CLUBS);

const BRASILEIRAO_TIEBREAK_CHAIN = [ // idêntica pra A e B (Wikipédia PT, citando CBF)
  { kind: 'stat', field: 'pts' }, { kind: 'stat', field: 'v' }, { kind: 'stat', field: 'sg' }, { kind: 'stat', field: 'gp' },
  { kind: 'head_to_head' },
  { kind: 'unavailable_stat', reason: 'cartões vermelhos não são rastreados no jogo hoje' },
  { kind: 'unavailable_stat', reason: 'cartões amarelos não são rastreados no jogo hoje' },
  { kind: 'deterministic_draw' },
];

function buildSerieA2026Definition(clubIdsOverride) {
  const clubIds = clubIdsOverride || SERIE_A_2026_CLUBS;
  return {
    family: 'serie_a_2026', seasonYear: 2026,
    stages: [
      { id: 'fase_unica', type: 'league', doubleRound: true, tiebreakChain: BRASILEIRAO_TIEBREAK_CHAIN,
        participantsSource: { type: 'external', list: clubIds },
        cutlines: [
          { name: 'champion', rule: { kind: 'topN', n: 1 } },
          { name: 'relegated', rule: { kind: 'bottomN', n: 4 } },
        ] },
    ],
    seasonOutcomes: { promotion: null, relegation: { sourceStageId: 'fase_unica', qualifierGroup: 'relegated', targetFamily: 'serie_b_2026' } },
  };
}
function buildSerieB2026Definition(clubIdsOverride) {
  const clubIds = clubIdsOverride || SERIE_B_2026_CLUBS;
  return {
    family: 'serie_b_2026', seasonYear: 2026,
    stages: [
      { id: 'liga', type: 'league', doubleRound: true, tiebreakChain: BRASILEIRAO_TIEBREAK_CHAIN,
        participantsSource: { type: 'external', list: clubIds },
        cutlines: [
          { name: 'direct_access', rule: { kind: 'topN', n: 2 } },
          { name: 'top6_zone', rule: { kind: 'topN', n: 6 } },
          { name: 'playoff_zone', rule: { kind: 'rankRange', start: 3, end: 6 } },
          { name: 'relegated', rule: { kind: 'bottomN', n: 4 } },
        ] },
      { id: 'playoff', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'liga', qualifierGroup: 'playoff_zone' },
        campaignSeed: { type: 'fromStage', stageId: 'liga' },
        seeding: { kind: 'sequential' },
        homeAdvantageRule: { kind: 'aggregateCampaign', tiebreakChain: BRASILEIRAO_TIEBREAK_CHAIN, drawSeedPrefix: 'serie_b_playoff' },
        aggregateTieBreak: 'campaign',
        cutlines: [{ name: 'playoff_winners', rule: { kind: 'reachedRound', round: 'final' } }] },
    ],
    seasonOutcomes: {
      promotion: [
        { sourceStageId: 'liga', qualifierGroup: 'direct_access', targetFamily: 'serie_a_2026' },
        { sourceStageId: 'playoff', qualifierGroup: 'playoff_winners', targetFamily: 'serie_a_2026' },
      ],
      relegation: { sourceStageId: 'liga', qualifierGroup: 'relegated', targetFamily: 'serie_c_2026' },
    },
  };
}

// Playoff da Série B — fora do CompetitionSeasonResolver de propósito: o
// mando/desempate não usa campanha computada (o seed JÁ é a resposta: 3º é
// por definição melhor que 6º na tabela original). pair[1] sempre manda a
// volta e vence o empate agregado — sem pênaltis, confirmado por múltiplas
// fontes da CBF.
function resolveSerieBPlayoffTie(betterSeedId, worseSeedId, leg1, leg2) {
  // leg1: worseSeed em casa (ida); leg2: betterSeed em casa (volta).
  const goalsBetter = leg1.ga + leg2.gh;
  const goalsWorse = leg1.gh + leg2.ga;
  if (goalsBetter !== goalsWorse) return goalsBetter > goalsWorse ? betterSeedId : worseSeedId;
  return betterSeedId; // empate agregado → melhor campanha (seed fixo) vence, sem pênaltis
}

function runSerieA2026DemoSelfCheck() {
  let seed = 20260128;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  try {
    const { resolvedStages } = CompetitionEngineV2.resolveCompetitionSeason(buildSerieA2026Definition(), () => (fx) => fx.map(f => ({ ...f, gh: Math.floor(rng() * 4), ga: Math.floor(rng() * 4) })));
    const ok = SERIE_A_2026_CLUBS.length === 20 && resolvedStages.fase_unica.qualifierGroups.champion.length === 1 && resolvedStages.fase_unica.qualifierGroups.relegated.length === 4;
    if (!ok) console.error('[Série A 2026 self-check] Estrutura não bateu o esperado.');
    return ok;
  } catch (e) { console.error('[Série A 2026 self-check] Erro:', e); return false; }
}
function runSerieB2026DemoSelfCheck() {
  let seed = 20260321;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  try {
    const getResultsProvider = (stage) => (fx, legFormat) => stage.type === 'knockout'
      ? fx.map(pair => ({ leg1: { gh: Math.floor(rng() * 4), ga: Math.floor(rng() * 4) }, leg2: { gh: Math.floor(rng() * 4), ga: Math.floor(rng() * 4) }, penaltyWinner: pair[0] }))
      : fx.map(f => ({ ...f, gh: Math.floor(rng() * 4), ga: Math.floor(rng() * 4) }));
    const { resolvedStages, outcomes } = CompetitionEngineV2.resolveCompetitionSeason(buildSerieB2026Definition(), getResultsProvider);
    const ok = SERIE_B_2026_CLUBS.length === 20 && outcomes.promotion.clubIds.length === 4 && outcomes.relegation.clubIds.length === 4 && resolvedStages.liga.qualifierGroups.top6_zone.length === 6 && resolvedStages.liga.qualifierGroups.playoff_zone.length === 4 && resolvedStages.playoff.qualifierGroups.playoff_winners.length === 2;
    if (!ok) console.error('[Série B 2026 self-check] Estrutura não bateu o esperado.');
    return ok;
  } catch (e) { console.error('[Série B 2026 self-check] Erro:', e); return false; }
}

if (typeof window !== 'undefined') { runCompetitionEngineV2SelfCheck(); runSerieD2026DemoSelfCheck(); runSerieC2026DemoSelfCheck(); runSerieA2026DemoSelfCheck(); runSerieB2026DemoSelfCheck(); runCopaDoBrasil2026SelfCheck(); }
const COMPETITION_TEMPLATES = {
  estadual_sp: { clubs: CLUBS, makeConfig: makeCompetitionConfig },
  serie_d: { clubs: SERIE_D_CLUBS, makeConfig: makeSerieDConfig },
  serie_a_2026: { clubs: SERIE_A_2026_CLUBS_MAP, makeConfig: (seasonYear, ids) => ({ id: `serie_a_2026_${seasonYear}`, name: 'Brasileirão Série A', family: 'serie_a_2026', format: 'league', participants: ids || SERIE_A_2026_CLUBS, promotion: { count: 0, target_competition_id: null }, relegation: { count: 4, target_competition_id: 'serie_b_2026' }, tiebreakers: ['pts','v','sg','gp'], calendar_pattern: { match_intervals: [3,4] } }) },
  serie_b_2026: { clubs: SERIE_B_2026_CLUBS_MAP, makeConfig: (seasonYear, ids) => ({ id: `serie_b_2026_${seasonYear}`, name: 'Brasileirão Série B', family: 'serie_b_2026', format: 'league', participants: ids || SERIE_B_2026_CLUBS, promotion: { count: 2, target_competition_id: 'serie_a_2026' }, relegation: { count: 4, target_competition_id: 'serie_c_2026' }, tiebreakers: ['pts','v','sg','gp'], calendar_pattern: { match_intervals: [3,4] } }) },
  serie_c_2026: { clubs: SERIE_C_2026_CLUBS_MAP, makeConfig: (seasonYear, ids) => ({ id: `serie_c_2026_${seasonYear}`, name: 'Brasileirão Série C', family: 'serie_c_2026', format: 'league', participants: ids || SERIE_C_2026_CLUBS, promotion: { count: 4, target_competition_id: 'serie_b_2026' }, relegation: { count: 2, target_competition_id: 'serie_d_2026' }, tiebreakers: ['pts','v','sg','gp'], calendar_pattern: { match_intervals: [3,4] } }) },
  serie_d_2026: { clubs: SERIE_D_2026_CLUBS_MAP, makeConfig: (seasonYear, ids) => ({ id: `serie_d_2026_${seasonYear}`, name: 'Brasileirão Série D', family: 'serie_d_2026', format: 'league', participants: ids || SERIE_D_2026_CLUB_IDS, promotion: { count: 6, target_competition_id: 'serie_c_2026' }, relegation: { count: 0, target_competition_id: null }, tiebreakers: ['pts','v','sg','gp'], calendar_pattern: { match_intervals: [3,4] } }) },
};

// Universo completo de clubes (todas as divisões que existem hoje). Com o
// Mundo Persistente, qualquer clube pode estar em qualquer divisão em
// qualquer momento — não existe mais "os clubes da divisão X" como lista fixa,
// só "em que divisão cada clube está agora" (ver worldState.clubDivision).
const ALL_CLUBS_MAP = { ...CLUBS_MAP, ...Object.fromEntries(SERIE_D_CLUBS.map(c => [c.id, c])), ...SERIE_D_2026_CLUBS_MAP, ...SERIE_C_2026_CLUBS_MAP, ...SERIE_A_2026_CLUBS_MAP, ...SERIE_B_2026_CLUBS_MAP };

// Nomes/cores/roster de qualquer clube, não importa a divisão atual dele.
function getActiveClubsMap() {
  return ALL_CLUBS_MAP;
}

// Divisão-natal de cada clube — usado só pra inicializar o Mundo Persistente
// na primeira vez (ou se o save não tiver worldState ainda).
function initialClubDivision() {
  const map = {};
  CLUBS.forEach(c => { map[c.id] = 'estadual_sp'; });
  SERIE_D_CLUBS.forEach(c => { map[c.id] = 'serie_d'; });
  SERIE_A_2026_CLUBS.forEach(id => { map[id] = 'serie_a_2026'; });
  SERIE_B_2026_CLUBS.forEach(id => { map[id] = 'serie_b_2026'; });
  SERIE_C_2026_CLUBS.forEach(id => { map[id] = 'serie_c_2026'; });
  SERIE_D_2026_CLUB_IDS.forEach(id => { map[id] = 'serie_d_2026'; });
  return map;
}


export { buildCopaDoBrasil2026Definition, runCopaDoBrasil2026SelfCheck, SERIE_A_2026_CLUBS, SERIE_B_2026_CLUBS, makeBrasileiraoClubsMap, SERIE_A_2026_CLUBS_MAP, SERIE_B_2026_CLUBS_MAP, BRASILEIRAO_TIEBREAK_CHAIN, buildSerieA2026Definition, buildSerieB2026Definition, resolveSerieBPlayoffTie, runSerieA2026DemoSelfCheck, runSerieB2026DemoSelfCheck, COMPETITION_TEMPLATES, ALL_CLUBS_MAP, getActiveClubsMap, initialClubDivision };

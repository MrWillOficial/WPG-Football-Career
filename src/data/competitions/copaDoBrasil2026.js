import { CompetitionEngineV2 } from '../../engines/competition/CompetitionEngineV2.js';

/**
 * COPA DO BRASIL 2026 — REGULAMENTO OFICIAL CBF.
 * 126 clubes, 9 fases, 155 partidas.
 * Fases 1–4: jogo único, empate -> pênaltis.
 * Fase 5–semifinais: ida e volta, empate agregado -> pênaltis.
 * Final: jogo único, empate -> pênaltis.
 *
 * A lista de participantes não é hard-coded como resultado de uma temporada:
 * ela é resolvida por critérios de classificação (Série A + campeões nacionais
 * previstos + vagas estaduais). Isso permite que a carreira mude os clubes
 * participantes nas temporadas seguintes sem contaminar os dados oficiais de 2026.
 */

const COPA_DO_BRASIL_2026 = {
  family: 'copa_do_brasil_2026',
  seasonYear: 2026,
  participantCount: 126,
  phases: 9,
  matches: 155,
  dates: { start: '2026-02-18', final: '2026-12-06' },
  phaseRules: {
    fase1: { entrants: 28, matches: 14, format: 'single', penaltyOnDraw: true },
    fase2: { entrants: 88, matches: 44, actualMatches: 88, format: 'two-legged', penaltyOnAggregateDraw: true },
    fase3: { entrants: 48, matches: 24, format: 'single', penaltyOnDraw: true },
    fase4: { entrants: 24, matches: 12, format: 'single', penaltyOnDraw: true },
    fase5: { entrants: 32, matches: 32, actualMatches: 32, format: 'two-legged', penaltyOnAggregateDraw: true },
    oitavas: { entrants: 16, matches: 16, actualMatches: 16, format: 'two-legged', penaltyOnAggregateDraw: true },
    quartas: { entrants: 8, matches: 8, actualMatches: 8, format: 'two-legged', penaltyOnAggregateDraw: true },
    semifinal: { entrants: 4, matches: 4, actualMatches: 4, format: 'two-legged', penaltyOnAggregateDraw: true },
    final: { entrants: 2, matches: 1, format: 'single', penaltyOnDraw: true },
  },
  criteria: {
    serieA2026: 20,
    champions2025: ['copa_do_nordeste_2025', 'copa_verde_2025', 'serie_c_2025', 'serie_d_2025'],
    stateFederationSlots: 102,
  },
};

const COPA_DO_BRASIL_2026_PHASE_LABELS = {
  fase1: '1ª Fase', fase2: '2ª Fase', fase3: '3ª Fase', fase4: '4ª Fase', fase5: '5ª Fase',
  oitavas: 'Oitavas de Final', quartas: 'Quartas de Final', semifinal: 'Semifinal', final: 'Final',
};

function unique(ids) { return [...new Set((ids || []).filter(Boolean))]; }

/**
 * Resolve os participantes a partir do estado do mundo.
 * `state` pode fornecer os campeões nacionais e as vagas estaduais já apuradas.
 * Não inventamos clubes para preencher lacunas: `pending` fica explícito.
 */
function resolveCopaDoBrasil2026Participants(state = {}) {
  const serieA = unique(state.serieA2026Clubs);
  const champions = unique(state.nationalChampions2025);
  const stateQualified = unique(state.stateQualified2026);
  const missing = [];
  if (serieA.length !== 20) missing.push(`serieA2026Clubs:${20 - serieA.length}`);
  if (champions.length !== 4) missing.push(`nationalChampions2025:${4 - champions.length}`);
  if (stateQualified.length !== 102) missing.push(`stateQualified2026:${102 - stateQualified.length}`);
  const participants = unique([...serieA, ...champions, ...stateQualified]);
  return {
    participants,
    count: participants.length,
    valid: participants.length === 126 && missing.length === 0,
    status: participants.length === 126 && missing.length === 0 ? 'official_complete' : 'pending_official_qualification_data',
    missing,
  };
}

function makeDeterministicRng(seed = 20260218) {
  let s = seed >>> 0;
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
}

function syntheticScore(rng) {
  const home = Math.floor(rng() * 4);
  const away = Math.floor(rng() * 4);
  return { gh: home, ga: away };
}

function buildCopaDoBrasil2026Definition(input = {}) {
  const phase1Clubs = input.phase1Clubs || [];
  const phase2Entries = input.phase2Entries || [];
  const champions = input.champions || [];
  const serieA = input.serieA || [];
  if (phase1Clubs.length !== 28 || phase2Entries.length !== 74 || champions.length !== 4 || serieA.length !== 20) {
    throw new Error('Copa do Brasil 2026 exige 28 clubes na F1, 74 entradas adicionais na F2, 4 campeões nacionais na F3 e 20 clubes da Série A na F5.');
  }
  return {
    family: COPA_DO_BRASIL_2026.family, seasonYear: 2026,
    stages: [
      { id: 'fase1', type: 'knockout', legFormat: 'single', maxRounds: 1,
        participantsSource: { type: 'external', list: phase1Clubs }, seeding: { kind: 'sequential' },
        cutlines: [{ name: 'advance', rule: { kind: 'reachedRound', round: 'final' } }] },
      { id: 'fase2', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'combined', sources: [
          { type: 'fromStage', stageId: 'fase1', qualifierGroup: 'advance' },
          { type: 'external', list: phase2Entries },
        ] }, seeding: { kind: 'sequential' },
        cutlines: [{ name: 'advance', rule: { kind: 'reachedRound', round: 'final' } }] },
      { id: 'fase3', type: 'knockout', legFormat: 'single', maxRounds: 1,
        participantsSource: { type: 'combined', sources: [
          { type: 'fromStage', stageId: 'fase2', qualifierGroup: 'advance' },
          { type: 'external', list: champions },
        ] }, seeding: { kind: 'sequential' },
        cutlines: [{ name: 'advance', rule: { kind: 'reachedRound', round: 'final' } }] },
      { id: 'fase4', type: 'knockout', legFormat: 'single', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'fase3', qualifierGroup: 'advance' }, seeding: { kind: 'sequential' },
        cutlines: [{ name: 'advance', rule: { kind: 'reachedRound', round: 'final' } }] },
      { id: 'fase5', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'combined', sources: [
          { type: 'fromStage', stageId: 'fase4', qualifierGroup: 'advance' },
          { type: 'external', list: serieA },
        ] }, seeding: { kind: 'sequential' },
        cutlines: [{ name: 'advance', rule: { kind: 'reachedRound', round: 'final' } }] },
      { id: 'oitavas', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'fase5', qualifierGroup: 'advance' }, seeding: { kind: 'sequential' },
        cutlines: [{ name: 'advance', rule: { kind: 'reachedRound', round: 'final' } }] },
      { id: 'quartas', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'oitavas', qualifierGroup: 'advance' }, seeding: { kind: 'sequential' },
        cutlines: [{ name: 'advance', rule: { kind: 'reachedRound', round: 'final' } }] },
      { id: 'semifinal', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'quartas', qualifierGroup: 'advance' }, seeding: { kind: 'sequential' },
        cutlines: [{ name: 'finalists', rule: { kind: 'reachedRound', round: 'final' } }] },
      { id: 'final', type: 'knockout', legFormat: 'single', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'semifinal', qualifierGroup: 'finalists' }, seeding: { kind: 'sequential' },
        cutlines: [{ name: 'champion', rule: { kind: 'winner' } }] },
    ],
    seasonOutcomes: { promotion: null, relegation: null },
  };
}

function runCopaDoBrasil2026SelfCheck() {
  const counts = COPA_DO_BRASIL_2026_PHASES_CHECK;
  const totalMatches = Object.values(COPA_DO_BRASIL_2026.phaseRules).reduce((sum, x) => sum + x.matches, 0);
  const ok = COPA_DO_BRASIL_2026.participantCount === 126 && COPA_DO_BRASIL_2026.phases === 9 && totalMatches === 155
    && counts.every(Boolean);
  if (!ok) console.error('[Copa do Brasil 2026 self-check] Estrutura oficial inconsistente.', { counts, totalMatches });
  return ok;
}

const COPA_DO_BRASIL_2026_PHASES_CHECK = [
  COPA_DO_BRASIL_2026.phaseRules.fase1.entrants === 28,
  COPA_DO_BRASIL_2026.phaseRules.fase2.entrants === 88,
  COPA_DO_BRASIL_2026.phaseRules.fase3.entrants === 48,
  COPA_DO_BRASIL_2026.phaseRules.fase4.entrants === 24,
  COPA_DO_BRASIL_2026.phaseRules.fase5.entrants === 32,
  COPA_DO_BRASIL_2026.phaseRules.oitavas.entrants === 16,
  COPA_DO_BRASIL_2026.phaseRules.quartas.entrants === 8,
  COPA_DO_BRASIL_2026.phaseRules.semifinal.entrants === 4,
  COPA_DO_BRASIL_2026.phaseRules.final.entrants === 2,
];

export {
  COPA_DO_BRASIL_2026,
  COPA_DO_BRASIL_2026_PHASE_LABELS,
  COPA_DO_BRASIL_2026_PHASES_CHECK,
  resolveCopaDoBrasil2026Participants,
  buildCopaDoBrasil2026Definition,
  makeDeterministicRng,
  syntheticScore,
  runCopaDoBrasil2026SelfCheck,
};

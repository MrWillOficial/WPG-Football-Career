import { CompetitionEngineV2 } from '../../engines/competition/CompetitionEngineV2.js';
/* ============================================================================
   SÉRIE C 2026 — DADOS OFICIAIS (CBF, REC_Brasileiro_Serie_C_2026.pdf,
   23/02/2026, Anexo A/B). 20 clubes reais. Formato bem mais simples que a
   Série D: 1ª Fase (liga única, turno único) → 2ª Fase (2 grupos de 4,
   turno e returno) → 3ª Fase (final, ida e volta). Nenhuma peça nova de
   motor foi necessária — só configuração, sobre o mesmo Competition Engine
   V2 já validado.
============================================================================ */
const SERIE_C_2026_CLUBS = [
  'Ferroviária-SP', 'Amazonas-AM', 'Volta Redonda-RJ', 'Paysandu-PA',
  'Caxias-RS', 'Brusque-SC', 'Guarani-SP', 'Floresta-CE', 'Confiança-SE', 'Ypiranga-RS',
  'Maringá-PR', 'Ituano-SP', 'Botafogo-PB', 'Figueirense-SC', 'Anápolis-GO', 'Itabaiana-SE',
  'Barra-SC', 'Santa Cruz-PE', 'Inter de Limeira-SP', 'Maranhão-MA',
];
const SERIE_C_2026_CLUBS_MAP = Object.fromEntries(
  SERIE_C_2026_CLUBS.map(name => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return [name, { id: name, name, overall: 62 + (hash % 12), color: `hsl(${hue}, 45%, 32%)` }]; // sintético, nunca dado oficial
  })
);

const SERIE_C_2026_FASE1_TIEBREAK_CHAIN = [ // Art. 16 — SEM confronto direto
  { kind: 'stat', field: 'v' }, { kind: 'stat', field: 'sg' }, { kind: 'stat', field: 'gp' },
  { kind: 'unavailable_stat', reason: 'cartões vermelhos não são rastreados no jogo hoje' },
  { kind: 'unavailable_stat', reason: 'cartões amarelos não são rastreados no jogo hoje' },
  { kind: 'deterministic_draw' },
];
const SERIE_C_2026_FASE2_TIEBREAK_CHAIN = [ // Art. 20 — COM confronto direto (só entre 2, sem reaplicação)
  { kind: 'stat', field: 'v' }, { kind: 'stat', field: 'sg' }, { kind: 'stat', field: 'gp' },
  { kind: 'head_to_head' },
  { kind: 'unavailable_stat', reason: 'cartões vermelhos não são rastreados no jogo hoje' },
  { kind: 'unavailable_stat', reason: 'cartões amarelos não são rastreados no jogo hoje' },
  { kind: 'deterministic_draw' },
];
const SERIE_C_2026_MANDO_VOLTA_FINAL_CHAIN = [ // Art. 22 — cadeia curta e própria
  { kind: 'stat', field: 'pts' }, { kind: 'stat', field: 'v' }, { kind: 'stat', field: 'sg' },
  { kind: 'deterministic_draw' },
];
const SERIE_C_2026_STAGE_LABELS = { fase1: '1ª Fase', fase2: '2ª Fase', fase3_final: '3ª Fase (Final)' };

function buildSerieC2026Definition(clubIdsOverride) {
  const clubIds = clubIdsOverride || SERIE_C_2026_CLUBS;
  return {
    family: 'serie_c_2026', seasonYear: 2026,
    stages: [
      { id: 'fase1', type: 'league', doubleRound: false, tiebreakChain: SERIE_C_2026_FASE1_TIEBREAK_CHAIN,
        participantsSource: { type: 'external', list: clubIds },
        cutlines: [
          { name: 'advance', rule: { kind: 'topN', n: 8 } },
          { name: 'relegated', rule: { kind: 'bottomN', n: 2 } },
        ] },
      { id: 'fase2', type: 'group', groupCount: 2, doubleRound: true, tiebreakChain: SERIE_C_2026_FASE2_TIEBREAK_CHAIN,
        participantsSource: { type: 'fromStage', stageId: 'fase1', qualifierGroup: 'advance' },
        campaignSeed: { type: 'fromStage', stageId: 'fase1' },
        groupingRule: { kind: 'seeded', orderSource: { type: 'fromStage', stageId: 'fase1', qualifierGroup: 'advance' } },
        cutlines: [
          { name: 'promoted', rule: { kind: 'topNPerGroup', n: 2 } },
          { name: 'finalists', rule: { kind: 'topNPerGroup', n: 1 } },
        ] },
      { id: 'fase3_final', type: 'knockout', legFormat: 'two-legged',
        participantsSource: { type: 'fromStage', stageId: 'fase2', qualifierGroup: 'finalists' },
        campaignSeed: { type: 'fromStage', stageId: 'fase2' },
        seeding: { kind: 'sequential' },
        homeAdvantageRule: { kind: 'aggregateCampaign', tiebreakChain: SERIE_C_2026_MANDO_VOLTA_FINAL_CHAIN, drawSeedPrefix: 'serie_c_final' },
        cutlines: [{ name: 'champion', rule: { kind: 'winner' } }] },
    ],
    seasonOutcomes: {
      promotion: { sourceStageId: 'fase2', qualifierGroup: 'promoted', targetFamily: 'serie_b_2026' },
      relegation: { sourceStageId: 'fase1', qualifierGroup: 'relegated', targetFamily: 'serie_d_2026' },
    },
  };
}

function resolveSerieC2026UpTo(stageId, customClubIds, resultsHistory, sessionSeed) {
  const fullDef = buildSerieC2026Definition(customClubIds);
  const idx = fullDef.stages.findIndex(s => s.id === stageId);
  const partialDef = { ...fullDef, stages: fullDef.stages.slice(0, idx + 1) };

  function makeRng(offset) { let s = (sessionSeed + offset) % 2147483648; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function neutralScore(rng) { function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; } return [poisson(1.3), poisson(1.3)]; }

  const getResultsProvider = (stage) => {
    const rng = makeRng(stage.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 7919);
    const history = resultsHistory[stage.id];
    return (fixturesOrPairings, legFormat) => {
      if (stage.type !== 'knockout') {
        return fixturesOrPairings.map(f => {
          if (history) {
            const real = history.find(r => r.homeId === f.homeId && r.awayId === f.awayId);
            if (real) return { ...f, gh: real.gh, ga: real.ga };
          }
          const [gh, ga] = neutralScore(rng); return { ...f, gh, ga };
        });
      }
      return fixturesOrPairings.map(pair => {
        if (history && pair.includes(history.myId)) {
          return { leg1: history.leg1, leg2: history.leg2, penaltyWinner: history.penaltyWinner || pair[0] };
        }
        const [gh1, ga1] = neutralScore(rng), [gh2, ga2] = neutralScore(rng);
        return { leg1: { gh: gh1, ga: ga1 }, leg2: { gh: gh2, ga: ga2 }, penaltyWinner: pair[Math.floor(rng() * 2)] };
      });
    };
  };

  return CompetitionEngineV2.resolveCompetitionSeason(partialDef, getResultsProvider);
}

function runSerieC2026DemoSelfCheck() {
  let seed = 20260405;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const getResultsProvider = (stage) => (fx, legFormat) => stage.type === 'knockout'
    ? fx.map(pair => ({ leg1: { gh: Math.floor(rng() * 3), ga: Math.floor(rng() * 3) }, leg2: { gh: Math.floor(rng() * 3), ga: Math.floor(rng() * 3) }, penaltyWinner: pair[0] }))
    : fx.map(f => ({ ...f, gh: Math.floor(rng() * 4), ga: Math.floor(rng() * 4) }));
  try {
    const { resolvedStages, outcomes } = CompetitionEngineV2.resolveCompetitionSeason(buildSerieC2026Definition(), getResultsProvider);
    const ok = SERIE_C_2026_CLUBS.length === 20
      && resolvedStages.fase1.qualifierGroups.advance.length === 8
      && resolvedStages.fase1.qualifierGroups.relegated.length === 2
      && outcomes.promotion.clubIds.length === 4
      && resolvedStages.fase2.qualifierGroups.finalists.length === 2
      && !!resolvedStages.fase3_final.qualifierGroups.champion[0];
    if (!ok) console.error('[Série C 2026 self-check] Estrutura não bateu o esperado.', { resolvedStages, outcomes });
    return ok;
  } catch (e) {
    console.error('[Série C 2026 self-check] Erro ao resolver a temporada de demonstração:', e);
    return false;
  }
}


export { SERIE_C_2026_CLUBS, SERIE_C_2026_CLUBS_MAP, SERIE_C_2026_FASE1_TIEBREAK_CHAIN, SERIE_C_2026_FASE2_TIEBREAK_CHAIN, SERIE_C_2026_MANDO_VOLTA_FINAL_CHAIN, SERIE_C_2026_STAGE_LABELS, buildSerieC2026Definition, resolveSerieC2026UpTo, runSerieC2026DemoSelfCheck };

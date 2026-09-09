import { poisson } from '../../engines/match/matchEngine.js';
import { CompetitionEngineV2 } from '../../engines/competition/CompetitionEngineV2.js';
/* ============================================================================
   SÉRIE D 2026 — DADOS OFICIAIS (CBF, REC_Brasileiro_Serie_D_2026.pdf,
   24/02/2026 + Anexo A/B). 96 clubes reais, 16 grupos reais (A01-A16),
   conferidos nome a nome contra o Anexo A na auditoria oficial. Ainda NÃO
   conectados a nenhum clube jogável nem ao Mundo Persistente — só a
   definição da competição em si, pronta pra quando a integração de
   gameplay acontecer (próximo incremento, não este).
============================================================================ */
const SERIE_D_2026_GROUPS = {
  A01: ['Nacional-AM', 'Manaus-AM', 'Manauara-AM', 'GAS-RR', 'Monte Roraima-RR', 'São Raimundo-RR'],
  A02: ['Independência-AC', 'Galvez-AC', 'Humaitá-AC', 'Porto Velho-RO', 'Guaporé-RO', 'Araguaína-TO'],
  A03: ['Gama-DF', 'Brasiliense-DF', 'Luverdense-MT', 'Primavera-MT', 'Inhumas-GO', 'Aparecidense-GO'],
  A04: ['Capital-DF', 'Ceilândia-DF', 'Mixto-MT', 'Operário-MT', 'União-MT', 'Goiatuba-GO'],
  A05: ['Trem-AP', 'Oratório-AP', 'Tuna Luso-PA', 'Águia de Marabá-PA', 'Tocantinópolis-TO', 'Imperatriz-MA'],
  A06: ['Sampaio Corrêa-MA', 'Moto Club-MA', 'IAPE-MA', 'Maracanã-CE', 'Iguatu-CE', 'Parnahyba-PI'],
  A07: ['Ferroviário-CE', 'Tirol-CE', 'Atlético-CE', 'Altos-PI', 'Piauí-PI', 'Fluminense-PI'],
  A08: ['ABC-RN', 'América-RN', 'Laguna-RN', 'Sousa-PB', 'Maguary-PE', 'Central-PE'],
  A09: ['Retrô-PE', 'Decisão-PE', 'Serra Branca-PB', 'Treze-PB', 'Lagarto-SE', 'Sergipe-SE'],
  A10: ['ASA-AL', 'CSA-AL', 'CSE-AL', 'Jacuipense-BA', 'Alagoinhas Atlético Clube-BA', 'Juazeirense-BA'],
  A11: ['Uberlândia-MG', 'Betim-MG', 'CRAC-GO', 'ABECAT-GO', 'Operário-MS', 'Ivinhema-MS'],
  A12: ['Porto Seguro SAF-BA', 'Rio Branco-ES', 'Vitória-ES', 'Real Noroeste-ES', 'Tombense-MG', 'Esporte Clube Democrata-MG'],
  A13: ['Madureira-RJ', 'Portuguesa-RJ', 'America-RJ', 'Portuguesa-SP', 'Água Santa-SP', 'Pouso Alegre-MG'],
  A14: ['Nova Iguaçu-RJ', 'Sampaio Corrêa-RJ', 'Maricá-RJ', 'XV de Novembro-SP', 'Noroeste-SP', 'Velo Clube-SP'],
  A15: ['Cianorte-PR', 'FC Cascavel-PR', 'Santa Catarina-SC', 'Joinville-SC', 'Guarany de Bagé-RS', 'São Luiz-RS'],
  A16: ['Blumenau-SC', 'Marcílio Dias-SC', 'São Joseense-PR', 'Azuriz-PR', 'São José-RS', 'Brasil-RS'],
};
const SERIE_D_2026_GROUP_PAIRS = [['A01', 'A02'], ['A03', 'A04'], ['A05', 'A06'], ['A07', 'A08'], ['A09', 'A10'], ['A11', 'A12'], ['A13', 'A14'], ['A15', 'A16']];
const SERIE_D_2026_TIEBREAK_CHAIN = [
  { kind: 'stat', field: 'pts' },
  { kind: 'stat', field: 'v' },
  { kind: 'stat', field: 'sg' },
  { kind: 'stat', field: 'gp' },
  { kind: 'head_to_head' },
  { kind: 'unavailable_stat', reason: 'cartões vermelhos não são rastreados no jogo hoje (sem elenco individual)' },
  { kind: 'unavailable_stat', reason: 'cartões amarelos não são rastreados no jogo hoje (sem elenco individual)' },
  { kind: 'deterministic_draw' },
];
const SERIE_D_2026_CLUB_IDS = [];
const SERIE_D_2026_ASSIGNMENT = {};
Object.entries(SERIE_D_2026_GROUPS).forEach(([groupId, names]) => {
  names.forEach(name => { const id = `${groupId}::${name}`; SERIE_D_2026_CLUB_IDS.push(id); SERIE_D_2026_ASSIGNMENT[id] = groupId; });
});

// Mapa de EXIBIÇÃO/SIMULAÇÃO pros 96 clubes reais — o resto da interface e o
// Match Engine (reaproveitado) esperam todo clube ter um `name`/`overall` em
// ALL_CLUBS_MAP, senão quebram ao tentar mostrar "próximo jogo" ou simular
// uma partida entre dois clubes que não são o do jogador. O `overall` aqui é
// SINTÉTICO — não representa força real de nenhum clube (não temos e não
// inventamos esse dado oficial); existe só pra o simulador funcionar,
// igual já fazemos com os clubes fictícios do Paulista/Série D mock.
const SERIE_D_2026_CLUBS_MAP = Object.fromEntries(
  SERIE_D_2026_CLUB_IDS.map(id => {
    const name = id.split('::')[1];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return [id, {
      id,
      name, // remove o prefixo do grupo (ex: "A01::Nacional-AM" → "Nacional-AM")
      overall: 58 + (hash % 12), // sintético, faixa igual à Série D mock — nunca dado oficial
      color: `hsl(${hue}, 45%, 32%)`, // determinístico por nome — só pra o monograma não ficar sem cor, não é dado oficial
    }];
  })
);

// Sequência de fases jogáveis (Art. 13/17) — depois da 5ª Fase (quartas), a
// sequência bifurca: semifinalista vai pra 6ª Fase (acesso já garantido,
// Art. 6), eliminado vai pro Playoff. Nenhuma das duas tem "próxima" depois.
const SERIE_D_2026_NEXT_STAGE = {
  fase2_r64: 'fase3_r32', fase3_r32: 'fase4_oitavas', fase4_oitavas: 'fase5_quartas',
  fase6_semifinal: 'fase7_final', playoff: null, fase7_final: null,
};
const SERIE_D_2026_STAGE_LABELS = {
  fase2_r64: '2ª Fase', fase3_r32: '3ª Fase', fase4_oitavas: '4ª Fase (Oitavas)',
  fase5_quartas: '5ª Fase (Quartas)', playoff: 'Playoff de acesso', fase6_semifinal: '6ª Fase (Semifinal)', fase7_final: '7ª Fase (Final)',
};

// Monta a CompetitionDefinition completa (7 fases + playoff) — mesma
// estrutura validada em test-serieD-full-chain.js, com os dados oficiais.
function buildSerieD2026Definition(clubIdsOverride, assignmentOverride) {
  const clubIds = clubIdsOverride || SERIE_D_2026_CLUB_IDS;
  const assignment = assignmentOverride || SERIE_D_2026_ASSIGNMENT;
  const CHAIN = SERIE_D_2026_TIEBREAK_CHAIN;
  return {
    family: 'serie_d_2026', seasonYear: 2026,
    stages: [
      { id: 'fase1_grupos', type: 'group', groupCount: 16, doubleRound: true, tiebreakChain: CHAIN,
        participantsSource: { type: 'external', list: clubIds },
        groupingRule: { kind: 'explicit', assignment },
        cutlines: [{ name: 'advance', rule: { kind: 'topNPerGroup', n: 4 } }] },
      { id: 'fase2_r64', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'fase1_grupos', qualifierGroup: 'advance' },
        campaignSeed: { type: 'fromStage', stageId: 'fase1_grupos' },
        seeding: { kind: 'groupPairCross', groupPairs: SERIE_D_2026_GROUP_PAIRS, perGroupStandingsSource: { type: 'fromStage', stageId: 'fase1_grupos' } },
        homeAdvantageRule: { kind: 'groupPosition' },
        cutlines: [{ name: 'advance', rule: { kind: 'reachedRound', round: 'round_of_32' } }] },
      { id: 'fase3_r32', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'fase2_r64', qualifierGroup: 'advance' },
        campaignSeed: { type: 'fromStage', stageId: 'fase2_r64' },
        seeding: { kind: 'sequential' },
        homeAdvantageRule: { kind: 'aggregateCampaign', tiebreakChain: CHAIN, drawSeedPrefix: 'fase3' },
        cutlines: [{ name: 'advance', rule: { kind: 'reachedRound', round: 'round_of_16' } }] },
      { id: 'fase4_oitavas', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'fase3_r32', qualifierGroup: 'advance' },
        campaignSeed: { type: 'fromStage', stageId: 'fase3_r32' },
        seeding: { kind: 'sequential' },
        homeAdvantageRule: { kind: 'aggregateCampaign', tiebreakChain: CHAIN, drawSeedPrefix: 'fase4' },
        cutlines: [{ name: 'advance', rule: { kind: 'reachedRound', round: 'quarterfinal' } }] },
      { id: 'fase5_quartas', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'fase4_oitavas', qualifierGroup: 'advance' },
        campaignSeed: { type: 'fromStage', stageId: 'fase4_oitavas' },
        seeding: { kind: 'campaignRanked', tiebreakChain: CHAIN, drawSeedPrefix: 'fase5_seed' },
        homeAdvantageRule: { kind: 'aggregateCampaign', tiebreakChain: CHAIN, drawSeedPrefix: 'fase5_mando' },
        cutlines: [
          { name: 'semifinalists', rule: { kind: 'reachedRound', round: 'semifinal' } },
          { name: 'eliminated', rule: { kind: 'eliminatedAtRound', round: 'quarterfinal' } },
        ] },
      { id: 'playoff', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'fase5_quartas', qualifierGroup: 'eliminated' },
        campaignSeed: { type: 'fromStage', stageId: 'fase5_quartas' },
        seeding: { kind: 'campaignRanked', tiebreakChain: CHAIN, drawSeedPrefix: 'playoff_seed' },
        homeAdvantageRule: { kind: 'aggregateCampaign', tiebreakChain: CHAIN, drawSeedPrefix: 'playoff_mando' },
        aggregateTieBreak: 'campaign', winCondition: 'legPoints', // Art. 21: pontos por perna, sem pênaltis
        cutlines: [{ name: 'winners', rule: { kind: 'reachedRound', round: 'final' } }] },
      { id: 'fase6_semifinal', type: 'knockout', legFormat: 'two-legged', maxRounds: 1,
        participantsSource: { type: 'fromStage', stageId: 'fase5_quartas', qualifierGroup: 'semifinalists' },
        campaignSeed: { type: 'fromStage', stageId: 'fase5_quartas' },
        seeding: { kind: 'sequential' },
        homeAdvantageRule: { kind: 'aggregateCampaign', tiebreakChain: CHAIN, drawSeedPrefix: 'fase6' },
        cutlines: [{ name: 'finalists', rule: { kind: 'reachedRound', round: 'final' } }] },
      { id: 'fase7_final', type: 'knockout', legFormat: 'two-legged',
        participantsSource: { type: 'fromStage', stageId: 'fase6_semifinal', qualifierGroup: 'finalists' },
        campaignSeed: { type: 'fromStage', stageId: 'fase6_semifinal' },
        seeding: { kind: 'sequential' },
        homeAdvantageRule: { kind: 'aggregateCampaign', tiebreakChain: CHAIN, drawSeedPrefix: 'fase7' },
        cutlines: [{ name: 'champion', rule: { kind: 'winner' } }] },
    ],
    seasonOutcomes: {
      promotion: [
        { sourceStageId: 'fase5_quartas', qualifierGroup: 'semifinalists', targetFamily: 'serie_c_2026' },
        { sourceStageId: 'playoff', qualifierGroup: 'winners', targetFamily: 'serie_c_2026' },
      ],
      relegation: null, // Série D não tem rebaixamento nacional
    },
  };
}

// Self-check/demo — resolve UMA temporada sintética completa (placares
// gerados por RNG determinística, NUNCA usados como dado real) só pra provar
// que a definição oficial roda corretamente dentro do jogo. Loga um resumo
// legível no console; não altera nenhum estado do jogo, não é chamado por
// nenhuma tela ainda.
// Resolve a Série D 2026 (com os dados customizados do jogador) até UMA
// fase específica — nunca precisa jogar as fases seguintes de verdade pra
// saber quem é o próximo adversário/mando. `resultsHistory` tem o resultado
// REAL do jogador em cada fase já jogada (chave = stageId); tudo o mais é
// simulado de forma neutra (sem inventar força pros 96 clubes reais), mas
// com uma seed FIXA por sessão — garante que recomputar não "treme" o resto
// do mundo entre uma chamada e outra.
function resolveSerieD2026UpTo(stageId, customClubIds, customAssignment, resultsHistory, sessionSeed) {
  const fullDef = buildSerieD2026Definition(customClubIds, customAssignment);
  const idx = fullDef.stages.findIndex(s => s.id === stageId);
  const partialDef = { ...fullDef, stages: fullDef.stages.slice(0, idx + 1) };

  function makeRng(offset) { let s = (sessionSeed + offset) % 2147483648; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function neutralScore(rng) { function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; } return [poisson(1.3), poisson(1.3)]; }

  const getResultsProvider = (stage) => {
    const rng = makeRng(stage.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 7919);
    const history = resultsHistory[stage.id];
    return (fixturesOrPairings, legFormat) => {
      if (stage.type === 'group') {
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

function runSerieD2026DemoSelfCheck() {
  let seed = 20260913;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const getResultsProvider = (stage) => (fixturesOrPairings, legFormat) => {
    if (stage.type === 'knockout') {
      return fixturesOrPairings.map(pair => legFormat === 'single'
        ? { score: { gh: Math.floor(rng() * 3), ga: Math.floor(rng() * 3) }, penaltyWinner: pair[Math.floor(rng() * 2)] }
        : { leg1: { gh: Math.floor(rng() * 3), ga: Math.floor(rng() * 3) }, leg2: { gh: Math.floor(rng() * 3), ga: Math.floor(rng() * 3) }, penaltyWinner: pair[Math.floor(rng() * 2)] });
    }
    return fixturesOrPairings.map(f => ({ ...f, gh: Math.floor(rng() * 4), ga: Math.floor(rng() * 4) }));
  };

  try {
    const { resolvedStages, outcomes } = CompetitionEngineV2.resolveCompetitionSeason(buildSerieD2026Definition(), getResultsProvider);
    const advance64 = resolvedStages.fase1_grupos.qualifierGroups.advance.length === 64;
    const semifinalists = outcomes.promotion.clubIds;
    const playoffWinners = resolvedStages.playoff.qualifierGroups.winners;
    const champion = resolvedStages.fase7_final.qualifierGroups.champion[0];
    const totalAcessos = new Set([...semifinalists, ...playoffWinners]).size;
    const ok = SERIE_D_2026_CLUB_IDS.length === 96 && advance64 && totalAcessos === 6 && !!champion;
    if (!ok) {
      console.error('[Série D 2026 self-check] Estrutura não bateu o esperado.', { totalClubes: SERIE_D_2026_CLUB_IDS.length, advance64, totalAcessos, champion });
    }
    return ok;
  } catch (e) {
    console.error('[Série D 2026 self-check] Erro ao resolver a temporada de demonstração:', e);
    return false;
  }
}


export { SERIE_D_2026_GROUPS, SERIE_D_2026_GROUP_PAIRS, SERIE_D_2026_TIEBREAK_CHAIN, SERIE_D_2026_CLUB_IDS, SERIE_D_2026_ASSIGNMENT, SERIE_D_2026_CLUBS_MAP, SERIE_D_2026_NEXT_STAGE, SERIE_D_2026_STAGE_LABELS, buildSerieD2026Definition, resolveSerieD2026UpTo, runSerieD2026DemoSelfCheck };

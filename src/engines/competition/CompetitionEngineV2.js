import { runSerieD2026DemoSelfCheck } from '../../data/competitions/serieD2026.js';
import { freshStandings, generateLeagueFixtures, sortStandings } from '../match/matchEngine.js';
/* ============================================================================
   COMPETITION ENGINE V2 — motor genérico completo (liga/grupos/mata-mata,
   desempate oficial por cluster, campanha acumulada entre fases, mando de
   campo por posição de grupo ou por campanha, playoff por pontos/perna).
   Construído e validado isoladamente antes de entrar aqui — ver relatórios
   de migração e auditoria oficial contra o REC da Série D 2026.

   Vive num namespace próprio (`CompetitionEngineV2`) de propósito: NENHUMA
   função aqui colide com nada do motor legado acima. NADA da gameplay atual
   lê este objeto ainda — é aditivo. Paulista e Série D mock (fase única)
   continuam 100% no motor legado, comportamentalmente idêntico ao V2 nesse
   caso (ver runCompetitionEngineV2SelfCheck). A Série D 2026 REAL (96
   clubes, 7 fases + playoff) já está montada abaixo e se autovalida a cada
   carregamento (ver runSerieD2026DemoSelfCheck), mas ainda não está
   conectada a nenhuma tela nem ao loop de temporada do jogador.
============================================================================ */
const CompetitionEngineV2 = (function () {
    // ---- de core.js ----
  // ============================================================================
  // CORE — primitivas puras de tabela (fixtures, standings, cutlines).
  // Preservação de comportamento: o algoritmo de buildLeagueFixtures é IDÊNTICO
  // ao generateLeagueFixtures original do career-v2.jsx (round-robin por rotação
  // de array, mesma ordem de mando de campo). Ver test-regression.js para a
  // prova de que a saída bate byte a byte com o original para as mesmas entradas.
  // ============================================================================

  function buildLeagueFixtures(participantIds, doubleRound = true) {
    const ids = [...participantIds];
    if (ids.length % 2 !== 0) ids.push(null);
    const n = ids.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const roundMatches = [];
      for (let i = 0; i < n / 2; i++) {
        const home = ids[i], away = ids[n - 1 - i];
        if (home && away) roundMatches.push(r % 2 === 0 ? [home, away] : [away, home]);
      }
      rounds.push(roundMatches);
      ids.splice(1, 0, ids.pop());
    }
    if (!doubleRound) return rounds;
    const second = rounds.map(round => round.map(([h, a]) => [a, h]));
    return [...rounds, ...second];
  }

  function freshStandings(participantIds) {
    const map = {};
    participantIds.forEach(id => { map[id] = { club_id: id, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }; });
    return map;
  }

  function sortStandings(standingsMap, tiebreakers) {
    const rows = Object.values(standingsMap).map(r => ({ ...r, sg: r.gp - r.gc }));
    return rows.sort((a, b) => {
      for (const key of tiebreakers) { if (b[key] !== a[key]) return b[key] - a[key]; }
      return 0;
    });
  }

  // Aplica UM resultado de partida a uma tabela — pura, devolve tabela nova.
  function applyMatchResultToStandings(standingsMap, homeId, awayId, gh, ga) {
    const next = { ...standingsMap };
    next[homeId] = { ...next[homeId] };
    next[awayId] = { ...next[awayId] };
    next[homeId].pj++; next[awayId].pj++;
    next[homeId].gp += gh; next[homeId].gc += ga;
    next[awayId].gp += ga; next[awayId].gc += gh;
    if (gh > ga) { next[homeId].v++; next[homeId].pts += 3; next[awayId].d++; }
    else if (gh < ga) { next[awayId].v++; next[awayId].pts += 3; next[homeId].d++; }
    else { next[homeId].e++; next[awayId].e++; next[homeId].pts++; next[awayId].pts++; }
    return next;
  }

  // Constrói a tabela final a partir de uma lista de resultados já resolvidos.
  function computeLeagueStandings(participantIds, matchResults, tiebreakers) {
    let standings = freshStandings(participantIds);
    matchResults.forEach(({ homeId, awayId, gh, ga }) => {
      standings = applyMatchResultToStandings(standings, homeId, awayId, gh, ga);
    });
    return sortStandings(standings, tiebreakers);
  }

  // ---------------------------------------------------------------------------
  // CUTLINES — regras nomeadas, config-driven. Nunca "os 4 últimos" hardcoded
  // em lugar nenhum fora daqui.
  // ---------------------------------------------------------------------------
  const CUTLINE_RULES = {
    topN: (sorted, params) => sorted.slice(0, params.n).map(r => r.club_id),
    bottomN: (sorted, params) => sorted.slice(-params.n).map(r => r.club_id),
    rankRange: (sorted, params) => sorted.slice(params.start - 1, params.end).map(r => r.club_id),
  };

  // Aplica todas as cutlines de uma fase de tabela sobre a classificação final.
  // Retorna { [cutlineName]: [clubId, ...] }. Um clube pode ficar de fora de
  // TODAS as cutlines (ex: meio de tabela da Série C fase 1) — isso é esperado,
  // não é órfão: significa "sem consequência, permanece na mesma divisão".
  function applyCutlines(sorted, cutlines) {
    const groups = {};
    cutlines.forEach(cl => {
      const rule = CUTLINE_RULES[cl.rule.kind];
      if (!rule) throw new Error(`Cutline desconhecida: ${cl.rule.kind}`);
      groups[cl.name] = rule(sorted, cl.rule);
    });
    return groups;
  }

    // ---- de tiebreak.js ----
  // ============================================================================
  // TIEBREAK — resolve empates seguindo uma CADEIA de critérios configurada
  // (a mesma ordem do regulamento oficial), mas nunca finge avaliar um critério
  // para o qual o jogo não tem dado (ex: cartões, sem elenco individual).
  //
  // IMPORTANTE — por que isso é um algoritmo de CLUSTERS, não de comparação
  // par-a-par: a regra oficial do confronto direto ("só vale entre EXATAMENTE
  // 2 clubes empatados") é uma propriedade do GRUPO inteiro que está empatado
  // naquele momento, não de um par isolado. Um comparador pairwise simples
  // (Array.sort de JS) nunca sabe quantos outros clubes também estão
  // empatados — por isso a ordenação aqui trabalha em CLUSTERS (agrupando
  // quem está empatado a cada critério) e só invoca confronto direto quando o
  // cluster tem exatamente 2 membros.
  //
  // INTERPRETAÇÃO OFICIAL ADOTADA (pesquisada, não presumida) — "sem
  // reaplicação":
  //   Fonte primária: REC Brasileiro Série D (cláusula recorrente em vários
  //   anos) — "Ocorrendo igualdade em pontos... aplicam-se sucessivamente:
  //   a) vitórias; b) saldo; c) gols pró; d) confronto direto; e) cartões
  //   vermelhos; f) cartões amarelos; g) sorteio. § No caso de empate entre
  //   mais de 2 Clubes, não será considerado o quarto critério [confronto
  //   direto]." Cruzado com 6+ fontes jornalísticas independentes explicando
  //   a mesma cláusula do Brasileirão (Lance!, Trivela, Band, CNN,
  //   70notícias, Beira do Campo) — todas descrevem o fluxo como "descartado,
  //   segue direto pros critérios seguintes", NUNCA mencionando reaplicação
  //   pra um subgrupo que sobre depois. Contraste deliberado: o regulamento
  //   da FIFA (Copa do Mundo 2026) TEM uma cláusula explícita de reaplicação
  //   ("os critérios serão reaplicados apenas às partidas entre as equipes
  //   ainda empatadas") — a ausência dessa mesma frase em todas as fontes da
  //   CBF, quando a FIFA mostra que essa frase É escrita quando a intenção
  //   existe, é o que sustenta a interpretação adotada: uma vez descartado
  //   pro grupo original de 3+, o confronto direto NUNCA volta a ser avaliado
  //   depois, mesmo que um critério posterior separe um subgrupo de exatos 2.
  //   Decisão consciente, registrada explicitamente — não é suposição.
  // ============================================================================

  const NOT_EVALUATED = Symbol('NOT_EVALUATED');

  // Hash determinístico simples (FNV-1a) — mesma entrada, sempre a mesma saída.
  function deterministicHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function evaluateHeadToHead(a, b, ctx) {
    if (!ctx.headToHeadResults) return NOT_EVALUATED;
    const matches = ctx.headToHeadResults.filter(m =>
      (m.homeId === a.club_id && m.awayId === b.club_id) || (m.homeId === b.club_id && m.awayId === a.club_id)
    );
    if (matches.length === 0) return NOT_EVALUATED;
    let ptsA = 0, ptsB = 0;
    matches.forEach(m => {
      const [ga, gb] = m.homeId === a.club_id ? [m.gh, m.ga] : [m.ga, m.gh];
      if (ga > gb) ptsA += 3; else if (gb > ga) ptsB += 3; else { ptsA++; ptsB++; }
    });
    return ptsA - ptsB; // >0 → a na frente; <0 → b na frente; 0 → confronto direto também empatou
  }

  function groupByEqualValue(sortedDescRows, field) {
    const groups = [];
    let current = [];
    sortedDescRows.forEach(row => {
      if (current.length === 0 || current[current.length - 1][field] === row[field]) current.push(row);
      else { groups.push(current); current = [row]; }
    });
    if (current.length) groups.push(current);
    return groups;
  }

  // Resolve UM cluster (grupo de linhas empatadas até aqui) contra a cadeia de
  // critérios RESTANTE. Devolve o cluster ordenado (definitivamente, se a
  // cadeia tiver sorteio no fim). `log` acumula todo critério pulado/não
  // avaliado, nunca escondido.
  function resolveCluster(rows, chain, context, log) {
    if (rows.length <= 1) return rows;
    if (chain.length === 0) return rows; // cadeia esgotada sem decisão (não deveria acontecer com sorteio no fim)

    const [criterion, ...rest] = chain;

    if (criterion.kind === 'stat') {
      const sortedDesc = [...rows].sort((a, b) => (b[criterion.field] ?? 0) - (a[criterion.field] ?? 0));
      const groups = groupByEqualValue(sortedDesc, criterion.field);
      return groups.flatMap(g => resolveCluster(g, rest, context, log));
    }

    if (criterion.kind === 'head_to_head') {
      if (rows.length !== 2) {
        // Regra oficial: só vale entre EXATAMENTE 2 empatados. Com 3+, o
        // critério é DESCARTADO PRO GRUPO TODO — nunca reaplicado depois,
        // mesmo que um critério seguinte separe um subgrupo de exatos 2
        // (interpretação pesquisada e aprovada — ver cabeçalho do arquivo).
        log.push({ criterion: 'head_to_head', clubs: rows.map(r => r.club_id), status: 'skipped_group_size', reason: `regra CBF: confronto direto só se aplica entre exatamente 2 clubes empatados (havia ${rows.length}) — descartado pro grupo, sem reaplicação posterior` });
        return resolveCluster(rows, rest, context, log);
      }
      const [a, b] = rows;
      const result = evaluateHeadToHead(a, b, context);
      if (result === NOT_EVALUATED) {
        log.push({ criterion: 'head_to_head', clubs: [a.club_id, b.club_id], status: 'not_evaluated', reason: 'dado de confronto direto não disponível' });
        return resolveCluster(rows, rest, context, log);
      }
      if (result === 0) return resolveCluster(rows, rest, context, log); // confronto direto também empatou — segue a cadeia
      return result > 0 ? [a, b] : [b, a];
    }

    if (criterion.kind === 'unavailable_stat') {
      log.push({ criterion: 'unavailable_stat', clubs: rows.map(r => r.club_id), status: 'not_evaluated', reason: criterion.reason || 'dado não disponível no jogo hoje' });
      return resolveCluster(rows, rest, context, log);
    }

    if (criterion.kind === 'deterministic_draw') {
      const seed = context.drawSeed || '';
      return [...rows].sort((a, b) => deterministicHash(`${seed}:${a.club_id}`) - deterministicHash(`${seed}:${b.club_id}`));
    }

    throw new Error(`Critério de desempate desconhecido: '${criterion.kind}'`);
  }

  // Ordena uma tabela inteira pela cadeia de critérios, devolvendo também o
  // log de tudo que não pôde ser avaliado/foi descartado — pra nunca ficar
  // escondido. Funciona igualmente bem pra 2 linhas (uso do homeAdvantageRule)
  // ou pra uma tabela de grupo inteira (N linhas).
  function sortStandingsWithTiebreakChain(rows, criteriaChain, context = {}) {
    const log = [];
    const sorted = resolveCluster(rows, criteriaChain, context, log);
    return { sorted, tiebreakLog: log };
  }

    // ---- de campaignTracker.js ----
  // ============================================================================
  // CAMPAIGN TRACKER — "campanha geral" do Art. 19: estatística ACUMULADA ao
  // longo de TODAS as fases já disputadas, nunca recalculada só a partir da
  // fase anterior. Cada fase que se resolve (grupos, oitavas, quartas...)
  // ALIMENTA o mesmo tracker — ele nunca reseta.
  // ============================================================================

  function initCampaignTracker(clubIds) {
    const tracker = {};
    clubIds.forEach(id => { tracker[id] = { club_id: id, pj: 0, pts: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }; });
    return tracker;
  }

  // Pura — devolve um tracker NOVO com mais uma partida somada. Nunca muta o
  // tracker recebido, então cada fase resolvida gera um snapshot rastreável.
  function addMatchToCampaign(tracker, homeId, awayId, gh, ga) {
    const next = { ...tracker };
    if (!next[homeId]) next[homeId] = { club_id: homeId, pj: 0, pts: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
    if (!next[awayId]) next[awayId] = { club_id: awayId, pj: 0, pts: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
    next[homeId] = { ...next[homeId] }; next[awayId] = { ...next[awayId] };
    next[homeId].pj++; next[awayId].pj++;
    next[homeId].gp += gh; next[homeId].gc += ga; next[awayId].gp += ga; next[awayId].gc += gh;
    if (gh > ga) { next[homeId].v++; next[homeId].pts += 3; next[awayId].d++; }
    else if (gh < ga) { next[awayId].v++; next[awayId].pts += 3; next[homeId].d++; }
    else { next[homeId].e++; next[awayId].e++; next[homeId].pts++; next[awayId].pts++; }
    return next;
  }

  // Soma uma LISTA de resultados de uma vez (ex: todos os jogos de uma fase
  // inteira) — sempre em cima do tracker que já vinha de fases anteriores.
  function addPhaseToCampaign(tracker, matchResults) {
    return matchResults.reduce((acc, { homeId, awayId, gh, ga }) => addMatchToCampaign(acc, homeId, awayId, gh, ga), tracker);
  }

  // Linha pronta pro formato que tiebreak.js espera (com `sg` calculado).
  function campaignRow(tracker, clubId) {
    const r = tracker[clubId];
    if (!r) throw new Error(`Clube '${clubId}' não existe no CampaignTracker — campanha não pode ser inventada.`);
    return { ...r, sg: r.gp - r.gc };
  }

    // ---- de leagueStageResolver.js ----

  // StageConfig (type: 'league') = {
  //   id, type: 'league', participantIds, doubleRound, cutlines,
  //   tiebreakers: ['pts','sg','gp',...]   // MODO SIMPLES (legado) — Série A/B mock
  //     OU
  //   tiebreakChain: [{kind:'stat',field:'pts'}, {kind:'head_to_head'}, ...]  // MODO OFICIAL — tiebreak.js
  //     // tiebreakChain tem precedência se ambos existirem. Modo oficial
  //     // resolve por CLUSTER (confronto direto só entre exatamente 2), com
  //     // as próprias partidas da liga como headToHeadResults.
  // }
  //
  // resultsProvider(fixtures) → [{ homeId, awayId, gh, ga }]
  // (em produção, isso vem do Match/Calendar Engine; em teste, injetamos direto.)
  function resolveLeagueStage(stageConfig, participantIds, resultsProvider) {
    const rounds = buildLeagueFixtures(participantIds, stageConfig.doubleRound !== false);
    const pad = String(rounds.length).length;
    const fixtures = [];
    rounds.forEach((roundMatches, roundIndex) => {
      roundMatches.forEach(([homeId, awayId], i) => {
        fixtures.push({
          fixtureId: `${stageConfig.id}_r${String(roundIndex).padStart(pad, '0')}_f${i}`,
          stageId: stageConfig.id, roundIndex, homeId, awayId,
        });
      });
    });
    const results = resultsProvider(fixtures);

    let sorted;
    if (stageConfig.tiebreakChain) {
      let standings = freshStandings(participantIds);
      results.forEach(({ homeId, awayId, gh, ga }) => { standings = applyMatchResultToStandings(standings, homeId, awayId, gh, ga); });
      const rows = Object.values(standings).map(r => ({ ...r, sg: r.gp - r.gc }));
      const { sorted: officialSorted } = sortStandingsWithTiebreakChain(rows, stageConfig.tiebreakChain, {
        headToHeadResults: results, drawSeed: stageConfig.id,
      });
      sorted = officialSorted;
    } else {
      sorted = computeLeagueStandings(participantIds, results, stageConfig.tiebreakers);
    }

    const qualifierGroups = applyCutlines(sorted, stageConfig.cutlines);
    // Campanha acumulada — igual ao GroupStageResolver: qualquer fase pode ser
    // o PONTO DE PARTIDA da campanha geral (Série C começa numa liga, Série D
    // começa num grupo) — nunca recalculada só a partir da fase seguinte.
    const finalCampaign = addPhaseToCampaign(initCampaignTracker(participantIds), results);
    return { stageId: stageConfig.id, type: 'league', finalStandings: sorted, qualifierGroups, fixtures, results, finalCampaign };
  }

    // ---- de groupStageResolver.js ----

  // StageConfig (type: 'group') = {
  //   id, type: 'group', participantIds, groupCount, doubleRound,
  //   tiebreakers: ['pts','sg','gp',...]   // MODO SIMPLES (legado) — Série A/B/C
  //     OU
  //   tiebreakChain: [{kind:'stat',field:'pts'}, {kind:'head_to_head'}, ...]  // MODO OFICIAL — usa tiebreak.js
  //     // Só um dos dois deve ser fornecido. tiebreakChain tem precedência se
  //     // ambos existirem. O modo oficial resolve por CLUSTER (não par-a-par),
  //     // aplicando confronto direto só quando o empate for entre EXATAMENTE
  //     // 2 clubes, com o próprio resultado do grupo como headToHeadResults.
  //   groupingRule: { kind: 'explicit', assignment: {clubId: groupId} }
  //              | { kind: 'seeded', order: [clubId,...] }   // serpentine 1-2-3-4-4-3-2-1...
  //              | { kind: 'random', rng: () => number }      // injeção de RNG — nunca Math.random direto, testável
  //   cutlines: [ { name, rule: { kind: 'topNPerGroup', n } } ]
  // }
  function assignGroups(stageConfig, participantIds) {
    const { groupingRule, groupCount } = stageConfig;

    if (groupingRule.kind === 'explicit') {
      // Dado de entrada da temporada (ex: os 16 grupos regionais da Série D,
      // publicados manualmente pela CBF) — o motor NUNCA calcula isso sozinho.
      return groupingRule.assignment;
    }

    if (groupingRule.kind === 'seeded') {
      // Distribuição serpentina a partir de uma ordem de força já definida
      // (ex: classificação da fase anterior) — 1º grupo A, 2º grupo B, ...,
      // último grupo, depois inverte. Documentado como escolha de modelagem
      // (ver incerteza registrada: regulamento não publica a fórmula exata
      // de como os 8 classificados da Série C viram 2 grupos de 4).
      const order = groupingRule.order;
      const groups = Array.from({ length: groupCount }, () => []);
      let dir = 1, g = 0;
      order.forEach(id => {
        groups[g].push(id);
        if (dir === 1 && g === groupCount - 1) dir = -1;
        else if (dir === -1 && g === 0) dir = 1;
        else g += dir;
      });
      const assignment = {};
      groups.forEach((ids, i) => ids.forEach(id => { assignment[id] = `G${i + 1}`; }));
      return assignment;
    }

    if (groupingRule.kind === 'random') {
      const rng = groupingRule.rng || Math.random;
      const shuffled = [...participantIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const assignment = {};
      shuffled.forEach((id, i) => { assignment[id] = `G${(i % groupCount) + 1}`; });
      return assignment;
    }

    throw new Error(`groupingRule desconhecida: ${groupingRule.kind}`);
  }

  // Ordena a tabela de UM grupo — modo oficial (cluster, com confronto direto
  // respeitando a regra de "só entre 2") se `tiebreakChain` existir; senão cai
  // no modo simples legado (compatibilidade com Série A/B/C já validadas).
  function sortGroupStandings(groupParticipants, results, stageConfig, groupId) {
    if (stageConfig.tiebreakChain) {
      let standings = freshStandings(groupParticipants);
      results.forEach(({ homeId, awayId, gh, ga }) => { standings = applyMatchResultToStandings(standings, homeId, awayId, gh, ga); });
      const rows = Object.values(standings).map(r => ({ ...r, sg: r.gp - r.gc }));
      const { sorted, tiebreakLog } = sortStandingsWithTiebreakChain(rows, stageConfig.tiebreakChain, {
        headToHeadResults: results, // as próprias partidas do grupo já bastam pro confronto direto
        drawSeed: `${stageConfig.id}_${groupId}`,
      });
      return { sorted, tiebreakLog };
    }
    return { sorted: computeLeagueStandings(groupParticipants, results, stageConfig.tiebreakers), tiebreakLog: [] };
  }

  function resolveGroupStage(stageConfig, participantIds, resultsProvider) {
    const assignment = assignGroups(stageConfig, participantIds);
    const groupIds = [...new Set(Object.values(assignment))].sort(); // ordem determinística, nunca por inserção

    const perGroupStandings = {};
    const allFixtures = [];
    const allResults = [];
    const tiebreakLogByGroup = {};

    groupIds.forEach(groupId => {
      const groupParticipants = participantIds.filter(id => assignment[id] === groupId);
      const rounds = buildLeagueFixtures(groupParticipants, stageConfig.doubleRound !== false);
      const pad = String(rounds.length).length;
      const fixtures = [];
      rounds.forEach((roundMatches, roundIndex) => {
        roundMatches.forEach(([homeId, awayId], i) => {
          fixtures.push({
            fixtureId: `${stageConfig.id}_${groupId}_r${String(roundIndex).padStart(pad, '0')}_f${i}`,
            stageId: stageConfig.id, groupId, roundIndex, homeId, awayId,
          });
        });
      });
      const results = resultsProvider(fixtures);
      allFixtures.push(...fixtures);
      allResults.push(...results);
      const { sorted, tiebreakLog } = sortGroupStandings(groupParticipants, results, stageConfig, groupId);
      perGroupStandings[groupId] = sorted;
      if (tiebreakLog.length) tiebreakLogByGroup[groupId] = tiebreakLog;
    });

    // Cutlines tipo topNPerGroup — concatenadas de TODOS os grupos num único qualifierGroup.
    const qualifierGroups = {};
    stageConfig.cutlines.forEach(cl => {
      if (cl.rule.kind !== 'topNPerGroup') throw new Error(`GroupStage só suporta cutline topNPerGroup, recebeu: ${cl.rule.kind}`);
      qualifierGroups[cl.name] = groupIds.flatMap(gid => perGroupStandings[gid].slice(0, cl.rule.n).map(r => r.club_id));
    });

    // Campanha acumulada nasce aqui — a fase de grupos é sempre o ponto de
    // partida da "campanha geral" (Art. 19: "soma de pontos... de todas as
    // fases"). As fases seguintes recebem isso como `campaignSeed`, nunca
    // recalculando do zero.
    const finalCampaign = addPhaseToCampaign(initCampaignTracker(participantIds), allResults);

    return { stageId: stageConfig.id, type: 'group', assignment, perGroupStandings, qualifierGroups, fixtures: allFixtures, results: allResults, finalCampaign, tiebreakLogByGroup };
  }

    // ---- de knockoutStageResolver.js ----

  // StageConfig (type: 'knockout') = {
  //   id, type: 'knockout', participantIds, legFormat: 'two-legged' | 'single',
  //   seeding: { kind: 'explicit', initialPairs: [[a,b],...] }
  //         | { kind: 'bracket', order: [clubId,...] }               // 1º x último, 2º x penúltimo...
  //         | { kind: 'groupPairCross', groupPairs: [[groupIdA,groupIdB],...], perGroupStandings: {...} }
  //           // Regra oficial da Série D 2026: pares de grupos VIZINHOS se
  //           // cruzam — 1ºA x 4ºB, 2ºA x 3ºB, 3ºA x 2ºB, 4ºA x 1ºB. Isso é
  //           // ESTRUTURALMENTE diferente de um seed genérico (que cruzaria
  //           // 1º geral x último geral, ignorando de qual grupo cada um veio)
  //           // — por isso é um `kind` próprio, não uma adaptação do 'bracket'.
  //   reseeding: { beforeRound: roundName, tiebreakers } | null,       // ex: quarterfinal da Série D
  //   maxRounds: number | undefined,   // se definido, a stage para após N rodadas mesmo
  //     // com mais de 1 sobrevivente — usado pra modelar cada "Fase" oficial da
  //     // Série D (Art. 17) como uma unidade discreta própria (64→32 é UMA
  //     // fase, não um trecho de um mata-mata contínuo de 6 rodadas).
  //   homeAdvantageRule: { kind: 'aggregateCampaign', initialCampaign: CampaignTracker, tiebreakChain, drawSeedPrefix } | undefined,
  //     // SEPARADO do `seeding` — decide só QUEM MANDA A VOLTA, nunca quem
  //     // joga contra quem. `initialCampaign` é a campanha JÁ ACUMULADA de
  //     // todas as fases anteriores (nunca recalculada só daqui) — a stage
  //     // devolve o tracker atualizado pra próxima fase encadear.
  //   cutlines: [ { name, rule: { kind: 'winner' } }
  //             | { name, rule: { kind: 'reachedRound', round } }
  //             | { name, rule: { kind: 'eliminatedAtRound', round } } ],
  // }
  //
  // resultsProvider(pairings, legFormat) → array alinhada com pairings:
  //   two-legged: [{ leg1: {gh,ga}, leg2: {gh,ga}, penaltyWinner: clubId|null }]
  //   single:     [{ score: {gh,ga}, penaltyWinner: clubId|null }]
  // (teamA = mandante do jogo 1 / único jogo)

  const ROUND_NAMES_BY_SIZE = { 64: 'round_of_64', 32: 'round_of_32', 16: 'round_of_16', 8: 'quarterfinal', 4: 'semifinal', 2: 'final' };

  function roundNameForSize(n) { return ROUND_NAMES_BY_SIZE[n] || `round_of_${n}`; }

  function pairSequentially(order) {
    const pairs = [];
    for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
    return pairs;
  }

  function pairSeeded(order) {
    // 1º x último, 2º x penúltimo... (chaveamento clássico)
    const pairs = [];
    const n = order.length;
    for (let i = 0; i < n / 2; i++) pairs.push([order[i], order[n - 1 - i]]);
    return pairs;
  }

  function resolveTie(pair, matchResult, legFormat, aggregateTieBreaker) {
    if (matchResult.penaltyWinner != null && !pair.includes(matchResult.penaltyWinner)) {
      throw new Error(`penaltyWinner '${matchResult.penaltyWinner}' não pertence ao confronto ${pair[0]} x ${pair[1]}.`);
    }
    if (legFormat === 'single') {
      const { gh, ga } = matchResult.score;
      if (gh > ga) return pair[0];
      if (ga > gh) return pair[1];
      if (aggregateTieBreaker) return aggregateTieBreaker(pair);
      if (matchResult.penaltyWinner) return matchResult.penaltyWinner;
      throw new Error(`Empate sem definição em jogo único: ${pair[0]} x ${pair[1]}`);
    }
    // two-legged: teamA = mandante do jogo 1
    const [teamA, teamB] = pair;
    const aggA = matchResult.leg1.gh + matchResult.leg2.ga;
    const aggB = matchResult.leg1.ga + matchResult.leg2.gh;
    if (aggA > aggB) return teamA;
    if (aggB > aggA) return teamB;
    // Empate agregado — regra padrão é pênaltis (sem gol fora, conforme
    // regulamento pesquisado). MAS o Playoff da Série D 2026 é uma EXCEÇÃO
    // explícita: "não haverá disputa por pênaltis... serão promovidas as
    // equipes que tenham feito as melhores campanhas" — por isso o
    // `aggregateTieBreaker` é injetado pela stage, nunca assumido por padrão.
    if (aggregateTieBreaker) return aggregateTieBreaker(pair);
    if (matchResult.penaltyWinner) return matchResult.penaltyWinner;
    throw new Error(`Empate agregado sem vencedor de pênaltis: ${teamA} x ${teamB}`);
  }

  // Mecânica LITERAL do Art. 21 do REC (Playoff de acesso) — cada perna vale
  // pontos como uma partida normal (3/1/0), as duas pernas formam uma
  // mini-classificação de 2 clubes; empate em pontos → saldo de gols; empate
  // no saldo → campanha geral (nunca pênaltis, por determinação expressa do
  // artigo). Isso é DELIBERADAMENTE separado de `resolveTie` (que usa saldo
  // agregado direto) — mesmo resultado matemático nesse caso específico, mas
  // representando o texto do regulamento diretamente, não uma fórmula equivalente.
  function resolveTieByLegPoints(pair, matchResult, campaignTieBreaker) {
    const [teamA, teamB] = pair; // teamA manda a ida, teamB manda a volta (convenção já existente)
    const { gh: gh1, ga: ga1 } = matchResult.leg1; // ida: teamA em casa
    const { gh: gh2, ga: ga2 } = matchResult.leg2; // volta: teamB em casa

    const ptsLeg1 = gh1 > ga1 ? { a: 3, b: 0 } : gh1 < ga1 ? { a: 0, b: 3 } : { a: 1, b: 1 };
    const ptsLeg2 = gh2 > ga2 ? { a: 0, b: 3 } : gh2 < ga2 ? { a: 3, b: 0 } : { a: 1, b: 1 }; // teamA é visitante na volta

    const totalA = ptsLeg1.a + ptsLeg2.a;
    const totalB = ptsLeg1.b + ptsLeg2.b;
    if (totalA !== totalB) return totalA > totalB ? teamA : teamB;

    // Empate em pontos (mini-classificação de 2 jogos) → 1º critério: saldo de gols.
    const saldoA = (gh1 + ga2) - (ga1 + gh2);
    if (saldoA !== 0) return saldoA > 0 ? teamA : teamB;

    // Empate também no saldo → 2º critério: campanha geral (nunca pênaltis).
    if (campaignTieBreaker) return campaignTieBreaker(pair);
    throw new Error(`Playoff empatado em pontos e saldo, sem campanha geral disponível: ${teamA} x ${teamB}`);
  }

  // Tabela agregada de toda a competição até aqui — usada só quando a fase tem
  // reseeding configurado (ex: quartas da Série D reordenam por essa tabela).
  function computeAggregateTable(allResultsSoFar, tiebreakers) {
    const stats = {};
    const ensure = id => { if (!stats[id]) stats[id] = { club_id: id, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }; };
    allResultsSoFar.forEach(({ homeId, awayId, gh, ga }) => {
      ensure(homeId); ensure(awayId);
      stats[homeId].pj++; stats[awayId].pj++;
      stats[homeId].gp += gh; stats[homeId].gc += ga; stats[awayId].gp += ga; stats[awayId].gc += gh;
      if (gh > ga) { stats[homeId].v++; stats[homeId].pts += 3; stats[awayId].d++; }
      else if (gh < ga) { stats[awayId].v++; stats[awayId].pts += 3; stats[homeId].d++; }
      else { stats[homeId].e++; stats[awayId].e++; stats[homeId].pts++; stats[awayId].pts++; }
    });
    const rows = Object.values(stats).map(r => ({ ...r, sg: r.gp - r.gc }));
    return rows.sort((a, b) => { for (const k of tiebreakers) if (b[k] !== a[k]) return b[k] - a[k]; return 0; });
  }

  // ---------------------------------------------------------------------------
  // CAMADA 1 — SEEDING: só decide QUEM ENFRENTA QUEM. Devolve "matchups" não
  // ordenados, cada um anotado com a posição de origem de cada clube (dado que
  // o homeAdvantageRule da 2ª Fase precisa dessa posição — mas quem decide o
  // mando é a camada 2, nunca esta).
  // ---------------------------------------------------------------------------
  function buildGroupPairCrossMatchups(groupPairs, perGroupStandings) {
    const matchups = [];
    groupPairs.forEach(([groupA, groupB]) => {
      const rankA = perGroupStandings[groupA].map(r => r.club_id);
      const rankB = perGroupStandings[groupB].map(r => r.club_id);
      if (rankA.length < 4 || rankB.length < 4) throw new Error(`groupPairCross exige ao menos 4 classificados por grupo (grupo ${groupA} ou ${groupB} tem menos).`);
      matchups.push({ clubs: [rankA[0], rankB[3]], groupPosition: { [rankA[0]]: 1, [rankB[3]]: 4 } }); // 1ºA x 4ºB
      matchups.push({ clubs: [rankA[1], rankB[2]], groupPosition: { [rankA[1]]: 2, [rankB[2]]: 3 } }); // 2ºA x 3ºB
      matchups.push({ clubs: [rankA[2], rankB[1]], groupPosition: { [rankA[2]]: 3, [rankB[1]]: 2 } }); // 3ºA x 2ºB
      matchups.push({ clubs: [rankA[3], rankB[0]], groupPosition: { [rankA[3]]: 4, [rankB[0]]: 1 } }); // 4ºA x 1ºB
    });
    return matchups;
  }

  // ---------------------------------------------------------------------------
  // CAMADA 2 — HOME ADVANTAGE RULE: só decide QUEM MANDA A PARTIDA DECISIVA
  // (a volta). Nunca decide quem joga contra quem — isso já veio pronto da
  // camada 1. Convenção do motor: no par ordenado [a, b], `b` manda a volta.
  // ---------------------------------------------------------------------------

  // Regra da 2ª Fase (Art. 19): 1º/2º colocado do grupo de origem manda a
  // volta, independente de qual grupo (A1, A2, A15... tanto faz).
  function applyGroupPositionHomeAdvantage(matchups) {
    return matchups.map(({ clubs, groupPosition }) => {
      const [x, y] = clubs;
      const xHostsSecondLeg = groupPosition[x] <= 2;
      return xHostsSecondLeg ? [y, x] : [x, y];
    });
  }

  // Regra das Fases 3ª-7ª (Art. 19): campanha geral ACUMULADA de toda a
  // competição decide quem manda a volta — reaproveita o tiebreak.js já
  // validado (mesma cadeia pts→vitórias→saldo→gols→cartões→sorteio), nunca
  // uma cadeia paralela reinventada aqui.
  function applyAggregateCampaignHomeAdvantage(matchups, campaignTracker, campaignRowFn, tiebreakChain, sortFn, drawSeedPrefix) {
    return matchups.map(({ clubs }) => {
      const [x, y] = clubs;
      const rowX = campaignRowFn(campaignTracker, x), rowY = campaignRowFn(campaignTracker, y);
      const { sorted } = sortFn([rowX, rowY], tiebreakChain, { drawSeed: `${drawSeedPrefix}:${x}:${y}` });
      // Melhor campanha (sorted[0]) manda a volta → fica no índice 1.
      return sorted[0].club_id === x ? [y, x] : [x, y];
    });
  }

  // Composição pública — mantém compatibilidade com quem já chama
  // pairGroupCross esperando pares prontos [ida, volta].
  function pairGroupCross(groupPairs, perGroupStandings) {
    const matchups = buildGroupPairCrossMatchups(groupPairs, perGroupStandings);
    return applyGroupPositionHomeAdvantage(matchups);
  }

  function resolveKnockoutStage(stageConfig, participantIds, resultsProvider) {
    let currentOrder;
    let pairings;

    if (stageConfig.seeding.kind === 'explicit') {
      pairings = stageConfig.seeding.initialPairs;
      currentOrder = pairings.flat();
      const flatSet = new Set(currentOrder);
      if (flatSet.size !== participantIds.length || !participantIds.every(id => flatSet.has(id))) {
        throw new Error(`seeding.initialPairs não corresponde exatamente aos participantIds recebidos.`);
      }
    } else if (stageConfig.seeding.kind === 'groupPairCross') {
      pairings = pairGroupCross(stageConfig.seeding.groupPairs, stageConfig.seeding.perGroupStandings);
      currentOrder = pairings.flat();
      const flatSet = new Set(currentOrder);
      if (flatSet.size !== participantIds.length || !participantIds.every(id => flatSet.has(id))) {
        throw new Error(`groupPairCross não corresponde exatamente aos participantIds recebidos (esperado ${participantIds.length}, obteve ${flatSet.size}).`);
      }
    } else if (stageConfig.seeding.kind === 'sequential') {
      // Avança o bracket JÁ EXISTENTE de uma fase discreta anterior — pareia
      // adjacentes (0&1, 2&3...), preservando a estrutura do chaveamento sem
      // reembaralhar. Usado nas Fases 3ª/4ª da Série D (Art. 17: vencedor
      // avança, sem reseed).
      const providedOrder = stageConfig.seeding.order || participantIds;
      currentOrder = providedOrder.filter(id => participantIds.includes(id));
      if (currentOrder.length !== participantIds.length) {
        throw new Error(`seeding.order (sequential) não cobre todos os participantIds recebidos (esperado ${participantIds.length}, obteve ${currentOrder.length}).`);
      }
      pairings = pairSequentially(currentOrder);
    } else if (stageConfig.seeding.kind === 'campaignRanked') {
      // Reseed de verdade por campanha geral acumulada — 1º x último, 2º x
      // penúltimo, sobre o RANKING real (nunca sobre a ordem de chegada). Usado
      // nas Quartas (Art. 19: "a partir das quartas, confrontos definidos pela
      // campanha geral") e no Playoff (reseed só entre os 4 eliminados).
      const tracker = stageConfig.campaignSeed;
      if (!tracker) throw new Error(`seeding 'campaignRanked' exige campaignSeed já resolvido na stage '${stageConfig.id}'.`);
      const rows = participantIds.map(id => campaignRow(tracker, id));
      const { sorted } = sortStandingsWithTiebreakChain(rows, stageConfig.seeding.tiebreakChain, { drawSeed: stageConfig.seeding.drawSeedPrefix || stageConfig.id });
      currentOrder = sorted.map(r => r.club_id);
      pairings = pairSeeded(currentOrder);
    } else {
      // O 'order' de configuração pode conter mais clubes do que os que de fato
      // chegaram nesta fase (ex: veio de uma lista estática maior) — SEMPRE
      // filtramos pra só os participantes reais, preservando a ordem relativa
      // entre eles. Nunca confiamos numa lista solta que possa divergir.
      const providedOrder = stageConfig.seeding.order || participantIds;
      currentOrder = providedOrder.filter(id => participantIds.includes(id));
      if (currentOrder.length !== participantIds.length) {
        throw new Error(`seeding.order não cobre todos os participantIds recebidos (esperado ${participantIds.length}, obteve ${currentOrder.length}).`);
      }
      pairings = pairSeeded(currentOrder);
    }

    const allResultsFlat = []; // pra tabela agregada de reseeding
    const eliminatedAtRound = {}; // clubId -> roundName
    let winner = null;
    const roundsPlayed = [];
    const reachedRoundSet = {}; // roundName -> Set(clubId) que CHEGOU a essa rodada (jogou nela)

    let remaining = [...participantIds];

    // Campanha acumulada — SEMPRE semeada do que já veio de fases anteriores
    // (nunca recalculada só a partir daqui). `campaignSeed` é independente de
    // `homeAdvantageRule`: mesmo numa fase com regra 'groupPosition' (2ª Fase),
    // ainda precisamos ACUMULAR os resultados pra alimentar a campanha da
    // fase seguinte, que já usa 'aggregateCampaign'.
    let campaignTracker = stageConfig.campaignSeed || null;

    function applyHomeAdvantage(currentPairings) {
      if (!stageConfig.homeAdvantageRule) return currentPairings; // sem regra configurada — comportamento antigo preservado
      if (stageConfig.homeAdvantageRule.kind === 'aggregateCampaign') {
        if (!campaignTracker) throw new Error(`homeAdvantageRule 'aggregateCampaign' exige campaignSeed configurado na stage.`);
        const matchups = currentPairings.map(([a, b]) => ({ clubs: [a, b] }));
        return applyAggregateCampaignHomeAdvantage(
          matchups, campaignTracker, campaignRow, stageConfig.homeAdvantageRule.tiebreakChain,
          sortStandingsWithTiebreakChain, stageConfig.homeAdvantageRule.drawSeedPrefix || stageConfig.id
        );
      }
      if (stageConfig.homeAdvantageRule.kind === 'groupPosition') return currentPairings; // já resolvido na construção do seeding (groupPairCross)
      throw new Error(`homeAdvantageRule desconhecida: '${stageConfig.homeAdvantageRule.kind}'`);
    }

    pairings = applyHomeAdvantage(pairings);

    while (pairings.length >= 1) {
      const roundName = roundNameForSize(remaining.length);
      reachedRoundSet[roundName] = new Set(remaining);

      const results = resultsProvider(pairings, stageConfig.legFormat);
      const winners = [];
      pairings.forEach((pair, i) => {
        const tieBreaker = stageConfig.aggregateTieBreak === 'campaign' && campaignTracker
          ? (p) => sortStandingsWithTiebreakChain(p.map(id => campaignRow(campaignTracker, id)), stageConfig.homeAdvantageRule.tiebreakChain, { drawSeed: `${stageConfig.id}:${p.join(':')}` }).sorted[0].club_id
          : null;
        const w = stageConfig.winCondition === 'legPoints'
          ? resolveTieByLegPoints(pair, results[i], tieBreaker)
          : resolveTie(pair, results[i], stageConfig.legFormat, tieBreaker);
        const loser = pair[0] === w ? pair[1] : pair[0];
        eliminatedAtRound[loser] = roundName;
        winners.push(w);

        if (stageConfig.legFormat === 'two-legged') {
          allResultsFlat.push({ homeId: pair[0], awayId: pair[1], gh: results[i].leg1.gh, ga: results[i].leg1.ga });
          allResultsFlat.push({ homeId: pair[1], awayId: pair[0], gh: results[i].leg2.gh, ga: results[i].leg2.ga });
          if (campaignTracker) {
            campaignTracker = addPhaseToCampaign(campaignTracker, [
              { homeId: pair[0], awayId: pair[1], gh: results[i].leg1.gh, ga: results[i].leg1.ga },
              { homeId: pair[1], awayId: pair[0], gh: results[i].leg2.gh, ga: results[i].leg2.ga },
            ]);
          }
        } else {
          allResultsFlat.push({ homeId: pair[0], awayId: pair[1], gh: results[i].score.gh, ga: results[i].score.ga });
          if (campaignTracker) campaignTracker = addPhaseToCampaign(campaignTracker, [{ homeId: pair[0], awayId: pair[1], gh: results[i].score.gh, ga: results[i].score.ga }]);
        }
      });

      roundsPlayed.push({ roundName, pairings, results });
      remaining = winners;

      if (remaining.length === 1) { winner = remaining[0]; break; }
      if (stageConfig.maxRounds && roundsPlayed.length >= stageConfig.maxRounds) {
        // Fase discreta (Art. 17) — para aqui mesmo com múltiplos sobreviventes;
        // `remaining` vira o qualifierGroup via cutline 'reachedRound' da
        // próxima rodada nominal, que já registramos abaixo antes de sair.
        reachedRoundSet[roundNameForSize(remaining.length)] = new Set(remaining);
        break;
      }

      // Reseeding, se configurado pra rodada que vem a seguir.
      const nextRoundName = roundNameForSize(remaining.length);
      if (stageConfig.reseeding && stageConfig.reseeding.beforeRound === nextRoundName) {
        const table = computeAggregateTable(allResultsFlat, stageConfig.reseeding.tiebreakers);
        const rankedRemaining = table.filter(r => remaining.includes(r.club_id)).map(r => r.club_id);
        pairings = pairSeeded(rankedRemaining);
      } else {
        pairings = pairSequentially(remaining); // avança o bracket original em ordem
      }
      pairings = applyHomeAdvantage(pairings);
    }

    const qualifierGroups = {};
    stageConfig.cutlines.forEach(cl => {
      if (cl.rule.kind === 'winner') qualifierGroups[cl.name] = [winner];
      else if (cl.rule.kind === 'reachedRound') qualifierGroups[cl.name] = [...(reachedRoundSet[cl.rule.round] || [])];
      else if (cl.rule.kind === 'eliminatedAtRound') qualifierGroups[cl.name] = Object.entries(eliminatedAtRound).filter(([, r]) => r === cl.rule.round).map(([id]) => id);
      else throw new Error(`Cutline de knockout desconhecida: ${cl.rule.kind}`);
    });

    return { stageId: stageConfig.id, type: 'knockout', winner, eliminatedAtRound, roundsPlayed, qualifierGroups, finalCampaign: campaignTracker };
  }

    // ---- de seasonResolver.js ----

  // CompetitionDefinition = {
  //   family, seasonYear, stages: [StageConfig],
  //   seasonOutcomes: {
  //     promotion: { sourceStageId, qualifierGroup, targetFamily } | null,
  //     relegation: { sourceStageId, qualifierGroup, targetFamily } | null,
  //   },
  // }
  // StageConfig.participantsSource:
  //   { type: 'external', list: [clubId] }
  //   { type: 'fromStage', stageId, qualifierGroup }
  // StageConfig.campaignSeed (opcional, só stages tipo 'knockout' que usam
  // homeAdvantageRule 'aggregateCampaign', ou que precisam repassar campanha
  // pra frente):
  //   { type: 'fromStage', stageId }   // pega o finalCampaign JÁ RESOLVIDO dessa stage
  //   { type: 'external', tracker }    // caso raro de campanha vinda de fora (ex: import de dado real)

  function topologicalOrder(stages) {
    const byId = Object.fromEntries(stages.map(s => [s.id, s]));
    const ordered = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(stage) {
      if (visited.has(stage.id)) return;
      if (visiting.has(stage.id)) throw new Error(`Ciclo de dependência detectado envolvendo a stage '${stage.id}'`);
      visiting.add(stage.id);
      if (stage.participantsSource.type === 'fromStage') {
        const dep = byId[stage.participantsSource.stageId];
        if (!dep) throw new Error(`Stage '${stage.id}' depende de '${stage.participantsSource.stageId}', que não existe.`);
        visit(dep);
      }
      if (stage.campaignSeed && stage.campaignSeed.type === 'fromStage') {
        const dep = byId[stage.campaignSeed.stageId];
        if (!dep) throw new Error(`Stage '${stage.id}' depende de '${stage.campaignSeed.stageId}' (campaignSeed), que não existe.`);
        visit(dep);
      }
      if (stage.seeding && stage.seeding.kind === 'groupPairCross' && stage.seeding.perGroupStandingsSource) {
        const dep = byId[stage.seeding.perGroupStandingsSource.stageId];
        if (!dep) throw new Error(`Stage '${stage.id}' depende de '${stage.seeding.perGroupStandingsSource.stageId}' (perGroupStandings), que não existe.`);
        visit(dep);
      }
      if (stage.groupingRule && stage.groupingRule.kind === 'seeded' && stage.groupingRule.orderSource) {
        const dep = byId[stage.groupingRule.orderSource.stageId];
        if (!dep) throw new Error(`Stage '${stage.id}' depende de '${stage.groupingRule.orderSource.stageId}' (groupingRule.orderSource), que não existe.`);
        visit(dep);
      }
      visiting.delete(stage.id);
      visited.add(stage.id);
      ordered.push(stage);
    }
    stages.forEach(visit);
    return ordered;
  }

  function resolveParticipants(stage, resolvedStages) {
    const source = stage.participantsSource;
    if (source.type === 'external') return source.list;
    if (source.type === 'combined') {
      const combined = [];
      (source.sources || []).forEach(item => {
        if (item.type === 'external') combined.push(...(item.list || []));
        else if (item.type === 'fromStage') {
          const dep = resolvedStages[item.stageId];
          if (!dep) throw new Error(`Stage '${stage.id}' referencia '${item.stageId}', ainda não resolvida.`);
          const group = dep.qualifierGroups ? dep.qualifierGroups[item.qualifierGroup] : undefined;
          if (group === undefined) throw new Error(`qualifierGroup '${item.qualifierGroup}' não existe na stage '${item.stageId}'.`);
          combined.push(...group);
        }
      });
      return [...new Set(combined)];
    }
    const dep = resolvedStages[source.stageId];
    if (!dep) throw new Error(`Stage '${stage.id}' referencia '${source.stageId}', ainda não resolvida.`);
    const group = dep.qualifierGroups ? dep.qualifierGroups[source.qualifierGroup] : undefined;
    if (group === undefined) throw new Error(`qualifierGroup '${source.qualifierGroup}' não existe na stage '${source.stageId}'.`);
    return group;
  }

  // Resolve campaignSeed em tempo de execução — nunca estático, porque o
  // finalCampaign só existe depois que a stage de origem já foi resolvida.
  function resolveCampaignSeed(stage, resolvedStages) {
    if (!stage.campaignSeed) return undefined;
    if (stage.campaignSeed.type === 'external') return stage.campaignSeed.tracker;
    if (stage.campaignSeed.type === 'fromStage') {
      const dep = resolvedStages[stage.campaignSeed.stageId];
      if (!dep || !dep.finalCampaign) throw new Error(`Stage '${stage.id}' referencia campaignSeed de '${stage.campaignSeed.stageId}', que não tem finalCampaign disponível.`);
      return dep.finalCampaign;
    }
    throw new Error(`campaignSeed.type desconhecido: '${stage.campaignSeed.type}'`);
  }

  // Mesmo princípio pro groupPairCross: perGroupStandings só existe depois que
  // a fase de grupos resolveu — nunca injetado estaticamente (isso forçaria
  // resolver a fase de origem duas vezes, com resultados aleatórios DIFERENTES
  // entre as duas chamadas).
  function resolvePerGroupStandingsSource(stage, resolvedStages) {
    if (!stage.seeding || stage.seeding.kind !== 'groupPairCross' || !stage.seeding.perGroupStandingsSource) return undefined;
    const src = stage.seeding.perGroupStandingsSource;
    const dep = resolvedStages[src.stageId];
    if (!dep || !dep.perGroupStandings) throw new Error(`Stage '${stage.id}' referencia perGroupStandings de '${src.stageId}', que não tem esse dado disponível.`);
    return dep.perGroupStandings;
  }

  // Mesmo princípio pro groupingRule 'seeded': a ordem de força (ex: ranking da
  // fase anterior) só existe depois que essa fase resolveu — nunca injetada
  // estaticamente. Usado pela Série C 2026 (Art. 13: Grupo B/C definidos pela
  // posição de chegada da 1ª Fase).
  function resolveGroupingOrderSource(stage, resolvedStages) {
    if (!stage.groupingRule || stage.groupingRule.kind !== 'seeded' || !stage.groupingRule.orderSource) return undefined;
    const src = stage.groupingRule.orderSource;
    const dep = resolvedStages[src.stageId];
    const group = dep && dep.qualifierGroups ? dep.qualifierGroups[src.qualifierGroup] : undefined;
    if (group === undefined) throw new Error(`Stage '${stage.id}' referencia orderSource de '${src.stageId}'/'${src.qualifierGroup}', indisponível.`);
    return group;
  }

  function resolveStage(stage, participants, provider, resolvedStages) {
    const resolvedCampaignSeed = resolveCampaignSeed(stage, resolvedStages);
    const resolvedPerGroupStandings = resolvePerGroupStandingsSource(stage, resolvedStages);
    const resolvedGroupingOrder = resolveGroupingOrderSource(stage, resolvedStages);
    let effectiveStage = stage;
    if (resolvedCampaignSeed !== undefined) effectiveStage = { ...effectiveStage, campaignSeed: resolvedCampaignSeed };
    if (resolvedPerGroupStandings !== undefined) effectiveStage = { ...effectiveStage, seeding: { ...effectiveStage.seeding, perGroupStandings: resolvedPerGroupStandings } };
    if (resolvedGroupingOrder !== undefined) effectiveStage = { ...effectiveStage, groupingRule: { ...effectiveStage.groupingRule, order: resolvedGroupingOrder } };
    if (stage.type === 'league') return resolveLeagueStage(effectiveStage, participants, provider);
    if (stage.type === 'group') return resolveGroupStage(effectiveStage, participants, provider);
    if (stage.type === 'knockout') return resolveKnockoutStage(effectiveStage, participants, provider);
    throw new Error(`Tipo de stage desconhecido: '${stage.type}'`);
  }

  // getResultsProvider(stageConfig) → função de resolução de resultados pra essa
  // stage específica. Em produção isso vem do Calendar/Match Engine; aqui é
  // injetado, o que é o que permite testar o Competition Engine sozinho.
  function resolveCompetitionSeason(definition, getResultsProvider) {
    const order = topologicalOrder(definition.stages);
    const resolvedStages = {};

    order.forEach(stage => {
      const participants = resolveParticipants(stage, resolvedStages);
      if (participants.length === 0) {
        // Ex: clube não se classificou para essa fase — stage resolve vazia,
        // sem rodar o resolver (nada pra jogar).
        resolvedStages[stage.id] = { stageId: stage.id, type: stage.type, qualifierGroups: {}, skipped: true };
        return;
      }
      resolvedStages[stage.id] = resolveStage(stage, participants, getResultsProvider(stage), resolvedStages);
    });

    const outcomes = {};
    ['promotion', 'relegation'].forEach(key => {
      const cfg = definition.seasonOutcomes[key];
      if (!cfg) { outcomes[key] = { clubIds: [], targetFamily: null }; return; }
      const entries = Array.isArray(cfg) ? cfg : [cfg];
      const clubIds = [];
      let targetFamily = null;
      entries.forEach(entry => {
        const src = resolvedStages[entry.sourceStageId];
        const ids = (src && src.qualifierGroups[entry.qualifierGroup]) || [];
        ids.forEach(id => { if (!clubIds.includes(id)) clubIds.push(id); });
        targetFamily = targetFamily || entry.targetFamily || null;
      });
      outcomes[key] = { clubIds, targetFamily };
    });

    return { resolvedStages, outcomes };
  }

  return {
    buildLeagueFixtures, freshStandings, sortStandings, applyMatchResultToStandings, computeLeagueStandings, applyCutlines,
    sortStandingsWithTiebreakChain, resolveCluster, deterministicHash,
    initCampaignTracker, addMatchToCampaign, addPhaseToCampaign, campaignRow,
    resolveLeagueStage,
    resolveGroupStage, assignGroups, sortGroupStandings,
    resolveKnockoutStage, computeAggregateTable, pairSeeded, pairSequentially, roundNameForSize,
    buildGroupPairCrossMatchups, applyGroupPositionHomeAdvantage, applyAggregateCampaignHomeAdvantage, pairGroupCross, resolveTieByLegPoints,
    resolveCompetitionSeason, topologicalOrder, resolveParticipants, resolveCampaignSeed,
  };
})();

// Rede de segurança — Legacy vs. V2, no ÚNICO formato que o jogo usa hoje
// (liga de fase única). Roda uma vez, silenciosamente, ao carregar o jogo —
// só reporta no console se algo divergir (nunca deveria).
function runCompetitionEngineV2SelfCheck() {
  const ids = Array.from({ length: 8 }, (_, k) => `selfcheck_${k}`);
  const legacyFixtures = generateLeagueFixtures(ids);
  const v2Fixtures = CompetitionEngineV2.buildLeagueFixtures(ids);
  const fixturesMatch = JSON.stringify(legacyFixtures) === JSON.stringify(v2Fixtures);

  const results = legacyFixtures.flat().map(([h, a]) => ({ homeId: h, awayId: a, gh: Math.floor(Math.random() * 4), ga: Math.floor(Math.random() * 4) }));
  let legacyStandings = freshStandings(ids);
  results.forEach(({ homeId, awayId, gh, ga }) => {
    legacyStandings[homeId].pj++; legacyStandings[awayId].pj++;
    legacyStandings[homeId].gp += gh; legacyStandings[homeId].gc += ga; legacyStandings[awayId].gp += ga; legacyStandings[awayId].gc += gh;
    if (gh > ga) { legacyStandings[homeId].v++; legacyStandings[homeId].pts += 3; legacyStandings[awayId].d++; }
    else if (gh < ga) { legacyStandings[awayId].v++; legacyStandings[awayId].pts += 3; legacyStandings[homeId].d++; }
    else { legacyStandings[homeId].e++; legacyStandings[awayId].e++; legacyStandings[homeId].pts++; legacyStandings[awayId].pts++; }
  });
  const legacySorted = sortStandings(legacyStandings, ['pts', 'sg', 'gp']);
  const v2Sorted = CompetitionEngineV2.computeLeagueStandings(ids, results, ['pts', 'sg', 'gp']);
  const standingsMatch = JSON.stringify(legacySorted) === JSON.stringify(v2Sorted);

  const ok = fixturesMatch && standingsMatch;
  if (!ok) console.error('[CompetitionEngineV2 self-check] DIVERGÊNCIA detectada entre Legacy e V2 — não deveria acontecer.', { fixturesMatch, standingsMatch });
  return ok;
}


export { CompetitionEngineV2, runCompetitionEngineV2SelfCheck };

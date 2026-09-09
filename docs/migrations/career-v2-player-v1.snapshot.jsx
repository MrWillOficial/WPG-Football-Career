import React, { useState, useEffect, useCallback } from 'react';

// Storage adapter: mantém compatibilidade com o ambiente original (window.storage)
// e adiciona fallback para localStorage quando o jogo roda como site independente.
const appStorage = {
  async get(key) {
    if (typeof window !== 'undefined' && window.storage?.get) return window.storage.get(key, false);
    if (typeof window !== 'undefined' && window.localStorage) {
      const value = window.localStorage.getItem(key);
      return value == null ? null : { value };
    }
    return null;
  },
  async set(key, value) {
    if (typeof window !== 'undefined' && window.storage?.set) return window.storage.set(key, value, false);
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(key, value);
  },
  async delete(key) {
    if (typeof window !== 'undefined' && window.storage?.delete) return window.storage.delete(key, false);
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(key);
  },
};

/* ============================================================================
   DADOS MOCKADOS — inalterado em relação ao vertical slice (Fase 1)
============================================================================ */

const STATE = { id: 'SP', name: 'São Paulo' };
const FEDERATION = { id: 'fpf', state_id: 'SP', name: 'Federação Paulista de Futebol (mock)' };

// branding: estrutura preparada para trocar 'monogram' por 'licensed' (escudo real)
// no futuro sem alterar nenhum componente que consome `club` — ver ClubMonogram.
//
// roster: hoje só nomes fictícios, usados apenas pra narração de gols do
// adversário — não afeta overall do clube, não é jogador simulado de verdade.
// Formato pensado pra evoluir: no futuro, cada string vira um objeto
// { name, ovr, attrs }, e pickScorer passa a escolher por peso
// (atributo ofensivo) em vez de sorteio uniforme — sem mudar quem consome.
const CLUBS = [
  { id: 'vila_nova', name: 'EC Vila Nova', color: '#1F6F4A', overall: 62, branding: { type: 'monogram', text: 'EVN' }, roster: ['Bruno Alves', 'Kaique Silva', 'Rafael Dutra', 'Emerson Paz', 'Diego Moura'] },
  { id: 'rio_preto', name: 'AA Rio Preto', color: '#C0392B', overall: 65, branding: { type: 'monogram', text: 'ARP' }, roster: ['Anderson Reis', 'Lucas Prado', 'Thiago Nunes', 'Caio Ramos', 'Everton Dias'] },
  { id: 'litoral', name: 'SC Litoral', color: '#1B5FA8', overall: 60, branding: { type: 'monogram', text: 'SCL' }, roster: ['Marcelo Souza', 'Felipe Costa', 'Igor Barros', 'Renan Teles', 'Douglas Melo'] },
  { id: 'serrano', name: 'CA Serrano', color: '#8B5E2A', overall: 58, branding: { type: 'monogram', text: 'CAS' }, roster: ['Gustavo Lima', 'Wesley Rocha', 'Alan Freitas', 'Jonas Pereira', 'Vinícius Aguiar'] },
  { id: 'bandeirantes', name: 'União Bandeirantes', color: '#4A4A4A', overall: 68, branding: { type: 'monogram', text: 'UB' }, roster: ['Matheus Farias', 'Léo Martins', 'Samuel Borges', 'Ricardo Assis', 'Elias Cardoso'] },
  { id: 'ferroviario', name: 'Ferroviário SP', color: '#D4A72C', overall: 61, branding: { type: 'monogram', text: 'FSP' }, roster: ['André Vieira', 'Cauã Ribeiro', 'Otávio Sales', 'Breno Xavier', 'Nathan Correia'] },
  { id: 'independente', name: 'Independente FC', color: '#6C3483', overall: 59, branding: { type: 'monogram', text: 'IND' }, roster: ['Fábio Andrade', 'Júlio Bezerra', 'Wallace Duarte', 'Kevin Monteiro', 'Sérgio Bastos'] },
  { id: 'sorocaba', name: 'Atlético Sorocaba', color: '#A93226', overall: 64, branding: { type: 'monogram', text: 'ASC' }, roster: ['Robson Guedes', 'Ederson Brito', 'Vitor Hugo Lacerda', 'Paulo Machado', 'Iago Ferraz'] },
];
const CLUBS_MAP = Object.fromEntries(CLUBS.map(c => [c.id, c]));

function makeCompetitionConfig(seasonYear, participantIds) {
  return {
    id: `estadual_sp_${seasonYear}`,
    name: 'Campeonato Paulista (mock)',
    family: 'estadual_sp', // chave de lookup em COMPETITION_TEMPLATES
    federation_id: FEDERATION.id,
    format: 'league',
    season_id: `season_${seasonYear}`,
    participants: participantIds,
    promotion: { count: 2, target_competition_id: 'serie_d' },
    relegation: { count: 0, target_competition_id: null },
    tiebreakers: ['pts', 'sg', 'gp'],
    calendar_pattern: { match_intervals: [3, 4] }, // Calendar Engine lê daqui — nunca hardcoded por competição
  };
}

/* ============================================================================
   SÉRIE D — 7 clubes fictícios novos. O 8º participante é sempre o clube do
   próprio jogador quando ele é promovido (ver continueNextSeason/getActiveClubsMap)
   — mantém a liga com 8 participantes, mesmo tamanho do Paulista, número par
   exigido por generateLeagueFixtures. Série D só passa a existir de verdade
   quando o SEU clube sobe; se outro clube terminar em posição de acesso, o
   Paulista simplesmente continua igual na temporada seguinte (ver continueNextSeason).
============================================================================ */

const SERIE_D_CLUBS = [
  { id: 'norte_clube', name: 'EC Norte', color: '#2E7D6B', overall: 66, branding: { type: 'monogram', text: 'EN' }, roster: ['Adalberto Nogueira', 'Rogério Kessler', 'Vinícius Tavares', 'Elenilson Braga', 'Fabrício Odei'] },
  { id: 'serra_verde', name: 'AA Serra Verde', color: '#3E8914', overall: 70, branding: { type: 'monogram', text: 'ASV' }, roster: ['Gilmar Petronilho', 'Cristiano Rezende', 'Danilo Weber', 'Adriano Falcão', 'Márcio Guimarães'] },
  { id: 'litoral_sul', name: 'SC Litoral Sul', color: '#16679A', overall: 63, branding: { type: 'monogram', text: 'SLS' }, roster: ['Ivo Cadorna', 'Renato Piancó', 'Sávio Marchesi', 'Otoniel Braz', 'Uriel Santana'] },
  { id: 'planalto', name: 'CA Planalto', color: '#8E4A2E', overall: 68, branding: { type: 'monogram', text: 'CAP' }, roster: ['Wander Vilhena', 'Élcio Marinho', 'Diogo Casagrande', 'Robério Tolentino', 'Nilton Espírito Santo'] },
  { id: 'central_fc', name: 'União Central FC', color: '#B08D1F', overall: 72, branding: { type: 'monogram', text: 'UCF' }, roster: ['Jefferson Icó', 'Paulo Vitor Anchieta', 'Rangel Coimbra', 'Bismarck Lira', 'Deyvid Marreiro'] },
  { id: 'vale_ferroviario', name: 'Ferroviário do Vale', color: '#5B3A29', overall: 64, branding: { type: 'monogram', text: 'FDV' }, roster: ['Osnei Cavalcanti', 'Tarcísio Bandeira', 'Yuri Aparecido', 'Genildo Prado', 'Wagner Sepúlveda'] },
  { id: 'popular_ac', name: 'Popular Atlético Clube', color: '#7A1F3D', overall: 67, branding: { type: 'monogram', text: 'PAC' }, roster: ['Jorge Wilson Kato', 'Nataniel Borba', 'Cassiano Redivo', 'Elber Dourado', 'Thomaz Vilar'] },
  { id: 'porto_azul', name: 'EC Porto Azul', color: '#1C4E80', overall: 65, branding: { type: 'monogram', text: 'EPA' }, roster: ['Aluísio Ferrer', 'Benedito Amaral', 'Cauê Mendonça', 'Hélio Trindade', 'Ronivon Castilho'] },
];

function makeSerieDConfig(seasonYear, participantIds) {
  return {
    id: `serie_d_${seasonYear}`,
    name: 'Série D (mock)',
    family: 'serie_d',
    federation_id: null, // competição nacional, não amarrada a uma federação estadual
    format: 'league',
    season_id: `season_${seasonYear}`,
    participants: participantIds,
    promotion: { count: 2, target_competition_id: 'serie_c' }, // stub — Série C ainda não implementada; sem template, o Mundo Persistente não move ninguém até ela existir
    relegation: { count: 2, target_competition_id: 'estadual_sp' }, // real — fecha o ciclo com o Paulista, mantém as duas divisões sempre com 8 clubes
    tiebreakers: ['pts', 'sg', 'gp'],
    calendar_pattern: { match_intervals: [3, 4] },
  };
}

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
    if (stage.participantsSource.type === 'external') return stage.participantsSource.list;
    const dep = resolvedStages[stage.participantsSource.stageId];
    if (!dep) throw new Error(`Stage '${stage.id}' referencia '${stage.participantsSource.stageId}', ainda não resolvida.`);
    const group = dep.qualifierGroups ? dep.qualifierGroups[stage.participantsSource.qualifierGroup] : undefined;
    if (group === undefined) throw new Error(`qualifierGroup '${stage.participantsSource.qualifierGroup}' não existe na stage '${stage.participantsSource.stageId}'.`);
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
      const src = resolvedStages[cfg.sourceStageId];
      outcomes[key] = { clubIds: (src && src.qualifierGroups[cfg.qualifierGroup]) || [], targetFamily: cfg.targetFamily };
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
      overall: 58 + Math.floor(Math.random() * 12), // sintético, faixa igual à Série D mock — nunca dado oficial
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
      promotion: { sourceStageId: 'fase5_quartas', qualifierGroup: 'semifinalists', targetFamily: 'serie_c' },
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
    return [name, { id: name, name, overall: 62 + Math.floor(Math.random() * 12), color: `hsl(${hue}, 45%, 32%)` }]; // sintético, nunca dado oficial
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
      promotion: { sourceStageId: 'fase2', qualifierGroup: 'promoted', targetFamily: 'serie_b' },
      relegation: { sourceStageId: 'fase1', qualifierGroup: 'relegated', targetFamily: 'serie_d' },
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
    return [name, { id: name, name, overall: 66 + Math.floor(Math.random() * 12), color: `hsl(${hue}, 45%, 32%)` }]; // sintético, nunca dado oficial
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
    seasonOutcomes: { promotion: null, relegation: { sourceStageId: 'fase_unica', qualifierGroup: 'relegated', targetFamily: 'serie_b' } },
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
          { name: 'playoff_zone', rule: { kind: 'topN', n: 6 } },
          { name: 'relegated', rule: { kind: 'bottomN', n: 4 } },
        ] },
    ],
    seasonOutcomes: {
      promotion: { sourceStageId: 'liga', qualifierGroup: 'direct_access', targetFamily: 'serie_a' },
      relegation: { sourceStageId: 'liga', qualifierGroup: 'relegated', targetFamily: 'serie_c' },
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
    const { resolvedStages, outcomes } = CompetitionEngineV2.resolveCompetitionSeason(buildSerieB2026Definition(), () => (fx) => fx.map(f => ({ ...f, gh: Math.floor(rng() * 4), ga: Math.floor(rng() * 4) })));
    const ok = SERIE_B_2026_CLUBS.length === 20 && outcomes.promotion.clubIds.length === 2 && outcomes.relegation.clubIds.length === 4 && resolvedStages.liga.qualifierGroups.playoff_zone.length === 6;
    if (!ok) console.error('[Série B 2026 self-check] Estrutura não bateu o esperado.');
    return ok;
  } catch (e) { console.error('[Série B 2026 self-check] Erro:', e); return false; }
}

if (typeof window !== 'undefined') { runCompetitionEngineV2SelfCheck(); runSerieD2026DemoSelfCheck(); runSerieC2026DemoSelfCheck(); runSerieA2026DemoSelfCheck(); runSerieB2026DemoSelfCheck(); }
const COMPETITION_TEMPLATES = {
  estadual_sp: { clubs: CLUBS, makeConfig: makeCompetitionConfig },
  serie_d: { clubs: SERIE_D_CLUBS, makeConfig: makeSerieDConfig },
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
  return map;
}

/* ============================================================================
   CONTRACT / TRANSFER ENGINE — camada mínima de economia. Não conhece Match,
   Competition, Calendar ou Fitness Engine — só recebe números (overall,
   reputação, idade, status) e devolve decisões/valores. Reaproveita
   COMPETITION_TEMPLATES/RIVALRIES já existentes; não cria estrutura paralela.

   UNIDADE CANÔNICA: `salary` é sempre MENSAL em todo o sistema. A única
   conversão pra anual acontece dentro de computeBuyoutClause (× 12, uma vez).

   FONTE dos valores-base: relatório ANRESF/CBF Academy (2026) sobre contratos
   assinados entre clubes brasileiros na janela de transferências — Série A
   ~R$143k/mês, Série B ~R$26,5k/mês, Série C ~R$10,1k/mês, Série D ~R$3,7k/mês
   (piso R$1.621, salário mínimo). Cruzado com reportagens de mercado sobre
   Série C/D. NÃO são valores definitivos — candidatos a recalibração quando
   dados mais detalhados existirem.
============================================================================ */

const OFFICIAL_SALARY_REGISTRY = [];
const OFFICIAL_SALARY_SOURCE = {
  provider: 'CBF/ANRESF', seasonYear: 2026,
  status: 'official_framework_individual_values_not_public',
  url: 'https://www.cbf.com.br/a-cbf/noticias/escala-campeonato-brasileiro-serie-a/2017/cbf-instala-agencia-de-regulacao-e-da-inicio-a-implementacao-do-fair-play-financeiro-no-brasil',
};
// Faixas abaixo são ECONOMIA DO JOGO, não salários reais. Um valor individual
// só vira oficial quando entrar em OFFICIAL_SALARY_REGISTRY com fonte verificável.
const ESTIMATED_SALARY_BANDS = {
  estadual_sp: { base: 1900, floor: 1621, starMultiplier: 6 },
  serie_d: { base: 3700, floor: 1621, starMultiplier: 12 },
  serie_d_2026: { base: 3700, floor: 1621, starMultiplier: 12 },
  serie_c: { base: 10100, floor: 3000, starMultiplier: 8 },
  serie_b: { base: 26500, floor: 8000, starMultiplier: 8 },
  serie_a: { base: 143000, floor: 20000, starMultiplier: 10 },
};

const STATUS_MULTIPLIERS = { prospect: 0.3, squad_player: 0.6, starter: 1.0, key_player: 1.8, star: 3.5 };
const TIER_ORDER = ['estadual_sp', 'serie_d', 'serie_c', 'serie_b', 'serie_a'];

// Status derivado do que já existe hoje (overall vs. média da competição,
// presença na temporada, reputação) — não é escolhido manualmente.
function evaluatePlayerStatus(player, apps, totalRounds, competitionAvgOverall) {
  const overallGap = player.overall - competitionAvgOverall;
  const appRate = totalRounds > 0 ? apps / totalRounds : 0;
  const score = overallGap / 5 + appRate * 3 + (player.reputation - 5) / 5;
  let status;
  if (score >= 6) status = 'star';
  else if (score >= 3.5) status = 'key_player';
  else if (score >= 1.5) status = 'starter';
  else if (score >= 0) status = 'squad_player';
  else status = 'prospect';
  return { status, score };
}

function computeSalary(competitionFamily, status, params = ESTIMATED_SALARY_BANDS) {
  const band = params[competitionFamily] || params.estadual_sp;
  const multiplier = STATUS_MULTIPLIERS[status] ?? 0.6;
  return Math.round(clamp(band.base * multiplier, band.floor, band.base * band.starMultiplier));
}

function getOfficialSalaryRecord(playerId, clubId, seasonYear = 2026) {
  return OFFICIAL_SALARY_REGISTRY.find(r => r.playerId === playerId && r.clubId === clubId && r.seasonYear === seasonYear) || null;
}

function resolvePlayerSalary(player, competitionFamily, status, seasonYear = 2026) {
  const official = getOfficialSalaryRecord(player?.id, player?.registeredClub || player?.clubId, seasonYear);
  if (official && Number.isFinite(official.monthly)) return { monthly: official.monthly, source: official.source || 'official', status: 'official' };
  return { monthly: computeSalary(competitionFamily, status), source: 'game_estimate', status: 'estimated_pending_official' };
}

function makeContract(clubId, salary, seasonYear, durationSeasons = 2) {
  return { clubId, salary, signedSeason: seasonYear, durationSeasons, expiresSeason: seasonYear + durationSeasons };
}

const BUYOUT_FORMULA_PARAMS = { annualMultiplier: 1.5, reputationDivisor: 15, remainingWeight: 0.25 };
// Multa entre clubes — não movimenta o saldo do jogador (não existe economia
// de clube nesta versão, só a do jogador). Fica exibida como contexto/realismo.
function computeBuyoutClause(contract, player, seasonYear, params = BUYOUT_FORMULA_PARAMS) {
  const remaining = Math.max(0, contract.expiresSeason - seasonYear);
  const annualSalary = contract.salary * 12; // única conversão mensal→anual do sistema inteiro
  const base = annualSalary * params.annualMultiplier;
  const reputationFactor = 1 + player.reputation / params.reputationDivisor;
  const remainingFactor = 1 + remaining * params.remainingWeight;
  return Math.round(base * reputationFactor * remainingFactor);
}

// Compensação quando o CLUBE demite sem comprador (paga ao jogador, ao
// contrário da multa entre clubes).
function computeReleaseCompensation(contract, seasonYear) {
  const remaining = Math.max(0, contract.expiresSeason - seasonYear);
  return Math.round(remaining * contract.salary * 12 * 0.5);
}

const CLUB_DECISION_PARAMS = {
  releaseThreshold: -2,
  // Calibração ajustada após simulação de estresse (100 carreiras × 15
  // temporadas): com highStatus/prospectLowApps=2, o clube NUNCA agia por
  // conta própria (2 nunca alcança o limiar de 3) — só reagia a pedido do
  // jogador. Subindo pra 3, o clube também age sozinho ocasionalmente,
  // exatamente como "clube decide primeiro" pretendia desde o desenho original.
  saleWeights: { wantsTransfer: 3, highStatus: 3 },
  loanWeights: { wantsLoan: 3, prospectLowApps: 3 },
};

// CLUBE decide primeiro — pesos configuráveis, nunca hardcoded por nome de
// clube. Devolve uma ação; o jogador só reage depois (ver resolveContractDecision).
function clubSeasonDecision(contract, status, statusScore, seasonYear, playerRequestFlags, appRate, params = CLUB_DECISION_PARAMS) {
  const contractExpiring = contract.expiresSeason - seasonYear <= 0;
  if (contractExpiring && statusScore <= params.releaseThreshold) return 'release';

  let saleWeight = 0;
  if (playerRequestFlags.wantsTransfer) saleWeight += params.saleWeights.wantsTransfer;
  if (status === 'key_player' || status === 'star') saleWeight += params.saleWeights.highStatus;
  if (saleWeight >= 3) return 'consider_sale';

  let loanWeight = 0;
  if (playerRequestFlags.wantsLoan) loanWeight += params.loanWeights.wantsLoan;
  if (status === 'prospect' && appRate < 0.3) loanWeight += params.loanWeights.prospectLowApps;
  if (loanWeight >= 3) return 'offer_loan';

  return contractExpiring ? 'renew' : 'keep_as_is';
}

// "Qual clube REALMENTE teria motivo pra querer esse jogador?" — não é
// sorteio simples: idade, overall relativo, reputação e status compõem um
// score de interesse que decide se um tier ACIMA do atual é plausível.
function computeDemandScore(player, status, competitionAvgOverall, playerRequestFlags) {
  let score = (player.overall - competitionAvgOverall) / 5;
  score += STATUS_MULTIPLIERS[status] ?? 0.6;
  score += (30 - player.age) / 15; // mais jovem = mais valorizado pro nível acima (potencial)
  score += player.reputation / 10;
  if (playerRequestFlags.wantsTransfer) score += 0.5;
  return score;
}

function generateTransferOffers(player, status, currentFamily, competitionAvgOverall, playerRequestFlags) {
  const demand = computeDemandScore(player, status, competitionAvgOverall, playerRequestFlags);
  const currentIndex = TIER_ORDER.indexOf(currentFamily);
  let targetFamily = currentFamily;
  if (demand >= 4 && currentIndex < TIER_ORDER.length - 1) targetFamily = TIER_ORDER[currentIndex + 1];

  const template = COMPETITION_TEMPLATES[targetFamily];
  if (!template || template.clubs.length === 0) return [];
  const targetClub = template.clubs[Math.floor(Math.random() * template.clubs.length)];
  const proposedSalary = computeSalary(targetFamily, status);
  return [{ clubId: targetClub.id, clubName: targetClub.name, family: targetFamily, proposedSalary, proposedDuration: 2 }];
}

// Empréstimo: destino plausível pro NÍVEL ATUAL (não sobe de tier — jogador
// precisa de minutos, não de um salto que ele ainda não teria motivo real pra dar).
function generateLoanOffer(currentFamily) {
  const template = COMPETITION_TEMPLATES[currentFamily];
  if (!template || template.clubs.length === 0) return null;
  const targetClub = template.clubs[Math.floor(Math.random() * template.clubs.length)];
  return { clubId: targetClub.id, clubName: targetClub.name, family: currentFamily, durationSeasons: 1 };
}

/* ============================================================================
   ECONOMY / LIFESTYLE ENGINE — camada isolada, igual ao Contract/Transfer:
   só recebe números (saldo, valor, upkeep) e devolve números. Não conhece
   Match, Competition, Season nem Contract. `economyState.balance` continua
   sendo a MESMA fonte de dinheiro do salário — investir/comprar imóvel só
   move dinheiro de um lugar pro outro, nunca cria dinheiro do nada.

   PATRIMÔNIO LÍQUIDO = saldo em conta + investimentos + soma do valor dos
   imóveis. Retorno de investimento e manutenção de imóveis são SINTÉTICOS
   (não representam mercado real ou preços reais de imóveis) — documentado
   aqui, não escondido.
============================================================================ */
const INVESTMENT_SEASONAL_RETURN = 0.06; // sintético — 6% por temporada, fixo (sem risco/volatilidade nesta v1)
const PROPERTY_OPTIONS = [
  { id: 'apto_pequeno', name: 'Apartamento pequeno', cost: 80000, upkeep: 400 },
  { id: 'apto_medio', name: 'Apartamento médio', cost: 250000, upkeep: 1200 },
  { id: 'casa_grande', name: 'Casa grande', cost: 600000, upkeep: 3000 },
  { id: 'mansao', name: 'Mansão', cost: 1500000, upkeep: 8000 },
];
const INVESTMENT_AMOUNTS = [5000, 20000, 100000];

function computeNetWorth(economyState) {
  const propertiesValue = economyState.properties.reduce((sum, p) => sum + p.value, 0);
  return economyState.balance + economyState.investments + propertiesValue;
}
function investAmount(economyState, amount) {
  if (amount <= 0 || amount > economyState.balance) return economyState; // nunca investe mais do que tem
  return { ...economyState, balance: economyState.balance - amount, investments: economyState.investments + amount };
}
function withdrawAllInvestments(economyState) {
  if (economyState.investments <= 0) return economyState;
  return { ...economyState, balance: economyState.balance + economyState.investments, investments: 0 };
}
function buyProperty(economyState, propertyId) {
  const option = PROPERTY_OPTIONS.find(p => p.id === propertyId);
  if (!option || option.cost > economyState.balance) return economyState; // nunca compra o que não pode pagar
  const newProperty = { id: `${propertyId}_${Date.now()}`, optionId: propertyId, name: option.name, value: option.cost, upkeep: option.upkeep };
  return { ...economyState, balance: economyState.balance - option.cost, properties: [...economyState.properties, newProperty] };
}
// Chamado UMA vez por virada de temporada (nunca por rodada — upkeep e
// retorno de investimento são anuais, diferente do salário que já é por
// rodada). Nunca deixa o saldo ficar negativo por causa de upkeep — se não
// dá pra pagar tudo, paga o que dá, sem inventar dívida (fora de escopo).
function applyAnnualEconomyUpdate(economyState) {
  const totalUpkeep = economyState.properties.reduce((sum, p) => sum + p.upkeep, 0);
  const newBalance = Math.max(0, economyState.balance - totalUpkeep);
  const newInvestments = Math.round(economyState.investments * (1 + INVESTMENT_SEASONAL_RETURN));
  return { ...economyState, balance: newBalance, investments: newInvestments };
}

const POSITIONS = [
  { id: 'GOL', label: 'Goleiro' },
  { id: 'ZAG', label: 'Zagueiro' },
  { id: 'MEI', label: 'Meio-campo' },
  { id: 'ATA', label: 'Atacante' },
];

/* ============================================================================
   PLAYER DATA MODEL V1 — ponte entre a base real e o motor atual

   Regra desta etapa:
   - a base real pode guardar posição detalhada;
   - o Match/Progression Engine atual continua operando nas 4 posições legadas;
   - registeredClub/currentClub ficam separados;
   - nenhum OVR/atributo/potencial é inventado para jogador real nesta camada.

   Quando a coleta oficial da Série A 2026 entrar, ela será normalizada por
   normalizeRegisteredPlayer() e poderá conviver com os mocks sem quebrá-los.
============================================================================ */
const DETAILED_POSITIONS = [
  { id: 'GOL', label: 'Goleiro', legacy: 'GOL' },
  { id: 'ZAG', label: 'Zagueiro', legacy: 'ZAG' },
  { id: 'LD', label: 'Lateral-direito', legacy: 'ZAG' },
  { id: 'LE', label: 'Lateral-esquerdo', legacy: 'ZAG' },
  { id: 'VOL', label: 'Volante', legacy: 'MEI' },
  { id: 'MC', label: 'Meio-campista', legacy: 'MEI' },
  { id: 'MEI', label: 'Meia-atacante', legacy: 'MEI' },
  { id: 'MD', label: 'Meia-direita', legacy: 'MEI' },
  { id: 'ME', label: 'Meia-esquerda', legacy: 'MEI' },
  { id: 'PD', label: 'Ponta-direita', legacy: 'ATA' },
  { id: 'PE', label: 'Ponta-esquerda', legacy: 'ATA' },
  { id: 'SA', label: 'Segundo atacante', legacy: 'ATA' },
  { id: 'CA', label: 'Centroavante', legacy: 'ATA' },
];
const DETAILED_POSITION_MAP = Object.fromEntries(DETAILED_POSITIONS.map(p => [p.id, p]));

function detailedPositionToLegacy(position) {
  return DETAILED_POSITION_MAP[position]?.legacy || position;
}

// ---------------------------------------------------------------------------
// PLAYER PROFILE V1.2
// Posição -> Função -> Arquétipo -> especialização.
// Esta camada é determinística e serve para jogadores criados pelo usuário.
// Jogadores reais só recebem função/arquétipo quando a posição estiver
// confirmada por fonte de dados; nunca inferimos uma posição de um nome.
// ---------------------------------------------------------------------------
const POSITION_FUNCTIONS = {
  GOL: ['Goleiro'],
  ZAG: ['Defensor central'],
  LD: ['Lateral'],
  LE: ['Lateral'],
  VOL: ['Primeiro volante', 'Volante organizador', 'Box-to-Box'],
  MC: ['Maestro', 'Organizador', 'Box-to-Box', 'Criador'],
  MEI: ['Criador', 'Meia-atacante'],
  MD: ['Ponta/ala', 'Criador'],
  ME: ['Ponta/ala', 'Criador'],
  PD: ['Driblador', 'Criador', 'Finalizador', 'Ala ofensivo'],
  PE: ['Driblador', 'Criador', 'Finalizador', 'Ala ofensivo'],
  SA: ['Segundo atacante', 'Atacante móvel', 'Criador'],
  CA: ['Matador', 'Atacante móvel', 'Pivô', 'Falso 9'],
};

const ARCHETYPE_PROFILES = {
  'Matador': { finalizacao: 1.12, velocidade: 1.02, passe: 0.92, defesa: 0.72, fisico: 1.02 },
  'Atacante móvel': { finalizacao: 1.04, velocidade: 1.12, passe: 0.96, defesa: 0.72, fisico: 0.98 },
  'Pivô': { finalizacao: 1.02, velocidade: 0.86, passe: 1.02, defesa: 0.74, fisico: 1.14 },
  'Falso 9': { finalizacao: 0.98, velocidade: 0.96, passe: 1.12, defesa: 0.70, fisico: 0.94 },
  'Driblador': { finalizacao: 1.02, velocidade: 1.14, passe: 1.02, defesa: 0.70, fisico: 0.90 },
  'Criador': { finalizacao: 0.94, velocidade: 0.98, passe: 1.14, defesa: 0.76, fisico: 0.90 },
  'Finalizador': { finalizacao: 1.10, velocidade: 1.04, passe: 0.90, defesa: 0.70, fisico: 0.96 },
  'Ala ofensivo': { finalizacao: 1.00, velocidade: 1.10, passe: 1.00, defesa: 0.82, fisico: 0.96 },
  'Maestro': { finalizacao: 0.88, velocidade: 0.90, passe: 1.18, defesa: 0.82, fisico: 0.92 },
  'Organizador': { finalizacao: 0.90, velocidade: 0.94, passe: 1.16, defesa: 0.92, fisico: 0.94 },
  'Box-to-Box': { finalizacao: 0.96, velocidade: 1.02, passe: 1.02, defesa: 1.02, fisico: 1.08 },
  'Primeiro volante': { finalizacao: 0.76, velocidade: 0.88, passe: 1.00, defesa: 1.14, fisico: 1.08 },
  'Volante organizador': { finalizacao: 0.80, velocidade: 0.90, passe: 1.12, defesa: 1.06, fisico: 1.02 },
  'Defensor central': { finalizacao: 0.54, velocidade: 0.84, passe: 0.94, defesa: 1.18, fisico: 1.14 },
  'Lateral': { finalizacao: 0.78, velocidade: 1.10, passe: 1.00, defesa: 1.02, fisico: 1.00 },
  'Goleiro': { finalizacao: 0.30, velocidade: 0.70, passe: 0.86, defesa: 1.24, fisico: 1.08 },
  'Meia-atacante': { finalizacao: 1.00, velocidade: 1.00, passe: 1.10, defesa: 0.72, fisico: 0.90 },
  'Ponta/ala': { finalizacao: 0.98, velocidade: 1.10, passe: 1.02, defesa: 0.82, fisico: 0.94 },
  'Segundo atacante': { finalizacao: 1.04, velocidade: 1.06, passe: 1.02, defesa: 0.72, fisico: 0.94 },
};

function derivePlayerProfile(position, attrs = {}) {
  const detailed = DETAILED_POSITION_MAP[position] ? position : null;
  if (!detailed) return { position: null, legacyPosition: null, functions: [], archetype: null, specialization: null };
  const functions = POSITION_FUNCTIONS[detailed] || [];
  const archetype = functions[0] || null;
  return {
    position: detailed,
    legacyPosition: detailedPositionToLegacy(detailed),
    functions,
    archetype,
    specialization: archetype ? `${detailed}:${archetype}` : null,
    profileMultipliers: archetype ? ARCHETYPE_PROFILES[archetype] : null,
  };
}

function makePlayerId(clubId, name) {
  const slug = String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${clubId}-${slug || 'player'}`;
}

function normalizeRegisteredPlayer(raw) {
  if (!raw || !raw.clubId || !raw.name) return null;
  const detailedPosition = raw.position || raw.detailedPosition || null;
  const profile = derivePlayerProfile(detailedPosition);
  return {
    id: raw.id || makePlayerId(raw.clubId, raw.name),
    clubId: raw.clubId,
    name: raw.name,
    displayName: raw.displayName || raw.name,
    age: Number.isFinite(raw.age) ? raw.age : null,
    birthDate: raw.birthDate || null,
    position: detailedPosition,
    legacyPosition: profile.legacyPosition,
    functions: raw.functions || profile.functions,
    archetype: raw.archetype || profile.archetype,
    specialization: raw.specialization || profile.specialization,
    registeredClub: raw.registeredClub || raw.clubId,
    currentClub: raw.currentClub || raw.clubId,
    competition: raw.competition || null,
    source: raw.source || 'official_cbf',
    dataStatus: raw.dataStatus || 'validated',
    attrs: raw.attrs || null,
    overall: Number.isFinite(raw.overall) ? raw.overall : null,
    potential: raw.potential || null,
  };
}

function getRosterPlayerName(playerOrString) {
  return typeof playerOrString === 'string' ? playerOrString : (playerOrString?.displayName || playerOrString?.name || 'jogador do time');
}

function validateRegisteredPlayerRecord(player) {
  const errors = [];
  if (!player?.id) errors.push('id');
  if (!player?.clubId) errors.push('clubId');
  if (!player?.name) errors.push('name');
  if (player?.age != null && (!Number.isInteger(player.age) || player.age < 14 || player.age > 60)) errors.push('age');
  if (player?.position != null && !DETAILED_POSITION_MAP[player.position]) errors.push('position');
  if (player?.birthDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(player.birthDate)) errors.push('birthDate');
  if (player?.attrs != null && (typeof player.attrs !== 'object' || Object.values(player.attrs).some(v => !Number.isFinite(v) || v < 0 || v > 99))) errors.push('attrs');
  if (player?.overall != null && (!Number.isFinite(player.overall) || player.overall < 0 || player.overall > 99)) errors.push('overall');
  if (!player?.registeredClub) errors.push('registeredClub');
  if (!player?.currentClub) errors.push('currentClub');
  return { valid: errors.length === 0, errors };
}

function validateRegisteredPlayerDatabase(players) {
  const normalized = (players || []).map(normalizeRegisteredPlayer).filter(Boolean);
  const ids = new Set();
  const duplicates = [];
  const invalid = [];
  normalized.forEach(player => {
    if (ids.has(player.id)) duplicates.push(player.id);
    ids.add(player.id);
    const check = validateRegisteredPlayerRecord(player);
    if (!check.valid) invalid.push({ id: player.id, errors: check.errors });
  });
  return { total: normalized.length, valid: invalid.length === 0 && duplicates.length === 0, duplicates, invalid, players: normalized };
}

// Registry V1: a base oficial entra aqui quando for coletada. O array vazio é
// deliberado: ausência de dado oficial nunca vira jogador inventado.
// Fonte oficial primária da base profissional: CBF Série A 2026.
// A coleção é incremental, mas NÃO pode ativar parcialmente um elenco oficial:
// enquanto não houver cobertura completa validada, o jogo mantém o roster
// narrativo/mock como fallback para não esconder jogadores por acidente.
const PLAYER_DATABASE_SOURCE = {
  provider: 'CBF',
  competition: 'CAMPEONATO_BRASILEIRO_SERIE_A',
  seasonYear: 2026,
  url: 'https://www.cbf.com.br/futebol-brasileiro/atletas/campeonato-brasileiro/serie-a/2026',
};
const OFFICIAL_PLAYER_DATABASE = [];
const OFFICIAL_ACADEMY_PLAYER_DATABASE = [
  // Campeonato Brasileiro Sub-20 2026 — nomes oficiais publicados pela CBF.
  // Posição/atributos/salário permanecem pendentes até haver fonte verificável.
  { id: 'sao_paulo-pedro-henrique-rodrigues-ribeiro', clubId: 'sao_paulo', name: 'Pedro Henrique Rodrigues Ribeiro', displayName: 'PEDRO', registeredClub: 'sao_paulo', currentClub: 'sao_paulo', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'sao_paulo-kauã-edmar-ramos-santos', clubId: 'sao_paulo', name: 'Kauã Edmar Ramos Santos', displayName: 'Kauã', registeredClub: 'sao_paulo', currentClub: 'sao_paulo', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'sao_paulo-ryan-francisco-rodrigues', clubId: 'sao_paulo', name: 'Ryan Francisco Rodrigues dos Santos Silva', displayName: 'Ryan Francisco', registeredClub: 'sao_paulo', currentClub: 'sao_paulo', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'sao_paulo-luan-de-almeida-silva', clubId: 'sao_paulo', name: 'Luan de Almeida Silva', displayName: 'Luan', registeredClub: 'sao_paulo', currentClub: 'sao_paulo', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'sao_paulo-alisson-santana-da-silva', clubId: 'sao_paulo', name: 'Alisson Santana da Silva', displayName: 'Alisson', registeredClub: 'sao_paulo', currentClub: 'sao_paulo', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'palmeiras-gabriel-kidani-bernardino', clubId: 'palmeiras', name: 'Gabriel Kidani Bernardino', displayName: 'Gabriel Kidani', registeredClub: 'palmeiras', currentClub: 'palmeiras', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'palmeiras-kaue-leal-silva-santos', clubId: 'palmeiras', name: 'Kauê Leal Silva Santos', displayName: 'KAUÊ', registeredClub: 'palmeiras', currentClub: 'palmeiras', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'palmeiras-luiz-felipe-santana-gomes', clubId: 'palmeiras', name: 'Luiz Felipe Santana Gomes', displayName: 'LUIZ FELIPE', registeredClub: 'palmeiras', currentClub: 'palmeiras', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'palmeiras-thiago-soares-nogueira', clubId: 'palmeiras', name: 'Thiago Soares Nogueira', displayName: 'THIAGO', registeredClub: 'palmeiras', currentClub: 'palmeiras', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'palmeiras-luighi-hanri-sousa-santos', clubId: 'palmeiras', name: 'Luighi Hanri Sousa Santos', displayName: 'Luighi', registeredClub: 'palmeiras', currentClub: 'palmeiras', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'vitoria-luis-henrique-sousa-dos-santos', clubId: 'vitoria', name: 'Luis Henrique Sousa dos Santos', displayName: 'Luis', registeredClub: 'vitoria', currentClub: 'vitoria', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'vitoria-yuri-santos-silveira', clubId: 'vitoria', name: 'Yuri Santos Silveira', displayName: 'Yuri', registeredClub: 'vitoria', currentClub: 'vitoria', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'vitoria-robert-de-souza-nogueira', clubId: 'vitoria', name: 'Robert de Souza Nogueira', displayName: 'Robert', registeredClub: 'vitoria', currentClub: 'vitoria', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'bragantino-luis-gustavo-lucio-antonio', clubId: 'red_bull_bragantino', name: 'Luis Gustavo Lucio Antonio', displayName: 'Luis Gustavo', registeredClub: 'red_bull_bragantino', currentClub: 'red_bull_bragantino', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'bragantino-weimar-enrique-vivas-palacios', clubId: 'red_bull_bragantino', name: 'Weimar Enrique Vivas Palacios', displayName: 'Weimar Palacios', registeredClub: 'red_bull_bragantino', currentClub: 'red_bull_bragantino', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
  { id: 'bragantino-caio-henrique-simoes-dos-santos', clubId: 'red_bull_bragantino', name: 'Caio Henrique Simões dos Santos', displayName: 'Caio Henrique', registeredClub: 'red_bull_bragantino', currentClub: 'red_bull_bragantino', competition: 'CAMPEONATO_BRASILEIRO_SUB20', source: 'official_cbf', dataStatus: 'official_name_only' },
];
const OFFICIAL_ACADEMY_DATABASE_COMPLETE = false;

function validateAcademyDatabase(players) {
  const normalized = (players || []).map(normalizeRegisteredPlayer).filter(Boolean);
  const ids = new Set();
  const duplicates = [];
  normalized.forEach(p => { if (ids.has(p.id)) duplicates.push(p.id); ids.add(p.id); });
  return {
    total: normalized.length,
    duplicates,
    valid: duplicates.length === 0,
    complete: OFFICIAL_ACADEMY_DATABASE_COMPLETE,
    source: 'CBF Campeonato Brasileiro Sub-20 2026',
  };
}

function getAcademyPlayers(clubId) {
  return OFFICIAL_ACADEMY_PLAYER_DATABASE
    .filter(p => p.registeredClub === clubId || p.clubId === clubId)
    .map(normalizeRegisteredPlayer);
}

const ACADEMY_DATABASE_SELF_CHECK = validateAcademyDatabase(OFFICIAL_ACADEMY_PLAYER_DATABASE);

function resolveAcademyCompensation(player, clubId, seasonYear = 2026) {
  const official = getOfficialSalaryRecord(player?.id, clubId, seasonYear);
  if (official && Number.isFinite(official.monthly)) {
    return { monthly: official.monthly, source: official.source || 'official', status: 'official' };
  }
  return { monthly: null, source: 'pending_official', status: 'pending_official' };
}

const OFFICIAL_PLAYER_DATABASE_COMPLETE = false;
const PLAYER_DATABASE_EXPECTED_CLUBS = [
  'athletico_paranaense', 'atletico_mineiro', 'bahia', 'botafogo', 'chapecoense',
  'corinthians', 'coritiba', 'cruzeiro', 'flamengo', 'fluminense', 'gremio',
  'internacional', 'mirassol', 'palmeiras', 'red_bull_bragantino', 'remo',
  'santos', 'sao_paulo', 'vasco', 'vitoria',
];

function validateOfficialCoverage(players) {
  const normalized = (players || []).map(normalizeRegisteredPlayer).filter(Boolean);
  const clubs = new Set(normalized.map(p => p.registeredClub || p.clubId));
  const missingClubs = PLAYER_DATABASE_EXPECTED_CLUBS.filter(id => !clubs.has(id));
  return { totalPlayers: normalized.length, clubsCovered: clubs.size, expectedClubs: PLAYER_DATABASE_EXPECTED_CLUBS.length, missingClubs, complete: missingClubs.length === 0 && normalized.length > 0 };
}

const PLAYER_DATA_MODEL_VERSION = '1.2';
const PLAYER_DATA_MODEL_CHECK = validateRegisteredPlayerDatabase(OFFICIAL_PLAYER_DATABASE);
const PLAYER_DATABASE_COVERAGE_CHECK = validateOfficialCoverage(OFFICIAL_PLAYER_DATABASE);

function normalizeClubRoster(club) {
  const roster = Array.isArray(club?.roster) ? club.roster : [];
  return roster.map(entry => {
    if (typeof entry === 'string') {
      return {
        id: makePlayerId(club.id, entry),
        clubId: club.id,
        name: entry,
        displayName: entry,
        age: null,
        birthDate: null,
        position: null,
        legacyPosition: null,
        registeredClub: club.id,
        currentClub: club.id,
        competition: null,
        source: 'mock_narrative',
        dataStatus: 'mock',
      };
    }
    return normalizeRegisteredPlayer({ ...entry, clubId: entry.clubId || club.id });
  }).filter(Boolean);
}

function getClubRosterPlayers(club) {
  if (!club) return [];
  const official = OFFICIAL_PLAYER_DATABASE.filter(p => p.registeredClub === club.id || p.clubId === club.id);
  // Cobertura parcial nunca substitui o elenco inteiro. Só ativa a fonte
  // oficial quando a coleta da competição tiver sido explicitamente fechada
  // e validada.
  if (OFFICIAL_PLAYER_DATABASE_COMPLETE && official.length > 0) return official;
  return normalizeClubRoster(club);
}

function validatePlayerModelSelfCheck() {
  const result = validateRegisteredPlayerDatabase(OFFICIAL_PLAYER_DATABASE);
  if (!result.valid) throw new Error(`Player Data Model V${PLAYER_DATA_MODEL_VERSION} inválido: ${JSON.stringify(result.invalid)}`);
  return {
    ...result,
    source: PLAYER_DATABASE_SOURCE,
    complete: OFFICIAL_PLAYER_DATABASE_COMPLETE,
    coverage: validateOfficialCoverage(OFFICIAL_PLAYER_DATABASE),
    activationSafe: !OFFICIAL_PLAYER_DATABASE_COMPLETE || (result.valid && validateOfficialCoverage(OFFICIAL_PLAYER_DATABASE).complete),
  };
}
const PLAYER_DATABASE_SELF_CHECK = validatePlayerModelSelfCheck();
const WEIGHTS = {
  GOL: { defesa: 0.5, fisico: 0.3, passe: 0.1, velocidade: 0.05, finalizacao: 0.05 },
  ZAG: { defesa: 0.45, fisico: 0.25, passe: 0.15, velocidade: 0.1, finalizacao: 0.05 },
  MEI: { passe: 0.35, velocidade: 0.2, finalizacao: 0.15, defesa: 0.15, fisico: 0.15 },
  ATA: { finalizacao: 0.4, velocidade: 0.3, passe: 0.15, fisico: 0.1, defesa: 0.05 },
};
const ATTR_LABELS = { finalizacao: 'Finalização', passe: 'Passe', velocidade: 'Velocidade', defesa: 'Defesa', fisico: 'Físico' };

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function computeOverall(position, attrs) {
  const w = WEIGHTS[position];
  let sum = 0;
  for (const k in w) sum += (attrs[k] || 0) * w[k];
  return Math.round(sum);
}

/* ============================================================================
   PLAYER PROGRESSION ENGINE — isolado. Só ele decide como attrs/overall evoluem.
   Match/Competition/Season continuam recebendo números prontos e não sabem que
   por baixo existe treino composto, decimal ou potencial. computeOverall() acima
   não mudou: já recebia número e arredondava só a saída — decimal é transparente
   pra ele.

   Corte desta etapa (deliberado): intensidade/fadiga ficam para o Fitness Engine
   (item 5 da fila), pra não misturar dois riscos na mesma implementação. Aqui só
   entra o núcleo: treino composto + potencial + desaceleração.
============================================================================ */

// Equivalente a trainings.json — cada treino distribui um ganho-base entre vários
// atributos por peso. "Treino ≠ atributo": o jogador escolhe a atividade, não o
// número que quer subir.
const TRAININGS = [
  { id: 'finishing', name: 'Finalizações', effects: { finalizacao: 0.7, passe: 0.15, fisico: 0.15 } },
  { id: 'short_pass', name: 'Passe curto', effects: { passe: 0.7, velocidade: 0.15, finalizacao: 0.15 } },
  { id: 'sprint', name: 'Sprint', effects: { velocidade: 0.7, fisico: 0.3 } },
  { id: 'gym', name: 'Academia', effects: { fisico: 0.7, defesa: 0.3 } },
  { id: 'free_kick', name: 'Cobrança de falta', effects: { finalizacao: 0.5, passe: 0.35, fisico: 0.15 } },
];

const BASE_TRAINING_GAIN = 0.9; // "pontos de treino" totais distribuídos por sessão, antes da desaceleração

// Curva de desaceleração: quanto mais perto do potencial, menor o ganho.
function decelerate(current, potential, rawGain) {
  if (potential <= current) return 0;
  return rawGain * (potential - current) / potential;
}

// Função genérica de composição de modificadores. Não conhece treino, treinador,
// fitness, calendário, partida ou qualquer outro domínio — só recebe um número
// e uma lista de transformações. Com lista vazia, devolve o valor de entrada
// sem alteração (reduce sobre array vazio retorna o initialValue).
function composeModifiers(baseValue, modifiers = []) {
  return modifiers.reduce((value, modifier) => {
    if (typeof modifier === 'function') return modifier(value);
    if (modifier && typeof modifier.multiplier === 'number') return value * modifier.multiplier;
    if (modifier && typeof modifier.flat === 'number') return value + modifier.flat;
    return value;
  }, baseValue);
}

// Recebe o jogador e o id do treino escolhido; devolve attrs decimais atualizados
// + overall recalculado (via computeOverall, sem alterar essa função). Pura.
// `modifiers` é o ponto de extensão pra Growth Profile/Development Focus/Trainer
// no futuro — hoje sempre vazio, então o resultado é idêntico ao anterior.
function applyTraining(player, trainingId, modifiers = []) {
  const training = TRAININGS.find(t => t.id === trainingId);
  if (!training) return player;

  const attrs = { ...player.attrs };
  for (const [attr, weight] of Object.entries(training.effects)) {
    const current = attrs[attr] || 0;
    const potential = player.potential[attr] ?? 99;
    const baseGain = BASE_TRAINING_GAIN * weight;
    const modifiedGain = composeModifiers(baseGain, modifiers);
    const gain = decelerate(current, potential, modifiedGain);
    attrs[attr] = clamp(current + gain, 0, 99);
  }
  return { ...player, attrs, overall: computeOverall(player.position, attrs) };
}

/* ============================================================================
   MATCH ENGINE — inalterado
============================================================================ */

function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
function simulateScore(strA, strB) {
  const base = 1.2;
  const diff = (strA - strB) / 16;
  const expA = clamp(base + diff, 0.25, 3.2);
  const expB = clamp(base - diff, 0.25, 3.2);
  return [poisson(expA), poisson(expB)];
}
// Fitness abaixo do piso de disponibilidade: bloqueio DURO, decidido antes de
// qualquer sorteio de probabilidade — não é mais "reduz a chance", é "não é
// relacionado". Mudança combinada desde o desenho original do Fitness
// Engine, implementada só agora com aprovação explícita (mexe no Match
// Engine, que era propositalmente protegido até aqui). O resto da função
// (fórmula de probabilidade/nota) continua absolutamente idêntico ao que
// já estava validado.
function resolveUserInvolvement(player, clubOverall, condition) {
  if (condition !== undefined && condition <= FITNESS_AVAILABILITY_FLOOR) return { calledUp: false };
  const prob = clamp(0.35 + (player.overall - clubOverall) / 80, 0.15, 0.95);
  const calledUp = Math.random() < prob;
  if (!calledUp) return { calledUp: false };
  const rating = clamp(5.5 + (player.overall - clubOverall) / 20 + (Math.random() - 0.5) * 3, 1, 10);
  return { calledUp: true, rating };
}
function resolvePlayerGoalsAssists(player, teamGoals) {
  const goalChance = player.position === 'ATA' ? 0.4 : player.position === 'MEI' ? 0.18 : 0.04;
  const assistChance = player.position === 'MEI' ? 0.3 : player.position === 'ATA' ? 0.15 : 0.06;
  let goals = 0, assists = 0;
  for (let g = 0; g < teamGoals; g++) {
    if (Math.random() < goalChance * (player.attrs.finalizacao / 60)) goals++;
    else if (Math.random() < assistChance * (player.attrs.passe / 60)) assists++;
  }
  return { goals, assists };
}

/* ============================================================================
   COMPETITION ENGINE — inalterado
============================================================================ */

function generateLeagueFixtures(participantIds) {
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
  const second = rounds.map(round => round.map(([h, a]) => [a, h]));
  return [...rounds, ...second];
}
function generateFixtures(config) {
  if (config.format === 'league') return generateLeagueFixtures(config.participants);
  throw new Error(`Formato de competição não suportado ainda: ${config.format}`);
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
function resolveRound(roundFixtures, clubsMap, standingsMap, userClubId, player, round, competitionId, condition) {
  const newStandings = { ...standingsMap };
  for (const id in newStandings) newStandings[id] = { ...newStandings[id] };
  let userMatchInfo = null;
  let playerDelta = null;
  const matchResults = []; // contrato mínimo: { homeId, awayId, gh, ga, round, competitionId }

  roundFixtures.forEach(([homeId, awayId]) => {
    const isUserHome = homeId === userClubId;
    const isUserAway = awayId === userClubId;
    let involvement = { calledUp: false };

    if (isUserHome || isUserAway) {
      const clubOverall = clubsMap[userClubId].overall;
      involvement = resolveUserInvolvement(player, clubOverall, condition);
    }

    let strHome = clubsMap[homeId].overall;
    let strAway = clubsMap[awayId].overall;
    if (isUserHome && involvement.calledUp) strHome += (involvement.rating - 6) * 1.5;
    if (isUserAway && involvement.calledUp) strAway += (involvement.rating - 6) * 1.5;

    const [gh, ga] = simulateScore(strHome, strAway);
    matchResults.push({ homeId, awayId, gh, ga, round, competitionId });

    if ((isUserHome || isUserAway) && involvement.calledUp) {
      const teamGoals = isUserHome ? gh : ga;
      const { goals, assists } = resolvePlayerGoalsAssists(player, teamGoals);
      userMatchInfo = { home: clubsMap[homeId].name, away: clubsMap[awayId].name, homeId, awayId, gh, ga, isUserHome, calledUp: true, rating: involvement.rating, goals, assists };
      playerDelta = { goals, assists, rating: involvement.rating };
    } else if (isUserHome || isUserAway) {
      userMatchInfo = { home: clubsMap[homeId].name, away: clubsMap[awayId].name, homeId, awayId, gh, ga, isUserHome, calledUp: false };
    }

    newStandings[homeId].pj++; newStandings[awayId].pj++;
    newStandings[homeId].gp += gh; newStandings[homeId].gc += ga;
    newStandings[awayId].gp += ga; newStandings[awayId].gc += gh;
    if (gh > ga) { newStandings[homeId].v++; newStandings[homeId].pts += 3; newStandings[awayId].d++; }
    else if (gh < ga) { newStandings[awayId].v++; newStandings[awayId].pts += 3; newStandings[homeId].d++; }
    else { newStandings[homeId].e++; newStandings[awayId].e++; newStandings[homeId].pts++; newStandings[awayId].pts++; }
  });

  return { newStandings, userMatchInfo, playerDelta, matchResults };
}
function computePromotionRelegation(config, sortedStandings) {
  const promoted = config.promotion.count > 0 ? sortedStandings.slice(0, config.promotion.count).map(r => r.club_id) : [];
  const relegated = config.relegation.count > 0 ? sortedStandings.slice(-config.relegation.count).map(r => r.club_id) : [];
  return { promoted, relegated, promotion_target: config.promotion.target_competition_id, relegation_target: config.relegation.target_competition_id };
}

/* ============================================================================
   MUNDO PERSISTENTE — cada clube guarda sua divisão atual entre temporadas
   (worldState.clubDivision), em vez de ela ser recalculada do zero a partir
   de uma lista estática toda vez. Promoção/rebaixamento passam a valer pra
   TODOS os clubes, não só pro clube do jogador.

   Simplificação deliberada e explícita: a simulação das divisões que o
   jogador NÃO está jogando usa só o overall estático de cada clube (sem
   Form/Momentum/Morale/Match Context) — rodar o motor completo pra times que
   o jogador nunca vê seria custo sem retorno perceptível. Isso é o mesmo tipo
   de corte já usado em "elenco individual dos outros clubes" e "Club Fitness".
============================================================================ */

// Resolve uma temporada inteira de uma divisão de forma leve — só overall
// estático, sem histórico/forma. Usado exclusivamente pras divisões que o
// jogador não está jogando nesta temporada.
function simulateParallelSeason(clubIds, clubsMap) {
  const fixtures = generateLeagueFixtures(clubIds);
  let standings = freshStandings(clubIds);
  fixtures.forEach(roundFixtures => {
    roundFixtures.forEach(([h, a]) => {
      const [gh, ga] = simulateScore(clubsMap[h].overall, clubsMap[a].overall);
      standings[h].pj++; standings[a].pj++;
      standings[h].gp += gh; standings[h].gc += ga; standings[a].gp += ga; standings[a].gc += gh;
      if (gh > ga) { standings[h].v++; standings[h].pts += 3; standings[a].d++; }
      else if (gh < ga) { standings[a].v++; standings[a].pts += 3; standings[h].d++; }
      else { standings[h].e++; standings[a].e++; standings[h].pts++; standings[a].pts++; }
    });
  });
  return sortStandings(standings, ['pts', 'sg', 'gp']);
}

// Aplica o resultado (promovido/rebaixado/ficou) de UMA divisão já resolvida
// (seja pelo motor completo, se for a do jogador, seja pela simulação leve,
// se for outra) sobre o mapa de divisões — só move o clube se o destino
// realmente existir como template hoje (senão fica parado, como o próprio
// Série D ficou "parado" antes de existir).
function applyDivisionResult(clubDivision, family, promo) {
  const next = { ...clubDivision };
  promo.promoted.forEach(id => { if (COMPETITION_TEMPLATES[promo.promotion_target]) next[id] = promo.promotion_target; });
  promo.relegated.forEach(id => { if (COMPETITION_TEMPLATES[promo.relegation_target]) next[id] = promo.relegation_target; });
  return next;
}

// Avança TODAS as divisões que existem hoje, EXCETO a que o jogador acabou de
// jogar (essa já foi resolvida partida a partida pelo motor completo — não
// simulamos ela de novo aqui, só aplicamos o resultado dela via applyDivisionResult).
function advanceOtherDivisions(clubDivision, excludeFamily) {
  let next = { ...clubDivision };
  const families = [...new Set(Object.values(clubDivision))].filter(f => f !== excludeFamily);
  families.forEach(family => {
    const clubIds = Object.keys(next).filter(id => next[id] === family);
    if (clubIds.length < 2) return; // divisão vazia/incompleta demais pra ter campeonato
    const template = COMPETITION_TEMPLATES[family];
    if (!template) return;
    const cfg = template.makeConfig(0, clubIds); // seasonYear irrelevante aqui, é só pra ler promotion/relegation config
    const sorted = simulateParallelSeason(clubIds, ALL_CLUBS_MAP);
    const promo = computePromotionRelegation(cfg, sorted);
    next = applyDivisionResult(next, family, promo);
  });
  return next;
}

/* ============================================================================
   MATCH STATE ENGINE — Form / Momentum / Morale. Funções puras sobre
   matchHistory. Não conhecem Match Engine, Competition Engine, Calendar,
   Fitness ou LIFE — só leem uma lista de resultados e devolvem um número.

   Neste passo, NENHUMA dessas funções é chamada por resolveRound nem por
   qualquer orquestração de partida — existem, mas ainda não afetam nada.
   Parâmetros fixados conforme aprovado: Form=5, Momentum=3, Morale=10,
   K=4, w_m=0.35, alpha=0.5.
============================================================================ */

const MATCH_STATE_PARAMS = { formWindow: 5, momentumWindow: 3, moraleWindow: 10, K: 4, w_m: 0.35, alpha: 0.5 };

function resultValue(r) { return r === 'W' ? 1 : r === 'L' ? -1 : 0; }

// Filtra o histórico de um clube pra uma competição específica, na ordem em
// que aconteceram (matchHistory já nasce em ordem de rodada, via append).
function historyForCompetition(clubHistory, competitionId) {
  return clubHistory.filter(h => h.competitionId === competitionId).map(h => h.result);
}

// Form: nível de desempenho recente. Janela 5, peso linear de recência.
function calcForm(results, window = MATCH_STATE_PARAMS.formWindow) {
  const seq = results.slice(-window);
  if (seq.length === 0) return 0;
  const weights = seq.map((_, i) => i + 1);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const weighted = seq.reduce((acc, r, i) => acc + resultValue(r) * weights[i], 0);
  return weighted / sumW;
}

// Momentum: direção + consistência da direção. Janela 3, penaliza alternância.
function calcMomentum(results, window = MATCH_STATE_PARAMS.momentumWindow, recencyWeights = [1, 1.2, 1.5], damping = 1) {
  const seq = results.slice(-window);
  if (seq.length === 0) return 0;
  const w = recencyWeights.slice(-seq.length);
  const sumW = w.reduce((a, b) => a + b, 0);
  const R = seq.reduce((acc, r, i) => acc + resultValue(r) * w[i], 0) / sumW;
  if (seq.length < 2) return R;
  let flips = 0, pairs = 0;
  for (let i = 1; i < seq.length; i++) {
    const a = resultValue(seq[i - 1]), b = resultValue(seq[i]);
    if (a !== 0 && b !== 0) { pairs++; if (a * b < 0) flips++; }
  }
  const V = pairs > 0 ? flips / pairs : 0;
  return R * (1 - damping * V);
}

// Morale: estabilidade psicológica de médio prazo. Janela 10, sem peso de
// recência, sem penalidade de alternância — deliberadamente estável.
function calcMorale(results, window = MATCH_STATE_PARAMS.moraleWindow) {
  const seq = results.slice(-window);
  if (seq.length === 0) return 0;
  const sum = seq.reduce((acc, r) => acc + resultValue(r), 0);
  return sum / seq.length;
}

// Amortecedor de Morale: só reduz magnitude quando a forma já modificada é
// negativa. Nunca amplifica o positivo — aprovado explicitamente assim.
function moraleDamper(modifiedForm, morale, alpha = MATCH_STATE_PARAMS.alpha) {
  return modifiedForm < 0 ? 1 - alpha * clamp(morale, 0, 1) : 1;
}

// Composição completa aprovada: BaseStrength → Form → Momentum → Morale →
// EffectiveStrength. context é opcional e default 'normal' — sem passar nada,
// o comportamento é idêntico ao Passo 3 (contextDamper('normal') = 1).
function computeClubEffectiveStrength(baseStrength, results, context = 'normal') {
  const form = calcForm(results);
  const momentum = calcMomentum(results);
  const morale = calcMorale(results);
  const modifiedForm = form * (1 + MATCH_STATE_PARAMS.w_m * momentum);
  const damper = moraleDamper(modifiedForm, morale);
  let dampenedForm = modifiedForm * damper;
  if (dampenedForm < 0) dampenedForm *= contextDamper(context); // só atenua o negativo; nunca amplifica
  return baseStrength + dampenedForm * MATCH_STATE_PARAMS.K;
}

/* ============================================================================
   MATCH CONTEXT — camada aditiva sobre o resultado já validado do Passo 3.
   Config-driven: RIVALRIES é uma tabela de pares, não if(isDerby) espalhado.
   Só reduz a magnitude de estado NEGATIVO (ver contextDamper acima) — nunca
   toca BaseStrength, nunca introduz um termo novo somado à força.
============================================================================ */

const MATCH_CONTEXT_PARAMS = { derbyDamper: 0.5 };

// Exemplo de config — clubes fictícios do mock, só pra validar o mecanismo.
const RIVALRIES = [['vila_nova', 'bandeirantes']];

function contextDamper(context) {
  return context === 'derby' ? MATCH_CONTEXT_PARAMS.derbyDamper : 1;
}

// Pura: recebe dois ids + a tabela de rivalidade, devolve o rótulo do confronto.
function getMatchContext(homeId, awayId, rivalries = RIVALRIES) {
  const isRival = rivalries.some(([a, b]) => (a === homeId && b === awayId) || (a === awayId && b === homeId));
  return isRival ? 'derby' : 'normal';
}

/* ============================================================================
   LIFE ENGINE — desacoplado dos engines esportivos. Só lê fatos já produzidos
   pela partida (via camada de orquestração) e devolve consequências. Nunca é
   chamado por resolveRound/playWeek — só por continueAfterMatch().
============================================================================ */

// Equivalente a life_events.json — cada entrada é gatilho + prompt + opções.
// Corte estrito da Fatia 1: só relations.coach/crowd/media + fans. Nada de
// teammates/board ainda, porque nenhum evento hoje precisa deles.
/* ============================================================================
   HONRARIAS — camada de exibição, calculada no momento de cada tela de
   resultado, nunca guardada em estado próprio (v1). Baseada só em dados que
   já existem (stats acumulados da temporada, lifeState.fans, outcomeType de
   cada competição) — nenhum dado de outros jogadores é necessário nem
   inventado, porque os limiares são absolutos, não comparativos com o resto
   da liga (que o jogo não modela individualmente).
============================================================================ */
const HONOR_DEFINITIONS = [
  { id: 'campeao', name: 'Campeão', icon: '🏆', condition: (ctx) => ctx.outcomeType === 'champion' },
  { id: 'acesso', name: 'Acesso conquistado', icon: '⬆️', condition: (ctx) => ['promoted', 'promoted_direct', 'promoted_playoff', 'access_semifinalist', 'access_playoff', 'finalist', 'champion', 'runner_up'].includes(ctx.outcomeType) },
  { id: 'artilheiro', name: 'Artilheiro da Temporada', icon: '⚽', condition: (ctx) => ctx.goals >= 15 },
  { id: 'garcom', name: 'Garçom da Temporada', icon: '🎯', condition: (ctx) => ctx.assists >= 10 },
  { id: 'craque', name: 'Craque da Temporada', icon: '⭐', condition: (ctx) => ctx.avgRating >= 8 },
  { id: 'idolo', name: 'Ídolo da Torcida', icon: '❤️', condition: (ctx) => ctx.fans >= 500 },
];
function computeSeasonHonors(ctx) {
  return HONOR_DEFINITIONS.filter(h => h.condition(ctx));
}
function HonorsList({ honors }) {
  if (!honors || honors.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {honors.map(h => (
        <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: `1px solid ${THEME.gold}`, borderRadius: 20 }}>
          <span>{h.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: THEME.gold }}>{h.name}</span>
        </div>
      ))}
    </div>
  );
}

const LIFE_EVENTS = [
  {
    id: 'interview_decisive_goal',
    trigger: { type: 'match_performance', condition: 'decisive_goal' },
    prompt: 'A imprensa quer sua reação após o gol decisivo.',
    options: [
      { posture: 'agressivo', label: 'Cobrar mais espaço no time', effects: { relations: { coach: -3, crowd: 2, media: 2 }, fans: 4 } },
      { posture: 'confiante', label: 'Mostrar ambição, sem criar caso', effects: { relations: { coach: 0, crowd: 2, media: 1 }, fans: 2 } },
      { posture: 'sossegado', label: 'Elogiar o grupo, evitar o holofote', effects: { relations: { coach: 2, crowd: 1, media: 0 }, fans: 1 } },
      { posture: 'desleixado', label: 'Brincar com a pergunta', effects: { relations: { coach: -1, crowd: 1, media: 1 }, fans: 5 } },
    ],
  },
  {
    id: 'confronted_about_training',
    trigger: { type: 'behavior', condition: 'training_skip_streak' },
    prompt: 'O treinador te chama: "Você tem faltado aos treinos. Está insatisfeito com o clube?"',
    options: [
      { posture: 'agressivo', label: 'Dizer que quer mais chances', effects: { relations: { coach: -4, crowd: 1, media: 1 }, fans: 2 } },
      { posture: 'confiante', label: 'Explicar que precisa de ajustes, sem drama', effects: { relations: { coach: 1, crowd: 0, media: 0 }, fans: 0 } },
      { posture: 'sossegado', label: 'Pedir desculpas e prometer foco', effects: { relations: { coach: 3, crowd: 0, media: 0 }, fans: 0 } },
      { posture: 'desleixado', label: 'Minimizar o assunto', effects: { relations: { coach: -2, crowd: -1, media: 1 }, fans: 1 } },
    ],
  },
  {
    id: 'requested_transfer',
    trigger: { type: 'behavior', condition: 'transfer_request' },
    prompt: 'Você comunica ao clube que deseja sair.',
    options: [
      { posture: 'agressivo', label: 'Deixar claro que quer sair já', effects: { relations: { coach: -8, crowd: -3 }, fans: -2 } },
      { posture: 'confiante', label: 'Explicar que busca um novo desafio', effects: { relations: { coach: -4, crowd: -1 }, fans: 0 } },
      { posture: 'sossegado', label: 'Pedir sem criar problema', effects: { relations: { coach: -2, crowd: 1 }, fans: 1 } },
      { posture: 'desleixado', label: 'Comentar informalmente com a imprensa', effects: { relations: { coach: -5, crowd: -2 }, fans: -1 } },
    ],
  },
  {
    id: 'requested_loan',
    trigger: { type: 'behavior', condition: 'loan_request' },
    prompt: 'Você pede ao clube uma chance por empréstimo em outro time.',
    options: [
      { posture: 'agressivo', label: 'Dizer que precisa jogar mais, custe o que custar', effects: { relations: { coach: -3, crowd: 0 }, fans: 0 } },
      { posture: 'confiante', label: 'Argumentar que ganhar ritmo ajuda os dois lados', effects: { relations: { coach: -1, crowd: 1 }, fans: 0 } },
      { posture: 'sossegado', label: 'Pedir com respeito, deixando a decisão pro clube', effects: { relations: { coach: 0, crowd: 1 }, fans: 0 } },
      { posture: 'desleixado', label: 'Comentar que "só quer jogar bola em algum lugar"', effects: { relations: { coach: -2, crowd: -1 }, fans: -1 } },
    ],
  },
  {
    id: 'bad_rating_criticized',
    trigger: { type: 'match_performance', condition: 'bad_rating' },
    prompt: 'A imprensa questiona sua atuação fraca: "O que houve hoje em campo?"',
    options: [
      { posture: 'agressivo', label: 'Culpar o esquema tático', effects: { relations: { coach: -5, crowd: -1, media: -1 }, fans: -1 } },
      { posture: 'confiante', label: 'Dizer que vai melhorar', effects: { relations: { coach: 1, crowd: 0, media: 0 }, fans: 0 } },
      { posture: 'sossegado', label: 'Assumir o dia ruim, sem drama', effects: { relations: { coach: 2, crowd: 0, media: 1 }, fans: 0 } },
      { posture: 'desleixado', label: 'Minimizar, "foi só um jogo"', effects: { relations: { coach: -2, crowd: -2, media: 0 }, fans: -1 } },
    ],
  },
  {
    id: 'hat_trick_glory',
    trigger: { type: 'match_performance', condition: 'hat_trick' },
    prompt: 'Três gols na partida! A imprensa quer saber o segredo do dia inspirado.',
    options: [
      { posture: 'agressivo', label: 'Dizer que merece ser titular absoluto', effects: { relations: { coach: -2, crowd: 3, media: 3 }, fans: 8 } },
      { posture: 'confiante', label: 'Agradecer e prometer mais', effects: { relations: { coach: 1, crowd: 3, media: 2 }, fans: 6 } },
      { posture: 'sossegado', label: 'Dividir o mérito com o time', effects: { relations: { coach: 3, crowd: 2, media: 1 }, fans: 4 } },
      { posture: 'desleixado', label: 'Brincar que "tava de sorte"', effects: { relations: { coach: 0, crowd: 2, media: 2 }, fans: 7 } },
    ],
  },
  {
    id: 'assist_playmaker',
    trigger: { type: 'match_performance', condition: 'playmaker' },
    prompt: 'Duas assistências na partida — te chamam de "cérebro" do time.',
    options: [
      { posture: 'agressivo', label: 'Cobrar mais protagonismo nas jogadas', effects: { relations: { coach: -2, crowd: 1, media: 1 }, fans: 2 } },
      { posture: 'confiante', label: 'Falar que gosta de fazer o time jogar', effects: { relations: { coach: 1, crowd: 1, media: 1 }, fans: 2 } },
      { posture: 'sossegado', label: 'Elogiar quem converteu os passes', effects: { relations: { coach: 2, crowd: 1, media: 0 }, fans: 1 } },
      { posture: 'desleixado', label: 'Dizer que só "estava no dia"', effects: { relations: { coach: 0, crowd: 0, media: 1 }, fans: 2 } },
    ],
  },
  {
    id: 'first_pro_goal',
    trigger: { type: 'match_performance', condition: 'first_goal' },
    prompt: 'Seu primeiro gol da temporada! Um repórter pede uma declaração.',
    options: [
      { posture: 'agressivo', label: 'Dizer que é só o começo', effects: { relations: { coach: -1, crowd: 2, media: 1 }, fans: 5 } },
      { posture: 'confiante', label: 'Dedicar à família e ao trabalho duro', effects: { relations: { coach: 1, crowd: 2, media: 1 }, fans: 5 } },
      { posture: 'sossegado', label: 'Agradecer ao clube pela oportunidade', effects: { relations: { coach: 3, crowd: 1, media: 0 }, fans: 3 } },
      { posture: 'desleixado', label: 'Rir e dizer que nem esperava', effects: { relations: { coach: 0, crowd: 1, media: 1 }, fans: 4 } },
    ],
  },
];

// Avaliadores de condição — a config só referencia o nome; a lógica de "o que
// significa esse gatilho" fica aqui, pronta pra crescer sem tocar em LIFE_EVENTS.
const LIFE_CONDITION_EVALUATORS = {
  decisive_goal: (ctx) => ctx.type === 'match_performance' && ctx.goals > 0 && ctx.matchWon,
  bad_rating: (ctx) => ctx.type === 'match_performance' && ctx.rating < 4.5,
  hat_trick: (ctx) => ctx.type === 'match_performance' && ctx.goals >= 3,
  playmaker: (ctx) => ctx.type === 'match_performance' && ctx.assists >= 2,
  first_goal: (ctx) => ctx.type === 'match_performance' && ctx.isFirstCareerGoal,
  training_skip_streak: (ctx) => ctx.type === 'behavior' && ctx.skipStreak >= 3,
  transfer_request: (ctx) => ctx.type === 'behavior' && ctx.action === 'transfer_request',
  loan_request: (ctx) => ctx.type === 'behavior' && ctx.action === 'loan_request',
};

// Recebe um fato puro (nunca o player/estado inteiro) e devolve o evento elegível.
function findEligibleLifeEvent(context) {
  for (const event of LIFE_EVENTS) {
    const evaluate = LIFE_CONDITION_EVALUATORS[event.trigger.condition];
    if (evaluate && evaluate(context)) return event;
  }
  return null;
}

// Pura: não muta lifeState, só devolve os efeitos configurados da postura escolhida.
function applyLifeChoice(event, postureId) {
  const option = event.options.find(o => o.posture === postureId);
  return option ? option.effects : null;
}

/* ============================================================================
   CALENDAR ENGINE — só sabe organizar o tempo. Não sabe o que é gol, atributo,
   treino ou relação. Lê calendar_pattern do config da competição (mesmo lugar
   de promotion/tiebreakers) — nenhuma competição futura exige código novo.

   roundToDay é sempre DERIVADO (nunca persistido): dado o padrão + nº de
   rodadas, o mapeamento rodada→dia é determinístico.
============================================================================ */

// Data de início de temporada por família (mês/dia reais aproximados de
// cada competição) — combinado com dayIndex (já é uma contagem de dias
// corridos desde o início), dá uma data de calendário de verdade.
const SEASON_START_MONTHDAY = { serie_d_2026: [4, 5], serie_c_2026: [4, 4], serie_b_2026: [3, 15], serie_a_2026: [3, 28] };
function getCalendarDate(family, seasonYear, dayIndex) {
  const [month, day] = SEASON_START_MONTHDAY[family] || [4, 1];
  const d = new Date(seasonYear, month - 1, day);
  d.setDate(d.getDate() + dayIndex);
  return d;
}
function formatDateBr(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
// Salário é mensal — credita quando o dia que está terminando (dayIndexBefore)
// vira um mês diferente do dia seguinte. Chamado em TODO ponto que avança
// dayIndex em 1 (treino, recuperação, partida), não só nas partidas.
function crossesNewMonth(family, seasonYear, dayIndexBefore) {
  const before = getCalendarDate(family, seasonYear, dayIndexBefore);
  const after = getCalendarDate(family, seasonYear, dayIndexBefore + 1);
  return before.getMonth() !== after.getMonth();
}

function buildRoundToDay(totalRounds, pattern) {
  const intervals = pattern.match_intervals;
  const map = {};
  let day = 0;
  for (let r = 0; r < totalRounds; r++) {
    day += intervals[r % intervals.length];
    map[r] = day;
  }
  return map;
}

// 'match' | 'recovery' (dia seguinte a uma partida) | 'training' (todo o resto)
function getDayType(dayIndex, roundToDay) {
  const matchDays = Object.values(roundToDay);
  if (matchDays.includes(dayIndex)) return 'match';
  if (matchDays.includes(dayIndex - 1)) return 'recovery';
  return 'training';
}

/* ============================================================================
   FITNESS ENGINE — cuida só do estado físico. Um número (condition, 0-100) é
   suficiente pro MVP: fadiga é só "condition baixa", recuperação é só
   "condition subindo" — abrir isso em campos separados agora seria campo
   especulativo sem uso real ainda.

   Não conhece Progression, Calendar, LIFE nem Match Engine. A orquestração
   monta um "jogador efetivo" (overall ajustado) ANTES de chamar resolveRound —
   resolveRound continua exatamente como está, sem saber que Fitness existe.
============================================================================ */

const FITNESS_TRAIN_COST = 8;
const FITNESS_MATCH_COST = 15;
const FITNESS_REST_RECOVERY = 12;
const FITNESS_AVAILABILITY_FLOOR = 25;

function applyTrainingCost(condition) { return clamp(condition - FITNESS_TRAIN_COST, 0, 100); }
function applyMatchCost(condition) { return clamp(condition - FITNESS_MATCH_COST, 0, 100); }
function applyRestRecovery(condition) { return clamp(condition + FITNESS_REST_RECOVERY, 0, 100); }

// Abaixo do piso, o overall efetivo cai bastante — isso já reduz naturalmente
// a chance de escalação dentro de resolveUserInvolvement, sem editar essa
// função. Não é um bloqueio literal (isso exigiria tocar resolveRound).
function matchModifier(condition) {
  if (condition >= 70) return 1;
  if (condition <= FITNESS_AVAILABILITY_FLOOR) return 0.6;
  return 0.6 + ((condition - FITNESS_AVAILABILITY_FLOOR) / (70 - FITNESS_AVAILABILITY_FLOOR)) * 0.4;
}

/* ============================================================================
   DESIGN SYSTEM — tokens + componentes base (Direção Visual V2)
============================================================================ */

const THEME = {
  bg: '#080808',
  panel: '#101010',
  card: '#141414',
  cardElevated: '#1A1A1A',
  orange: '#FF6A00',
  gold: '#FF6A00',
  green: '#36C275',
  text: '#F5F5F5',
  textSecondary: '#929292',
  red: '#E05252',
  border: '#292929',
  fontDisplay: "'Barlow Condensed', sans-serif",
  fontBody: "'Inter', sans-serif",
};

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      html, body, #root { margin: 0; min-height: 100%; background: ${THEME.bg}; }
      body { background: ${THEME.bg}; }
      .display { font-family: ${THEME.fontDisplay}; letter-spacing: -0.02em; }
      .app-root { background: ${THEME.bg}; color: ${THEME.text}; font-family: ${THEME.fontBody}; min-height: 100vh; }
      button, input { font-family: inherit; }
      button { cursor: pointer; transition: transform .15s ease, background .15s ease, border-color .15s ease, opacity .15s ease; }
      button:hover:not(:disabled) { transform: translateY(-1px); }
      button:disabled { cursor: default; }
      .wpg-shell { min-height: 100vh; display: flex; background: ${THEME.bg}; }
      .wpg-sidebar { position: fixed; inset: 0 auto 0 0; width: 224px; background: #0B0B0B; border-right: 1px solid ${THEME.border}; z-index: 20; display: flex; flex-direction: column; }
      .wpg-brand { padding: 24px 20px 20px; border-bottom: 1px solid ${THEME.border}; }
      .wpg-brand-mark { font-family: ${THEME.fontDisplay}; font-size: 43px; font-weight: 800; line-height: .82; color: ${THEME.orange}; letter-spacing: -.06em; }
      .wpg-brand-sub { font-size: 9px; letter-spacing: 3px; color: #BDBDBD; margin-top: 7px; }
      .wpg-brand-desc { font-size: 8px; letter-spacing: 1.3px; color: #666; margin-top: 9px; text-transform: uppercase; }
      .wpg-nav { padding: 18px 10px; overflow-y: auto; }
      .wpg-nav-section { margin: 18px 10px 7px; font-size: 9px; font-weight: 700; letter-spacing: 1.6px; color: #666; }
      .wpg-nav-section:first-child { margin-top: 0; }
      .wpg-nav-item { width: 100%; border: 0; background: transparent; color: #999; padding: 10px 11px; display: flex; align-items: center; gap: 11px; text-align: left; font-size: 12px; font-weight: 600; border-left: 2px solid transparent; }
      .wpg-nav-item.active { color: ${THEME.orange}; background: linear-gradient(90deg, rgba(255,106,0,.16), transparent); border-left-color: ${THEME.orange}; }
      .wpg-nav-icon { width: 18px; text-align: center; font-size: 14px; }
      .wpg-main { width: calc(100% - 224px); margin-left: 224px; min-height: 100vh; }
      .wpg-topbar { height: 58px; border-bottom: 1px solid ${THEME.border}; background: rgba(8,8,8,.96); display: flex; align-items: center; justify-content: space-between; padding: 0 28px; position: sticky; top: 0; z-index: 10; }
      .wpg-breadcrumb { font-size: 11px; color: #777; letter-spacing: .6px; text-transform: uppercase; }
      .wpg-breadcrumb strong { color: #DDD; }
      .wpg-season-pill { display: flex; align-items: center; gap: 14px; font-size: 11px; color: #999; }
      .wpg-season-pill b { color: #FFF; font-family: ${THEME.fontDisplay}; font-size: 17px; }
      .screen-page { width: min(1180px, calc(100% - 48px)); margin: 0 auto; padding: 28px 0 42px; }
      .wpg-kicker { color: ${THEME.orange}; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
      .wpg-title { font-family: ${THEME.fontDisplay}; font-size: 34px; line-height: .98; margin: 5px 0 0; font-weight: 800; }
      .wpg-card { border: 1px solid ${THEME.border}; background: linear-gradient(145deg, #151515, #101010); }
      .wpg-card:hover { border-color: #3A3A3A; }
      .wpg-section-label { font-size: 10px; color: #777; font-weight: 700; letter-spacing: 1.3px; margin: 0 0 9px; text-transform: uppercase; }
      .wpg-accent-line { height: 2px; width: 38px; background: ${THEME.orange}; margin-top: 10px; }
      .wpg-mobile-nav { display: none; }
      @media (max-width: 800px) {
        .wpg-sidebar { display: none; }
        .wpg-main { width: 100%; margin-left: 0; }
        .wpg-topbar { padding: 0 16px; height: 54px; }
        .screen-page { width: calc(100% - 28px); padding: 18px 0 86px; }
        .wpg-mobile-nav { position: fixed; display: flex; left: 10px; right: 10px; bottom: 10px; height: 62px; background: rgba(18,18,18,.97); border: 1px solid ${THEME.border}; z-index: 30; box-shadow: 0 10px 40px rgba(0,0,0,.45); }
        .wpg-mobile-nav button { flex: 1; background: transparent; border: 0; color: #777; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 9px; }
        .wpg-mobile-nav button.active { color: ${THEME.orange}; }
      }
    `}</style>
  );
}

function Card({ children, elevated, style, onClick }) {
  return (
    <div onClick={onClick} className="wpg-card" style={{ background: elevated ? THEME.cardElevated : THEME.card, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function Badge({ children, tone = 'neutral', style }) {
  const tones = {
    gold: { background: THEME.orange, color: '#0A0A0A' },
    green: { background: THEME.green, color: THEME.bg },
    red: { background: THEME.red, color: THEME.text },
    neutral: { background: THEME.cardElevated, color: THEME.textSecondary },
  };
  return (
    <span style={{ ...tones[tone], fontSize: 11, fontWeight: 700, padding: '3px 8px', letterSpacing: 0.4, textTransform: 'uppercase', ...style }}>
      {children}
    </span>
  );
}

function AttrBar({ label, value, potential }) {
  const shown = Math.round(value);
  return (
    <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: THEME.textSecondary, width: 96 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: THEME.cardElevated, position: 'relative' }}>
        <div style={{ width: `${(value / 99) * 100}%`, height: 6, background: THEME.gold }} />
        {potential != null && (
          <div style={{ position: 'absolute', top: -2, left: `${(potential / 99) * 100}%`, width: 2, height: 10, background: THEME.textSecondary }} />
        )}
      </div>
      <span style={{ fontSize: 12, width: potential != null ? 56 : 24, textAlign: 'right', fontWeight: 600 }}>
        {shown}{potential != null && <span style={{ color: THEME.textSecondary, fontWeight: 400 }}> /{Math.round(potential)}</span>}
      </span>
    </div>
  );
}

// FormaDots — só apresenta resultados que matchHistory já produz (Passo 1-4).
// Nenhum cálculo novo: recebe um array de 'W'|'D'|'L' já pronto.
function FormaDots({ results, size = 16 }) {
  const color = (r) => r === 'W' ? THEME.green : r === 'L' ? THEME.red : THEME.textSecondary;
  if (!results || results.length === 0) {
    return <span style={{ fontSize: 10, color: THEME.textSecondary }}>—</span>;
  }
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {results.map((r, i) => (
        <span key={i} style={{
          width: size, height: size, borderRadius: '50%', background: color(r),
          color: THEME.bg, fontSize: size * 0.55, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {r}
        </span>
      ))}
    </div>
  );
}

function ClubMonogram({ club, size = 44 }) {
  const branding = club.branding || { type: 'monogram', text: club.name.slice(0, 2).toUpperCase() };

  // Caminho já preparado: quando um clube tiver branding.type === 'licensed' com
  // um escudo real (via Data Importer), basta renderizar a imagem aqui — nenhum
  // componente que consome <ClubMonogram club={...} /> precisa mudar.
  if (branding.type === 'licensed' && branding.logo) {
    return <img src={branding.logo} alt={club.name} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />;
  }

  const text = branding.text || club.name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, background: club.color, color: '#fff', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, flexShrink: 0,
    }}>
      {text}
    </div>
  );
}

const NAV_ITEMS = [
  { id: 'home', icon: '⌂', label: 'Visão Geral' },
  { id: 'carreira', icon: '▣', label: 'Carreira' },
  { id: 'mundo', icon: '◈', label: 'Mundo' },
  { id: 'voce', icon: '●', label: 'Perfil' },
];

const WPG_NAV_GROUPS = [
  { label: 'CARREIRA', items: [{ id: 'home', icon: '⌂', label: 'Visão Geral' }, { id: 'carreira', icon: '▣', label: 'Carreira' }, { id: 'voce', icon: '●', label: 'Perfil' }] },
  { label: 'MUNDO', items: [{ id: 'mundo', icon: '◈', label: 'Competições & Mundo' }] },
  { label: 'DADOS', items: [{ id: 'carreira', icon: '▤', label: 'Estatísticas' }] },
];

function WPGShell({ active, onChange, player, club, seasonYear, children }) {
  return (
    <div className="wpg-shell">
      <aside className="wpg-sidebar">
        <div className="wpg-brand">
          <div className="wpg-brand-mark">WPG</div>
          <div className="wpg-brand-sub">PROJECT</div>
          <div className="wpg-brand-desc">Football Career Simulation</div>
        </div>
        <nav className="wpg-nav">
          {WPG_NAV_GROUPS.map((group, gi) => (
            <div key={group.label}>
              <div className="wpg-nav-section">{group.label}</div>
              {group.items.map(item => (
                <button key={`${group.label}-${item.id}`} className={`wpg-nav-item ${active === item.id ? 'active' : ''}`} onClick={() => onChange(item.id)}>
                  <span className="wpg-nav-icon">{item.icon}</span><span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '18px 20px', borderTop: `1px solid ${THEME.border}` }}>
          <div className="display" style={{ color: THEME.orange, fontSize: 18, fontWeight: 700 }}>MORE THAN THE GAME</div>
          <div style={{ color: '#555', fontSize: 8, letterSpacing: 1.5, marginTop: 5 }}>WPG PROJECT</div>
        </div>
      </aside>
      <main className="wpg-main">
        <header className="wpg-topbar">
          <div className="wpg-breadcrumb">WPG PROJECT &nbsp;›&nbsp; <strong>{NAV_ITEMS.find(n => n.id === active)?.label || 'Carreira'}</strong></div>
          <div className="wpg-season-pill"><span>{club?.name || 'CARREIRA'}</span><b>{seasonYear}</b></div>
        </header>
        {children}
        <div className="wpg-mobile-nav">
          {NAV_ITEMS.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onChange(item.id)}><span style={{fontSize:18}}>{item.icon}</span><span>{item.label}</span></button>)}
        </div>
      </main>
    </div>
  );
}

/* ============================================================================
   TELAS — Criar / Escolher clube
============================================================================ */

function CreateScreen({ onStart }) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('CA');
  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
      <div>
        <p style={{ color: THEME.gold, fontSize: 13, fontWeight: 600 }}>RUMO AO BRASILEIRÃO</p>
        <h1 className="display" style={{ fontSize: 38, fontWeight: 700, lineHeight: 1 }}>Brasileirão Série D 2026</h1>
        <p style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 8 }}>Crie seu jogador para começar a carreira.</p>
      </div>
      <div>
        <label style={{ fontSize: 12, color: THEME.textSecondary }}>Nome do jogador</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Vitor"
          style={{ width: '100%', padding: '12px 0', background: 'transparent', border: 'none', borderBottom: `2px solid ${THEME.gold}`, color: THEME.text, fontSize: 18, outline: 'none', marginTop: 6 }} />
      </div>
      <div>
        <label style={{ fontSize: 12, color: THEME.textSecondary }}>Posição</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
          {DETAILED_POSITIONS.map(p => (
            <button key={p.id} onClick={() => setPosition(p.id)}
              style={{ padding: '12px 0', fontWeight: 600, fontSize: 14, border: `1px solid ${position === p.id ? THEME.gold : THEME.cardElevated}`, background: position === p.id ? THEME.gold : 'transparent', color: position === p.id ? THEME.bg : THEME.text }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <button disabled={!name.trim()} onClick={() => onStart(name.trim(), position)}
        className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 20, background: THEME.gold, color: THEME.bg, border: 'none', opacity: name.trim() ? 1 : 0.4 }}>
        Começar carreira
      </button>
    </div>
  );
}

function ClubSelectScreen({ player, onChoose }) {
  const groupIds = Object.keys(SERIE_D_2026_GROUPS);
  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh' }}>
      <p style={{ color: THEME.gold, fontSize: 13, fontWeight: 600 }}>ESCOLHA SEU CLUBE</p>
      <h1 className="display" style={{ fontSize: 30, fontWeight: 700, marginBottom: 2 }}>{player.name}</h1>
      <p style={{ color: THEME.textSecondary, fontSize: 13, marginBottom: 20 }}>Overall {player.overall} · Brasileirão Série D 2026 (96 clubes reais, 16 grupos oficiais)</p>
      {groupIds.map(groupId => (
        <div key={groupId} style={{ marginBottom: 18 }}>
          <p style={{ color: THEME.textSecondary, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>GRUPO {groupId}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SERIE_D_2026_GROUPS[groupId].map(name => {
              const id = `${groupId}::${name}`;
              const c = SERIE_D_2026_CLUBS_MAP[id];
              return (
                <Card key={id} onClick={() => onChoose(id)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '10px 14px' }}>
                  <ClubMonogram club={c} size={30} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                  <Badge>Força {c.overall}</Badge>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   TELA — Início (Home)
============================================================================ */

// Rótulo de apresentação pro selo "Rumo à X" na Home — dado, não hardcode
// espalhado; ganhar Série C/B/A no futuro é só adicionar uma entrada aqui.
const NEXT_TIER_LABELS = { serie_d: 'SÉRIE D', serie_c: 'SÉRIE C', serie_b: 'SÉRIE B', serie_a: 'SÉRIE A' };

function HomeScreen({ player, club, competition, round, totalRounds, fixtures, log, dayType, condition, matchHistory, clubsMap, trainPick, onTogglePicker, showPicker, onSelectTrainingActivity, onRest, onSkipTraining, onPlay, onAdvanceRecovery, dayIndex, seasonYear }) {
  const nextFixture = fixtures[round] ? fixtures[round].find(([h, a]) => h === club.id || a === club.id) : null;
  const opponentId = nextFixture ? (nextFixture[0] === club.id ? nextFixture[1] : nextFixture[0]) : null;
  const isHome = nextFixture ? nextFixture[0] === club.id : null;
  const conditionColor = condition <= 25 ? THEME.red : condition <= 50 ? THEME.gold : THEME.green;
  const clubForma = historyForCompetition(matchHistory[club.id] || [], competition.id).slice(-5);
  const isDerby = opponentId ? getMatchContext(club.id, opponentId) === 'derby' : false;
  const calendarDate = formatDateBr(getCalendarDate(competition.family, seasonYear, dayIndex));

  return (
    <div className="screen-page">
      <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>RUMO À {NEXT_TIER_LABELS[competition.promotion.target_competition_id] || 'PRÓXIMA DIVISÃO'}</p>
      <p style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}>{calendarDate}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '14px 0 10px' }}>
        <ClubMonogram club={club} size={56} />
        <div>
          <h1 className="display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{player.name}</h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <Badge tone="gold">{player.position} OVR {player.overall}</Badge>
            <span style={{ fontSize: 12, color: THEME.textSecondary }}>{club.name}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: THEME.textSecondary, width: 90 }}>Condição física</span>
        <div style={{ flex: 1, height: 5, background: THEME.cardElevated }}>
          <div style={{ width: `${condition}%`, height: 5, background: conditionColor }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: conditionColor, width: 32, textAlign: 'right' }}>{Math.round(condition)}%</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: THEME.textSecondary, width: 90 }}>Forma recente</span>
        <FormaDots results={clubForma} size={15} />
      </div>

      <Card elevated style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>PRÓXIMO JOGO · RODADA {Math.min(round + 1, totalRounds)}/{totalRounds}</p>
        {opponentId ? (
          <>
            {isDerby && <Badge tone="gold" style={{ marginBottom: 6 }}>CLÁSSICO</Badge>}
            <p className="display" style={{ fontSize: 20, fontWeight: 700 }}>
              {isHome ? club.name : clubsMap[opponentId].name} <span style={{ color: THEME.textSecondary, fontWeight: 400 }}>vs</span> {isHome ? clubsMap[opponentId].name : club.name}
            </p>
          </>
        ) : <p style={{ color: THEME.textSecondary }}>Temporada concluída.</p>}

        {dayType === 'match' && (
          <button onClick={onPlay} disabled={!opponentId} className="display" style={{ width: '100%', marginTop: 14, padding: '13px 0', fontWeight: 700, fontSize: 16, background: THEME.gold, color: THEME.bg, border: 'none', opacity: opponentId ? 1 : 0.4 }}>
            JOGAR
          </button>
        )}

        {dayType === 'recovery' && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 10 }}>Dia de recuperação física após a partida.</p>
            <button onClick={onAdvanceRecovery} className="display" style={{ width: '100%', padding: '13px 0', fontWeight: 700, fontSize: 16, background: THEME.gold, color: THEME.bg, border: 'none' }}>
              AVANÇAR
            </button>
          </div>
        )}

        {dayType === 'training' && !showPicker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <button onClick={onTogglePicker} className="display" style={{ padding: '13px 0', fontWeight: 700, fontSize: 16, background: THEME.gold, color: THEME.bg, border: 'none' }}>
              TREINAR
            </button>
            <button onClick={onRest} style={{ padding: '12px 0', fontWeight: 700, fontSize: 14, border: `1px solid ${THEME.gold}`, background: 'transparent', color: THEME.gold }}>
              DESCANSAR
            </button>
            <button onClick={onSkipTraining} style={{ padding: '12px 0', fontWeight: 600, fontSize: 13, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: THEME.textSecondary }}>
              Não quero treinar
            </button>
          </div>
        )}

        {dayType === 'training' && showPicker && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
            {TRAININGS.map(t => (
              <button key={t.id} onClick={() => onSelectTrainingActivity(t.id)}
                style={{ padding: '10px 0', fontSize: 13, fontWeight: 600, border: `1px solid ${THEME.card}`, background: THEME.card, color: THEME.text }}>
                {t.name}
              </button>
            ))}
          </div>
        )}
      </Card>

      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>ÚLTIMOS ACONTECIMENTOS</p>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {log.length === 0 && <p style={{ fontSize: 13, color: THEME.textSecondary }}>Nenhum acontecimento ainda.</p>}
        {log.slice(0, 3).map((l, i) => <p key={i} style={{ fontSize: 13, color: THEME.textSecondary }}>• {l}</p>)}
      </Card>
    </div>
  );
}

/* ============================================================================
   TELA — Carreira (temporada atual em detalhe)
============================================================================ */

function CareiraScreen({ competition, round, totalRounds, stats, log }) {
  const avgRating = stats.apps ? (stats.ratingSum / stats.apps).toFixed(1) : '-';
  return (
    <div className="screen-page">
      <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>TEMPORADA ATUAL</p>
      <h1 className="display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 14 }}>{competition.name}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <Card elevated><p style={{ fontSize: 11, color: THEME.textSecondary }}>Jogos</p><p className="display" style={{ fontSize: 28, fontWeight: 700, color: THEME.gold }}>{stats.apps}</p></Card>
        <Card elevated><p style={{ fontSize: 11, color: THEME.textSecondary }}>Gols</p><p className="display" style={{ fontSize: 28, fontWeight: 700, color: THEME.gold }}>{stats.goals}</p></Card>
        <Card elevated><p style={{ fontSize: 11, color: THEME.textSecondary }}>Assistências</p><p className="display" style={{ fontSize: 28, fontWeight: 700, color: THEME.gold }}>{stats.assists}</p></Card>
        <Card elevated><p style={{ fontSize: 11, color: THEME.textSecondary }}>Nota média</p><p className="display" style={{ fontSize: 28, fontWeight: 700, color: THEME.gold }}>{avgRating}</p></Card>
      </div>

      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>RODADA {Math.min(round + 1, totalRounds)} DE {totalRounds}</p>
      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, margin: '18px 0 8px' }}>HISTÓRICO DE ACONTECIMENTOS</p>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {log.length === 0 && <p style={{ fontSize: 13, color: THEME.textSecondary }}>Nenhum acontecimento ainda.</p>}
        {log.map((l, i) => <p key={i} style={{ fontSize: 13, color: THEME.textSecondary }}>• {l}</p>)}
      </Card>
    </div>
  );
}

/* ============================================================================
   TELA — Mundo (tabela com zonas)
============================================================================ */

/* ============================================================================
   MERCADO DE TRANSFERÊNCIAS — notícias de OUTROS clubes, pra dar sensação de
   mundo vivo. Clubes são reais (dados oficiais da CBF); nomes de jogadores
   são fictícios/procedurais — nunca inventamos elenco real de ninguém.
   Volume pequeno de propósito: isso é o "esqueleto" do Jornal/Mural de
   Futebol registrado como visão futura; elenco de verdade (nomes reais por
   clube) é a próxima etapa, maior, discutida à parte.
============================================================================ */
const TRANSFER_NEWS_FIRST_NAMES = ['Lucas', 'Gabriel', 'Matheus', 'Rafael', 'Bruno', 'Thiago', 'Felipe', 'Diego', 'Vitor', 'Caio', 'Igor', 'André', 'Renan', 'Kauê', 'Rodrigo', 'Everton', 'Douglas', 'Wesley', 'Jean', 'Marlon'];
const TRANSFER_NEWS_LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Almeida', 'Ferreira', 'Rodrigues', 'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Barbosa', 'Ribeiro', 'Nascimento', 'Teixeira', 'Correia'];
const TRANSFER_NEWS_TEMPLATES = [
  (player, clubIn, clubOut) => `${player} é anunciado como reforço do ${clubIn}, vindo do ${clubOut}.`,
  (player, clubIn, clubOut) => `${clubIn} acerta a contratação de ${player}, que estava no ${clubOut}.`,
  (player, clubIn) => `${clubIn} anuncia a chegada do meio-campista ${player} para a próxima temporada.`,
  (player, clubIn, clubOut) => `${player} é emprestado pelo ${clubOut} ao ${clubIn} até o fim do ano.`,
  (player, clubIn) => `Promessa da base, ${player} é promovido ao elenco principal do ${clubIn}.`,
];
function generateTransferNewsName() {
  const f = TRANSFER_NEWS_FIRST_NAMES[Math.floor(Math.random() * TRANSFER_NEWS_FIRST_NAMES.length)];
  const l = TRANSFER_NEWS_LAST_NAMES[Math.floor(Math.random() * TRANSFER_NEWS_LAST_NAMES.length)];
  return `${f} ${l}`;
}
// Gera `count` notícias entre clubes da MESMA divisão, nunca envolvendo o
// jogador (isso é sobre o mundo, não sobre a carreira dele).
function generateTransferNews(clubIds, userClubId, clubsMap, count = 4) {
  const pool = clubIds.filter(id => id !== userClubId);
  if (pool.length < 2) return [];
  const news = [];
  for (let i = 0; i < count; i++) {
    const clubInId = pool[Math.floor(Math.random() * pool.length)];
    let clubOutId = pool[Math.floor(Math.random() * pool.length)];
    while (clubOutId === clubInId) clubOutId = pool[Math.floor(Math.random() * pool.length)];
    const clubIn = clubsMap[clubInId]?.name || clubInId;
    const clubOut = clubsMap[clubOutId]?.name || clubOutId;
    const template = TRANSFER_NEWS_TEMPLATES[Math.floor(Math.random() * TRANSFER_NEWS_TEMPLATES.length)];
    news.push({ id: `${Date.now()}_${i}`, text: template(generateTransferNewsName(), clubIn, clubOut) });
  }
  return news;
}

function MundoScreen({ competition, standings, userClubId, matchHistory, clubsMap, transferNews }) {
  const promoCount = competition.promotion.count;
  const relegCount = competition.relegation.count;
  const total = standings.length;
  return (
    <div className="screen-page">
      <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>MUNDO</p>
      <h1 className="display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 14 }}>{competition.name}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) 20px 20px 28px 30px 78px', columnGap: 5, fontSize: 10, color: THEME.textSecondary, fontWeight: 700, padding: '0 8px 6px' }}>
        <span style={{ textAlign: 'center' }}>POS</span><span>CLUBE</span><span style={{ textAlign: 'right' }}>J</span><span style={{ textAlign: 'right' }}>V</span><span style={{ textAlign: 'right' }}>SG</span><span style={{ textAlign: 'right' }}>PTS</span><span style={{ textAlign: 'right' }}>FORMA</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {standings.map((r, i) => {
          const isUser = r.club_id === userClubId;
          const inPromo = i < promoCount;
          const inRelega = relegCount > 0 && i >= total - relegCount;
          const borderColor = inPromo ? THEME.gold : inRelega ? THEME.red : 'transparent';
          const recentForm = historyForCompetition(matchHistory[r.club_id] || [], competition.id).slice(-5);
          return (
            <div key={r.club_id} style={{
              display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) 20px 20px 28px 30px 78px', columnGap: 5, alignItems: 'center',
              padding: '8px', background: isUser ? THEME.cardElevated : THEME.card,
              borderLeft: `3px solid ${borderColor}`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: THEME.textSecondary, textAlign: 'center' }}>{i + 1}</span>
              <span style={{ fontSize: 13, fontWeight: isUser ? 700 : 500, color: isUser ? THEME.gold : THEME.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{clubsMap[r.club_id].name}</span>
              <span style={{ fontSize: 11, textAlign: 'right', color: THEME.textSecondary }}>{r.pj}</span>
              <span style={{ fontSize: 11, textAlign: 'right', color: THEME.textSecondary }}>{r.v}</span>
              <span style={{ fontSize: 11, textAlign: 'right', color: THEME.textSecondary }}>{r.sg}</span>
              <span style={{ fontSize: 13, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.pts}</span>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><FormaDots results={recentForm} size={12} /></div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: THEME.textSecondary, marginTop: 10 }}>Forma: últimos 5 jogos na competição (mais recente à direita).</p>

      <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, background: THEME.gold }} /><span style={{ fontSize: 11, color: THEME.textSecondary }}>Acesso</span></div>
        {relegCount > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, background: THEME.red }} /><span style={{ fontSize: 11, color: THEME.textSecondary }}>Rebaixamento</span></div>}
      </div>

      {transferNews && transferNews.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>💰 MERCADO DA BOLA</p>
          {transferNews.map(n => (
            <Card key={n.id} style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, color: THEME.text }}>{n.text}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   TELA — Você (perfil)
============================================================================ */

function VoceScreen({ player, club, lifeState, economyState, onReset, onRequestTransfer, onRequestLoan, onInvest, onWithdrawInvestments, onBuyProperty }) {
  const netWorth = computeNetWorth(economyState);
  return (
    <div className="screen-page">
      <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>PERFIL</p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '18px 0 22px' }}>
        <ClubMonogram club={club} size={72} />
        <h1 className="display" style={{ fontSize: 28, fontWeight: 700, marginTop: 12 }}>{player.name}</h1>
        <p style={{ color: THEME.textSecondary, fontSize: 13 }}>{POSITIONS.find(p => p.id === player.position)?.label}</p>
        <p className="display" style={{ fontSize: 56, fontWeight: 700, color: THEME.gold, lineHeight: 1, marginTop: 8 }}>{player.overall}</p>
        <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 1 }}>OVERALL</p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        {Object.entries(player.attrs).map(([k, v]) => <AttrBar key={k} label={ATTR_LABELS[k]} value={v} potential={player.potential?.[k]} />)}
      </Card>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Card elevated style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 11, color: THEME.textSecondary }}>Idade</p><p className="display" style={{ fontSize: 22, fontWeight: 700 }}>{player.age}</p></Card>
        <Card elevated style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 11, color: THEME.textSecondary }}>Reputação</p><p className="display" style={{ fontSize: 22, fontWeight: 700 }}>{player.reputation}</p></Card>
      </div>

      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>CONTRATO</p>
      <Card style={{ marginBottom: 14 }}>
        {player.contract ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: THEME.textSecondary }}>Salário mensal</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>R$ {player.contract.salary.toLocaleString('pt-BR')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: THEME.textSecondary }}>Vencimento</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{player.contract.expiresSeason}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: THEME.textSecondary }}>Saldo em conta</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: THEME.gold }}>R$ {economyState.balance.toLocaleString('pt-BR')}</span>
            </div>
            {player.loan && <p style={{ fontSize: 12, color: THEME.textSecondary, marginTop: 8 }}>Emprestado — retorna ao clube de origem em {player.loan.returnSeason}.</p>}
          </>
        ) : <p style={{ fontSize: 13, color: THEME.textSecondary }}>Sem contrato ativo.</p>}
      </Card>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={onRequestTransfer} disabled={!!player.wantsTransfer} style={{ flex: 1, padding: '11px 0', fontSize: 12, fontWeight: 700, border: `1px solid ${THEME.gold}`, background: 'transparent', color: THEME.gold, opacity: player.wantsTransfer ? 0.4 : 1 }}>
          {player.wantsTransfer ? 'PEDIDO FEITO' : 'PEDIR TRANSFERÊNCIA'}
        </button>
        <button onClick={onRequestLoan} disabled={!!player.wantsLoan} style={{ flex: 1, padding: '11px 0', fontSize: 12, fontWeight: 700, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: THEME.textSecondary, opacity: player.wantsLoan ? 0.4 : 1 }}>
          {player.wantsLoan ? 'PEDIDO FEITO' : 'PEDIR EMPRÉSTIMO'}
        </button>
      </div>

      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>VIDA FINANCEIRA</p>
      <Card elevated style={{ marginBottom: 10, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: THEME.textSecondary }}>Patrimônio líquido</p>
        <p className="display" style={{ fontSize: 26, fontWeight: 700, color: THEME.gold }}>R$ {netWorth.toLocaleString('pt-BR')}</p>
        <p style={{ fontSize: 11, color: THEME.textSecondary, marginTop: 2 }}>conta + investimentos + imóveis</p>
      </Card>
      <Card style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: THEME.textSecondary }}>Investido (rende {Math.round(INVESTMENT_SEASONAL_RETURN * 100)}%/temporada)</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>R$ {economyState.investments.toLocaleString('pt-BR')}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: economyState.investments > 0 ? 8 : 0 }}>
          {INVESTMENT_AMOUNTS.map(amount => (
            <button key={amount} onClick={() => onInvest(amount)} disabled={amount > economyState.balance}
              style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: amount > economyState.balance ? THEME.textSecondary : THEME.gold, opacity: amount > economyState.balance ? 0.4 : 1 }}>
              +R$ {(amount / 1000)}mil
            </button>
          ))}
        </div>
        {economyState.investments > 0 && (
          <button onClick={onWithdrawInvestments} style={{ width: '100%', padding: '8px 0', fontSize: 11, fontWeight: 700, border: 'none', background: 'transparent', color: THEME.textSecondary, textDecoration: 'underline' }}>
            Sacar tudo (R$ {economyState.investments.toLocaleString('pt-BR')})
          </button>
        )}
      </Card>
      <Card style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 8 }}>Imóveis {economyState.properties.length > 0 ? `(${economyState.properties.length})` : ''}</p>
        {economyState.properties.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12 }}>{p.name}</span>
            <span style={{ fontSize: 12, color: THEME.textSecondary }}>manutenção R$ {p.upkeep.toLocaleString('pt-BR')}/temp.</span>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: economyState.properties.length > 0 ? 10 : 0 }}>
          {PROPERTY_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => onBuyProperty(opt.id)} disabled={opt.cost > economyState.balance}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 10px', fontSize: 12, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: opt.cost > economyState.balance ? THEME.textSecondary : THEME.text, opacity: opt.cost > economyState.balance ? 0.4 : 1 }}>
              <span>{opt.name}</span>
              <span style={{ fontWeight: 700 }}>R$ {opt.cost.toLocaleString('pt-BR')}</span>
            </button>
          ))}
        </div>
      </Card>

      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>VIDA FORA DE CAMPO</p>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: THEME.textSecondary }}>Fãs</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: THEME.gold }}>{lifeState.fans}</span>
        </div>
        <AttrBar label="Treinador" value={lifeState.relations.coach} />
        <AttrBar label="Torcida" value={lifeState.relations.crowd} />
        <AttrBar label="Mídia" value={lifeState.relations.media} />
      </Card>

      <button onClick={onReset} style={{ width: '100%', padding: '10px 0', background: 'transparent', border: 'none', color: THEME.textSecondary, fontSize: 12 }}>
        Reiniciar carreira
      </button>
    </div>
  );
}

/* ============================================================================
   TELA — Partida (revelação sequencial de eventos)
============================================================================ */

// Sorteio uniforme por enquanto — só decoração narrativa. Quando o roster
// virar elenco real (com atributos), esta função passa a pesar por atributo
// ofensivo em vez de sortear igual pra todo mundo; ninguém que a chama precisa
// mudar por causa disso. Serve pros dois lados do confronto (não é mais só
// "adversário" — um gol do seu próprio time que não foi seu também usa isso).
function pickScorer(club) {
  const roster = getClubRosterPlayers(club);
  if (roster.length === 0) return 'jogador do time';

  // Jogadores reais (quando a base oficial existir) passam a ter peso por
  // atributo ofensivo. Roster mock continua com sorteio uniforme, preservando
  // exatamente a narrativa atual enquanto a coleta oficial não foi feita.
  const weighted = roster.map(p => {
    const finishing = Number(p?.attrs?.finalizacao);
    const pace = Number(p?.attrs?.velocidade);
    const attackingPosition = ['ATA', 'MEI', 'PD', 'PE', 'SA', 'CA'].includes(p?.position);
    const hasAttributes = Number.isFinite(finishing) || Number.isFinite(pace);
    if (!hasAttributes) return { player: p, weight: 1 };
    return { player: p, weight: Math.max(0.1, (finishing || 50) * 0.65 + (pace || 50) * 0.2 + (attackingPosition ? 15 : 0)) };
  });
  const total = weighted.reduce((sum, x) => sum + x.weight, 0);
  let roll = Math.random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return getRosterPlayerName(item.player);
  }
  return getRosterPlayerName(weighted[weighted.length - 1].player);
}

function buildMatchSteps(match, clubsMap) {
  const used = [];
  const genMinute = () => { let m; do { m = 4 + Math.floor(Math.random() * 86); } while (used.includes(m)); used.push(m); return m; };
  const events = [];

  const userClubId = match.isUserHome ? match.homeId : match.awayId;
  const opponentId = match.isUserHome ? match.awayId : match.homeId;
  const userClub = clubsMap[userClubId];
  const opponentClub = clubsMap[opponentId];

  const userTeamGoals = match.isUserHome ? match.gh : match.ga;
  const opponentGoals = match.isUserHome ? match.ga : match.gh;
  const personalGoals = match.calledUp ? match.goals : 0;
  const teammateGoals = userTeamGoals - personalGoals; // gols do SEU time que não foram seus

  if (match.calledUp) {
    for (let i = 0; i < match.goals; i++) events.push({ min: genMinute(), text: 'Gol seu! ⚽' });
    for (let i = 0; i < match.assists; i++) events.push({ min: genMinute(), text: 'Assistência sua.' });
  }

  // Gols do seu time que não foram seus — antes desapareciam da narração.
  for (let i = 0; i < teammateGoals; i++) {
    events.push({ min: genMinute(), text: `Gol do ${userClub.name}: ${pickScorer(userClub)}.` });
  }

  // Narração dos gols do adversário — puramente narrativa, não altera gh/ga
  // nem qualquer resultado já calculado pelo Match Engine.
  for (let i = 0; i < opponentGoals; i++) {
    events.push({ min: genMinute(), text: `Gol do ${opponentClub.name}: ${pickScorer(opponentClub)}.` });
  }

  events.sort((a, b) => a.min - b.min);
  const steps = ['Apito inicial.'];
  events.forEach(e => steps.push(`${e.min}' — ${e.text}`));
  steps.push('Apito final.');
  return steps;
}

function MatchScreen({ match, clubsMap, preMatchCondition, onContinue }) {
  const [steps] = useState(() => buildMatchSteps(match, clubsMap));
  const [shown, setShown] = useState(1);

  useEffect(() => {
    if (shown >= steps.length) return;
    const t = setTimeout(() => setShown(s => s + 1), 750);
    return () => clearTimeout(t);
  }, [shown, steps.length]);

  const done = shown >= steps.length;
  const wasTired = preMatchCondition <= 50;
  const lowRating = match.calledUp && match.rating < 6;

  return (
    <div onClick={() => !done && setShown(steps.length)} style={{ minHeight: '100vh', maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, cursor: done ? 'default' : 'pointer' }}>
      <p style={{ textAlign: 'center', color: THEME.textSecondary, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>PARTIDA</p>
      <p className="display" style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, margin: '10px 0 4px' }}>{match.home}</p>
      <p className="display" style={{ textAlign: 'center', fontSize: 56, fontWeight: 700, color: THEME.gold, lineHeight: 1 }}>
        {done ? `${match.gh} — ${match.ga}` : '⋯'}
      </p>
      <p className="display" style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, margin: '4px 0 24px' }}>{match.away}</p>

      <Card elevated style={{ minHeight: 120 }}>
        {steps.slice(0, shown).map((s, i) => (
          <p key={i} style={{ fontSize: 13, color: i === shown - 1 ? THEME.text : THEME.textSecondary, marginBottom: 6 }}>{s}</p>
        ))}
      </Card>

      {done && (
        <>
          {match.calledUp && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <Badge tone="gold" style={{ fontSize: 14, padding: '6px 14px' }}>SUA NOTA: {match.rating.toFixed(1)}</Badge>
            </div>
          )}
          {!match.calledUp && <p style={{ textAlign: 'center', color: THEME.textSecondary, fontSize: 13, marginTop: 16 }}>Você ficou no banco nesta rodada.</p>}

          <Card style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12, color: THEME.textSecondary }}>
              Condição física ao entrar na rodada: <span style={{ color: wasTired ? THEME.red : THEME.text, fontWeight: 700 }}>{Math.round(preMatchCondition)}%</span>{wasTired ? ' — cansado' : ''}
            </p>
            {!match.calledUp && preMatchCondition <= FITNESS_AVAILABILITY_FLOOR && (
              <p style={{ fontSize: 12, color: THEME.red, marginTop: 6, fontWeight: 600 }}>Você não foi relacionado: condição física abaixo de {FITNESS_AVAILABILITY_FLOOR}% impede a escalação nesta rodada.</p>
            )}
            {!match.calledUp && wasTired && preMatchCondition > FITNESS_AVAILABILITY_FLOOR && (
              <p style={{ fontSize: 12, color: THEME.textSecondary, marginTop: 6 }}>A condição física baixa pode ter pesado contra sua escalação nesta rodada.</p>
            )}
            {(wasTired || lowRating) && (
              <p style={{ fontSize: 12, color: THEME.gold, marginTop: 6, fontWeight: 600 }}>Recomendação: considere descansar no próximo dia de treino.</p>
            )}
          </Card>

          <button onClick={onContinue} className="display" style={{ marginTop: 20, padding: '15px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
            CONTINUAR
          </button>
        </>
      )}
    </div>
  );
}

/* ============================================================================
   TELA — Fim de temporada
============================================================================ */

function SeasonEndScreen({ player, result, stats, onContinue }) {
  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
      <div>
        <p style={{ color: THEME.gold, fontSize: 13, fontWeight: 700 }}>FIM DE TEMPORADA</p>
        <h1 className="display" style={{ fontSize: 30, fontWeight: 700 }}>{player.name}</h1>
        <p style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 4 }}>{result.position}º lugar de {result.total} · {stats.apps} jogos · {stats.goals} gols · {stats.assists} assist.</p>
      </div>
      <Card elevated>
        {result.promoted ? (
          <>
            <p style={{ fontWeight: 700, color: THEME.gold }}>Classificado para promoção! 🎉</p>
            <p style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 6 }}>
              Destino configurado: <code>{result.target}</code>. Essa competição ainda não existe (entra na Fase 2) — o motor calculou a promoção corretamente a partir da config.
            </p>
          </>
        ) : result.relegated ? (
          <p style={{ fontSize: 13, color: THEME.red }}>Rebaixamento nesta temporada.</p>
        ) : (
          <p style={{ fontSize: 13, color: THEME.textSecondary }}>Sem promoção desta vez. Vamos para a próxima temporada.</p>
        )}
      </Card>
      <button onClick={onContinue} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
        Continuar para a próxima temporada
      </button>
    </div>
  );
}

/* ============================================================================
   TELA — Decisão de contrato (empréstimo/transferência oferecidos pelo clube)
============================================================================ */

function ContractDecisionScreen({ decision, clubsMap, onDecide }) {
  const { type, offer } = decision;
  const offerClub = clubsMap[offer.clubId] || { name: offer.clubName };
  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
      <div>
        <p style={{ color: THEME.gold, fontSize: 13, fontWeight: 700 }}>{type === 'loan' ? 'PROPOSTA DE EMPRÉSTIMO' : 'PROPOSTA DE TRANSFERÊNCIA'}</p>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700 }}>{offerClub.name}</h1>
      </div>
      <Card elevated>
        {type === 'loan' ? (
          <>
            <p style={{ fontSize: 13, color: THEME.textSecondary }}>Seu clube avalia que você precisa de mais minutos e recebeu uma proposta de empréstimo.</p>
            <p style={{ fontSize: 13, color: THEME.text, marginTop: 8 }}>Duração: {offer.durationSeasons} temporada(s). Seu contrato com o clube atual fica em espera e você retorna automaticamente ao fim do período.</p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: THEME.textSecondary }}>Seu clube avalia negociar sua saída.</p>
            <p style={{ fontSize: 13, color: THEME.text, marginTop: 8 }}>Novo salário: R$ {offer.proposedSalary.toLocaleString('pt-BR')}/mês · Duração: {offer.proposedDuration} temporadas.</p>
          </>
        )}
        <p style={{ fontSize: 12, color: THEME.textSecondary, marginTop: 10 }}>Você tem a palavra final sobre os termos pessoais.</p>
      </Card>
      <button onClick={() => onDecide(true)} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
        Aceitar
      </button>
      <button onClick={() => onDecide(false)} style={{ padding: '14px 0', fontWeight: 700, fontSize: 14, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: THEME.textSecondary }}>
        Recusar
      </button>
    </div>
  );
}

/* ============================================================================
   TELA — Resultado da Fase 1 da Série D 2026 (Competition Engine V2, modo teste)
============================================================================ */

const SERIE_D_2026_OUTCOME_LABELS = {
  access_semifinalist: { title: 'Acesso garantido! 🎉', color: THEME.gold, desc: 'Você chegou à Semifinal — pelo Art. 6 do REC, isso já garante o acesso à Série C 2027, independente do resultado dela.' },
  eliminated_to_playoff: { title: 'Eliminado nas Quartas', color: THEME.textSecondary, desc: 'Ainda resta uma chance: o Playoff de acesso, entre os 4 eliminados nas quartas.' },
  access_playoff: { title: 'Acesso garantido pelo Playoff! 🎉', color: THEME.gold, desc: 'Você venceu o Playoff (Art. 21 — pontos por perna, sem pênaltis) e garantiu o acesso à Série C 2027.' },
  champion: { title: 'CAMPEÃO DA SÉRIE D 2026! 🏆', color: THEME.gold, desc: 'Você venceu a Final e é o campeão.' },
  runner_up: { title: 'Vice-campeão', color: THEME.textSecondary, desc: 'Você perdeu a Final, mas o acesso já estava garantido desde a semifinal.' },
  eliminated_after_access: { title: 'Eliminado na Semifinal', color: THEME.textSecondary, desc: 'O acesso à Série C 2027 já estava garantido desde que você chegou aqui (Art. 6) — só não disputa a Final.' },
  eliminated: { title: 'Eliminado', color: THEME.red, desc: 'Sua trajetória na Série D 2026 termina aqui.' },
};

function SerieD2026ResultScreen({ demo, onExit, onPlayNext, stats, fans }) {
  const { groupId, result } = demo;
  if (!result) return null;
  const avgRating = stats && stats.apps ? stats.ratingSum / stats.apps : 0;

  // Caso 1: resultado da Fase 1 (grupo) — tem posição/total, não tem iWon/outcomeType ainda definido.
  if (result.phaseReached === 'fase1_grupos') {
    const { position, total, advanced, nextTie } = result;
    const honors = !advanced ? computeSeasonHonors({ outcomeType: 'eliminated', goals: stats?.goals || 0, assists: stats?.assists || 0, avgRating, fans }) : [];
    return (
      <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
        <div>
          <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>TESTE — MOTOR NOVO</p>
          <h1 className="display" style={{ fontSize: 24, fontWeight: 700 }}>1ª Fase — Grupo {groupId}</h1>
          <p style={{ color: THEME.textSecondary, fontSize: 13 }}>Série D 2026 real (96 clubes, 16 grupos oficiais)</p>
        </div>
        <Card elevated>
          <p style={{ fontSize: 14 }}>Você terminou em <b>{position}º de {total}</b> no grupo.</p>
          <p style={{ fontSize: 14, color: advanced ? THEME.green : THEME.red, fontWeight: 700, marginTop: 8 }}>
            {advanced ? 'Classificado para a 2ª Fase!' : 'Não classificado.'}
          </p>
          {advanced && nextTie && (
            <p style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 10 }}>
              Cruzamento oficial (Art. 19): você enfrenta <b>{ALL_CLUBS_MAP[nextTie.opponentId]?.name || nextTie.opponentId}</b>, {nextTie.hostsSecondLeg ? 'você manda o jogo de volta' : 'o adversário manda o jogo de volta'}.
            </p>
          )}
          <HonorsList honors={honors} />
        </Card>
        {advanced && nextTie ? (
          <button onClick={() => onPlayNext(nextTie)} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
            Jogar {SERIE_D_2026_STAGE_LABELS[nextTie.stageId]}
          </button>
        ) : (
          <button onClick={onExit} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
            Próxima temporada
          </button>
        )}
      </div>
    );
  }

  // Caso 2: resultado de um confronto de mata-mata (ida+volta já jogadas).
  const { iWon, phaseReached, opponentId, nextTie, outcomeType } = result;
  const outcome = outcomeType ? SERIE_D_2026_OUTCOME_LABELS[outcomeType] : null;
  const honors = !nextTie ? computeSeasonHonors({ outcomeType, goals: stats?.goals || 0, assists: stats?.assists || 0, avgRating, fans }) : [];
  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
      <div>
        <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>TESTE — MOTOR NOVO</p>
        <h1 className="display" style={{ fontSize: 24, fontWeight: 700 }}>{SERIE_D_2026_STAGE_LABELS[phaseReached]}</h1>
      </div>
      <Card elevated>
        <p style={{ fontSize: 14 }}>Confronto contra <b>{ALL_CLUBS_MAP[opponentId]?.name || opponentId}</b>: {iWon ? 'você avançou.' : 'você foi eliminado.'}</p>
        {outcome && (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: outcome.color, marginTop: 10 }}>{outcome.title}</p>
            <p style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 6 }}>{outcome.desc}</p>
          </>
        )}
        {nextTie && (
          <p style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 10 }}>
            Próximo: <b>{ALL_CLUBS_MAP[nextTie.opponentId]?.name || nextTie.opponentId}</b>, {nextTie.hostsSecondLeg ? 'você manda a volta' : 'o adversário manda a volta'}.
          </p>
        )}
        <HonorsList honors={honors} />
      </Card>
      {nextTie ? (
        <button onClick={() => onPlayNext(nextTie)} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
          Jogar {SERIE_D_2026_STAGE_LABELS[nextTie.stageId]}
        </button>
      ) : (
        <button onClick={onExit} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
          Próxima temporada
        </button>
      )}
    </div>
  );
}

const SERIE_C_2026_OUTCOME_LABELS = {
  advance_fase2: { title: 'Classificado para a 2ª Fase!', color: THEME.green, desc: 'Você ficou entre os 8 melhores da 1ª Fase (Art. 15).' },
  mid_table: { title: 'Não classificado', color: THEME.textSecondary, desc: 'Você não ficou entre os 8 primeiros nem entre os 2 últimos — segue na Série C 2026 na temporada seguinte.' },
  relegated: { title: 'Rebaixado', color: THEME.red, desc: 'Você terminou entre os 2 últimos da 1ª Fase (Art. 42) — desce para a Série D 2027.' },
  finalist: { title: 'Classificado para a Final! 🎉', color: THEME.gold, desc: 'Você foi o 1º colocado do seu grupo (Art. 19) — acesso à Série B já garantido, e ainda disputa o título.' },
  promoted: { title: 'Acesso garantido! 🎉', color: THEME.gold, desc: 'Você ficou entre os 2 primeiros do seu grupo (Art. 5) — acesso à Série B 2027 garantido, mas não disputa a final.' },
  eliminated_fase2: { title: 'Eliminado na 2ª Fase', color: THEME.textSecondary, desc: 'Você não ficou entre os 2 primeiros do seu grupo — sem acesso desta vez.' },
  champion: { title: 'CAMPEÃO DA SÉRIE C 2026! 🏆', color: THEME.gold, desc: 'Você venceu a Final e é o campeão — acesso à Série B já estava garantido desde a 2ª Fase.' },
  runner_up: { title: 'Vice-campeão', color: THEME.textSecondary, desc: 'Você perdeu a Final, mas o acesso à Série B já estava garantido desde a 2ª Fase.' },
};

function SerieC2026ResultScreen({ state, onExit, onPlayFase2, onPlayFinal, stats, fans }) {
  const { result } = state;
  if (!result) return null;
  const { phaseReached, outcomeType } = result;
  const outcome = SERIE_C_2026_OUTCOME_LABELS[outcomeType];
  const isTerminal = !result.nextTie && !(outcomeType === 'advance_fase2' && result.nextGroupInfo);
  const avgRating = stats && stats.apps ? stats.ratingSum / stats.apps : 0;
  const honors = isTerminal ? computeSeasonHonors({ outcomeType, goals: stats?.goals || 0, assists: stats?.assists || 0, avgRating, fans }) : [];

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
      <div>
        <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>SÉRIE C 2026</p>
        <h1 className="display" style={{ fontSize: 24, fontWeight: 700 }}>{SERIE_C_2026_STAGE_LABELS[phaseReached]}</h1>
      </div>
      <Card elevated>
        {phaseReached !== 'fase3_final' && <p style={{ fontSize: 14 }}>Você terminou em <b>{result.position}º</b>{result.total ? ` de ${result.total}` : ' do grupo'}.</p>}
        {outcome && (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: outcome.color, marginTop: 10 }}>{outcome.title}</p>
            <p style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 6 }}>{outcome.desc}</p>
          </>
        )}
        {result.nextTie && (
          <p style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 10 }}>
            Final contra <b>{ALL_CLUBS_MAP[result.nextTie.opponentId]?.name || result.nextTie.opponentId}</b>, {result.nextTie.hostsSecondLeg ? 'você manda a volta' : 'o adversário manda a volta'}.
          </p>
        )}
        <HonorsList honors={honors} />
      </Card>
      {outcomeType === 'advance_fase2' && result.nextGroupInfo ? (
        <button onClick={() => onPlayFase2(result.nextGroupInfo.groupClubIds)} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
          Jogar 2ª Fase
        </button>
      ) : result.nextTie ? (
        <button onClick={() => onPlayFinal(result.nextTie.opponentId, result.nextTie.hostsSecondLeg)} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
          Jogar Final
        </button>
      ) : (
        <button onClick={onExit} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
          {outcomeType === 'relegated' ? 'Voltar pra Série D' : 'Próxima temporada'}
        </button>
      )}
    </div>
  );
}

const SERIE_B_2026_OUTCOME_LABELS = {
  promoted_direct: { title: 'Acesso direto à Série A! 🎉', color: THEME.gold, desc: 'Você ficou entre os 2 primeiros — acesso garantido, sem precisar de playoff.' },
  mid_table: { title: 'Meio de tabela', color: THEME.textSecondary, desc: 'Nem acesso, nem risco — segue na Série B na temporada seguinte.' },
  relegated: { title: 'Rebaixado', color: THEME.red, desc: 'Você terminou entre os 4 últimos — desce para a Série C 2027.' },
  playoff_needed: { title: 'Vaga no Playoff de Acesso', color: THEME.gold, desc: 'Você ficou entre 3º e 6º — vai disputar o playoff (ida e volta, sem pênaltis) por uma vaga na Série A.' },
  promoted_playoff: { title: 'Acesso garantido pelo Playoff! 🎉', color: THEME.gold, desc: 'Você venceu o playoff — acesso à Série A 2027 garantido.' },
  eliminated_playoff: { title: 'Eliminado no Playoff', color: THEME.textSecondary, desc: 'Você perdeu o playoff — sem acesso desta vez.' },
};

function SerieB2026ResultScreen({ state, onExit, onPlayPlayoff, stats, fans }) {
  const { result } = state;
  if (!result) return null;
  const { phaseReached, outcomeType } = result;
  const outcome = SERIE_B_2026_OUTCOME_LABELS[outcomeType];
  const isTerminal = !(outcomeType === 'playoff_needed' && result.nextTie);
  const avgRating = stats && stats.apps ? stats.ratingSum / stats.apps : 0;
  const honors = isTerminal ? computeSeasonHonors({ outcomeType, goals: stats?.goals || 0, assists: stats?.assists || 0, avgRating, fans }) : [];
  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
      <div>
        <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>SÉRIE B 2026</p>
        <h1 className="display" style={{ fontSize: 24, fontWeight: 700 }}>{phaseReached === 'liga' ? 'Fim da Temporada' : 'Playoff de Acesso'}</h1>
      </div>
      <Card elevated>
        {phaseReached === 'liga' && <p style={{ fontSize: 14 }}>Você terminou em <b>{result.position}º de {result.total}</b>.</p>}
        {phaseReached === 'playoff' && <p style={{ fontSize: 14 }}>Confronto contra <b>{ALL_CLUBS_MAP[result.opponentId]?.name || result.opponentId}</b>.</p>}
        {outcome && (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: outcome.color, marginTop: 10 }}>{outcome.title}</p>
            <p style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 6 }}>{outcome.desc}</p>
          </>
        )}
        {result.nextTie && (
          <p style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 10 }}>
            Contra <b>{ALL_CLUBS_MAP[result.nextTie.opponentId]?.name || result.nextTie.opponentId}</b>, {result.nextTie.hostsSecondLeg ? 'você manda a volta' : 'o adversário manda a volta'}.
          </p>
        )}
        <HonorsList honors={honors} />
      </Card>
      {outcomeType === 'playoff_needed' && result.nextTie ? (
        <button onClick={() => onPlayPlayoff(result.nextTie.opponentId, result.nextTie.hostsSecondLeg, result.nextTie.amIBetterSeed)} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
          Jogar Playoff
        </button>
      ) : (
        <button onClick={onExit} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
          {outcomeType === 'relegated' ? 'Voltar pra Série C' : (outcomeType === 'promoted_direct' || outcomeType === 'promoted_playoff') ? 'Ir pra Série A' : 'Próxima temporada'}
        </button>
      )}
    </div>
  );
}

const SERIE_A_2026_OUTCOME_LABELS = {
  champion: { title: 'CAMPEÃO DA SÉRIE A 2026! 🏆', color: THEME.gold, desc: 'Você é o campeão do futebol brasileiro — o topo da pirâmide.' },
  mid_table: { title: 'Meio de tabela', color: THEME.textSecondary, desc: 'Segue na elite do futebol brasileiro na temporada seguinte.' },
  relegated: { title: 'Rebaixado', color: THEME.red, desc: 'Você terminou entre os 4 últimos — desce para a Série B 2027.' },
};

function SerieA2026ResultScreen({ state, onExit, stats, fans }) {
  const { result } = state;
  if (!result) return null;
  const outcome = SERIE_A_2026_OUTCOME_LABELS[result.outcomeType];
  const avgRating = stats && stats.apps ? stats.ratingSum / stats.apps : 0;
  const honors = computeSeasonHonors({ outcomeType: result.outcomeType, goals: stats?.goals || 0, assists: stats?.assists || 0, avgRating, fans });
  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
      <div>
        <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>SÉRIE A 2026</p>
        <h1 className="display" style={{ fontSize: 24, fontWeight: 700 }}>Fim da Temporada</h1>
      </div>
      <Card elevated>
        <p style={{ fontSize: 14 }}>Você terminou em <b>{result.position}º de {result.total}</b>.</p>
        {outcome && (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: outcome.color, marginTop: 10 }}>{outcome.title}</p>
            <p style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 6 }}>{outcome.desc}</p>
          </>
        )}
        <HonorsList honors={honors} />
      </Card>
      <button onClick={onExit} className="display" style={{ padding: '16px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
        {result.outcomeType === 'relegated' ? 'Voltar pra Série B' : 'Próxima temporada'}
      </button>
    </div>
  );
}

/* ============================================================================
   TELA — Entrevista (LIFE Slice 1)
============================================================================ */

function LifeEventScreen({ event, onChoose }) {
  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
      <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>ENTREVISTA</p>
      <h1 className="display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15 }}>{event.prompt}</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        {event.options.map(opt => (
          <button key={opt.posture} onClick={() => onChoose(opt.posture)}
            style={{ textAlign: 'left', padding: '14px 16px', background: THEME.card, border: `1px solid ${THEME.cardElevated}`, color: THEME.text }}>
            <span style={{ display: 'block', fontSize: 11, color: THEME.gold, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{opt.posture}</span>
            <span style={{ fontSize: 14 }}>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   APP — Season Engine embutido (orquestra as peças acima, sem alterar sua lógica)
============================================================================ */

const STORAGE_KEY = 'slice-v2';

export default function CareerApp() {
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState('create'); // create, club-select, season, match, season-end
  const [tab, setTab] = useState('home');
  const [player, setPlayer] = useState(null);
  const [seasonYear, setSeasonYear] = useState(2027);
  const [competition, setCompetition] = useState(null);
  const [standings, setStandings] = useState({});
  const [fixtures, setFixtures] = useState([]);
  const [round, setRound] = useState(0);
  const [userClubId, setUserClubId] = useState(null);
  const [stats, setStats] = useState({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
  const [log, setLog] = useState([]);
  const [promotionResult, setPromotionResult] = useState(null);
  const [seasonHistory, setSeasonHistory] = useState([]);
  const [seasonStartSnapshot, setSeasonStartSnapshot] = useState(null);

  const [trainPick, setTrainPick] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingWeek, setPendingWeek] = useState(null);

  // LIFE Slice 1 — corte estrito: só coach/crowd/media + fans. Sem teammates/board.
  const [lifeState, setLifeState] = useState({ relations: { coach: 50, crowd: 50, media: 50 }, fans: 100 });
  const [interviewHistory, setInterviewHistory] = useState([]); // personalidade emerge daqui, nunca vira número
  const [pendingLifeEvent, setPendingLifeEvent] = useState(null); // { event, resumePhase }

  // Calendar + Fitness Engine — dayIndex é a única fonte de tempo; roundToDay
  // nunca é persistido, é sempre derivado de competition.calendar_pattern.
  const [dayIndex, setDayIndex] = useState(0);
  const [fitnessState, setFitnessState] = useState({ condition: 100 });
  const [trainingSkipStreak, setTrainingSkipStreak] = useState(0); // decisão comportamental, não física

  // matchHistory — fonte de verdade pra Form/Momentum/Morale (Passo 2). Nasce
  // aqui, alimentado só pela orquestração; resolveRound nunca escreve nele.
  const [matchHistory, setMatchHistory] = useState({}); // { [clubId]: [{ result, round, competitionId, opponentId, homeAway }] }

  // Mundo Persistente — em que divisão cada clube está agora. Fonte única de
  // verdade pra montar o roster de qualquer competição, substituindo a lista
  // estática por template que existia antes.
  const [worldState, setWorldState] = useState({ clubDivision: initialClubDivision() });

  // Contract/Transfer Engine — infraestrutura mínima, preparada pro Economy/
  // Lifestyle assumir depois sem reescrever nada disso.
  const [economyState, setEconomyState] = useState({ balance: 0, investments: 0, properties: [] });
  const [pendingContractDecision, setPendingContractDecision] = useState(null); // { type: 'loan'|'transfer', offer, ownFamily, nextWorldState }

  // ---- Série D 2026 (Competition Engine V2) — estado da carreira real ----
  // `serieD2026Demo` (nome histórico, mantido pra não mexer em mais lugares
  // do que o necessário) guarda o progresso do jogador pela temporada:
  // grupo, resultados acumulados, fase atual do mata-mata, campanha.
  const [serieD2026Demo, setSerieD2026Demo] = useState(null); // { groupId, groupClubIds, matchResults, result: null|{...} }
  const [serieC2026State, setSerieC2026State] = useState(null); // { customClubIds, droppedOfficialClubId, resultsHistory, rngSeed, stageId, currentOpponentId, hostsSecondLeg, groupClubIds, matchResults, result }
  const [serieB2026State, setSerieB2026State] = useState(null); // { customClubIds, droppedOfficialClubId, matchResults, result, playoffSeed, playoffOpponentId, playoffMatchResults }
  const [serieA2026State, setSerieA2026State] = useState(null); // { customClubIds, droppedOfficialClubId, matchResults, result }
  const [transferNews, setTransferNews] = useState([]);
  useEffect(() => {
    if (competition && competition.participants && competition.participants.length > 4) {
      setTransferNews(generateTransferNews(competition.participants, userClubId, ALL_CLUBS_MAP, 4));
    }
  }, [competition?.id]);

  useEffect(() => {
    (async () => {
      try {
        const res = await appStorage.get(STORAGE_KEY);
        if (res && res.value) {
          const d = JSON.parse(res.value);
          setPhase(d.phase); setPlayer(d.player ? { age: 17, reputation: 5, contract: null, loan: null, wantsTransfer: false, wantsLoan: false, ...d.player } : d.player); setSeasonYear(d.seasonYear);
          setCompetition(d.competition); setStandings(d.standings || {});
          setFixtures(d.fixtures || []); setRound(d.round || 0);
          setUserClubId(d.userClubId); setStats(d.stats); setLog(d.log || []);
          setPromotionResult(d.promotionResult || null);
          setSeasonHistory(d.seasonHistory || []);
          setSeasonStartSnapshot(d.seasonStartSnapshot || null);
          setLifeState(d.lifeState || { relations: { coach: 50, crowd: 50, media: 50 }, fans: 100 });
          setInterviewHistory(d.interviewHistory || []);
          setDayIndex(d.dayIndex || 0);
          setFitnessState(d.fitnessState || { condition: 100 });
          setTrainingSkipStreak(d.trainingSkipStreak || 0);
          setMatchHistory(d.matchHistory || {});
          setWorldState(d.worldState || { clubDivision: initialClubDivision() });
          setEconomyState({ balance: 0, investments: 0, properties: [], ...(d.economyState || {}) });
        }
      } catch (e) { /* nada salvo ainda */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const d = { phase, player, seasonYear, competition, standings, fixtures, round, userClubId, stats, log, promotionResult, seasonHistory, seasonStartSnapshot, lifeState, interviewHistory, dayIndex, fitnessState, trainingSkipStreak, matchHistory, economyState, worldState };
    appStorage.set(STORAGE_KEY, JSON.stringify(d)).catch(() => {});
  }, [loaded, phase, player, seasonYear, competition, standings, fixtures, round, userClubId, stats, log, promotionResult, seasonHistory, seasonStartSnapshot, lifeState, interviewHistory, dayIndex, fitnessState, trainingSkipStreak, matchHistory, economyState, worldState]);

  const pushLog = useCallback((msg) => setLog(prev => [msg, ...prev].slice(0, 30)), []);

  function startCareer(name, position) {
    const base = () => 32 + Math.random() * 14;
    const detailedPosition = DETAILED_POSITION_MAP[position] ? position : null;
    const legacyPosition = detailedPosition ? detailedPositionToLegacy(detailedPosition) : position;
    const attrs = { finalizacao: base(), passe: base(), velocidade: base(), defesa: base(), fisico: base() };
    // Potencial nasce na criação e fica fixo (idade/lesão/contexto ficam fora deste escopo).
    const potential = {};
    for (const k in attrs) potential[k] = clamp(attrs[k] + 15 + Math.random() * 25, attrs[k] + 10, 99);
    const overall = computeOverall(legacyPosition, attrs);
    const profile = derivePlayerProfile(detailedPosition, attrs);
    setPlayer({
      id: `career-${Date.now()}`, name, displayName: name, position: legacyPosition, detailedPosition,
      functions: profile.functions, archetype: profile.archetype, specialization: profile.specialization,
      registeredClub: null, currentClub: null, playerSource: 'career_created',
      attrs, potential, overall, age: 16, careerPhase: 'academy', academyStatus: 'youth_player', salarySource: 'pending_official', salaryStatus: 'pending_official', reputation: 5, contract: null, loan: null, wantsTransfer: false, wantsLoan: false,
    });
    setPhase('club-select');
  }

  function chooseClub(clubId) {
    const groupId = SERIE_D_2026_ASSIGNMENT[clubId];
    const groupClubIds = SERIE_D_2026_CLUB_IDS.filter(id => SERIE_D_2026_ASSIGNMENT[id] === groupId);
    const cfg = {
      id: `serie_d_2026_${seasonYear}`, name: `Brasileirão Série D 2026 — Grupo ${groupId}`,
      family: 'serie_d_2026', format: 'league', participants: groupClubIds,
      promotion: { count: 4, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    const salaryResolution = resolvePlayerSalary(player, cfg.family, 'prospect', seasonYear);
    const salary = salaryResolution.monthly;
    const contract = makeContract(clubId, salary, seasonYear, 2);
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(groupClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(groupClubIds, true));
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setUserClubId(clubId);
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, clubId, registeredClub: clubId, currentClub: clubId, contract, salarySource: salaryResolution.source, salaryStatus: salaryResolution.status }));
    setSeasonStartSnapshot({ overall: player.overall, reputation: player.reputation });
    setSerieD2026Demo({
      groupId, groupClubIds, droppedOfficialClubId: null, customClubIds: SERIE_D_2026_CLUB_IDS, customAssignment: SERIE_D_2026_ASSIGNMENT,
      rngSeed: Math.floor(Math.random() * 1000000), resultsHistory: {},
      stageId: null, currentOpponentId: null, hostsSecondLeg: null,
      matchResults: [], accessSecured: false, result: null,
    });
    setPhase('season'); setTab('home');
    pushLog(`${player.name} assinou com o ${ALL_CLUBS_MAP[clubId].name} para disputar o ${cfg.name}.`);
  }

  // Sorteio SIMULADO dos grupos pra temporadas seguintes (2027+) — só 2026
  // tem sorteio oficial da CBF publicado. Documentado explicitamente: isso
  // NUNCA deve ser confundido com dado real, é só continuidade de carreira.
  function redrawSerieD2026GroupsForNewSeason(myClubId) {
    const shuffled = SERIE_D_2026_CLUB_IDS.filter(id => id !== myClubId);
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const insertAt = Math.floor(Math.random() * (shuffled.length + 1));
    shuffled.splice(insertAt, 0, myClubId);
    const assignment = {};
    shuffled.forEach((id, i) => { assignment[id] = `A${String(Math.floor(i / 6) + 1).padStart(2, '0')}`; });
    return assignment;
  }

  // Sai da tela de resultado — sempre continua a carreira pra próxima
  // temporada (não existe mais "voltar" pra um estado anterior; a Série D
  // 2026 É a carreira agora). Usado tanto quando eliminado quanto após
  // conseguir acesso (Série C real ainda não existe no motor novo — ver
  // startNewSerieD2026Season).
  function exitSerieD2026Demo() {
    if (serieD2026Demo && serieD2026Demo.accessSecured) { startSerieC2026Season(); return; }
    startNewSerieD2026Season();
  }

  // Monta o confronto de ida e volta de UMA fase de mata-mata — reaproveita
  // o mesmo loop de temporada existente (2 rodadas, 1 jogo cada, mandos
  // invertidos). Nenhuma tela/engine nova precisa existir pra isso funcionar.
  function beginSerieD2026Tie(stageId, opponentId, hostsSecondLeg) {
    const homeLeg1 = hostsSecondLeg ? opponentId : userClubId;
    const awayLeg1 = hostsSecondLeg ? userClubId : opponentId;
    const cfg = {
      id: `serie_d_2026_${stageId}`, name: `Série D 2026 — ${SERIE_D_2026_STAGE_LABELS[stageId]} (TESTE)`,
      family: 'serie_d_2026', format: 'league', participants: [userClubId, opponentId],
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings([userClubId, opponentId]));
    setFixtures([[[homeLeg1, awayLeg1]], [[awayLeg1, homeLeg1]]]);
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSerieD2026Demo(prev => ({ ...prev, stageId, currentOpponentId: opponentId, hostsSecondLeg, matchResults: [], result: null }));
    setPhase('season'); setTab('home');
    pushLog(`[TESTE] ${SERIE_D_2026_STAGE_LABELS[stageId]}: você enfrenta ${ALL_CLUBS_MAP[opponentId]?.name || opponentId} — ida e volta.`);
  }

  // Fim de uma temporada da Série D 2026 (com ou sem acesso) — como não
  // existe mais Paulista pra "voltar", isso sempre inicia a temporada
  // seguinte com o MESMO jogador/clube. Enquanto a Série C real não existir
  // no motor novo, alcançar o acesso também leva pra uma nova temporada de
  // Série D — deixado claro na tela de resultado, nunca escondido.
  function startNewSerieD2026Season() {
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    const newAssignment = redrawSerieD2026GroupsForNewSeason(userClubId);
    const groupId = newAssignment[userClubId];
    const groupClubIds = Object.keys(newAssignment).filter(id => newAssignment[id] === groupId);
    const cfg = {
      id: `serie_d_2026_${seasonYear + 1}`, name: `Brasileirão Série D — Grupo ${groupId}`,
      family: 'serie_d_2026', format: 'league', participants: groupClubIds,
      promotion: { count: 4, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(groupClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(groupClubIds, true));
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1 }));
    setSerieD2026Demo({
      groupId, groupClubIds, droppedOfficialClubId: null, customClubIds: SERIE_D_2026_CLUB_IDS, customAssignment: newAssignment,
      rngSeed: Math.floor(Math.random() * 1000000), resultsHistory: {},
      stageId: null, currentOpponentId: null, hostsSecondLeg: null,
      matchResults: [], accessSecured: false, result: null,
    });
    setPhase('season'); setTab('home');
    pushLog(`Nova temporada — Grupo ${groupId} (sorteio simulado; só 2026 tem sorteio oficial da CBF).`);
  }

  // ---- Série C 2026 (Competition Engine V2) — entrada e fases jogáveis ----
  // Reaproveita o mesmo loop de temporada (Match/Fitness/telas) — só muda a
  // origem dos dados (20 clubes reais, 3 fases). Entrada acontece quando o
  // jogador consegue acesso na Série D (semifinalista/playoff) OU ao
  // continuar uma carreira já na Série C.
  function startSerieC2026Season(customClubIdsOverride) {
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    let customClubIds = customClubIdsOverride;
    if (!customClubIds) {
      // Primeira entrada: substitui um clube real aleatório pelo do jogador —
      // mesmo princípio já usado na Série D (o clube do jogador não é um dos
      // 20 oficiais da Série C 2026, precisa ocupar o lugar de um deles).
      const dropIndex = Math.floor(Math.random() * SERIE_C_2026_CLUBS.length);
      customClubIds = SERIE_C_2026_CLUBS.map((name, i) => (i === dropIndex ? userClubId : name));
      pushLog(`Acesso à Série C 2026! Você assume o lugar de ${SERIE_C_2026_CLUBS[dropIndex]} entre os 20 clubes reais.`);
    }
    const cfg = {
      id: `serie_c_2026_${seasonYear + 1}`, name: 'Brasileirão Série C 2026 — 1ª Fase',
      family: 'serie_c_2026', format: 'league', participants: customClubIds,
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] }, // desempate real usa a cadeia oficial (ver season-end)
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(customClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(customClubIds, false)); // Art. 14 — turno único
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1 }));
    setSerieC2026State({
      customClubIds, rngSeed: Math.floor(Math.random() * 1000000), resultsHistory: {},
      stageId: 'fase1', currentOpponentId: null, hostsSecondLeg: null, groupClubIds: null,
      matchResults: [], accessSecured: false, result: null,
    });
    setPhase('season'); setTab('home');
  }

  // Fase 2 — grupo de 4 (turno e returno, 6 rodadas). Diferente da Série D:
  // aqui o jogador joga a fase inteira contra os outros 3 do grupo, não um
  // confronto de mata-mata contra 1 adversário só.
  function beginSerieC2026Fase2(groupClubIds) {
    const cfg = {
      id: 'serie_c_2026_fase2', name: 'Brasileirão Série C 2026 — 2ª Fase (Grupo)',
      family: 'serie_c_2026', format: 'league', participants: groupClubIds,
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(groupClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(groupClubIds, true)); // Art. 17 — turno e returno
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSerieC2026State(prev => ({ ...prev, stageId: 'fase2', groupClubIds, matchResults: [], result: null }));
    setPhase('season'); setTab('home');
    pushLog(`2ª Fase da Série C 2026: grupo de 4 (turno e returno).`);
  }

  // Fase 3 — final, ida e volta entre os 2 finalistas.
  function beginSerieC2026Final(opponentId, hostsSecondLeg) {
    const homeLeg1 = hostsSecondLeg ? opponentId : userClubId;
    const awayLeg1 = hostsSecondLeg ? userClubId : opponentId;
    const cfg = {
      id: 'serie_c_2026_final', name: 'Brasileirão Série C 2026 — Final',
      family: 'serie_c_2026', format: 'league', participants: [userClubId, opponentId],
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings([userClubId, opponentId]));
    setFixtures([[[homeLeg1, awayLeg1]], [[awayLeg1, homeLeg1]]]);
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSerieC2026State(prev => ({ ...prev, stageId: 'fase3_final', currentOpponentId: opponentId, hostsSecondLeg, matchResults: [], result: null }));
    setPhase('season'); setTab('home');
    pushLog(`Final da Série C 2026: você enfrenta ${ALL_CLUBS_MAP[opponentId]?.name || opponentId} — ida e volta.`);
  }

  // Sai da tela de resultado da Série C — decide a temporada seguinte:
  // rebaixado volta pra Série D; promovido (Art. 5 — top2 do grupo, ou
  // campeão/vice) vai pra Série B de verdade; meio de tabela repete a Série C.
  function exitSerieC2026Season() {
    const outcome = serieC2026State?.result?.outcomeType;
    if (outcome === 'relegated') { startNewSerieD2026Season(); return; }
    if (['promoted', 'finalist', 'champion', 'runner_up'].includes(outcome)) { startSerieB2026Season(); return; }
    startSerieC2026Season();
  }

  // ---- Série B 2026 — entrada, playoff de acesso, e saída de temporada ----
  function startSerieB2026Season(customClubIdsOverride) {
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    let customClubIds = customClubIdsOverride;
    if (!customClubIds) {
      const dropIndex = Math.floor(Math.random() * SERIE_B_2026_CLUBS.length);
      customClubIds = SERIE_B_2026_CLUBS.map((name, i) => (i === dropIndex ? userClubId : name));
      pushLog(`Acesso à Série B 2026! Você assume o lugar de ${SERIE_B_2026_CLUBS[dropIndex]} entre os 20 clubes reais.`);
    }
    const cfg = {
      id: `serie_b_2026_${seasonYear + 1}`, name: 'Brasileirão Série B 2026',
      family: 'serie_b_2026', format: 'league', participants: customClubIds,
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(customClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(customClubIds, true));
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1 }));
    setSerieB2026State({ customClubIds, matchResults: [], result: null, playoffOpponentId: null, playoffHostsSecondLeg: null, playoffAmIBetterSeed: null, playoffMatchResults: [] });
    setPhase('season'); setTab('home');
  }

  function beginSerieB2026Playoff(opponentId, hostsSecondLeg, amIBetterSeed) {
    const homeLeg1 = hostsSecondLeg ? opponentId : userClubId;
    const awayLeg1 = hostsSecondLeg ? userClubId : opponentId;
    const cfg = {
      id: 'serie_b_2026_playoff', name: 'Brasileirão Série B 2026 — Playoff de Acesso',
      family: 'serie_b_2026', format: 'league', participants: [userClubId, opponentId],
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings([userClubId, opponentId]));
    setFixtures([[[homeLeg1, awayLeg1]], [[awayLeg1, homeLeg1]]]);
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSerieB2026State(prev => ({ ...prev, playoffOpponentId: opponentId, playoffHostsSecondLeg: hostsSecondLeg, playoffAmIBetterSeed: amIBetterSeed, playoffMatchResults: [], result: null }));
    setPhase('season'); setTab('home');
    pushLog(`Playoff de acesso da Série B 2026: você enfrenta ${ALL_CLUBS_MAP[opponentId]?.name || opponentId} — ida e volta, sem pênaltis.`);
  }

  function exitSerieB2026Season() {
    const outcome = serieB2026State?.result?.outcomeType;
    if (outcome === 'relegated') { startSerieC2026Season(); return; }
    if (outcome === 'promoted_direct' || outcome === 'promoted_playoff') { startSerieA2026Season(); return; }
    startSerieB2026Season();
  }

  // ---- Série A 2026 — entrada e saída de temporada (topo da pirâmide) ----
  function startSerieA2026Season(customClubIdsOverride) {
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    let customClubIds = customClubIdsOverride;
    if (!customClubIds) {
      const dropIndex = Math.floor(Math.random() * SERIE_A_2026_CLUBS.length);
      customClubIds = SERIE_A_2026_CLUBS.map((name, i) => (i === dropIndex ? userClubId : name));
      pushLog(`Acesso à Série A 2026! Você assume o lugar de ${SERIE_A_2026_CLUBS[dropIndex]} entre os 20 clubes reais — o topo do futebol brasileiro.`);
    }
    const cfg = {
      id: `serie_a_2026_${seasonYear + 1}`, name: 'Brasileirão Série A 2026',
      family: 'serie_a_2026', format: 'league', participants: customClubIds,
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(customClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(customClubIds, true));
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1 }));
    setSerieA2026State({ customClubIds, matchResults: [], result: null });
    setPhase('season'); setTab('home');
  }

  function exitSerieA2026Season() {
    const outcome = serieA2026State?.result?.outcomeType;
    if (outcome === 'relegated') { startSerieB2026Season(); return; }
    startSerieA2026Season();
  }

  function togglePicker() { setShowPicker(s => !s); }

  // Dia de treino: Treinar / Descansar / Não quero treinar são três decisões
  // com significados diferentes — nunca a mesma coisa por baixo.
  function advanceTrainingDay(decision, trainingId) {
    let finalPlayer = player;
    let newCondition = fitnessState.condition;
    let newSkipStreak = trainingSkipStreak;
    let logMsg = '';

    if (decision === 'train') {
      finalPlayer = applyTraining(player, trainingId);
      newCondition = applyTrainingCost(fitnessState.condition);
      newSkipStreak = 0;
      const training = TRAININGS.find(t => t.id === trainingId);
      const deltas = Object.keys(training.effects)
        .map(attr => ({ label: ATTR_LABELS[attr], delta: finalPlayer.attrs[attr] - player.attrs[attr] }))
        .filter(d => d.delta > 0.01);
      logMsg = deltas.length
        ? `Treino (${training.name}): ${deltas.map(d => `${d.label} +${d.delta.toFixed(2)}`).join(', ')}.`
        : `Treino (${training.name}) concluído.`;
    } else if (decision === 'rest') {
      newCondition = applyRestRecovery(fitnessState.condition);
      newSkipStreak = 0;
      logMsg = 'Você optou por descansar e recuperar a condição física.';
    } else if (decision === 'skip') {
      // Fisicamente tratado como descanso — a diferença é comportamental, não física.
      newCondition = applyRestRecovery(fitnessState.condition);
      newSkipStreak = trainingSkipStreak + 1;
      const wasFatigued = fitnessState.condition < 50;
      const penalty = wasFatigued ? -1 : -3; // desgastado recentemente = mais compreensível
      setLifeState(prev => ({ ...prev, relations: { ...prev.relations, coach: clamp(prev.relations.coach + penalty, 0, 100) } }));
      logMsg = wasFatigued
        ? 'Você optou por não treinar. O departamento físico entende o desgaste recente.'
        : 'Você optou por não treinar sem justificativa aparente. O treinador não gostou.';
    }

    setPlayer(finalPlayer);
    setFitnessState({ condition: newCondition });
    setTrainingSkipStreak(newSkipStreak);
    pushLog(logMsg);
    setTrainPick(null);
    setShowPicker(false);

    // LIFE só entra quando o comportamento vira algo narrativamente relevante —
    // não a cada falta isolada.
    if (decision === 'skip' && newSkipStreak >= 3) {
      const event = findEligibleLifeEvent({ type: 'behavior', skipStreak: newSkipStreak });
      if (event) {
        setPendingLifeEvent({ event, resumePhase: 'season', resetSkipStreak: true });
        setPhase('life-event');
        if (player.contract && crossesNewMonth(competition.family, seasonYear, dayIndex)) {
          setEconomyState(e => ({ balance: e.balance + player.contract.salary }));
        }
        setDayIndex(d => d + 1);
        return;
      }
    }
    if (player.contract && crossesNewMonth(competition.family, seasonYear, dayIndex)) {
      setEconomyState(e => ({ balance: e.balance + player.contract.salary }));
    }
    setDayIndex(d => d + 1);
  }

  // Dia de recuperação (o seguinte a uma partida): recuperação automática, sem
  // decisão do jogador — não é um dia de treino disponível.
  function advanceRecoveryDay() {
    setFitnessState({ condition: applyRestRecovery(fitnessState.condition) });
    pushLog('Dia de recuperação física após a partida.');
    if (player.contract && crossesNewMonth(competition.family, seasonYear, dayIndex)) {
      setEconomyState(e => ({ balance: e.balance + player.contract.salary }));
    }
    setDayIndex(d => d + 1);
  }

  function playWeek() {
    const roundFixtures = fixtures[round];
    if (!roundFixtures) return;

    // Fitness entra aqui como "jogador efetivo" — resolveRound nunca sabe disso.
    const effectivePlayer = { ...player, overall: player.overall * matchModifier(fitnessState.condition) };

    // Clubes ATIVOS da competição atual (Paulista ou Série D, o que estiver
    // valendo) — nunca o CLUBS_MAP fixo. Contexto é por CONFRONTO, por isso a
    // montagem percorre roundFixtures.
    const activeClubsMap = getActiveClubsMap(competition, userClubId);
    const effectiveClubsMap = {};
    roundFixtures.forEach(([homeId, awayId]) => {
      const context = getMatchContext(homeId, awayId);
      const homeResults = historyForCompetition(matchHistory[homeId] || [], competition.id);
      const awayResults = historyForCompetition(matchHistory[awayId] || [], competition.id);
      effectiveClubsMap[homeId] = { ...activeClubsMap[homeId], overall: computeClubEffectiveStrength(activeClubsMap[homeId].overall, homeResults, context) };
      effectiveClubsMap[awayId] = { ...activeClubsMap[awayId], overall: computeClubEffectiveStrength(activeClubsMap[awayId].overall, awayResults, context) };
    });

    const { newStandings, userMatchInfo, playerDelta, matchResults } = resolveRound(roundFixtures, effectiveClubsMap, standings, userClubId, effectivePlayer, round, competition.id, fitnessState.condition);
    const matchCondition = applyMatchCost(fitnessState.condition);
    setPendingWeek({ userMatchInfo, playerDelta, newStandings, nextRound: round + 1, matchCondition, matchResults });
    setPhase('match');
  }

  function continueAfterMatch() {
    const { userMatchInfo, playerDelta, newStandings, nextRound, matchCondition, matchResults } = pendingWeek;
    let finalPlayer = player;
    let finalStats = stats;

    if (userMatchInfo) {
      if (userMatchInfo.calledUp) {
        finalStats = { apps: stats.apps + 1, goals: stats.goals + playerDelta.goals, assists: stats.assists + playerDelta.assists, ratingSum: stats.ratingSum + playerDelta.rating };
        const repDelta = playerDelta.rating >= 7.5 ? 2 : playerDelta.rating <= 4.5 ? -1 : 0;
        finalPlayer = { ...finalPlayer, reputation: clamp(finalPlayer.reputation + repDelta, 1, 30) };
        pushLog(`Rodada ${round + 1}: ${userMatchInfo.home} ${userMatchInfo.gh}x${userMatchInfo.ga} ${userMatchInfo.away} — nota ${userMatchInfo.rating.toFixed(1)}${playerDelta.goals ? `, ${playerDelta.goals} gol(s)` : ''}${playerDelta.assists ? `, ${playerDelta.assists} assist.` : ''}.`);
      } else {
        pushLog(`Rodada ${round + 1}: ${userMatchInfo.home} ${userMatchInfo.gh}x${userMatchInfo.ga} ${userMatchInfo.away} — você ficou no banco.`);
      }
    }

    setPlayer(finalPlayer);
    setStats(finalStats);
    setStandings(newStandings);
    setRound(nextRound);
    setFitnessState({ condition: matchCondition });
    setDayIndex(d => d + 1);
    setPendingWeek(null);

    // Salário é mensal de verdade agora (ver crossesNewMonth) — creditado
    // em qualquer avanço de dia que vire o mês, não mais por rodada.
    if (player.contract && crossesNewMonth(competition.family, seasonYear, dayIndex)) {
      setEconomyState(e => ({ balance: e.balance + player.contract.salary }));
    }

    // matchHistory nasce aqui — resolveRound só devolveu o fato bruto (matchResults);
    // é a orquestração que decide como registrar, pro ponto de vista de cada clube.
    setMatchHistory(prev => {
      const next = { ...prev };
      matchResults.forEach(({ homeId, awayId, gh, ga, round: r, competitionId }) => {
        const homeResult = gh > ga ? 'W' : gh < ga ? 'L' : 'D';
        const awayResult = gh > ga ? 'L' : gh < ga ? 'W' : 'D';
        next[homeId] = [...(next[homeId] || []), { result: homeResult, round: r, competitionId, opponentId: awayId, homeAway: 'home' }];
        next[awayId] = [...(next[awayId] || []), { result: awayResult, round: r, competitionId, opponentId: homeId, homeAway: 'away' }];
      });
      return next;
    });

    // Série D 2026 (demo) — acumula os resultados brutos desta fase, pro
    // confronto direto/campanha funcionarem de verdade no fim dela.
    // Nunca toca matchHistory nem nada do caminho legado.
    if (serieD2026Demo) {
      setSerieD2026Demo(prev => (prev ? { ...prev, matchResults: [...prev.matchResults, ...matchResults] } : prev));
    }
    // Série C 2026 — mesmo princípio.
    if (serieC2026State) {
      setSerieC2026State(prev => (prev ? { ...prev, matchResults: [...prev.matchResults, ...matchResults] } : prev));
    }
    // Série B 2026 — acumula na liga OU no playoff, dependendo de qual está rolando.
    if (serieB2026State) {
      setSerieB2026State(prev => (prev ? (
        prev.playoffOpponentId
          ? { ...prev, playoffMatchResults: [...prev.playoffMatchResults, ...matchResults] }
          : { ...prev, matchResults: [...prev.matchResults, ...matchResults] }
      ) : prev));
    }
    // Série A 2026 — liga pura, sem mata-mata/playoff nenhum.
    if (serieA2026State) {
      setSerieA2026State(prev => (prev ? { ...prev, matchResults: [...prev.matchResults, ...matchResults] } : prev));
    }

    // Decide qual seria a próxima fase (season ou season-end) exatamente como antes.
    let nextPhase = 'season';
    if (nextRound >= fixtures.length && competition.family === 'serie_d_2026' && !serieD2026Demo.stageId) {
      // ---- Série D 2026 (Competition Engine V2) — fim da Fase 1 (grupo real) ----
      const rows = Object.values(newStandings).map(r => ({ ...r, sg: r.gp - r.gc }));
      const allGroupResults = [...serieD2026Demo.matchResults, ...matchResults];
      const { sorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(rows, SERIE_D_2026_TIEBREAK_CHAIN, {
        headToHeadResults: allGroupResults, drawSeed: `serieD2026demo_${serieD2026Demo.groupId}`,
      });
      const myPosition = sorted.findIndex(r => r.club_id === userClubId) + 1;
      const advanced = myPosition <= 4;
      const resultsHistory = { fase1_grupos: allGroupResults };

      let nextTie = null, campaignSoFar = null;
      try {
        if (advanced) {
          const resolved = resolveSerieD2026UpTo('fase2_r64', serieD2026Demo.customClubIds, serieD2026Demo.customAssignment, resultsHistory, serieD2026Demo.rngSeed);
          campaignSoFar = resolved.resolvedStages.fase1_grupos.finalCampaign;
          const myPair = resolved.resolvedStages.fase2_r64.roundsPlayed[0].pairings.find(p => p.includes(userClubId));
          if (myPair) {
            const opponentId = myPair[0] === userClubId ? myPair[1] : myPair[0];
            nextTie = { stageId: 'fase2_r64', opponentId, hostsSecondLeg: myPair[1] === userClubId };
          }
        }
      } catch (e) { console.error('[Série D 2026 demo] erro ao calcular a Fase 2:', e); }

      setSerieD2026Demo(prev => ({ ...prev, resultsHistory, campaignSoFar, result: { position: myPosition, total: sorted.length, advanced, nextTie, phaseReached: 'fase1_grupos', outcomeType: advanced ? null : 'eliminated' } }));
      pushLog(`[TESTE] Fim da Fase 1 — Grupo ${serieD2026Demo.groupId}: você terminou em ${myPosition}º lugar. ${advanced ? 'Avançou pra Fase 2!' : 'Não avançou.'}`);
      nextPhase = 'serie-d-2026-result';
    } else if (nextRound >= fixtures.length && competition.family === 'serie_d_2026' && serieD2026Demo.stageId) {
      // ---- Série D 2026 — fim de UM confronto de mata-mata (ida+volta reais) ----
      const stageId = serieD2026Demo.stageId;
      const opponentId = serieD2026Demo.currentOpponentId;
      const isPlayoff = stageId === 'playoff';
      const me = newStandings[userClubId], opp = newStandings[opponentId];
      const allTieResults = [...serieD2026Demo.matchResults, ...matchResults];

      let iWon;
      if (isPlayoff) {
        // Art. 21: pontos por perna decidem primeiro; empate → saldo; empate → campanha. NUNCA pênaltis.
        if (me.pts !== opp.pts) iWon = me.pts > opp.pts;
        else {
          const mySg = me.gp - me.gc, oppSg = opp.gp - opp.gc;
          if (mySg !== oppSg) iWon = mySg > oppSg;
          else {
            const campaignNow = CompetitionEngineV2.addPhaseToCampaign(serieD2026Demo.campaignSoFar || CompetitionEngineV2.initCampaignTracker([userClubId, opponentId]), allTieResults);
            const { sorted: campSorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(
              [CompetitionEngineV2.campaignRow(campaignNow, userClubId), CompetitionEngineV2.campaignRow(campaignNow, opponentId)],
              SERIE_D_2026_TIEBREAK_CHAIN, { drawSeed: `playoff_final:${userClubId}:${opponentId}` }
            );
            iWon = campSorted[0].club_id === userClubId;
          }
        }
      } else {
        // Art. 17: saldo de gols agregado decide; empate → pênaltis (sorteio determinístico, sem minigame).
        const mySg = me.gp - me.gc, oppSg = opp.gp - opp.gc;
        if (mySg !== oppSg) iWon = mySg > oppSg;
        else iWon = CompetitionEngineV2.deterministicHash(`penaltis:${stageId}:${userClubId}`) < CompetitionEngineV2.deterministicHash(`penaltis:${stageId}:${opponentId}`);
      }

      const pairForHistory = serieD2026Demo.hostsSecondLeg ? [opponentId, userClubId] : [userClubId, opponentId];
      const leg1Raw = allTieResults[0], leg2Raw = allTieResults[1];
      const resultsHistory = {
        ...serieD2026Demo.resultsHistory,
        [stageId]: { myId: userClubId, leg1: { gh: leg1Raw.gh, ga: leg1Raw.ga }, leg2: { gh: leg2Raw.gh, ga: leg2Raw.ga }, penaltyWinner: iWon ? userClubId : opponentId },
      };

      let nextTie = null, outcomeType = null, accessSecured = serieD2026Demo.accessSecured, campaignSoFar = serieD2026Demo.campaignSoFar;
      try {
        if (stageId === 'fase5_quartas') {
          if (iWon) {
            accessSecured = true; // Art. 6 — semifinalista já garante acesso, decida o que decidir a seguir
            const resolved = resolveSerieD2026UpTo('fase6_semifinal', serieD2026Demo.customClubIds, serieD2026Demo.customAssignment, resultsHistory, serieD2026Demo.rngSeed);
            campaignSoFar = resolved.resolvedStages.fase5_quartas.finalCampaign;
            const myPair = resolved.resolvedStages.fase6_semifinal.roundsPlayed[0].pairings.find(p => p.includes(userClubId));
            if (myPair) { const oid = myPair[0] === userClubId ? myPair[1] : myPair[0]; nextTie = { stageId: 'fase6_semifinal', opponentId: oid, hostsSecondLeg: myPair[1] === userClubId }; }
            outcomeType = 'access_semifinalist';
          } else {
            const resolved = resolveSerieD2026UpTo('playoff', serieD2026Demo.customClubIds, serieD2026Demo.customAssignment, resultsHistory, serieD2026Demo.rngSeed);
            campaignSoFar = resolved.resolvedStages.fase5_quartas.finalCampaign;
            const myPair = resolved.resolvedStages.playoff.roundsPlayed[0].pairings.find(p => p.includes(userClubId));
            if (myPair) { const oid = myPair[0] === userClubId ? myPair[1] : myPair[0]; nextTie = { stageId: 'playoff', opponentId: oid, hostsSecondLeg: myPair[1] === userClubId }; }
            outcomeType = 'eliminated_to_playoff';
          }
        } else if (stageId === 'playoff') {
          outcomeType = iWon ? 'access_playoff' : 'eliminated';
        } else if (stageId === 'fase7_final') {
          outcomeType = iWon ? 'champion' : 'runner_up';
        } else if (stageId === 'fase6_semifinal') {
          outcomeType = iWon ? null : 'eliminated_after_access';
          if (iWon) {
            const resolved = resolveSerieD2026UpTo('fase7_final', serieD2026Demo.customClubIds, serieD2026Demo.customAssignment, resultsHistory, serieD2026Demo.rngSeed);
            campaignSoFar = resolved.resolvedStages.fase6_semifinal.finalCampaign;
            const myPair = resolved.resolvedStages.fase7_final.roundsPlayed[0].pairings.find(p => p.includes(userClubId));
            if (myPair) { const oid = myPair[0] === userClubId ? myPair[1] : myPair[0]; nextTie = { stageId: 'fase7_final', opponentId: oid, hostsSecondLeg: myPair[1] === userClubId }; }
          }
        } else {
          // fase2_r64, fase3_r32, fase4_oitavas — segue a sequência normal ou elimina.
          if (iWon) {
            const next = SERIE_D_2026_NEXT_STAGE[stageId];
            const resolved = resolveSerieD2026UpTo(next, serieD2026Demo.customClubIds, serieD2026Demo.customAssignment, resultsHistory, serieD2026Demo.rngSeed);
            campaignSoFar = resolved.resolvedStages[stageId].finalCampaign;
            const myPair = resolved.resolvedStages[next].roundsPlayed[0].pairings.find(p => p.includes(userClubId));
            if (myPair) { const oid = myPair[0] === userClubId ? myPair[1] : myPair[0]; nextTie = { stageId: next, opponentId: oid, hostsSecondLeg: myPair[1] === userClubId }; }
          } else {
            outcomeType = 'eliminated';
          }
        }
      } catch (e) { console.error(`[Série D 2026 demo] erro ao avançar de ${stageId}:`, e); outcomeType = outcomeType || 'error'; }

      setSerieD2026Demo(prev => ({ ...prev, resultsHistory, campaignSoFar, accessSecured, result: { iWon, phaseReached: stageId, opponentId, nextTie, outcomeType } }));
      pushLog(`[TESTE] ${SERIE_D_2026_STAGE_LABELS[stageId]}: você ${iWon ? 'avançou' : 'foi eliminado'} contra ${ALL_CLUBS_MAP[opponentId]?.name || opponentId}.`);
      nextPhase = 'serie-d-2026-result';
    } else if (nextRound >= fixtures.length && competition.family === 'serie_c_2026') {
      // ---- Série C 2026 (Competition Engine V2) — fim de fase ----
      const stageId = serieC2026State.stageId;

      if (stageId === 'fase1') {
        // Art. 14/16 — liga única, 20 clubes, SEM confronto direto.
        const rows = Object.values(newStandings).map(r => ({ ...r, sg: r.gp - r.gc }));
        const allResults = [...serieC2026State.matchResults, ...matchResults];
        const { sorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(rows, SERIE_C_2026_FASE1_TIEBREAK_CHAIN, { drawSeed: 'serie_c_2026_fase1' });
        const myPosition = sorted.findIndex(r => r.club_id === userClubId) + 1;
        const advanced = myPosition <= 8; // Art. 15
        const relegated = myPosition >= 19; // Art. 42 (2 últimos de 20)
        const resultsHistory = { fase1: allResults };

        let nextGroupInfo = null;
        if (advanced) {
          try {
            const resolved = resolveSerieC2026UpTo('fase2', serieC2026State.customClubIds, resultsHistory, serieC2026State.rngSeed);
            const myGroupId = resolved.resolvedStages.fase2.assignment[userClubId];
            const groupClubIds = Object.keys(resolved.resolvedStages.fase2.assignment).filter(id => resolved.resolvedStages.fase2.assignment[id] === myGroupId);
            nextGroupInfo = { groupClubIds };
          } catch (e) { console.error('[Série C 2026] erro ao calcular a 2ª Fase:', e); }
        }
        const outcomeType = advanced ? 'advance_fase2' : (relegated ? 'relegated' : 'mid_table');
        setSerieC2026State(prev => ({ ...prev, resultsHistory, result: { phaseReached: 'fase1', position: myPosition, total: sorted.length, outcomeType, nextGroupInfo } }));
        pushLog(`[Série C 2026] Fim da 1ª Fase: ${myPosition}º de ${sorted.length}.`);
        nextPhase = 'serie-c-2026-result';
      } else if (stageId === 'fase2') {
        // Art. 17/20 — grupo de 4, COM confronto direto (só entre 2, sem reaplicação).
        const rows = Object.values(newStandings).map(r => ({ ...r, sg: r.gp - r.gc }));
        const allGroupResults = [...serieC2026State.matchResults, ...matchResults];
        const { sorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(rows, SERIE_C_2026_FASE2_TIEBREAK_CHAIN, { headToHeadResults: allGroupResults, drawSeed: 'serie_c_2026_fase2' });
        const myPosition = sorted.findIndex(r => r.club_id === userClubId) + 1;
        const promoted = myPosition <= 2; // Art. 5
        const isFinalist = myPosition === 1; // Art. 19 — só o 1º de cada grupo
        const resultsHistory = { ...serieC2026State.resultsHistory, fase2: allGroupResults };

        let nextTie = null;
        if (isFinalist) {
          try {
            const resolved = resolveSerieC2026UpTo('fase3_final', serieC2026State.customClubIds, resultsHistory, serieC2026State.rngSeed);
            const myPair = resolved.resolvedStages.fase3_final.roundsPlayed[0].pairings.find(p => p.includes(userClubId));
            if (myPair) { const oid = myPair[0] === userClubId ? myPair[1] : myPair[0]; nextTie = { opponentId: oid, hostsSecondLeg: myPair[1] === userClubId }; }
          } catch (e) { console.error('[Série C 2026] erro ao calcular a final:', e); }
        }
        const outcomeType = isFinalist ? 'finalist' : (promoted ? 'promoted' : 'eliminated_fase2');
        setSerieC2026State(prev => ({ ...prev, resultsHistory, result: { phaseReached: 'fase2', position: myPosition, outcomeType, nextTie } }));
        pushLog(`[Série C 2026] Fim da 2ª Fase: ${myPosition}º do grupo.`);
        nextPhase = 'serie-c-2026-result';
      } else if (stageId === 'fase3_final') {
        // Art. 21 — saldo agregado decide; empate → pênaltis (sorteio determinístico). SEM campanha aqui.
        const opponentId = serieC2026State.currentOpponentId;
        const me = newStandings[userClubId], opp = newStandings[opponentId];
        const mySg = me.gp - me.gc, oppSg = opp.gp - opp.gc;
        const iWon = mySg !== oppSg ? mySg > oppSg : CompetitionEngineV2.deterministicHash(`penaltis:serie_c_final:${userClubId}`) < CompetitionEngineV2.deterministicHash(`penaltis:serie_c_final:${opponentId}`);
        const outcomeType = iWon ? 'champion' : 'runner_up'; // promoção já garantida desde a fase2
        setSerieC2026State(prev => ({ ...prev, result: { phaseReached: 'fase3_final', outcomeType, opponentId } }));
        pushLog(`[Série C 2026] Final: você ${iWon ? 'venceu' : 'perdeu'} contra ${ALL_CLUBS_MAP[opponentId]?.name || opponentId}.`);
        nextPhase = 'serie-c-2026-result';
      }
    } else if (nextRound >= fixtures.length && competition.family === 'serie_b_2026') {
      // ---- Série B 2026 — liga (com playoff de acesso) ou fim do playoff ----
      if (!serieB2026State.playoffOpponentId) {
        // Fim da liga (38 rodadas) — mesma cadeia oficial de A/B.
        const rows = Object.values(newStandings).map(r => ({ ...r, sg: r.gp - r.gc }));
        const allResults = [...serieB2026State.matchResults, ...matchResults];
        const { sorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(rows, BRASILEIRAO_TIEBREAK_CHAIN, { headToHeadResults: allResults, drawSeed: 'serie_b_2026_liga' });
        const myPosition = sorted.findIndex(r => r.club_id === userClubId) + 1;

        let outcomeType, nextTie = null;
        if (myPosition <= 2) {
          outcomeType = 'promoted_direct';
        } else if (myPosition <= 6) {
          // 3ºx6º, 4ºx5º — mando/desempate sempre pro melhor posicionado do par (sem campanha computada, o seed já é a resposta).
          const amIBetterSeed = myPosition <= 4;
          const mirrorPosition = myPosition === 3 ? 6 : myPosition === 6 ? 3 : myPosition === 4 ? 5 : 4;
          const opponentId = sorted[mirrorPosition - 1].club_id;
          nextTie = { opponentId, hostsSecondLeg: amIBetterSeed, amIBetterSeed };
          outcomeType = 'playoff_needed';
        } else if (myPosition >= 17) {
          outcomeType = 'relegated';
        } else {
          outcomeType = 'mid_table';
        }
        setSerieB2026State(prev => ({ ...prev, result: { phaseReached: 'liga', position: myPosition, total: sorted.length, outcomeType, nextTie } }));
        pushLog(`[Série B 2026] Fim da temporada: ${myPosition}º de ${sorted.length}.`);
        nextPhase = 'serie-b-2026-result';
      } else {
        // Fim do playoff — Art. próprio: sem pênaltis, seed fixo decide o empate agregado.
        const opponentId = serieB2026State.playoffOpponentId;
        const amIBetterSeed = serieB2026State.playoffAmIBetterSeed;
        const me = newStandings[userClubId], opp = newStandings[opponentId];
        const mySg = me.gp - me.gc, oppSg = opp.gp - opp.gc;
        const iWon = mySg !== oppSg ? mySg > oppSg : amIBetterSeed; // empate agregado → melhor campanha (seed) vence
        const outcomeType = iWon ? 'promoted_playoff' : 'eliminated_playoff';
        setSerieB2026State(prev => ({ ...prev, result: { phaseReached: 'playoff', outcomeType, opponentId } }));
        pushLog(`[Série B 2026] Playoff: você ${iWon ? 'venceu' : 'perdeu'} contra ${ALL_CLUBS_MAP[opponentId]?.name || opponentId}.`);
        nextPhase = 'serie-b-2026-result';
      }
    } else if (nextRound >= fixtures.length && competition.family === 'serie_a_2026') {
      // ---- Série A 2026 — topo da pirâmide, liga pura, sem mata-mata ----
      const rows = Object.values(newStandings).map(r => ({ ...r, sg: r.gp - r.gc }));
      const allResults = [...serieA2026State.matchResults, ...matchResults];
      const { sorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(rows, BRASILEIRAO_TIEBREAK_CHAIN, { headToHeadResults: allResults, drawSeed: 'serie_a_2026_liga' });
      const myPosition = sorted.findIndex(r => r.club_id === userClubId) + 1;
      const outcomeType = myPosition === 1 ? 'champion' : (myPosition >= 17 ? 'relegated' : 'mid_table');
      setSerieA2026State(prev => ({ ...prev, result: { phaseReached: 'liga', position: myPosition, total: sorted.length, outcomeType } }));
      pushLog(`[Série A 2026] Fim da temporada: ${myPosition}º de ${sorted.length}.`);
      nextPhase = 'serie-a-2026-result';
    } else if (nextRound >= fixtures.length) {
      const sorted = sortStandings(newStandings, competition.tiebreakers);
      const promo = computePromotionRelegation(competition, sorted);
      const position = sorted.findIndex(r => r.club_id === userClubId) + 1;
      const promoted = promo.promoted.includes(userClubId);
      const relegated = promo.relegated.includes(userClubId);
      const record = {
        year: seasonYear, club: getActiveClubsMap(competition, userClubId)[userClubId].name, competition: competition.name,
        position, totalClubs: sorted.length, games: finalStats.apps, goals: finalStats.goals,
        assists: finalStats.assists, avgRating: finalStats.apps ? Number((finalStats.ratingSum / finalStats.apps).toFixed(1)) : null,
        overallStart: seasonStartSnapshot.overall, overallEnd: finalPlayer.overall,
        reputationStart: seasonStartSnapshot.reputation, reputationEnd: finalPlayer.reputation,
        promoted, relegated, target: promoted ? promo.promotion_target : (relegated ? promo.relegation_target : null),
      };
      setSeasonHistory(prev => [...prev, record]);
      setPromotionResult({ position, total: sorted.length, promoted, relegated, target: record.target });
      pushLog(`Fim da temporada ${seasonYear}: ${getActiveClubsMap(competition, userClubId)[userClubId].name} terminou em ${position}º lugar.`);
      // Mundo Persistente: promoção/rebaixamento valem pra TODOS os clubes
      // dessa divisão, não só pro jogador — corrige o "clube some" quando
      // outro clube muda de divisão independente da sua trajetória.
      setWorldState(ws => ({ clubDivision: applyDivisionResult(ws.clubDivision, competition.family, promo) }));
      nextPhase = 'season-end';
    }

    // LIFE entra aqui, e só aqui: fato puro derivado do que já foi calculado acima.
    // resolveRound/playWeek nunca sabem que isso existe.
    const lifeContext = (userMatchInfo && userMatchInfo.calledUp)
      ? { type: 'match_performance', goals: playerDelta.goals, assists: playerDelta.assists, rating: playerDelta.rating,
          matchWon: userMatchInfo.isUserHome ? userMatchInfo.gh > userMatchInfo.ga : userMatchInfo.ga > userMatchInfo.gh,
          isFirstCareerGoal: stats.goals === 0 && playerDelta.goals > 0 }
      : null;
    const eligibleEvent = lifeContext ? findEligibleLifeEvent(lifeContext) : null;

    if (eligibleEvent) {
      setPendingLifeEvent({ event: eligibleEvent, resumePhase: nextPhase });
      setPhase('life-event');
    } else {
      setPhase(nextPhase);
      if (nextPhase === 'season') setTab('home');
    }
  }

  function chooseLifePosture(postureId) {
    const { event, resumePhase, resetSkipStreak, setsTransferRequest, setsLoanRequest } = pendingLifeEvent;
    const effects = applyLifeChoice(event, postureId);
    if (effects) {
      setLifeState(prev => ({
        relations: {
          coach: clamp(prev.relations.coach + (effects.relations?.coach || 0), 0, 100),
          crowd: clamp(prev.relations.crowd + (effects.relations?.crowd || 0), 0, 100),
          media: clamp(prev.relations.media + (effects.relations?.media || 0), 0, 100),
        },
        fans: Math.max(0, prev.fans + (effects.fans || 0)),
      }));
      setInterviewHistory(prev => [...prev, { eventId: event.id, posture: postureId, year: seasonYear, round: round + 1 }]);
      pushLog(`Entrevista: você respondeu de forma ${postureId}.`);
    }
    if (resetSkipStreak) setTrainingSkipStreak(0);
    // O pedido em si (transferência/empréstimo) só é REGISTRADO aqui — quem
    // decide se ele vira algo real é clubSeasonDecision, na próxima transição.
    if (setsTransferRequest) setPlayer(p => ({ ...p, wantsTransfer: true }));
    if (setsLoanRequest) setPlayer(p => ({ ...p, wantsLoan: true }));
    setPendingLifeEvent(null);
    setPhase(resumePhase);
    if (resumePhase === 'season') setTab('home');
  }

  function requestTransfer() {
    const event = findEligibleLifeEvent({ type: 'behavior', action: 'transfer_request' });
    if (event) setPendingLifeEvent({ event, resumePhase: 'season', setsTransferRequest: true });
    setPhase('life-event'); setTab('home');
  }

  function requestLoan() {
    const event = findEligibleLifeEvent({ type: 'behavior', action: 'loan_request' });
    if (event) setPendingLifeEvent({ event, resumePhase: 'season', setsLoanRequest: true });
    setPhase('life-event'); setTab('home');
  }

  // Vida Financeira — cada handler só chama o Economy Engine puro (que já
  // recusa sozinho operações sem dinheiro suficiente) e atualiza o estado.
  function handleInvest(amount) { setEconomyState(e => investAmount(e, amount)); }
  function handleWithdrawInvestments() { setEconomyState(e => withdrawAllInvestments(e)); }
  function handleBuyProperty(propertyId) { setEconomyState(e => buyProperty(e, propertyId)); }

  // Montagem da temporada em si — reaproveitada tanto pelo caminho direto
  // (sem decisão pendente) quanto depois de resolver uma decisão de contrato.
  //
  // `nextWorldState` já vem PRONTO (com o clube do jogador na divisão certa e
  // as outras divisões já avançadas) — esta função só lê dele, nunca decide
  // quem está em cada divisão. targetFamily é sempre uma string simples
  // ('estadual_sp', 'serie_d', ...), nunca mais um objeto de template inteiro.
  function finalizeNextSeason(nextPlayer, targetClubId, targetFamily, nextWorldState, logMsg) {
    const ids = Object.keys(nextWorldState.clubDivision).filter(id => nextWorldState.clubDivision[id] === targetFamily);
    if (!ids.includes(targetClubId)) ids.push(targetClubId); // segurança — não deveria acontecer se o worldState já foi atualizado corretamente
    const template = COMPETITION_TEMPLATES[targetFamily] || COMPETITION_TEMPLATES.estadual_sp;
    const cfg = template.makeConfig(seasonYear + 1, ids);
    if (logMsg) pushLog(logMsg);

    setWorldState(nextWorldState);
    setCompetition(cfg);
    setStandings(freshStandings(ids));
    setFixtures(generateFixtures(cfg));
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    setUserClubId(targetClubId);
    setPlayer(nextPlayer);
    setSeasonStartSnapshot({ overall: nextPlayer.overall, reputation: nextPlayer.reputation });
    setPromotionResult(null);
    setPendingContractDecision(null);
    setPhase('season'); setTab('home');
  }

  function continueNextSeason() {
    // Salário agora é creditado por rodada (ver continueAfterMatch) — nada
    // a pagar aqui na transição em si, evita pagar duas vezes.

    const activeMap = ALL_CLUBS_MAP;
    const clubsInDivision = Object.keys(worldState.clubDivision).filter(id => worldState.clubDivision[id] === competition.family);
    const avgOverall = clubsInDivision.reduce((s, id) => s + activeMap[id].overall, 0) / clubsInDivision.length;
    const totalRounds = fixtures.length;
    const appRate = totalRounds > 0 ? stats.apps / totalRounds : 0;
    const { status, score } = evaluatePlayerStatus(player, stats.apps, totalRounds, avgOverall);
    const requestFlags = { wantsTransfer: !!player.wantsTransfer, wantsLoan: !!player.wantsLoan };

    // Mundo Persistente: a divisão que o jogador acabou de jogar já foi
    // atualizada (ver continueAfterMatch, no fim de temporada) — aqui só
    // avançamos TODAS AS OUTRAS divisões que existem hoje, de forma leve.
    const nextWorldState = { clubDivision: advanceOtherDivisions(worldState.clubDivision, competition.family) };
    // targetFamily de "ficar no seu próprio clube" é sempre onde o Mundo
    // Persistente já colocou ele — reflete promoção/rebaixamento automaticamente.
    const ownFamily = nextWorldState.clubDivision[userClubId] || competition.family;
    const promotedUp = ownFamily !== competition.family && TIER_ORDER.indexOf(ownFamily) > TIER_ORDER.indexOf(competition.family);
    const relegatedDown = ownFamily !== competition.family && TIER_ORDER.indexOf(ownFamily) < TIER_ORDER.indexOf(competition.family);
    const divisionChangeLog = promotedUp ? `Promovido! Você agora disputa: ${COMPETITION_TEMPLATES[ownFamily]?.makeConfig?.(0, [])?.name || ownFamily}.`
      : relegatedDown ? `Rebaixado. Você agora disputa: ${COMPETITION_TEMPLATES[ownFamily]?.makeConfig?.(0, [])?.name || ownFamily}.`
      : null;

    // Retorno de empréstimo — o clube de ORIGEM reassume antes de qualquer
    // nova decisão de mercado; a divisão de origem já foi atualizada acima
    // (o Mundo Persistente também simula a divisão do clube emprestador).
    if (player.loan && seasonYear + 1 >= player.loan.returnSeason) {
      const parentClubId = player.loan.parentClubId;
      const parentFamily = nextWorldState.clubDivision[parentClubId] || player.loan.parentContract.clubId;
      const restoredPlayer = { ...player, age: player.age + 1, contract: player.loan.parentContract, loan: null, wantsTransfer: false, wantsLoan: false };
      finalizeNextSeason(restoredPlayer, parentClubId, parentFamily, nextWorldState, 'Fim do empréstimo. Você retorna ao clube de origem.');
      return;
    }

    const decision = clubSeasonDecision(player.contract, status, score, seasonYear, requestFlags, appRate);

    // Mudança de divisão (promoção OU rebaixamento) tem precedência sobre o
    // mercado de contrato — não faz sentido o clube negociar/emprestar/
    // dispensar você na mesma transição em que sua divisão mudou por mérito
    // esportivo. O mercado volta a ser avaliado normalmente a partir da nova
    // divisão, na temporada seguinte.
    const divisionChanged = promotedUp || relegatedDown;

    if (decision === 'offer_loan' && !divisionChanged) {
      const offer = generateLoanOffer(competition.family);
      if (offer) {
        setPendingContractDecision({ type: 'loan', offer, ownFamily, nextWorldState, status });
        setPhase('contract-decision');
        return;
      }
    }

    if (decision === 'consider_sale' && !divisionChanged) {
      const offers = generateTransferOffers(player, status, competition.family, avgOverall, requestFlags);
      if (offers.length > 0) {
        setPendingContractDecision({ type: 'transfer', offer: offers[0], ownFamily, nextWorldState, status });
        setPhase('contract-decision');
        return;
      }
    }

    if (decision === 'release' && !divisionChanged) {
      const offers = generateTransferOffers(player, status, competition.family, avgOverall, { wantsTransfer: true, wantsLoan: false });
      const oldClubName = activeMap[userClubId]?.name;
      if (offers.length > 0) {
        const offer = offers[0];
        const compensation = computeReleaseCompensation(player.contract, seasonYear);
        setEconomyState(e => ({ balance: e.balance + compensation }));
        const nextPlayer = { ...player, age: player.age + 1, contract: makeContract(offer.clubId, offer.proposedSalary, seasonYear + 1, offer.proposedDuration), wantsTransfer: false, wantsLoan: false };
        finalizeNextSeason(nextPlayer, offer.clubId, offer.family, nextWorldState, `Dispensado pelo ${oldClubName} (compensação recebida). Assinou com o ${offer.clubName}.`);
      } else {
        // Fallback de segurança: sem interessados, o clube reconsidera e renova.
        const salary = computeSalary(competition.family, status);
        const nextPlayer = { ...player, age: player.age + 1, contract: makeContract(userClubId, salary, seasonYear + 1, 2), wantsTransfer: false, wantsLoan: false };
        finalizeNextSeason(nextPlayer, userClubId, ownFamily, nextWorldState, `O ${oldClubName} avaliou dispensar você, mas não houve interessados — contrato renovado.`);
      }
      return;
    }

    if (decision === 'renew') {
      const salary = computeSalary(competition.family, status);
      const nextPlayer = { ...player, age: player.age + 1, contract: makeContract(userClubId, salary, seasonYear + 1, 2), wantsTransfer: false, wantsLoan: false };
      finalizeNextSeason(nextPlayer, userClubId, ownFamily, nextWorldState, divisionChangeLog || `Contrato renovado com o ${activeMap[userClubId]?.name}.`);
      return;
    }

    // keep_as_is — comportamento preservado, nada muda no vínculo.
    const nextPlayer = { ...player, age: player.age + 1, wantsTransfer: false, wantsLoan: false };
    finalizeNextSeason(nextPlayer, userClubId, ownFamily, nextWorldState, divisionChangeLog);
  }

  // JOGADOR reage à decisão do clube — aceitar ou recusar.
  function resolveContractDecision(accepted) {
    const { type, offer, ownFamily, nextWorldState } = pendingContractDecision;

    if (!accepted) {
      setLifeState(prev => ({ ...prev, relations: { ...prev.relations, coach: clamp(prev.relations.coach - 3, 0, 100) } }));
      const label = type === 'loan' ? 'o empréstimo' : 'a proposta de transferência';
      const nextPlayer = { ...player, age: player.age + 1, wantsTransfer: false, wantsLoan: false };
      finalizeNextSeason(nextPlayer, userClubId, ownFamily, nextWorldState, `Você recusou ${label}. O clube não gostou da recusa.`);
      return;
    }

    if (type === 'loan') {
      const nextPlayer = {
        ...player, age: player.age + 1, wantsTransfer: false, wantsLoan: false,
        loan: { parentClubId: userClubId, parentContract: player.contract, loanClubId: offer.clubId, returnSeason: seasonYear + 1 + offer.durationSeasons },
      };
      finalizeNextSeason(nextPlayer, offer.clubId, offer.family, nextWorldState, `Empréstimo aceito! Você joga pelo ${offer.clubName} nesta temporada.`);
      return;
    }

    if (type === 'transfer') {
      const buyout = computeBuyoutClause(player.contract, player, seasonYear);
      const oldClubName = ALL_CLUBS_MAP[userClubId]?.name;
      const nextPlayer = { ...player, age: player.age + 1, contract: makeContract(offer.clubId, offer.proposedSalary, seasonYear + 1, offer.proposedDuration), wantsTransfer: false, wantsLoan: false };
      finalizeNextSeason(nextPlayer, offer.clubId, offer.family, nextWorldState, `Transferência aceita! Multa de R$ ${buyout.toLocaleString('pt-BR')} paga ao ${oldClubName}. Você assinou com o ${offer.clubName}.`);
    }
  }

  function resetCareer() {
    appStorage.delete(STORAGE_KEY).catch(() => {});
    setPhase('create'); setPlayer(null); setSeasonYear(2027); setCompetition(null);
    setStandings({}); setFixtures([]); setRound(0); setUserClubId(null);
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 }); setLog([]); setPromotionResult(null);
    setSeasonHistory([]); setSeasonStartSnapshot(null); setTrainPick(null); setShowPicker(false); setPendingWeek(null);
    setLifeState({ relations: { coach: 50, crowd: 50, media: 50 }, fans: 100 });
    setInterviewHistory([]); setPendingLifeEvent(null);
    setDayIndex(0); setFitnessState({ condition: 100 }); setTrainingSkipStreak(0);
    setMatchHistory({});
    setEconomyState({ balance: 0, investments: 0, properties: [] }); setPendingContractDecision(null);
    setWorldState({ clubDivision: initialClubDivision() });
  }

  if (!loaded) return null;

  const activeClubsMap = (userClubId && competition) ? getActiveClubsMap(competition, userClubId) : CLUBS_MAP;
  const club = userClubId ? activeClubsMap[userClubId] : null;
  const roundToDay = competition ? buildRoundToDay(fixtures.length, competition.calendar_pattern) : {};
  const dayType = competition ? getDayType(dayIndex, roundToDay) : null;

  return (
    <div className="app-root">
      <GlobalStyle />
      {phase === 'create' && <CreateScreen onStart={startCareer} />}
      {phase === 'club-select' && player && <ClubSelectScreen player={player} onChoose={chooseClub} />}

      {phase === 'season' && player && competition && club && (
        <WPGShell active={tab} onChange={setTab} player={player} club={club} seasonYear={seasonYear}>
          {tab === 'home' && (
            <HomeScreen
              player={player} club={club} competition={competition} round={round} totalRounds={fixtures.length}
              fixtures={fixtures} log={log} dayType={dayType} condition={fitnessState.condition} matchHistory={matchHistory} clubsMap={activeClubsMap}
              trainPick={trainPick} showPicker={showPicker}
              onTogglePicker={togglePicker}
              onSelectTrainingActivity={(id) => advanceTrainingDay('train', id)}
              onRest={() => advanceTrainingDay('rest')}
              onSkipTraining={() => advanceTrainingDay('skip')}
              onAdvanceRecovery={advanceRecoveryDay}
              onPlay={playWeek}
              dayIndex={dayIndex} seasonYear={seasonYear}
            />
          )}
          {tab === 'carreira' && <CareiraScreen competition={competition} round={round} totalRounds={fixtures.length} stats={stats} log={log} />}
          {tab === 'mundo' && <MundoScreen competition={competition} standings={sortStandings(standings, competition.tiebreakers)} userClubId={userClubId} matchHistory={matchHistory} clubsMap={activeClubsMap} transferNews={transferNews} />}
          {tab === 'voce' && <VoceScreen player={player} club={club} lifeState={lifeState} economyState={economyState} onReset={resetCareer} onRequestTransfer={requestTransfer} onRequestLoan={requestLoan} onInvest={handleInvest} onWithdrawInvestments={handleWithdrawInvestments} onBuyProperty={handleBuyProperty} />}
        </WPGShell>
      )}

      {phase === 'match' && pendingWeek?.userMatchInfo && <MatchScreen match={pendingWeek.userMatchInfo} clubsMap={activeClubsMap} preMatchCondition={fitnessState.condition} onContinue={continueAfterMatch} />}
      {phase === 'life-event' && pendingLifeEvent && <LifeEventScreen event={pendingLifeEvent.event} onChoose={chooseLifePosture} />}
      {phase === 'season-end' && promotionResult && <SeasonEndScreen player={player} result={promotionResult} stats={stats} onContinue={continueNextSeason} />}
      {phase === 'contract-decision' && pendingContractDecision && <ContractDecisionScreen decision={pendingContractDecision} clubsMap={activeClubsMap} onDecide={resolveContractDecision} />}
      {phase === 'serie-d-2026-result' && serieD2026Demo && <SerieD2026ResultScreen demo={serieD2026Demo} onExit={exitSerieD2026Demo} onPlayNext={(tie) => beginSerieD2026Tie(tie.stageId, tie.opponentId, tie.hostsSecondLeg)} stats={stats} fans={lifeState.fans} />}
      {phase === 'serie-c-2026-result' && serieC2026State && <SerieC2026ResultScreen state={serieC2026State} onExit={exitSerieC2026Season} onPlayFase2={beginSerieC2026Fase2} onPlayFinal={beginSerieC2026Final} stats={stats} fans={lifeState.fans} />}
      {phase === 'serie-b-2026-result' && serieB2026State && <SerieB2026ResultScreen state={serieB2026State} onExit={exitSerieB2026Season} onPlayPlayoff={beginSerieB2026Playoff} stats={stats} fans={lifeState.fans} />}
      {phase === 'serie-a-2026-result' && serieA2026State && <SerieA2026ResultScreen state={serieA2026State} onExit={exitSerieA2026Season} stats={stats} fans={lifeState.fans} />}
    </div>
  );
}

import { clamp } from '../player/playerEngine.js';
import { FITNESS_AVAILABILITY_FLOOR } from '../life/lifeCalendarFitness.jsx';
import { ALL_CLUBS_MAP, COMPETITION_TEMPLATES } from '../../data/competitions/brazil2026.js';
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
// Nota calibrada contra referência real (WhoScored/FotMob partem de 6.0,
// SofaScore de 6.5, Football Manager considera 6.5–6.9 "média" e a maioria
// das notas cai entre 6–8) — a base 5.5 anterior, com variação de ±1.5,
// jogava a maioria dos jogos pra faixa que qualquer uma dessas referências
// chamaria de atuação ruim, mesmo sem nada de errado ter acontecido.
const MATCH_RATING_BASELINE = 6.5;
function resolveUserInvolvement(player, clubOverall, condition) {
  if (condition !== undefined && condition <= FITNESS_AVAILABILITY_FLOOR) return { calledUp: false };
  const prob = clamp(0.35 + (player.overall - clubOverall) / 80, 0.15, 0.95);
  const calledUp = Math.random() < prob;
  if (!calledUp) return { calledUp: false };
  const rating = clamp(MATCH_RATING_BASELINE + (player.overall - clubOverall) / 25 + (Math.random() - 0.5) * 2, 2, 10);
  // Titular na maioria das escalações; quando não é, entra como substituto em
  // algum momento do 2º tempo — dá contexto real pra "jogou pouco hoje" em
  // vez de só um número de nota solto.
  const started = Math.random() < 0.75;
  const enteredMinute = started ? null : Math.floor(45 + Math.random() * 40);
  return { calledUp: true, rating, started, enteredMinute };
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
    if (isUserHome && involvement.calledUp) strHome += (involvement.rating - MATCH_RATING_BASELINE) * 1.5;
    if (isUserAway && involvement.calledUp) strAway += (involvement.rating - MATCH_RATING_BASELINE) * 1.5;

    const [gh, ga] = simulateScore(strHome, strAway);
    matchResults.push({ homeId, awayId, gh, ga, round, competitionId });

    if ((isUserHome || isUserAway) && involvement.calledUp) {
      const teamGoals = isUserHome ? gh : ga;
      const { goals, assists } = resolvePlayerGoalsAssists(player, teamGoals);
      // Gol/assistência sobem a nota FINAL exibida — não realimentam o sorteio
      // de força/placar acima (isso já aconteceu), só corrigem a leitura pro
      // jogador: hoje marcar gol não mudava a nota em nada, o que também
      // contribuía pra sensação de nota descolada da atuação.
      const finalRating = clamp(involvement.rating + goals * 0.35 + assists * 0.15, 2, 10);
      userMatchInfo = { home: clubsMap[homeId].name, away: clubsMap[awayId].name, homeId, awayId, gh, ga, isUserHome, calledUp: true, rating: finalRating, goals, assists, started: involvement.started, enteredMinute: involvement.enteredMinute };
      playerDelta = { goals, assists, rating: finalRating };
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


export { poisson, simulateScore, resolveUserInvolvement, resolvePlayerGoalsAssists, generateLeagueFixtures, generateFixtures, freshStandings, sortStandings, resolveRound, computePromotionRelegation, simulateParallelSeason, applyDivisionResult, advanceOtherDivisions, MATCH_RATING_BASELINE };

/* ============================================================================
   COPA SÃO PAULO DE FUTEBOL JÚNIOR — torneio completo (fase de grupos +
   mata-mata), reaproveitado tanto pra entrada pré-carreira (antes do
   primeiro clube profissional) quanto pra um convite repetível NO MEIO da
   carreira (ver maybeTriggerCopaJuniorInvite em useCareerController.js).

   Formato: um grupo de 4 (o lado do jogador + 3 clubes reais, turno único —
   3 jogos) seguido de mata-mata de jogo único a partir das oitavas de final
   até a decisão, se o jogador se classificar entre os 2 primeiros do grupo.
   Só o grupo/chave do PRÓPRIO jogador é simulado em detalhe (mesma
   abstração já usada pros grupos da Série D: o torneio real tem 128+ times
   e vários grupos simultâneos, mas só o que envolve o jogador importa pra
   história dele) -- os outros jogos do grupo entram no cálculo real de
   classificação via resolveRound (mesmo motor da liga), não são inventados.

   O lado do jogador é uma "Seleção da Copinha" sintética, NUNCA reivindicando
   ser a base de nenhum clube real específico (evitaria inventar afiliação
   que a coleta de imprensa não confirmou). Adversários são clubes REAIS já
   cadastrados no jogo (Séries D/C/B/A 2026, com os mesmos overalls
   sintéticos que já existem em brazil2026.js/serieD2026.js/serieC2026.js).

   Resultado deliberadamente raro: só uma campanha genuinamente boa (passar
   do grupo E avançar no mata-mata, com nota média sustentada) gera
   observação de olheiro pra Série C/B/A -- o caminho padrão (escolher/
   seguir num clube da Série D) continua sendo o desfecho mais comum de
   propósito, pra não trivializar "sempre começa de baixo".

   Este módulo é só a camada PURA (sorteio de adversários, avaliação de
   olheiro, escolha do clube de destino, garantia de oportunidade) -- a
   orquestração de estado/fases e a resolução de cada partida em si (via
   resolveRound do matchEngine, o mesmo motor já usado pela liga) fica em
   useCareerController.js.
============================================================================ */

import { generateLeagueFixtures, resolvePlayerGoalsAssists, sortStandings, MATCH_RATING_BASELINE } from '../match/matchEngine.js';
import { clamp } from '../player/playerEngine.js';

const COPINHA_OWN_ID = 'copinha_selecao';
const COPINHA_OWN_NAME = 'Seleção da Copinha';

const COPA_SP_GROUP_OPPONENTS = 3; // + a Seleção da Copinha = grupo de 4
const COPA_SP_GROUP_QUALIFY = 2; // top 2 do grupo avançam
const COPA_SP_GROUP_TIEBREAKERS = ['pts', 'v', 'sg', 'gp'];
const COPA_SP_KNOCKOUT_LABELS = ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];
const COPA_SP_KNOCKOUT_ROUNDS = COPA_SP_KNOCKOUT_LABELS.length;

// 3 adversários pro grupo -- aleatórios entre as 4 divisões já cadastradas,
// sem ordenar por força (turno único de grupo, não mata-mata crescente).
function drawCopaSPGroupOpponents(clubPools, clubsMap) {
  const pool = clubPools.flat();
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, COPA_SP_GROUP_OPPONENTS);
}

// Monta o grupo de 4 (jogador + 3 sorteados) e o calendário de turno único
// (3 rodadas, 1 jogo do jogador por rodada) -- generateLeagueFixtures já
// devolve turno+returno; o grupo da Copa SP é só turno único, então usa
// apenas a primeira metade.
function buildCopaSPGroupFixtures(groupOpponents) {
  const participantIds = [COPINHA_OWN_ID, ...groupOpponents];
  const fullFixtures = generateLeagueFixtures(participantIds);
  return fullFixtures.slice(0, COPA_SP_GROUP_OPPONENTS);
}

// 4 adversários pro mata-mata (oitavas -> final), evitando repetir quem já
// caiu no grupo do jogador -- ordenado por overall crescente (mais fraco
// nas oitavas, mais forte na decisão), mesma lógica de dificuldade
// progressiva que o mata-mata já usava.
function drawCopaSPKnockoutOpponents(clubPools, clubsMap, excludeIds = []) {
  const pool = clubPools.flat().filter(id => !excludeIds.includes(id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, COPA_SP_KNOCKOUT_ROUNDS);
  return chosen.sort((a, b) => (clubsMap[a]?.overall || 50) - (clubsMap[b]?.overall || 50));
}

const COPINHA_TIERS = {
  normal: { id: 'normal', label: 'Sem observadores de peso' },
  serie_d_forte: { id: 'serie_d_forte', label: 'Chamada de um clube maior da Série D' },
  serie_c: { id: 'serie_c', label: 'Observado para a Série C' },
  serie_b: { id: 'serie_b', label: 'Observado para a Série B' },
  serie_a: { id: 'serie_a', label: 'Observado para a Série A' },
};

// Avalia o "olheiro" com base só no que a própria campanha já produziu
// (fase alcançada + nota média nos jogos em que foi escalado) -- nunca usa
// overall/potencial do jogador diretamente, só o que ele mostrou EM CAMPO.
// Limiares calibrados pra serem raros: a fórmula de nota do Match Engine já
// rende média abaixo da linha de base (6.5) quando o overall do jogador é
// bem inferior ao do clube adversário -- o caso comum pra um garoto
// enfrentando clubes profissionais -- então bater 6.5+/7.0+/7.6+ de forma
// sustentada numa campanha de 3-7 jogos já é, por si só, um destaque
// genuíno, sem precisar de ajuste artificial extra aqui.
function evaluateCopaSPScouting({ groupQualified, knockoutRoundsWon, apps, ratingSum }) {
  const avgRating = apps > 0 ? ratingSum / apps : 0;
  if (knockoutRoundsWon >= COPA_SP_KNOCKOUT_ROUNDS && avgRating >= 7.6) {
    return Math.random() < 0.35 ? COPINHA_TIERS.serie_a : COPINHA_TIERS.serie_b; // campeão da Copa SP
  }
  if (knockoutRoundsWon >= 2 && avgRating >= 7.0) return COPINHA_TIERS.serie_c; // pelo menos semifinal
  if ((groupQualified || knockoutRoundsWon >= 1) && avgRating >= 6.5) return COPINHA_TIERS.serie_d_forte;
  return COPINHA_TIERS.normal;
}

// Escolhe o clube real de destino pro resultado do olheiro. Pra
// 'serie_d_forte', restringe aos 25% de overall mais alto da Série D (uma
// chamada de um clube GRANDE da divisão, não qualquer um) -- pros tiers C/B/A,
// qualquer um dos 20 clubes reais serve (nenhum tem "força" tão destoante
// dentro da própria divisão a ponto de precisar filtrar).
function pickScoutedClub(tierId, pools) {
  if (tierId === 'normal') return null;
  if (tierId === 'serie_d_forte') {
    const withOverall = pools.serie_d_forte
      .map(name => ({ name, overall: pools.clubsMap?.[name]?.overall || 0 }))
      .sort((a, b) => b.overall - a.overall);
    const topSlice = withOverall.slice(0, Math.max(1, Math.floor(withOverall.length * 0.25)));
    return topSlice[Math.floor(Math.random() * topSlice.length)].name;
  }
  const list = pools[tierId];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

// GARANTIA DE OPORTUNIDADE — não titularidade, não chance garantida em toda
// partida. resolveUserInvolvement/resolveRound (fórmula de escalação da
// liga) continuam 100% intocados; isso só reage ao resultado JÁ simulado:
// se o jogador chega numa partida decisiva (o 3º jogo do grupo, ou
// QUALQUER jogo do mata-mata -- todos são eliminatórios) sem ter pisado em
// campo nenhuma vez até ali, ele entra como substituto nessa partida --
// nunca antes, nunca como titular. O objetivo é só impedir "passou o
// torneio inteiro sem ser visto uma vez", que é o que torna a campanha
// incapaz de gerar qualquer avaliação de olheiro (evaluateCopaSPScouting
// depende de ratingSum/apps -- sem nenhuma aparição, não há amostra).
function guaranteeCopinhaAppearance(userMatchInfo, player, clubOverall, { alreadyAppeared, isFinalRound }) {
  if (!isFinalRound || alreadyAppeared || !userMatchInfo || userMatchInfo.calledUp) return userMatchInfo;
  const rating = clamp(MATCH_RATING_BASELINE + (player.overall - clubOverall) / 25 + (Math.random() - 0.5) * 2, 2, 10);
  const teamGoals = userMatchInfo.isUserHome ? userMatchInfo.gh : userMatchInfo.ga;
  const { goals, assists } = resolvePlayerGoalsAssists(player, teamGoals);
  const finalRating = clamp(rating + goals * 0.35 + assists * 0.15, 2, 10);
  // started:false + enteredMinute no 2º tempo -- entrada como substituto,
  // nunca reescrevendo o placar (já simulado sem essa participação).
  return { ...userMatchInfo, calledUp: true, rating: finalRating, goals, assists, started: false, enteredMinute: Math.floor(60 + Math.random() * 25) };
}

// Classificação final do grupo (posição do próprio jogador) -- fina camada
// sobre sortStandings (mesmo motor usado em Mundo), só pra achar a posição.
function getGroupPosition(groupStandings) {
  const sorted = sortStandings(groupStandings, COPA_SP_GROUP_TIEBREAKERS);
  return sorted.findIndex(r => r.club_id === COPINHA_OWN_ID) + 1;
}

export {
  COPINHA_OWN_ID, COPINHA_OWN_NAME,
  COPA_SP_GROUP_OPPONENTS, COPA_SP_GROUP_QUALIFY, COPA_SP_GROUP_TIEBREAKERS,
  COPA_SP_KNOCKOUT_LABELS, COPA_SP_KNOCKOUT_ROUNDS,
  drawCopaSPGroupOpponents, buildCopaSPGroupFixtures, drawCopaSPKnockoutOpponents,
  COPINHA_TIERS, evaluateCopaSPScouting, pickScoutedClub, guaranteeCopinhaAppearance, getGroupPosition,
};

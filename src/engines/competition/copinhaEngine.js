/* ============================================================================
   COPINHA (Copa São Paulo de Futebol Júnior) — camada de "peneira" opcional
   entre a formação (academia) e a escolha do primeiro clube profissional.
   Mata-mata curto (3 rodadas: quartas, semifinal, final) contra clubes REAIS
   já cadastrados no jogo (Séries D/C/B/A 2026, com os mesmos overalls
   sintéticos que já existem em brazil2026.js/serieD2026.js/serieC2026.js) --
   o lado do jogador é uma "Seleção da Copinha" sintética, NUNCA reivindicando
   ser a base de nenhum clube real específico (evitaria inventar afiliação
   que a coleta de imprensa não confirmou).

   Resultado deliberadamente raro: dependendo de quantas rodadas o jogador
   vence e da nota média na competição, ele pode ser "observado" direto pra
   Série C/B/A em vez do caminho padrão (escolher um clube da Série D) — mas
   o caminho padrão continua sendo o desfecho MAIS COMUM de propósito, pra
   não trivializar "sempre começa de baixo" (pedido explícito do usuário).

   Este módulo é só a camada PURA (sorteio de adversários, avaliação de
   olheiro, escolha do clube de destino) — a orquestração de estado/fases e
   a resolução de cada partida em si (via resolveRound do matchEngine, o
   mesmo motor já usado pela liga) fica em useCareerController.js.
============================================================================ */

const COPINHA_OWN_ID = 'copinha_selecao';
const COPINHA_OWN_NAME = 'Seleção da Copinha';
const COPINHA_TOTAL_ROUNDS = 3;
const COPINHA_ROUND_LABELS = ['Quartas de final', 'Semifinal', 'Final'];

// Times de todas as 4 divisões já cadastradas no jogo servem de adversário --
// não modela o chaveamento real da Copinha (96+ times, fases de grupo antes
// do mata-mata) por simplicidade deliberada de v1, só o suficiente pra dar 3
// jogos com dificuldade crescente. Ordenado por overall crescente: o
// adversário mais fraco vem nas quartas, o mais forte na final.
function drawCopinhaOpponents(clubPools, clubsMap) {
  const pool = clubPools.flat();
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, COPINHA_TOTAL_ROUNDS);
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
// (rodadas vencidas + nota média nos jogos em que foi escalado) -- nunca usa
// overall/potencial do jogador diretamente, só o que ele mostrou EM CAMPO
// na Copinha. Limiares calibrados pra serem raros: a fórmula de nota do
// Match Engine já rende média abaixo da linha de base (6.5) quando o
// overall do jogador é bem inferior ao do clube adversário -- o caso comum
// pra um garoto de 17 anos enfrentando clubes profissionais -- então bater
// 6.5+/7.0+/7.6+ de forma sustentada já é, por si só, uma campanha de
// destaque genuíno, sem precisar de ajuste artificial extra aqui.
function evaluateCopinhaScouting({ roundsWon, apps, ratingSum }) {
  const avgRating = apps > 0 ? ratingSum / apps : 0;
  if (roundsWon >= 3 && avgRating >= 7.6) {
    return Math.random() < 0.35 ? COPINHA_TIERS.serie_a : COPINHA_TIERS.serie_b;
  }
  if (roundsWon >= 2 && avgRating >= 7.0) return COPINHA_TIERS.serie_c;
  if (roundsWon >= 1 && avgRating >= 6.5) return COPINHA_TIERS.serie_d_forte;
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

export { COPINHA_OWN_ID, COPINHA_OWN_NAME, COPINHA_TOTAL_ROUNDS, COPINHA_ROUND_LABELS, COPINHA_TIERS, drawCopinhaOpponents, evaluateCopinhaScouting, pickScoutedClub };

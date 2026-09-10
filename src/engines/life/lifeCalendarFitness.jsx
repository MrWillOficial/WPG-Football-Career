import { THEME } from '../../ui/WPGUI.jsx';
import { resolveRound, resolveUserInvolvement } from '../match/matchEngine.js';
import { clamp } from '../player/playerEngine.js';
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

// Sorteio simples pra variar o TEXTO da pergunta do repórter em eventos que
// se repetem bastante ao longo de uma carreira (mesmo gatilho, mesmas 4
// opções de postura sempre -- só a pergunta em si muda). Nunca afeta
// efeitos/números, é puramente de ambientação -- por isso Math.random()
// direto está OK aqui, no mesmo espírito do resto do motor (matchEngine.js,
// contractsEconomy.js já usam Math.random() sem RNG injetado pra decisões
// sem consequência determinística exigida).
function pickRandom(list) { return list[Math.floor(Math.random() * list.length)]; }

const LIFE_EVENTS = [
  {
    id: 'hat_trick_glory',
    trigger: { type: 'match_performance', condition: 'hat_trick' },
    prompt: (ctx) => pickRandom([
      `${ctx.goals} gols na partida! A imprensa quer saber o segredo do dia inspirado.`,
      `Atuação de gala hoje, com ${ctx.goals} bolas na rede. Um repórter pergunta se você sonhava com um dia assim.`,
      `${ctx.goals} gols marcados -- a pergunta na roda de imprensa é direta: "Isso muda alguma coisa pra você?"`,
    ]),
    options: [
      { posture: 'agressivo', label: 'Dizer que merece ser titular absoluto', effects: { relations: { coach: -2, crowd: 3, media: 3 }, fans: 8 } },
      { posture: 'confiante', label: 'Agradecer e prometer mais', effects: { relations: { coach: 1, crowd: 3, media: 2 }, fans: 6 } },
      { posture: 'sossegado', label: 'Dividir o mérito com o time', effects: { relations: { coach: 3, crowd: 2, media: 1 }, fans: 4 } },
      { posture: 'desleixado', label: 'Brincar que "tava de sorte"', effects: { relations: { coach: 0, crowd: 2, media: 2 }, fans: 7 } },
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
  {
    id: 'assist_playmaker',
    trigger: { type: 'match_performance', condition: 'playmaker' },
    prompt: (ctx) => pickRandom([
      `${ctx.assists} assistências na partida -- te chamam de "cérebro" do time.`,
      `${ctx.assists} passes pra gol hoje. Um repórter comenta que você joga mais pros outros do que pra si mesmo.`,
    ]),
    options: [
      { posture: 'agressivo', label: 'Cobrar mais protagonismo nas jogadas', effects: { relations: { coach: -2, crowd: 1, media: 1 }, fans: 2 } },
      { posture: 'confiante', label: 'Falar que gosta de fazer o time jogar', effects: { relations: { coach: 1, crowd: 1, media: 1 }, fans: 2 } },
      { posture: 'sossegado', label: 'Elogiar quem converteu os passes', effects: { relations: { coach: 2, crowd: 1, media: 0 }, fans: 1 } },
      { posture: 'desleixado', label: 'Dizer que só "estava no dia"', effects: { relations: { coach: 0, crowd: 0, media: 1 }, fans: 2 } },
    ],
  },
  {
    id: 'interview_decisive_goal',
    trigger: { type: 'match_performance', condition: 'decisive_goal' },
    prompt: () => pickRandom([
      'Parabéns -- seu desempenho hoje ajudou a equipe a vencer. A imprensa quer sua reação após o gol decisivo.',
      'Gol decisivo, vitória garantida. Um repórter pergunta: "Sentiu a pressão do momento?"',
      'Herói da rodada -- a imprensa quer saber como foi viver esse momento na pele.',
    ]),
    options: [
      { posture: 'agressivo', label: 'Cobrar mais espaço no time', effects: { relations: { coach: -3, crowd: 2, media: 2 }, fans: 4 } },
      { posture: 'confiante', label: 'Mostrar ambição, sem criar caso', effects: { relations: { coach: 0, crowd: 2, media: 1 }, fans: 2 } },
      { posture: 'sossegado', label: 'Elogiar o grupo, evitar o holofote', effects: { relations: { coach: 2, crowd: 1, media: 0 }, fans: 1 } },
      { posture: 'desleixado', label: 'Brincar com a pergunta', effects: { relations: { coach: -1, crowd: 1, media: 1 }, fans: 5 } },
    ],
  },
  {
    id: 'late_cameo_scrutiny',
    trigger: { type: 'match_performance', condition: 'late_entry' },
    prompt: (ctx) => pickRandom([
      `Você só entrou aos ${ctx.enteredMinute}min hoje. Um repórter pergunta como foi acompanhar boa parte do jogo do banco.`,
      `Minutos finais de novo, entrando aos ${ctx.enteredMinute}min. A imprensa questiona se falta confiança do treinador em você.`,
    ]),
    options: [
      { posture: 'agressivo', label: 'Dizer que merece mais minutos', effects: { relations: { coach: -3, crowd: 1, media: 0 }, fans: 1 } },
      { posture: 'confiante', label: 'Dizer que está pronto quando for chamado', effects: { relations: { coach: 2, crowd: 1, media: 1 }, fans: 1 } },
      { posture: 'sossegado', label: 'Respeitar a decisão do treinador', effects: { relations: { coach: 3, crowd: 0, media: 0 }, fans: 0 } },
      { posture: 'desleixado', label: 'Dizer que "seja lá quando for, tá bom"', effects: { relations: { coach: -1, crowd: -1, media: 0 }, fans: 0 } },
    ],
  },
  {
    id: 'confronted_about_training',
    trigger: { type: 'behavior', condition: 'training_skip_streak' },
    prompt: () => pickRandom([
      'O treinador te chama: "Você tem faltado aos treinos. Está insatisfeito com o clube?"',
      'A comissão técnica cobra explicações pelas faltas recentes aos treinos.',
    ]),
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
    id: 'requested_raise',
    trigger: { type: 'behavior', condition: 'raise_request' },
    prompt: 'Você procura a diretoria pra pedir um aumento salarial.',
    options: [
      { posture: 'agressivo', label: 'Exigir um valor à altura do que vem entregando', effects: { relations: { coach: -3, crowd: -1, media: 1 }, fans: 0 } },
      { posture: 'confiante', label: 'Apresentar seus números e pedir revisão', effects: { relations: { coach: 0, crowd: 1, media: 0 }, fans: 1 } },
      { posture: 'sossegado', label: 'Pedir com calma, sem ultimato', effects: { relations: { coach: 1, crowd: 0, media: 0 }, fans: 0 } },
      { posture: 'desleixado', label: 'Jogar a conversa pro empresário resolver', effects: { relations: { coach: -1, crowd: 0, media: 0 }, fans: 0 } },
    ],
  },
  {
    id: 'bad_rating_criticized',
    trigger: { type: 'match_performance', condition: 'bad_rating' },
    // Duas leituras diferentes pro mesmo "jogo ruim": sem nenhuma participação
    // (marcação apertou, não sobrou espaço) vs. teve chance e não converteu --
    // usa só o que a partida já calculou (gols/assist./nota), nada novo.
    prompt: (ctx) => ctx.goals === 0 && ctx.assists === 0
      ? pickRandom([
          'A imprensa questiona sua atuação: "Hoje o jogo estava bem marcado, o adversário não te deixou jogar. O que houve?"',
          'Um repórter nota que você quase não tocou na bola hoje. "Faltou entrosamento com o time?"',
        ])
      : pickRandom([
          'A imprensa questiona sua atuação fraca: "Não foi dessa vez hoje -- teve chances e não fez. O que houve?"',
          'Você desperdiçou boas chances hoje. Um repórter pergunta se a pontaria vai melhorar.',
        ]),
    options: [
      { posture: 'agressivo', label: 'Culpar o esquema tático', effects: { relations: { coach: -5, crowd: -1, media: -1 }, fans: -1 } },
      { posture: 'confiante', label: 'Dizer que vai melhorar', effects: { relations: { coach: 1, crowd: 0, media: 0 }, fans: 0 } },
      { posture: 'sossegado', label: 'Assumir o dia ruim, sem drama', effects: { relations: { coach: 2, crowd: 0, media: 1 }, fans: 0 } },
      { posture: 'desleixado', label: 'Minimizar, "foi só um jogo"', effects: { relations: { coach: -2, crowd: -2, media: 0 }, fans: -1 } },
    ],
  },
  // ---- Marcos de carreira -- disparam via um contexto SEPARADO
  // (type: 'career_milestone'), consultado só quando a partida em si não
  // rendeu nenhum evento acima (ver useCareerController.js). Baseados em
  // stats já acumulados (apps/goals), nenhum dado novo precisa ser rastreado.
  {
    id: 'career_milestone_apps',
    trigger: { type: 'career_milestone', condition: 'milestone_apps' },
    prompt: (ctx) => pickRandom([
      `Você chegou aos ${ctx.value} jogos pelo clube. Um repórter pede um balanço da caminhada até aqui.`,
      `${ctx.value} partidas disputadas -- a imprensa questiona o que mudou desde a sua estreia.`,
    ]),
    options: [
      { posture: 'agressivo', label: 'Dizer que já merecia mais destaque nesse tempo todo', effects: { relations: { coach: -2, crowd: 1, media: 1 }, fans: 2 } },
      { posture: 'confiante', label: 'Falar que a evolução veio com trabalho e vem mais por aí', effects: { relations: { coach: 1, crowd: 1, media: 1 }, fans: 2 } },
      { posture: 'sossegado', label: 'Agradecer ao clube e à comissão técnica', effects: { relations: { coach: 3, crowd: 1, media: 0 }, fans: 1 } },
      { posture: 'desleixado', label: 'Dizer que "nem contava os jogos"', effects: { relations: { coach: -1, crowd: 0, media: 1 }, fans: 2 } },
    ],
  },
  {
    id: 'career_milestone_goals',
    trigger: { type: 'career_milestone', condition: 'milestone_goals' },
    prompt: (ctx) => pickRandom([
      `${ctx.value} gols marcados na carreira! A imprensa quer saber como foi alcançar essa marca.`,
      `Marca redonda: ${ctx.value} gols. Um repórter pergunta se você já mirava esse número.`,
    ]),
    options: [
      { posture: 'agressivo', label: 'Dizer que quer ser o artilheiro da equipe', effects: { relations: { coach: -1, crowd: 2, media: 2 }, fans: 4 } },
      { posture: 'confiante', label: 'Comemorar a marca com ambição de continuar', effects: { relations: { coach: 1, crowd: 2, media: 1 }, fans: 3 } },
      { posture: 'sossegado', label: 'Dividir o mérito com os companheiros de time', effects: { relations: { coach: 2, crowd: 1, media: 0 }, fans: 2 } },
      { posture: 'desleixado', label: 'Rir e dizer que "nem tava contando"', effects: { relations: { coach: 0, crowd: 1, media: 1 }, fans: 3 } },
    ],
  },
];

// Limiares que disparam um marco de carreira -- só o PRIMEIRO jogo em que o
// total cruza o limiar dispara (before < limiar <= after), nunca todo jogo
// depois disso. Ver crossedMilestone() no useCareerController.js.
const MILESTONE_APPS_THRESHOLDS = [10, 25, 50, 100, 150, 200];
const MILESTONE_GOALS_THRESHOLDS = [10, 25, 50, 100];

// Avaliadores de condição — a config só referencia o nome; a lógica de "o que
// significa esse gatilho" fica aqui, pronta pra crescer sem tocar em LIFE_EVENTS.
const LIFE_CONDITION_EVALUATORS = {
  decisive_goal: (ctx) => ctx.type === 'match_performance' && ctx.goals > 0 && ctx.matchWon,
  // -1.0 em relação à base da nota de partida (MATCH_RATING_BASELINE em
  // matchEngine.js) — mesma distância relativa de antes, só reancorada na
  // base nova (6.5), senão esse gatilho quase nunca mais dispararia.
  bad_rating: (ctx) => ctx.type === 'match_performance' && ctx.rating < 5.5,
  hat_trick: (ctx) => ctx.type === 'match_performance' && ctx.goals >= 3,
  playmaker: (ctx) => ctx.type === 'match_performance' && ctx.assists >= 2,
  first_goal: (ctx) => ctx.type === 'match_performance' && ctx.isFirstCareerGoal,
  late_entry: (ctx) => ctx.type === 'match_performance' && ctx.started === false,
  training_skip_streak: (ctx) => ctx.type === 'behavior' && ctx.skipStreak >= 3,
  transfer_request: (ctx) => ctx.type === 'behavior' && ctx.action === 'transfer_request',
  loan_request: (ctx) => ctx.type === 'behavior' && ctx.action === 'loan_request',
  raise_request: (ctx) => ctx.type === 'behavior' && ctx.action === 'raise_request',
  milestone_apps: (ctx) => ctx.type === 'career_milestone' && ctx.kind === 'apps',
  milestone_goals: (ctx) => ctx.type === 'career_milestone' && ctx.kind === 'goals',
};

// Devolve o limiar cruzado nesta partida (before < limiar <= after), ou null
// se nenhum foi cruzado agora -- garante que o marco dispara só UMA vez, no
// jogo exato em que o total vira aquele número, nunca de novo depois.
function crossedMilestone(before, after, thresholds) {
  return thresholds.find(t => before < t && after >= t) ?? null;
}

// Perfil de personalidade emerge do HISTÓRICO de posturas escolhidas em
// entrevista -- nunca é um atributo do jogador, nunca afeta overall/attrs,
// só descreve o padrão predominante das respostas até agora. Com poucas
// entrevistas ainda, fica "em formação" de propósito (não rotula a partir
// de 1 resposta isolada); em empate real entre as posturas mais usadas,
// fica "imprevisível" em vez de escolher arbitrariamente uma vencedora.
const POSTURE_LABELS = { agressivo: 'Confrontador(a)', confiante: 'Confiante', sossegado: 'Comedido(a)', desleixado: 'Descontraído(a)' };
const PERSONALITY_MIN_SAMPLE = 3;
function computePersonalityProfile(interviewHistory) {
  const counts = { agressivo: 0, confiante: 0, sossegado: 0, desleixado: 0 };
  for (const entry of interviewHistory || []) { if (counts[entry.posture] != null) counts[entry.posture] += 1; }
  const total = (interviewHistory || []).length;
  if (total < PERSONALITY_MIN_SAMPLE) return { dominant: null, label: 'Personalidade ainda em formação', counts, total };
  const [topPosture, topCount] = Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a));
  const tiedAtTop = Object.values(counts).filter(c => c === topCount).length > 1;
  return { dominant: tiedAtTop ? null : topPosture, label: tiedAtTop ? 'Personalidade imprevisível' : POSTURE_LABELS[topPosture], counts, total };
}

// Frase de resumo da partida pro log/feed — mesmos fatos que já alimentam
// LIFE_EVENTS (gols, assistências, nota, vitória, titular/reserva), só que
// aqui virando texto corrido em vez de decisão de entrevista. Sempre que
// nenhuma condição bate, devolve string vazia (nunca inventa elogio/crítica
// sem base no que aconteceu).
function describeMatchPerformance(ctx) {
  const { goals = 0, assists = 0, rating, matchWon, started, enteredMinute } = ctx;
  const lines = [];
  if (started === false && enteredMinute != null) lines.push(`Entrou só aos ${enteredMinute}min.`);
  if (goals > 0) lines.push(goals === 1 ? 'Balançou a rede.' : `Marcou ${goals} gols.`);
  if (assists > 0) lines.push(assists === 1 ? 'Deu uma assistência.' : `Deu ${assists} assistências.`);
  const wonWell = matchWon && rating >= 7;
  if (goals === 0 && assists === 0) {
    // "Ajudou a vencer" e "teve chance e não fez" seriam contraditórios juntos
    // (nota alta + vitória já é elogio suficiente) — uma linha, não as duas.
    if (wonWell) lines.push('Sem participar diretamente do gol, mas ajudou a equipe a vencer.');
    else if (rating >= 6.5) lines.push('Não foi dessa vez hoje — teve chances de gol e não fez.');
    else if (rating < 5.5) lines.push('Hoje o jogo estava bem marcado, o adversário não deixou você jogar.');
  } else if (wonWell) {
    lines.push('Seu desempenho ajudou a equipe a vencer.');
  }
  return lines.join(' ');
}

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
// Formato numérico dia/mês/ano (ex: 26/01/2026) — usado onde a UI pede data
// curta em vez do nome do mês por extenso.
function formatDateBrNumeric(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
// Academia (temporada-base) não pertence a nenhuma competição oficial ainda —
// início fixo (5/jan) só pra dar uma data de calendário real às 26 semanas de
// formação, no mesmo espírito de SEASON_START_MONTHDAY.
const ACADEMY_START_MONTHDAY = [1, 5];
function getAcademyCalendarDate(seasonYear, week) {
  const [month, day] = ACADEMY_START_MONTHDAY;
  const d = new Date(seasonYear, month - 1, day);
  d.setDate(d.getDate() + week * 7);
  return d;
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

// multiplier opcional (default 1 = comportamento antigo, intacto) — dá pra
// intensidade de treino custar mais/menos condição sem duplicar a função.
function applyTrainingCost(condition, multiplier = 1) { return clamp(condition - FITNESS_TRAIN_COST * multiplier, 0, 100); }
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


export { HONOR_DEFINITIONS, computeSeasonHonors, HonorsList, LIFE_EVENTS, LIFE_CONDITION_EVALUATORS, findEligibleLifeEvent, describeMatchPerformance, applyLifeChoice, MILESTONE_APPS_THRESHOLDS, MILESTONE_GOALS_THRESHOLDS, crossedMilestone, POSTURE_LABELS, PERSONALITY_MIN_SAMPLE, computePersonalityProfile, SEASON_START_MONTHDAY, getCalendarDate, formatDateBr, formatDateBrNumeric, ACADEMY_START_MONTHDAY, getAcademyCalendarDate, crossesNewMonth, buildRoundToDay, getDayType, FITNESS_TRAIN_COST, FITNESS_MATCH_COST, FITNESS_REST_RECOVERY, FITNESS_AVAILABILITY_FLOOR, applyTrainingCost, applyMatchCost, applyRestRecovery, matchModifier };

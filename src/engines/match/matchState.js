import { STATE } from '../../data/_mock/mockData.js';
import { resolveRound } from './matchEngine.js';
import { clamp } from '../player/playerEngine.js';
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

export { MATCH_STATE_PARAMS, resultValue, historyForCompetition, calcForm, calcMomentum, calcMorale, moraleDamper, computeClubEffectiveStrength, MATCH_CONTEXT_PARAMS, RIVALRIES, contextDamper, getMatchContext };

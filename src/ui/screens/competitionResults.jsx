import React from 'react';
import { Card, THEME } from '../system.jsx';
import { HonorsList, computeSeasonHonors } from '../../engines/life/lifeCalendarFitness.jsx';
import { ALL_CLUBS_MAP } from '../../data/competitions/brazil2026.js';
import { SERIE_D_2026_STAGE_LABELS } from '../../data/competitions/serieD2026.js';
import { SERIE_C_2026_STAGE_LABELS } from '../../data/competitions/serieC2026.js';
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


export { SeasonEndScreen, ContractDecisionScreen, SERIE_D_2026_OUTCOME_LABELS, SerieD2026ResultScreen, SERIE_C_2026_OUTCOME_LABELS, SerieC2026ResultScreen, SERIE_B_2026_OUTCOME_LABELS, SerieB2026ResultScreen, SERIE_A_2026_OUTCOME_LABELS, SerieA2026ResultScreen, LifeEventScreen };

import React, { useEffect, useState } from 'react';
import { getClubRosterPlayers, getRosterPlayerName } from '../../engines/player/playerEngine.js';
import { Card, THEME } from '../system.jsx';
import { FITNESS_AVAILABILITY_FLOOR } from '../../engines/life/lifeCalendarFitness.jsx';
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

// Cada passo carrega `kind` pra tela decidir o balão certo (cor/ícone) --
// 'whistle' (apito inicial/final, sem minuto) ou um evento com minuto e um
// kind que diz de quem foi (mine/team/opponent), sem duplicar a lógica de
// quem fez o quê (isso já vem decidido aqui, a tela só pinta).
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
    for (let i = 0; i < match.goals; i++) events.push({ min: genMinute(), kind: 'goal-mine', text: 'Gol seu!' });
    for (let i = 0; i < match.assists; i++) events.push({ min: genMinute(), kind: 'assist-mine', text: 'Assistência sua.' });
  }

  // Gols do seu time que não foram seus — antes desapareciam da narração.
  for (let i = 0; i < teammateGoals; i++) {
    events.push({ min: genMinute(), kind: 'goal-team', text: `Gol do ${userClub.name}: ${pickScorer(userClub)}.` });
  }

  // Narração dos gols do adversário — puramente narrativa, não altera gh/ga
  // nem qualquer resultado já calculado pelo Match Engine.
  for (let i = 0; i < opponentGoals; i++) {
    events.push({ min: genMinute(), kind: 'goal-opponent', text: `Gol do ${opponentClub.name}: ${pickScorer(opponentClub)}.` });
  }

  events.sort((a, b) => a.min - b.min);
  const steps = [{ kind: 'whistle', text: 'Apito inicial.' }];
  events.forEach(e => steps.push(e));
  steps.push({ kind: 'whistle', text: 'Apito final.' });
  return steps;
}

// Ícone + cor do balão por tipo de evento -- gol seu em destaque (laranja,
// bola), assistência sua em verde, gol do time em texto neutro, gol do
// adversário em vermelho discreto. 'whistle' não passa por aqui (sem balão).
const EVENT_STYLE = {
  'goal-mine': { color: THEME.orange, icon: '⚽' },
  'assist-mine': { color: THEME.green, icon: '🅰️' },
  'goal-team': { color: THEME.steel, icon: '⚽' },
  'goal-opponent': { color: THEME.red, icon: '⚽' },
};

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
      <p className="mono" style={{ textAlign: 'center', color: THEME.orange, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>Partida</p>
      <p className="display" style={{ textAlign: 'center', fontSize: 30, margin: '10px 0 4px' }}>{match.home}</p>
      <p className="mono" style={{ textAlign: 'center', fontSize: 52, fontWeight: 600, color: THEME.gold, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {done ? `${match.gh} — ${match.ga}` : '⋯'}
      </p>
      <p className="display" style={{ textAlign: 'center', fontSize: 30, margin: '4px 0 24px' }}>{match.away}</p>

      <Card elevated style={{ minHeight: 120, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.slice(0, shown).map((s, i) => {
          const isLast = i === shown - 1;
          if (s.kind === 'whistle') {
            return (
              <p key={i} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: isLast ? THEME.textSecondary : THEME.textFaint, margin: '2px 0' }}>{s.text}</p>
            );
          }
          const style = EVENT_STYLE[s.kind] || { color: THEME.textSecondary, icon: '•' };
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: isLast ? 1 : 0.75 }}>
              <span className="mono" style={{ flexShrink: 0, minWidth: 38, textAlign: 'center', fontSize: 13, fontWeight: 700, color: THEME.bg, background: style.color, borderRadius: 20, padding: '3px 8px' }}>{s.min}'</span>
              <span style={{ fontSize: 14, color: isLast ? THEME.text : THEME.textSecondary, lineHeight: 1.3 }}>{style.icon} {s.text}</span>
            </div>
          );
        })}
      </Card>

      {done && (
        <>
          {match.calledUp && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 16 }}>
              <div className="stat-ring" style={{ width: 62, height: 62, '--pct': (match.rating / 10) * 100, '--ring-color': match.rating >= 7 ? THEME.green : match.rating >= 5.5 ? THEME.warn : THEME.red }}>
                <b className="mono" style={{ fontSize: 15 }}>{match.rating.toFixed(1)}</b>
              </div>
              <span className="stat-label">Sua nota</span>
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


export { pickScorer, buildMatchSteps, MatchScreen };

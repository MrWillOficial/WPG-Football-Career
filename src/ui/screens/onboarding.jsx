import React, { useMemo, useState } from 'react';
import { Badge, Card, ClubMonogram, THEME } from '../system.jsx';
import { DETAILED_POSITIONS, TRAININGS, TRAINING_INTENSITIES } from '../../engines/player/playerEngine.js';
import { SERIE_D_2026_CLUBS_MAP } from '../../data/competitions/serieD2026.js';
import { formatDateBrNumeric, getAcademyCalendarDate } from '../../engines/life/lifeCalendarFitness.jsx';
import { ALL_CLUBS_MAP } from '../../data/competitions/brazil2026.js';
import { COPINHA_TOTAL_ROUNDS } from '../../engines/competition/copinhaEngine.js';
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


function AcademyScreen({ player, state, seasonYear, log, showPicker, onTogglePicker, onAdvance }) {
  const [intensity, setIntensity] = useState('equilibrado');
  const pct = Math.round((state.week / state.totalWeeks) * 100);
  const academyDate = formatDateBrNumeric(getAcademyCalendarDate(seasonYear, state.week));
  const isLastWeek = state.week + 1 >= state.totalWeeks;
  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
      <p style={{ color: THEME.gold, fontSize: 13, fontWeight: 700 }}>TEMPORADA-BASE · FORMAÇÃO</p>
      <h1 className="display" style={{ fontSize: 34, lineHeight: 1 }}>Academia de {player.name}</h1>
      <p style={{ color: THEME.textSecondary, fontSize: 13 }}>Aos 16 anos, sua carreira começa na formação. Treino e jogos de base desenvolvem o jogador antes do primeiro contrato profissional.</p>
      <Card style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <strong className="mono">{academyDate}</strong>
          <span className="mono" style={{ color: THEME.textFaint }}>{pct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: THEME.cardElevated, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: THEME.gold }} /></div>
      </Card>
      <div className="stat-tile-grid" style={{ margin: 0 }}>
        <div className="stat-tile"><span className="stat-big">{Math.round(player.overall)}</span><span className="stat-label">Overall</span></div>
        <div className="stat-tile"><span className="stat-big">{state.matches}</span><span className="stat-label">Jogos</span></div>
        <div className="stat-tile"><span className="stat-big">{state.goals}</span><span className="stat-label">Gols</span></div>
        <div className="stat-tile"><span className="stat-big">{state.assists}</span><span className="stat-label">Assist.</span></div>
      </div>
      <div style={{ color: THEME.textFaint, fontSize: 11, marginTop: -6 }}>17 anos ao concluir a temporada-base.</div>

      {!showPicker && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onTogglePicker} className="display" style={{ padding: '15px 0', fontWeight: 700, fontSize: 18, background: THEME.gold, color: THEME.bg, border: 'none' }}>
            {isLastWeek ? 'Treinar e concluir formação' : 'Treinar'}
          </button>
          <button onClick={() => onAdvance('rest')} style={{ padding: '13px 0', fontWeight: 700, fontSize: 14, border: `1px solid ${THEME.gold}`, background: 'transparent', color: THEME.gold }}>
            {isLastWeek ? 'Descansar e concluir formação' : 'Descansar'}
          </button>
        </div>
      )}
      {showPicker && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {TRAINING_INTENSITIES.map(i => (
              <button key={i.id} onClick={() => setIntensity(i.id)}
                style={{ flex: 1, padding: '7px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', border: `1px solid ${intensity === i.id ? THEME.gold : THEME.cardElevated}`, background: intensity === i.id ? THEME.gold : 'transparent', color: intensity === i.id ? THEME.bg : THEME.textSecondary }}>
                {i.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TRAININGS.map(t => (
              <button key={t.id} onClick={() => onAdvance('train', t.id, intensity)}
                style={{ padding: '12px 0', fontSize: 13, fontWeight: 600, border: `1px solid ${THEME.cardElevated}`, background: THEME.card, color: THEME.text }}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>SUA SEMANA NA BASE</p>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(!log || log.length === 0) && <p style={{ fontSize: 13, color: THEME.textSecondary }}>Ainda não teve sua primeira semana — escolha um treino pra começar.</p>}
          {(log || []).slice(0, 3).map((l, i) => <p key={i} style={{ fontSize: 13, color: THEME.textSecondary }}>• {l}</p>)}
        </Card>
      </div>
    </div>
  );
}

function ClubSelectScreen({ player, onChoose }) {
  const interested = useMemo(() => {
    const all = Object.entries(SERIE_D_2026_CLUBS_MAP).map(([id, club]) => ({ id, ...club }));
    const seed = [...player.name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    return all
      .map(c => ({ ...c, interest: Math.abs((c.overall - player.overall) * 2) + ((seed ^ c.id.length) % 7) }))
      .filter(c => Math.abs(c.overall - player.overall) <= 7 || c.interest % 5 === 0)
      .sort((a, b) => a.interest - b.interest)
      .slice(0, 8);
  }, [player]);
  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', minHeight: '100vh' }}>
      <p style={{ color: THEME.gold, fontSize: 13, fontWeight: 600 }}>INTERESSE DOS CLUBES</p>
      <h1 className="display" style={{ fontSize: 30, fontWeight: 700, marginBottom: 2 }}>{player.name}</h1>
      <p style={{ color: THEME.textSecondary, fontSize: 13, marginBottom: 20 }}>Você tem 16 anos e está saindo da formação. Estes são os clubes que demonstraram interesse inicial; os demais não estão disponíveis nesta decisão.</p>
      {interested.map(c => (
        <Card key={c.id} onClick={() => onChoose(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px', marginBottom: 7 }}>
          <ClubMonogram club={c} size={30} />
          <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{c.name}</span>
          <Badge>Força {c.overall}</Badge>
        </Card>
      ))}
    </div>
  );
}


/* ============================================================================
   COPINHA — mata-mata curto antes de escolher o primeiro clube profissional.
   Ver copinhaEngine.js pro porquê e a lógica de olheiro.
============================================================================ */
function CopinhaIntroScreen({ player, onStart }) {
  return (
    <div style={{ padding: 24, maxWidth: 420, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Card elevated style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Antes de escolher seu clube</p>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, margin: '8px 0 12px' }}>Copa São Paulo de Futebol Júnior</h1>
        <p style={{ color: THEME.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
          {player.name}, você foi convidado a defender uma seleção de base na Copinha antes de assinar seu primeiro contrato profissional. São {COPINHA_TOTAL_ROUNDS} jogos eliminatórios contra times de todo o país — perder qualquer um encerra sua participação. Um bom torneio pode chamar a atenção de olheiros de divisões maiores; um torneio discreto não muda nada, e você segue normalmente pra escolha de um clube da Série D.
        </p>
        <button className="display" onClick={onStart} style={{ marginTop: 20, padding: '15px 0', width: '100%', fontWeight: 700, fontSize: 16, background: THEME.gold, color: THEME.bg, border: 'none' }}>COMEÇAR A COPINHA</button>
      </Card>
    </div>
  );
}

const COPINHA_TIER_HEADLINES = {
  normal: 'Sem observadores de peso',
  serie_d_forte: 'Uma chamada especial!',
  serie_c: 'Observado para a Série C!',
  serie_b: 'Observado para a Série B!',
  serie_a: 'Observado para a Série A!',
};
function CopinhaResultScreen({ copinhaState, onContinue }) {
  const { stats, roundsWon, result } = copinhaState;
  const avgRating = stats.apps ? (stats.ratingSum / stats.apps).toFixed(1) : '—';
  const clubName = result.scoutedClub ? (ALL_CLUBS_MAP[result.scoutedClub]?.name || result.scoutedClub) : null;
  return (
    <div style={{ padding: 24, maxWidth: 420, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Card elevated style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Copinha — fim de participação</p>
        <h1 className="display" style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 6px', color: result.tier === 'normal' ? THEME.text : THEME.gold }}>{COPINHA_TIER_HEADLINES[result.tier]}</h1>
        <p style={{ color: THEME.textSecondary, fontSize: 13 }}>{roundsWon} de {COPINHA_TOTAL_ROUNDS} rodadas vencidas · {stats.goals} gol(s) · {stats.assists} assistência(s) · nota média {avgRating}</p>
        {clubName ? (
          <p style={{ marginTop: 14, fontSize: 14 }}>Você vai assinar direto com o <b style={{ color: THEME.gold }}>{clubName}</b>.</p>
        ) : (
          <p style={{ marginTop: 14, fontSize: 14 }}>Nenhum olheiro de peso apareceu — hora de escolher seu primeiro clube na Série D.</p>
        )}
        <button className="display" onClick={onContinue} style={{ marginTop: 20, padding: '15px 0', width: '100%', fontWeight: 700, fontSize: 16, background: THEME.gold, color: THEME.bg, border: 'none' }}>CONTINUAR</button>
      </Card>
    </div>
  );
}

export { AcademyScreen, CreateScreen, ClubSelectScreen, CopinhaIntroScreen, CopinhaResultScreen };

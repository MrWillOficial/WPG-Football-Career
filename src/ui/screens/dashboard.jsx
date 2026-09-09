import React, { useState } from 'react';
import { Badge, Card, ClubMonogram, FormaDots, THEME } from '../system.jsx';
import { getMatchContext, historyForCompetition } from '../../engines/match/matchState.js';
import { formatDateBr, getCalendarDate } from '../../engines/life/lifeCalendarFitness.jsx';
import { TRAININGS, TRAINING_INTENSITIES } from '../../engines/player/playerEngine.js';
/* ============================================================================
   TELA — Início (Home)
============================================================================ */

// Rótulo de apresentação pro selo "Rumo à X" na Home — dado, não hardcode
// espalhado; ganhar Série C/B/A no futuro é só adicionar uma entrada aqui.
const NEXT_TIER_LABELS = { serie_d: 'SÉRIE D', serie_c: 'SÉRIE C', serie_b: 'SÉRIE B', serie_a: 'SÉRIE A' };

function HomeScreen({ player, club, competition, round, totalRounds, fixtures, log, dayType, condition, matchHistory, clubsMap, trainPick, onTogglePicker, showPicker, onSelectTrainingActivity, onRest, onSkipTraining, onPlay, onAdvanceRecovery, dayIndex, seasonYear, stats, economyState }) {
  const [intensity, setIntensity] = useState('equilibrado');
  const nextFixture = fixtures[round] ? fixtures[round].find(([h, a]) => h === club.id || a === club.id) : null;
  const opponentId = nextFixture ? (nextFixture[0] === club.id ? nextFixture[1] : nextFixture[0]) : null;
  const isHome = nextFixture ? nextFixture[0] === club.id : null;
  const conditionColor = condition <= 25 ? THEME.red : condition <= 50 ? THEME.warn : THEME.green;
  const clubForma = historyForCompetition(matchHistory[club.id] || [], competition.id).slice(-5);
  const isDerby = opponentId ? getMatchContext(club.id, opponentId) === 'derby' : false;
  const calendarDate = formatDateBr(getCalendarDate(competition.family, seasonYear, dayIndex));
  const weeklyLoad = player.weeklyLoad || 0;
  const loadColor = weeklyLoad >= 70 ? THEME.red : weeklyLoad >= 45 ? THEME.warn : THEME.steel;
  const apps = stats?.apps || 0;
  const avgRating = apps > 0 ? (stats.ratingSum / apps).toFixed(1) : '—';

  return (
    <div className="screen-page">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <p style={{ color: THEME.orange, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, fontFamily: THEME.fontMono, textTransform: 'uppercase' }}>RUMO À {NEXT_TIER_LABELS[competition.promotion.target_competition_id] || 'PRÓXIMA DIVISÃO'}</p>
        {economyState && <span className="id-badge">R$ {Math.round(economyState.balance).toLocaleString('pt-BR')}</span>}
      </div>
      <p style={{ color: THEME.textFaint, fontSize: 12, marginTop: 2, fontFamily: THEME.fontMono }}>{calendarDate}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '14px 0 10px' }}>
        <ClubMonogram club={club} size={56} />
        <div>
          <h1 className="display" style={{ fontSize: 26, lineHeight: 1 }}>{player.name}</h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <Badge tone="gold">{player.position} OVR {player.overall}</Badge>
            <span style={{ fontSize: 12, color: THEME.textSecondary }}>{club.name}</span>
          </div>
        </div>
      </div>

      <div className="stat-tile-grid">
        <div className="stat-tile">
          <div className="stat-ring" style={{ '--pct': condition, '--ring-color': conditionColor }}><b>{Math.round(condition)}</b></div>
          <span className="stat-label">Condição</span>
        </div>
        <div className="stat-tile">
          <div className="stat-ring" style={{ '--pct': weeklyLoad, '--ring-color': loadColor }}><b>{Math.round(weeklyLoad)}</b></div>
          <span className="stat-label">Carga</span>
        </div>
        <div className="stat-tile">
          <span className="stat-big">{Math.round(player.overall)}</span>
          <span className="stat-label">Overall</span>
        </div>
        <div className="stat-tile">
          <span className="stat-big">{avgRating}</span>
          <span className="stat-label">Nota média</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: THEME.textSecondary, width: 90 }}>Forma recente</span>
        <FormaDots results={clubForma} size={15} />
      </div>

      <Card elevated style={{ marginBottom: 14, borderColor: 'rgba(242,102,15,0.28)', background: `linear-gradient(150deg, ${THEME.accentSoft}, ${THEME.card} 60%)` }}>
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
          <div style={{ marginTop: 14 }}>
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
                <button key={t.id} onClick={() => onSelectTrainingActivity(t.id, intensity)}
                  style={{ padding: '10px 0', fontSize: 13, fontWeight: 600, border: `1px solid ${THEME.card}`, background: THEME.card, color: THEME.text }}>
                  {t.name}
                </button>
              ))}
            </div>
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


export { NEXT_TIER_LABELS, HomeScreen };

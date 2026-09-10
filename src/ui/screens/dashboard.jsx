import React, { useState } from 'react';
import { Card, ClubMonogram, THEME } from '../system.jsx';
import { getMatchContext, historyForCompetition } from '../../engines/match/matchState.js';
import { sortStandings } from '../../engines/match/matchEngine.js';
import { formatDateBr, getCalendarDate, buildRoundToDay, computePersonalityProfile } from '../../engines/life/lifeCalendarFitness.jsx';
import { TRAININGS, TRAINING_INTENSITIES, DETAILED_POSITION_MAP, POSITIONS } from '../../engines/player/playerEngine.js';
/* ============================================================================
   TELA — Início (Home) — "Central da carreira"

   Direção aprovada (protótipo wpg-hud-directions): a tela responde rápido a
   5 perguntas -- quem sou, onde estou, o que está acontecendo agora, qual o
   próximo compromisso, o que eu preciso fazer -- e o resto fica a um toque
   de distância (aba Carreira). Nada aqui é inventado: condição já existia,
   forma vem do matchHistory, moral vem de lifeState.relations, evolução
   compara com seasonStartSnapshot, e a "personalidade" vem do histórico real
   de entrevistas (computePersonalityProfile) -- nunca um texto fixo.
============================================================================ */

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CURRENT_TIER_LABELS = { serie_d_2026: 'Série D', serie_c_2026: 'Série C', serie_b_2026: 'Série B', serie_a_2026: 'Série A' };

// Rótulo de apresentação pro selo "Rumo à X" — dado, não hardcode espalhado;
// ganhar Série C/B/A no futuro é só adicionar uma entrada aqui. Mantido
// exportado ainda que a Central não use mais o banner (a proximidade do G4
// já aparece no contexto secundário).
const NEXT_TIER_LABELS = { serie_d: 'SÉRIE D', serie_c: 'SÉRIE C', serie_b: 'SÉRIE B', serie_a: 'SÉRIE A' };

function IconBolt({ color }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>;
}
function IconTrend({ color, down }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={down ? { transform: 'scaleY(-1)' } : undefined}><path d="M4 19V9m6 10V4m6 15v-6m6 6V11" /></svg>;
}
function IconArrowUpRight({ color }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 5-5 4 3 8-9" /><path d="M15 6h5v5" /></svg>;
}
function Chip({ children }) {
  return <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: THEME.textSecondary, background: `${THEME.card}99`, borderRadius: 20, padding: '5px 10px' }}>{children}</span>;
}

// Forma recente -- heurística simples sobre resultados que matchHistory já
// produz (últimos 3): nenhum cálculo novo de rating, só leitura de W/D/L.
function describeForma(results) {
  if (!results || results.length === 0) return { label: 'Sem jogos', color: THEME.textFaint, down: false };
  const recent = results.slice(-3);
  const wins = recent.filter(r => r === 'W').length;
  const losses = recent.filter(r => r === 'L').length;
  if (wins > losses) return { label: 'Em alta', color: THEME.steel, down: false };
  if (losses > wins) return { label: 'Em queda', color: THEME.red, down: true };
  return { label: 'Estável', color: THEME.textSecondary, down: false };
}

// Moral -- média das 3 relações já rastreadas pelas entrevistas (coach,
// torcida, mídia). Começa em 50/50/50 (neutro) e só se move por escolha real.
function describeMoral(relations) {
  if (!relations) return { label: '—', color: THEME.textFaint };
  const avg = (relations.coach + relations.crowd + relations.media) / 3;
  if (avg >= 65) return { label: 'Ótima', color: THEME.green };
  if (avg >= 45) return { label: 'Boa', color: THEME.steel };
  if (avg >= 30) return { label: 'Instável', color: THEME.warn };
  return { label: 'Baixa', color: THEME.red };
}

// Ícone por acontecimento -- só decide a apresentação de um texto que já
// existe (log), nunca inventa um dado novo. Sem emoji: traço fino, igual ao
// resto da identidade WPG.
function LogIcon({ text }) {
  const t = text.toLowerCase();
  if (t.includes('gol') || t.includes('vitória') || t.includes('venceu')) return <IconBolt color={THEME.green} />;
  if (t.includes('overall') || t.includes(' ovr')) return <IconArrowUpRight color={THEME.green} />;
  if (t.includes('interesse de clube') || t.includes('observado') || t.includes('chamou a atenção')) {
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={THEME.warn} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /></svg>;
  }
  if (t.includes('entrevista')) return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={THEME.steel} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3H14Z" /></svg>;
  if (t.includes('derrota') || t.includes('perdeu') || t.includes('eliminado')) return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={THEME.red} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m4.9 4.9 14.2 14.2M19.1 4.9 4.9 19.1" /></svg>;
  if (t.includes('desgaste') || t.includes('lesão') || t.includes('lesionou')) return <span style={{ fontSize: 11 }}>🩹</span>;
  return <span style={{ width: 5, height: 5, borderRadius: '50%', background: THEME.textFaint, display: 'inline-block' }} />;
}

function HomeScreen({ player, club, competition, round, totalRounds, fixtures, log, dayType, condition, matchHistory, clubsMap, standings, seasonStartSnapshot, lifeState, interviewHistory, trainPick, onTogglePicker, showPicker, onSelectTrainingActivity, onRest, onSkipTraining, onPlay, onAdvanceRecovery, onOpenFeed, dayIndex, stageDayIndex, seasonYear, stats, economyState }) {
  const [intensity, setIntensity] = useState('equilibrado');
  const nextFixture = fixtures[round] ? fixtures[round].find(([h, a]) => h === club.id || a === club.id) : null;
  const opponentId = nextFixture ? (nextFixture[0] === club.id ? nextFixture[1] : nextFixture[0]) : null;
  const isHome = nextFixture ? nextFixture[0] === club.id : null;
  const conditionColor = condition <= 25 ? THEME.red : condition <= 50 ? THEME.warn : THEME.green;
  const clubForma = historyForCompetition(matchHistory[club.id] || [], competition.id).slice(-5);
  const forma = describeForma(clubForma);
  const moral = describeMoral(lifeState?.relations);
  const isDerby = opponentId ? getMatchContext(club.id, opponentId) === 'derby' : false;

  // Classificação -- posição real na tabela + distância pro corte de acesso,
  // reaproveitando o mesmo sortStandings usado em Mundo. Sem invenção: se a
  // competição não tiver corte de promoção (ex.: liga sem acesso), só mostra
  // a posição.
  const sortedStandings = sortStandings(standings, competition.tiebreakers);
  const myIndex = sortedStandings.findIndex(r => r.club_id === club.id);
  const myPosition = myIndex >= 0 ? myIndex + 1 : null;
  const promotionCount = competition.promotion?.count || 0;
  let standingsLabel = myPosition ? `${myPosition}º lugar` : '—';
  if (myPosition && promotionCount > 0) {
    if (myPosition <= promotionCount) standingsLabel = `${myPosition}º · no G${promotionCount}`;
    else {
      const cutoffPts = sortedStandings[promotionCount - 1]?.pts;
      const diff = cutoffPts != null ? cutoffPts - sortedStandings[myIndex].pts : null;
      standingsLabel = diff != null ? `${myPosition}º · ${diff > 0 ? `-${diff}` : '0'} do G${promotionCount}` : `${myPosition}º lugar`;
    }
  }

  // Evolução -- delta real de overall desde o início da temporada (já
  // existia como seasonStartSnapshot, só nunca tinha sido mostrado).
  const evolutionDelta = seasonStartSnapshot ? Math.round(player.overall - seasonStartSnapshot.overall) : 0;

  // Quando será o próximo jogo -- roundToDay é sempre derivado (nunca
  // persistido), igual ao resto do calendário; stageDayIndex é o contador
  // relativo à fase atual (o mesmo que decide dayType).
  const roundToDay = buildRoundToDay(totalRounds, competition.calendar_pattern);
  const nextMatchDay = roundToDay[round];
  const daysUntilMatch = (opponentId != null && nextMatchDay != null && stageDayIndex != null) ? nextMatchDay - stageDayIndex : null;
  const matchDate = (daysUntilMatch != null && daysUntilMatch >= 0) ? getCalendarDate(competition.family, seasonYear, dayIndex + daysUntilMatch) : null;
  const matchDateShort = matchDate ? `${matchDate.getDate()} ${MONTH_ABBR[matchDate.getMonth()]}` : null;
  let momentLabel = null;
  if (opponentId != null) {
    if (dayType === 'match') momentLabel = 'HOJE';
    else if (daysUntilMatch === 1) momentLabel = 'EM 1 DIA';
    else if (daysUntilMatch > 1) momentLabel = `EM ${daysUntilMatch} DIAS`;
  }

  const detailedLabel = DETAILED_POSITION_MAP[player.detailedPosition]?.label || POSITIONS.find(p => p.id === player.position)?.label || player.position;
  const tierLabel = CURRENT_TIER_LABELS[competition.family] || competition.name;
  const personality = computePersonalityProfile(interviewHistory);

  const opponentPositionIndex = opponentId ? sortedStandings.findIndex(r => r.club_id === opponentId) : -1;

  return (
    <div className="screen-page" style={{ maxWidth: 460 }}>

      {/* IDENTIDADE -- quem sou, sempre visível, sem virar um card à parte */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <ClubMonogram club={club} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: THEME.text, lineHeight: 1.2 }}>{player.name} <span style={{ color: THEME.textFaint, fontWeight: 500 }}>#{player.shirtNumber ?? '—'}</span></div>
          <div style={{ fontSize: 10, color: THEME.textFaint }}>{club.name} · {tierLabel}</div>
        </div>
        <div style={{ background: THEME.cardElevated, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: '4px 9px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 7, color: THEME.textFaint, letterSpacing: 1 }}>OVR</div>
          <div className="display" style={{ fontSize: 15, color: THEME.orange, lineHeight: 1 }}>{Math.round(player.overall)}</div>
        </div>
      </div>

      {/* O MOMENTO -- herói funcional da tela: o próximo compromisso da carreira */}
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: `radial-gradient(ellipse at 28% 22%, ${THEME.accentSoft} 0%, ${THEME.card} 60%, ${THEME.bg} 100%)`, border: `1px solid ${THEME.border}`, marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: `${THEME.cardElevated}99` }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: THEME.orange, boxShadow: `0 0 8px ${THEME.orange}` }} />
          <span style={{ fontSize: 10, letterSpacing: 1.5, color: THEME.orange, textTransform: 'uppercase', fontWeight: 700 }}>{tierLabel} · Rodada {Math.min(round + 1, totalRounds)} de {totalRounds}</span>
        </div>

        {opponentId ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '18px 16px 6px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, flex: 1 }}>
                <ClubMonogram club={isHome ? club : clubsMap[opponentId]} size={42} />
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{isHome ? club.name : clubsMap[opponentId].name}</span>
              </div>
              <span className="display" style={{ fontSize: 15, color: THEME.textFaint }}>VS</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, flex: 1 }}>
                <ClubMonogram club={isHome ? clubsMap[opponentId] : club} size={42} />
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{isHome ? clubsMap[opponentId].name : club.name}</span>
              </div>
            </div>
            {isDerby && <p style={{ textAlign: 'center', fontSize: 10, color: THEME.orange, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', margin: '2px 0 0' }}>Clássico</p>}
            {momentLabel && (
              <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
                <div className="display" style={{ fontSize: 26, color: THEME.orange, lineHeight: 1 }}>{momentLabel}</div>
                {matchDateShort && <div style={{ fontSize: 10, color: THEME.textFaint, marginTop: 5 }}>{matchDateShort} · {isHome ? 'em casa' : 'fora de casa'}</div>}
              </div>
            )}
          </>
        ) : (
          <p style={{ padding: '20px 16px', color: THEME.textSecondary, fontSize: 13, textAlign: 'center' }}>Temporada concluída.</p>
        )}

        <div style={{ padding: '14px 16px 16px' }}>
          {dayType === 'match' && (
            <button onClick={onPlay} disabled={!opponentId} className="display" style={{ width: '100%', padding: '15px 0', fontWeight: 700, fontSize: 14, background: THEME.orange, color: THEME.bg, border: 'none', borderRadius: 12, opacity: opponentId ? 1 : 0.4 }}>
              JOGAR
            </button>
          )}

          {dayType === 'recovery' && (
            <div>
              <p style={{ fontSize: 12, color: THEME.textSecondary, marginBottom: 10 }}>Dia de recuperação física após a partida.</p>
              <button onClick={onAdvanceRecovery} className="display" style={{ width: '100%', padding: '15px 0', fontWeight: 700, fontSize: 14, background: THEME.orange, color: THEME.bg, border: 'none', borderRadius: 12 }}>
                AVANÇAR
              </button>
            </div>
          )}

          {dayType === 'training' && !showPicker && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={onTogglePicker} className="display" style={{ padding: '15px 0', fontWeight: 700, fontSize: 14, background: THEME.orange, color: THEME.bg, border: 'none', borderRadius: 12 }}>
                TREINAR PARA O JOGO
              </button>
              <button onClick={onRest} style={{ padding: '11px 0', fontWeight: 700, fontSize: 13, border: `1px solid ${THEME.orange}`, background: 'transparent', color: THEME.orange, borderRadius: 12 }}>
                DESCANSAR
              </button>
              <button onClick={onSkipTraining} style={{ padding: '10px 0', fontWeight: 600, fontSize: 12, border: `1px solid ${THEME.border}`, background: 'transparent', color: THEME.textFaint, borderRadius: 12 }}>
                Não quero treinar
              </button>
            </div>
          )}

          {dayType === 'training' && showPicker && (
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {TRAINING_INTENSITIES.map(i => (
                  <button key={i.id} onClick={() => setIntensity(i.id)}
                    style={{ flex: 1, padding: '7px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', border: `1px solid ${intensity === i.id ? THEME.orange : THEME.border}`, background: intensity === i.id ? THEME.orange : 'transparent', color: intensity === i.id ? THEME.bg : THEME.textSecondary, borderRadius: 10 }}>
                    {i.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {TRAININGS.map(t => (
                  <button key={t.id} onClick={() => onSelectTrainingActivity(t.id, intensity)}
                    style={{ padding: '10px 0', fontSize: 13, fontWeight: 600, border: `1px solid ${THEME.border}`, background: THEME.card, color: THEME.text, borderRadius: 10 }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONTEXTO SECUNDÁRIO -- existe, mas discreto: chips numa linha, não */}
      {/* uma grade de KPIs. Todo dado aqui já é real (condição, forma, */}
      {/* moral, evolução, classificação, personalidade). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '8px 10px', marginBottom: 16, padding: '0 2px' }}>
        <Chip><IconBolt color={conditionColor} /><b style={{ color: conditionColor, fontFamily: THEME.fontMono }}>{Math.round(condition)}%</b></Chip>
        <Chip><IconTrend color={forma.color} down={forma.down} />{forma.label}</Chip>
        <Chip><span style={{ color: moral.color, fontWeight: 700 }}>●</span> Moral {moral.label}</Chip>
        <Chip><IconArrowUpRight color={evolutionDelta >= 0 ? THEME.green : THEME.red} /><b style={{ color: evolutionDelta >= 0 ? THEME.green : THEME.red, fontFamily: THEME.fontMono }}>{evolutionDelta >= 0 ? '+' : ''}{evolutionDelta}</b></Chip>
        <Chip><b style={{ color: THEME.orange }}>{standingsLabel}</b></Chip>
        {economyState && <Chip>R$ {Math.round(economyState.balance).toLocaleString('pt-BR')}</Chip>}
      </div>
      {personality.dominant && (
        <p style={{ textAlign: 'center', fontSize: 10.5, color: THEME.textFaint, fontStyle: 'italic', margin: '-8px 0 16px' }}>{personality.label}</p>
      )}

      {/* ACONTECIMENTOS -- só os 3 mais recentes; o histórico completo mora */}
      {/* na aba Carreira, que já mostra o log inteiro (evita duplicar tela). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: THEME.textFaint, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Acontecimentos</span>
        {log.length > 0 && (
          <button onClick={onOpenFeed} style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: THEME.orange, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
            VER TODOS <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        )}
      </div>
      <Card style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        {log.length === 0 && <p style={{ fontSize: 13, color: THEME.textSecondary, padding: 14 }}>Nenhum acontecimento ainda.</p>}
        {log.slice(0, 3).map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: i < Math.min(log.length, 3) - 1 ? `1px solid ${THEME.cardElevated}` : 'none' }}>
            <LogIcon text={l} />
            <span style={{ flex: 1, fontSize: 12, color: THEME.textSecondary }}>{l}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}


export { NEXT_TIER_LABELS, HomeScreen };

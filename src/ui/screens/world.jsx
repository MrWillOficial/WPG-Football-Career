import React from 'react';
import { Card, ClubMonogram, FormaDots, THEME } from '../system.jsx';
import { historyForCompetition } from '../../engines/match/matchState.js';
/* ============================================================================
   TELA — Carreira (temporada atual em detalhe)
============================================================================ */

function CareiraScreen({ competition, round, totalRounds, stats, log }) {
  const avgRating = stats.apps ? (stats.ratingSum / stats.apps).toFixed(1) : '-';
  return (
    <div className="screen-page">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 2 }}>
        <p style={{ color: THEME.orange, fontSize: 10, fontWeight: 700, letterSpacing: 1, fontFamily: THEME.fontMono, textTransform: 'uppercase' }}>RODADA {Math.min(round + 1, totalRounds)} DE {totalRounds}</p>
      </div>
      <h1 className="display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, lineHeight: 1.1 }}>{competition.name}</h1>

      {/* Resumo da temporada -- chips numa linha, não 4 cards de KPI */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontSize: 11, color: THEME.textSecondary, background: `${THEME.card}99`, borderRadius: 20, padding: '6px 12px' }}><b style={{ fontFamily: THEME.fontMono, color: THEME.text, fontSize: 15 }}>{stats.apps}</b> jogos</span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontSize: 11, color: THEME.textSecondary, background: `${THEME.card}99`, borderRadius: 20, padding: '6px 12px' }}><b style={{ fontFamily: THEME.fontMono, color: THEME.orange, fontSize: 15 }}>{stats.goals}</b> gols</span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontSize: 11, color: THEME.textSecondary, background: `${THEME.card}99`, borderRadius: 20, padding: '6px 12px' }}><b style={{ fontFamily: THEME.fontMono, color: THEME.text, fontSize: 15 }}>{stats.assists}</b> assist.</span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontSize: 11, color: THEME.textSecondary, background: `${THEME.card}99`, borderRadius: 20, padding: '6px 12px' }}><b style={{ fontFamily: THEME.fontMono, color: THEME.text, fontSize: 15 }}>{avgRating}</b> nota média</span>
      </div>

      <p style={{ fontSize: 10, color: THEME.textFaint, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Histórico de acontecimentos</p>
      <Card style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        {log.length === 0 && <p style={{ fontSize: 12, color: THEME.textSecondary, padding: 14 }}>Nenhum acontecimento ainda.</p>}
        {log.map((l, i) => <p key={i} style={{ fontSize: 12, color: THEME.textSecondary, margin: 0, padding: '10px 14px', borderBottom: i < log.length - 1 ? `1px solid ${THEME.cardElevated}` : 'none' }}>{l}</p>)}
      </Card>
    </div>
  );
}

/* ============================================================================
   TELA — Mundo (tabela com zonas)
============================================================================ */

/* ============================================================================
   MERCADO DE TRANSFERÊNCIAS — notícias de OUTROS clubes, pra dar sensação de
   mundo vivo. Clubes são reais (dados oficiais da CBF); nomes de jogadores
   são fictícios/procedurais — nunca inventamos elenco real de ninguém.
   Volume pequeno de propósito: isso é o "esqueleto" do Jornal/Mural de
   Futebol registrado como visão futura; elenco de verdade (nomes reais por
   clube) é a próxima etapa, maior, discutida à parte.
============================================================================ */
const TRANSFER_NEWS_FIRST_NAMES = ['Lucas', 'Gabriel', 'Matheus', 'Rafael', 'Bruno', 'Thiago', 'Felipe', 'Diego', 'Vitor', 'Caio', 'Igor', 'André', 'Renan', 'Kauê', 'Rodrigo', 'Everton', 'Douglas', 'Wesley', 'Jean', 'Marlon'];
const TRANSFER_NEWS_LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Almeida', 'Ferreira', 'Rodrigues', 'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Barbosa', 'Ribeiro', 'Nascimento', 'Teixeira', 'Correia'];
const TRANSFER_NEWS_TEMPLATES = [
  (player, clubIn, clubOut) => `${player} é anunciado como reforço do ${clubIn}, vindo do ${clubOut}.`,
  (player, clubIn, clubOut) => `${clubIn} acerta a contratação de ${player}, que estava no ${clubOut}.`,
  (player, clubIn) => `${clubIn} anuncia a chegada do meio-campista ${player} para a próxima temporada.`,
  (player, clubIn, clubOut) => `${player} é emprestado pelo ${clubOut} ao ${clubIn} até o fim do ano.`,
  (player, clubIn) => `Promessa da base, ${player} é promovido ao elenco principal do ${clubIn}.`,
];
function generateTransferNewsName() {
  const f = TRANSFER_NEWS_FIRST_NAMES[Math.floor(Math.random() * TRANSFER_NEWS_FIRST_NAMES.length)];
  const l = TRANSFER_NEWS_LAST_NAMES[Math.floor(Math.random() * TRANSFER_NEWS_LAST_NAMES.length)];
  return `${f} ${l}`;
}
// Gera `count` notícias entre clubes da MESMA divisão, nunca envolvendo o
// jogador (isso é sobre o mundo, não sobre a carreira dele).
function generateTransferNews(clubIds, userClubId, clubsMap, count = 4) {
  const pool = clubIds.filter(id => id !== userClubId);
  if (pool.length < 2) return [];
  const news = [];
  for (let i = 0; i < count; i++) {
    const clubInId = pool[Math.floor(Math.random() * pool.length)];
    let clubOutId = pool[Math.floor(Math.random() * pool.length)];
    while (clubOutId === clubInId) clubOutId = pool[Math.floor(Math.random() * pool.length)];
    const clubIn = clubsMap[clubInId]?.name || clubInId;
    const clubOut = clubsMap[clubOutId]?.name || clubOutId;
    const template = TRANSFER_NEWS_TEMPLATES[Math.floor(Math.random() * TRANSFER_NEWS_TEMPLATES.length)];
    news.push({ id: `${Date.now()}_${i}`, text: template(generateTransferNewsName(), clubIn, clubOut) });
  }
  return news;
}

function MundoScreen({ competition, standings, userClubId, matchHistory, clubsMap, transferNews }) {
  const promoCount = competition.promotion.count;
  const relegCount = competition.relegation.count;
  const total = standings.length;
  return (
    <div className="screen-page">
      <h1 className="display" style={{ fontSize: 20, fontWeight: 700, marginTop: 4, marginBottom: 10, lineHeight: 1.1 }}>{competition.name}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) 20px 20px 28px 30px 78px', columnGap: 5, fontSize: 10, color: THEME.textSecondary, fontWeight: 700, padding: '0 8px 6px' }}>
        <span style={{ textAlign: 'center' }}>POS</span><span>CLUBE</span><span style={{ textAlign: 'right' }}>J</span><span style={{ textAlign: 'right' }}>V</span><span style={{ textAlign: 'right' }}>SG</span><span style={{ textAlign: 'right' }}>PTS</span><span style={{ textAlign: 'right' }}>FORMA</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {standings.map((r, i) => {
          const isUser = r.club_id === userClubId;
          const inPromo = i < promoCount;
          const inRelega = relegCount > 0 && i >= total - relegCount;
          const borderColor = inPromo ? THEME.gold : inRelega ? THEME.red : 'transparent';
          const recentForm = historyForCompetition(matchHistory[r.club_id] || [], competition.id).slice(-5);
          return (
            <div key={r.club_id} style={{
              display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) 20px 20px 28px 30px 78px', columnGap: 5, alignItems: 'center',
              padding: '8px', background: isUser ? THEME.cardElevated : THEME.card,
              borderLeft: `3px solid ${borderColor}`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: THEME.textSecondary, textAlign: 'center' }}>{i + 1}</span>
              <span style={{ fontSize: 13, fontWeight: isUser ? 700 : 500, color: isUser ? THEME.gold : THEME.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{clubsMap[r.club_id].name}</span>
              <span style={{ fontSize: 11, textAlign: 'right', color: THEME.textSecondary }}>{r.pj}</span>
              <span style={{ fontSize: 11, textAlign: 'right', color: THEME.textSecondary }}>{r.v}</span>
              <span style={{ fontSize: 11, textAlign: 'right', color: THEME.textSecondary }}>{r.sg}</span>
              <span style={{ fontSize: 13, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.pts}</span>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><FormaDots results={recentForm} size={12} /></div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: THEME.textSecondary, marginTop: 10 }}>Forma: últimos 5 jogos na competição (mais recente à direita).</p>

      <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, background: THEME.gold }} /><span style={{ fontSize: 11, color: THEME.textSecondary }}>Acesso</span></div>
        {relegCount > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, background: THEME.red }} /><span style={{ fontSize: 11, color: THEME.textSecondary }}>Rebaixamento</span></div>}
      </div>

      {transferNews && transferNews.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p style={{ fontSize: 10, color: THEME.textFaint, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Mercado da bola</p>
          <Card style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            {transferNews.map((n, i) => (
              <p key={n.id} style={{ fontSize: 12, color: THEME.text, margin: 0, padding: '10px 14px', borderBottom: i < transferNews.length - 1 ? `1px solid ${THEME.cardElevated}` : 'none' }}>{n.text}</p>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}


export { CareiraScreen, TRANSFER_NEWS_FIRST_NAMES, TRANSFER_NEWS_LAST_NAMES, TRANSFER_NEWS_TEMPLATES, generateTransferNewsName, generateTransferNews, MundoScreen };

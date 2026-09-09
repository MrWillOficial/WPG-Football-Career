import React from 'react';
import { AttrBar, Card, ClubMonogram, FormaDots, THEME } from '../system.jsx';
import { historyForCompetition } from '../../engines/match/matchState.js';
import { INVESTMENT_AMOUNTS, INVESTMENT_SEASONAL_RETURN, PROPERTY_OPTIONS, computeNetWorth } from '../../engines/economy/contractsEconomy.js';
import { ATTR_LABELS, POSITIONS } from '../../engines/player/playerEngine.js';
/* ============================================================================
   TELA — Carreira (temporada atual em detalhe)
============================================================================ */

function CareiraScreen({ competition, round, totalRounds, stats, log }) {
  const avgRating = stats.apps ? (stats.ratingSum / stats.apps).toFixed(1) : '-';
  return (
    <div className="screen-page">
      <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>TEMPORADA ATUAL</p>
      <h1 className="display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 14 }}>{competition.name}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <Card elevated><p style={{ fontSize: 11, color: THEME.textSecondary }}>Jogos</p><p className="display" style={{ fontSize: 28, fontWeight: 700, color: THEME.gold }}>{stats.apps}</p></Card>
        <Card elevated><p style={{ fontSize: 11, color: THEME.textSecondary }}>Gols</p><p className="display" style={{ fontSize: 28, fontWeight: 700, color: THEME.gold }}>{stats.goals}</p></Card>
        <Card elevated><p style={{ fontSize: 11, color: THEME.textSecondary }}>Assistências</p><p className="display" style={{ fontSize: 28, fontWeight: 700, color: THEME.gold }}>{stats.assists}</p></Card>
        <Card elevated><p style={{ fontSize: 11, color: THEME.textSecondary }}>Nota média</p><p className="display" style={{ fontSize: 28, fontWeight: 700, color: THEME.gold }}>{avgRating}</p></Card>
      </div>

      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>RODADA {Math.min(round + 1, totalRounds)} DE {totalRounds}</p>
      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, margin: '18px 0 8px' }}>HISTÓRICO DE ACONTECIMENTOS</p>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {log.length === 0 && <p style={{ fontSize: 13, color: THEME.textSecondary }}>Nenhum acontecimento ainda.</p>}
        {log.map((l, i) => <p key={i} style={{ fontSize: 13, color: THEME.textSecondary }}>• {l}</p>)}
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
      <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>MUNDO</p>
      <h1 className="display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 14 }}>{competition.name}</h1>

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
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>💰 MERCADO DA BOLA</p>
          {transferNews.map(n => (
            <Card key={n.id} style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, color: THEME.text }}>{n.text}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   TELA — Você (perfil)
============================================================================ */

function VoceScreen({ player, club, lifeState, economyState, onReset, onRequestTransfer, onRequestLoan, onInvest, onWithdrawInvestments, onBuyProperty }) {
  const netWorth = computeNetWorth(economyState);
  return (
    <div className="screen-page">
      <p style={{ color: THEME.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>PERFIL</p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '18px 0 22px' }}>
        <ClubMonogram club={club} size={72} />
        <h1 className="display" style={{ fontSize: 28, fontWeight: 700, marginTop: 12 }}>{player.name}</h1>
        <p style={{ color: THEME.textSecondary, fontSize: 13 }}>{POSITIONS.find(p => p.id === player.position)?.label}</p>
        <p className="display" style={{ fontSize: 56, fontWeight: 700, color: THEME.gold, lineHeight: 1, marginTop: 8 }}>{player.overall}</p>
        <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 1 }}>OVERALL</p>
      </div>

      <Card style={{ marginBottom: 14 }}>
        {Object.entries(player.attrs).map(([k, v]) => <AttrBar key={k} label={ATTR_LABELS[k]} value={v} potential={player.potential?.[k]} />)}
      </Card>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Card elevated style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 11, color: THEME.textSecondary }}>Idade</p><p className="display" style={{ fontSize: 22, fontWeight: 700 }}>{player.age}</p></Card>
        <Card elevated style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 11, color: THEME.textSecondary }}>Reputação</p><p className="display" style={{ fontSize: 22, fontWeight: 700 }}>{player.reputation}</p></Card>
      </div>

      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>CONTRATO</p>
      <Card style={{ marginBottom: 14 }}>
        {player.contract ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: THEME.textSecondary }}>Salário mensal</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>R$ {player.contract.salary.toLocaleString('pt-BR')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: THEME.textSecondary }}>Vencimento</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{player.contract.expiresSeason}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: THEME.textSecondary }}>Saldo em conta</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: THEME.gold }}>R$ {economyState.balance.toLocaleString('pt-BR')}</span>
            </div>
            {player.loan && <p style={{ fontSize: 12, color: THEME.textSecondary, marginTop: 8 }}>Emprestado — retorna ao clube de origem em {player.loan.returnSeason}.</p>}
          </>
        ) : <p style={{ fontSize: 13, color: THEME.textSecondary }}>Sem contrato ativo.</p>}
      </Card>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={onRequestTransfer} disabled={!!player.wantsTransfer} style={{ flex: 1, padding: '11px 0', fontSize: 12, fontWeight: 700, border: `1px solid ${THEME.gold}`, background: 'transparent', color: THEME.gold, opacity: player.wantsTransfer ? 0.4 : 1 }}>
          {player.wantsTransfer ? 'PEDIDO FEITO' : 'PEDIR TRANSFERÊNCIA'}
        </button>
        <button onClick={onRequestLoan} disabled={!!player.wantsLoan} style={{ flex: 1, padding: '11px 0', fontSize: 12, fontWeight: 700, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: THEME.textSecondary, opacity: player.wantsLoan ? 0.4 : 1 }}>
          {player.wantsLoan ? 'PEDIDO FEITO' : 'PEDIR EMPRÉSTIMO'}
        </button>
      </div>

      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>VIDA FINANCEIRA</p>
      <Card elevated style={{ marginBottom: 10, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: THEME.textSecondary }}>Patrimônio líquido</p>
        <p className="display" style={{ fontSize: 26, fontWeight: 700, color: THEME.gold }}>R$ {netWorth.toLocaleString('pt-BR')}</p>
        <p style={{ fontSize: 11, color: THEME.textSecondary, marginTop: 2 }}>conta + investimentos + imóveis</p>
      </Card>
      <Card style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: THEME.textSecondary }}>Investido (rende {Math.round(INVESTMENT_SEASONAL_RETURN * 100)}%/temporada)</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>R$ {economyState.investments.toLocaleString('pt-BR')}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: economyState.investments > 0 ? 8 : 0 }}>
          {INVESTMENT_AMOUNTS.map(amount => (
            <button key={amount} onClick={() => onInvest(amount)} disabled={amount > economyState.balance}
              style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: amount > economyState.balance ? THEME.textSecondary : THEME.gold, opacity: amount > economyState.balance ? 0.4 : 1 }}>
              +R$ {(amount / 1000)}mil
            </button>
          ))}
        </div>
        {economyState.investments > 0 && (
          <button onClick={onWithdrawInvestments} style={{ width: '100%', padding: '8px 0', fontSize: 11, fontWeight: 700, border: 'none', background: 'transparent', color: THEME.textSecondary, textDecoration: 'underline' }}>
            Sacar tudo (R$ {economyState.investments.toLocaleString('pt-BR')})
          </button>
        )}
      </Card>
      <Card style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 8 }}>Imóveis {economyState.properties.length > 0 ? `(${economyState.properties.length})` : ''}</p>
        {economyState.properties.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12 }}>{p.name}</span>
            <span style={{ fontSize: 12, color: THEME.textSecondary }}>manutenção R$ {p.upkeep.toLocaleString('pt-BR')}/temp.</span>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: economyState.properties.length > 0 ? 10 : 0 }}>
          {PROPERTY_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => onBuyProperty(opt.id)} disabled={opt.cost > economyState.balance}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 10px', fontSize: 12, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: opt.cost > economyState.balance ? THEME.textSecondary : THEME.text, opacity: opt.cost > economyState.balance ? 0.4 : 1 }}>
              <span>{opt.name}</span>
              <span style={{ fontWeight: 700 }}>R$ {opt.cost.toLocaleString('pt-BR')}</span>
            </button>
          ))}
        </div>
      </Card>

      <p style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>VIDA FORA DE CAMPO</p>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: THEME.textSecondary }}>Fãs</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: THEME.gold }}>{lifeState.fans}</span>
        </div>
        <AttrBar label="Treinador" value={lifeState.relations.coach} />
        <AttrBar label="Torcida" value={lifeState.relations.crowd} />
        <AttrBar label="Mídia" value={lifeState.relations.media} />
      </Card>

      <button onClick={onReset} style={{ width: '100%', padding: '10px 0', background: 'transparent', border: 'none', color: THEME.textSecondary, fontSize: 12 }}>
        Reiniciar carreira
      </button>
    </div>
  );
}


export { CareiraScreen, TRANSFER_NEWS_FIRST_NAMES, TRANSFER_NEWS_LAST_NAMES, TRANSFER_NEWS_TEMPLATES, generateTransferNewsName, generateTransferNews, MundoScreen, VoceScreen };

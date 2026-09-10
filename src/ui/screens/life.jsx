import React, { useMemo, useState } from 'react';
import { AttrBar, Badge, Card, ClubMonogram, THEME } from '../system.jsx';
import { SOCIAL_TONES } from '../../engines/life/socialEngine.js';
import { ATTR_LABELS } from '../../engines/player/playerEngine.js';
import { computeBuyoutClause, computeNetWorth, INVESTMENT_AMOUNTS, INVESTMENT_SEASONAL_RETURN, PROPERTY_OPTIONS } from '../../engines/economy/contractsEconomy.js';
import { computePersonalityProfile, POSTURE_LABELS } from '../../engines/life/lifeCalendarFitness.jsx';
import { isShirtNumberAvailable } from '../../data/players/shirtNumbers.js';

const POSTURE_ICONS = { agressivo: '🔥', confiante: '💪', sossegado: '🧘', desleixado: '😅' };
const POSTURE_ORDER = ['agressivo', 'confiante', 'sossegado', 'desleixado'];

// Configurável pelo jogador -- considera os números já ocupados no elenco do
// clube atual (hoje sempre nenhum, ver shirtNumbers.js). Uma vez escolhido,
// vira só exibição; trocar depois é regra de clube/temporada, fora de escopo.
function ShirtNumberPicker({ club, onChoose }) {
  const [value, setValue] = useState('');
  const parsed = value === '' ? null : Number(value);
  const available = parsed != null && isShirtNumberAvailable(club, parsed);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <input type="number" min={1} max={99} value={value} onChange={e => setValue(e.target.value)} placeholder="Nº"
        style={{ width: 48, padding: '4px 6px', fontSize: 12, background: THEME.cardElevated, border: `1px solid ${THEME.border}`, color: THEME.text, borderRadius: 6 }} />
      <button disabled={!available} onClick={() => { onChoose(parsed); setValue(''); }}
        style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, background: available ? THEME.orange : THEME.cardElevated, color: available ? THEME.bg : THEME.textFaint, border: 'none', borderRadius: 6 }}>
        Confirmar
      </button>
      {parsed != null && !available && <span style={{ fontSize: 10, color: THEME.red }}>Ocupado</span>}
    </div>
  );
}

function Metric({ label, value, tone = THEME.green }) {
  return <div style={{ marginBottom: 9 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: THEME.textSecondary, marginBottom: 4 }}><span>{label}</span><b style={{ color: THEME.text }}>{Math.round(value)}</b></div><div style={{ height: 5, background: THEME.cardElevated }}><div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: tone }} /></div></div>;
}

function LifeScreen({ player, club, socialState, socialPosts, onPublish, onComment, interviewHistory, onChooseShirtNumber }) {
  const [commentTarget, setCommentTarget] = useState(null);
  const [selectedTone, setSelectedTone] = useState(null);
  const [section, setSection] = useState('overview');
  const posts = socialPosts || [];
  const tones = useMemo(() => SOCIAL_TONES, []);
  const context = posts[0]?.context || 'Aconteceu algo no seu mundo. Essa é sua chance de se manifestar.';
  const history = interviewHistory || [];
  const personality = useMemo(() => computePersonalityProfile(history), [history]);

  const publish = (tone) => { onPublish(tone.id, { context }); };
  const comment = (tone) => {
    if (!commentTarget) return;
    onComment(commentTarget, tone.id, { context: `Comentário em ${commentTarget.authorName}` });
    setCommentTarget(null); setSelectedTone(null);
  };

  return <div className="screen-page life-page">
    <div className="life-player-banner">
      <div className="life-player-art" aria-hidden="true"><span>{player.name?.slice(0, 1) || 'W'}</span></div>
      <div className="life-player-main">
        <div className="wpg-kicker">LIFE · SUA VOZ · SUA HISTÓRIA</div>
        <h1 className="display life-name">{player.name} <span>#{player.shirtNumber ?? '—'}</span></h1>
        <div className="life-meta">{player.position} · {club?.name || 'Clube'} · Camisa {player.shirtNumber ?? 'pendente'}</div>
        <div className="life-quote">“Sua atitude fora de campo também constrói sua carreira.”</div>
      </div>
      <div className="life-stats"><div><b>{(socialState.followers || 0).toLocaleString('pt-BR')}</b><span>Seguidores</span></div><div><b>{socialState.reputation}</b><span>Reputação</span></div><div><b>{socialState.popularity}</b><span>Popularidade</span></div></div>
    </div>

    <div className="life-tabs">
      {[['overview','Visão Geral'],['network','Minha Rede'],['posts','Publicações'],['media','Entrevistas'],['image','Minha Imagem'],['relations','Relacionamentos']].map(([id,label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>{label}</button>)}
    </div>

    {section === 'media' ? (
      <div className="life-grid">
        <main className="life-feed" style={{ gridColumn: '1 / -1' }}>
          <Card>
            <div className="wpg-section-label">PERSONALIDADE NA IMPRENSA</div>
            <p className="life-context" style={{ marginBottom: personality.total > 0 ? 10 : 0 }}>
              {personality.dominant
                ? <>Seu perfil predominante nas entrevistas até agora: <b style={{ color: THEME.gold }}>{personality.label}</b>.</>
                : <>{personality.label}{personality.total > 0 ? ` (${personality.total} entrevista${personality.total === 1 ? '' : 's'} até agora).` : '.'}</>}
            </p>
            {personality.total > 0 && (
              <div className="life-tone-grid compact">
                {POSTURE_ORDER.map(p => (
                  <div key={p} className="life-tone" style={{ cursor: 'default', borderColor: personality.dominant === p ? THEME.gold : undefined }}>
                    <span>{POSTURE_ICONS[p]}</span><b>{POSTURE_LABELS[p]}</b><small>{personality.counts[p]}x</small>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card style={{ marginTop: 10 }}>
            <div className="wpg-section-label">HISTÓRICO DE ENTREVISTAS</div>
            {history.length === 0
              ? <div className="life-empty">Nenhuma entrevista ainda — sua primeira aparição na imprensa vai aparecer aqui.</div>
              : history.slice().reverse().map((h, i) => (
                <p key={i} className="life-small" style={{ borderBottom: i < history.length - 1 ? `1px solid ${THEME.border}` : 'none', paddingBottom: 6, marginBottom: 6 }}>
                  <b style={{ color: THEME.gold }}>{h.year}</b> · rodada {h.round} — resposta <b>{POSTURE_LABELS[h.posture] || h.posture}</b>
                </p>
              ))}
          </Card>
        </main>
      </div>
    ) : (
      <div className="life-grid">
        <aside className="life-left">
          <Card><div className="wpg-section-label">Minha imagem</div><div className="life-reputation-ring" style={{ '--pct': socialState.reputation }}><b className="mono">{socialState.reputation}<small>REPUTAÇÃO</small></b></div><Metric label="Torcida" value={socialState.relationships.crowd} /><Metric label="Treinador" value={socialState.relationships.coach} /><Metric label="Vestiário" value={socialState.relationships.dressingRoom} /><Metric label="Mídia" value={socialState.relationships.media} /><Metric label="Diretoria" value={socialState.relationships.board} tone={THEME.gold} /></Card>
          <Card>
            <div className="wpg-section-label">Identidade</div>
            {player.shirtNumber != null
              ? <p className="life-small">Camisa: <b>{player.shirtNumber}</b></p>
              : <div className="life-small">Camisa: <b>a escolher</b>{onChooseShirtNumber && <ShirtNumberPicker club={club} onChoose={onChooseShirtNumber} />}</div>}
            <p className="life-small">Seguidores: <b>{(socialState.followers || 0).toLocaleString('pt-BR')}</b></p>
            <p className="life-small">Polêmica: <b>{socialState.controversy}</b></p>
            <p className="life-small">Respeito: <b>{socialState.respect}</b></p>
          </Card>
        </aside>

        <main className="life-feed">
          <Card><div className="life-feed-title"><div><h2 className="display">FEED</h2><span>ACONTECEU NO SEU MUNDO</span></div><Badge tone="gold">AO VIVO</Badge></div>
            {posts.length === 0 ? <div className="life-empty">Ainda não há publicações relevantes. Seu primeiro acontecimento vai aparecer aqui.</div> : posts.slice(0, 6).map(post => <article key={post.id} className="life-post"><div className="life-post-head"><ClubMonogram club={{ name: post.authorName, color: '#242424', branding: { type: 'monogram', text: post.authorName.slice(0,2).toUpperCase() } }} size={34} /><div><b>{post.authorName}</b><span>@{post.authorName.toLowerCase().replace(/\s+/g,'_')} · agora</span></div><button>•••</button></div><p>{post.text}</p><div className="life-post-actions"><span>♡ {post.reactions?.likes || 0}</span><span>↻ {post.reactions?.reposts || 0}</span><span>💬 {post.reactions?.comments || 0}</span><button onClick={() => setCommentTarget(post)}>Comentar</button></div></article>)}
          </Card>
          {commentTarget && <Card style={{ marginTop: 10, borderColor: THEME.orange }}><div className="wpg-section-label">COMENTAR EM {commentTarget.authorName.toUpperCase()}</div><div className="life-tone-grid compact">{tones.map(t => <button key={t.id} onClick={() => { setSelectedTone(t.id); comment(t); }} className="life-tone"><span>{t.icon}</span><b>{t.label}</b><small>{t.text}</small></button>)}</div></Card>}
        </main>

        <aside className="life-right">
          <Card style={{ borderColor: THEME.orange }}><div className="wpg-section-label">O QUE VOCÊ QUER FAZER?</div><p className="life-context">{context}</p><div className="life-tone-grid">{tones.map(t => <button key={t.id} onClick={() => publish(t)} className="life-tone"><span>{t.icon}</span><b>{t.label}</b><small>“{t.text}”</small></button>)}</div></Card>
          <Card><div className="wpg-section-label">TENDÊNCIAS DO DIA</div>{['Seu clube','Você','Brasileirão','Mercado da Bola','Clássico da rodada'].map((x,i)=><div key={x} className="life-trend"><b>{i+1}</b><span>{x}</span><small>{Math.max(12, socialState.engagement + (5-i)*7)} mil posts</small></div>)}</Card>
          <Card><div className="wpg-section-label">ÚLTIMAS NOTÍCIAS</div>{posts.slice(0,3).map(p => <div key={p.id} className="life-news"><b>WPG</b><span>{p.text}</span></div>)}</Card>
        </aside>
      </div>
    )}
  </div>;
}

const PROFILE_TABS = [['overview', 'Visão Geral'], ['atributos', 'Atributos'], ['contrato', 'Contrato'], ['financas', 'Finanças'], ['estatisticas', 'Estatísticas'], ['noticias', 'Notícias']];
// salaryStatus nunca é 'oficial de verdade' pra jogadores criados na carreira —
// só existe pra deixar claro, em toda tela que mostra o valor, que é uma
// estimativa do motor econômico, nunca um número pesquisado/confirmado.
const SALARY_STATUS_LABELS = { official: 'Oficial', estimated_pending_official: 'Estimado (pendente oficial)' };

function PlayerProfileScreen({ player, club, socialState, stats, log, transferNews, seasonYear, lifeState, economyState, onRequestTransfer, onRequestLoan, onInvest, onWithdrawInvestments, onBuyProperty, onReset }) {
  const [tab, setTab] = useState('overview');
  const attrs = Object.entries(player.attrs || {});
  const apps = stats?.apps || 0;
  const avgRating = apps > 0 ? (stats.ratingSum / apps).toFixed(1) : '—';
  const buyout = player.contract ? computeBuyoutClause(player.contract, player, seasonYear) : null;
  const netWorth = economyState ? computeNetWorth(economyState) : 0;

  return <div className="screen-page profile-page">
    <div className="profile-hero"><div className="profile-avatar"><span>{player.name?.slice(0,1) || 'W'}</span></div><div className="profile-main"><div className="wpg-kicker">CARREIRA › PERFIL</div><h1 className="display profile-name">{player.name} <span>#{player.shirtNumber ?? '—'}</span></h1><p>{player.detailedPosition || player.position} · {club?.name || 'Sem clube'} · {player.age} anos</p><div className="profile-meta"><span>Camisa <b>{player.shirtNumber ?? 'pendente oficial'}</b></span><span>Potencial <b>{player.potential ? `${Math.round(Math.min(...Object.values(player.potential)))}–${Math.round(Math.max(...Object.values(player.potential)))}` : '—'}</b></span></div></div><div className="profile-side"><div className="ovr-ring" style={{ '--pct': (player.overall / 99) * 100 }}><b>{Math.round(player.overall)}<span>OVERALL</span></b></div></div></div>

    <div className="life-tabs">
      {PROFILE_TABS.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
    </div>

    {tab === 'overview' && (
      <div className="profile-grid">
        <Card><div className="wpg-section-label">INFORMAÇÕES DO JOGADOR</div><p className="profile-row">Idade <b>{player.age}</b></p><p className="profile-row">Posição <b>{player.detailedPosition || player.position}</b></p><p className="profile-row">Arquétipo <b>{player.archetype || 'Pendente'}</b></p><p className="profile-row">Reputação <b>{socialState?.reputation ?? player.reputation ?? 0}</b></p></Card>
        <Card><div className="wpg-section-label">POSIÇÃO E FUNÇÃO</div><div className="profile-pitch"><span>{player.detailedPosition || player.position}</span></div><p className="life-small">Função: <b>{player.functions?.join(', ') || 'Pendente'}</b></p><p className="life-small">Especialização: <b>{player.specialization || 'Pendente'}</b></p></Card>
        <Card><div className="wpg-section-label">SITUAÇÃO CONTRATUAL</div>{player.contract ? <><p className="profile-row">Clube <b>{club?.name || player.contract.clubId}</b></p><p className="profile-row">Expira <b>{player.contract.expiresSeason}</b></p></> : <p className="life-small">Sem contrato profissional — jogador da base.</p>}<p className="profile-row">Status salarial <b>{SALARY_STATUS_LABELS[player.salaryStatus] || player.salaryStatus || '—'}</b></p></Card>
        <Card style={{ gridColumn: '1 / -1' }}><div className="wpg-section-label">REGISTROS RECENTES</div>{(log || []).length === 0 ? <div className="life-empty">Nada ainda — os acontecimentos da sua carreira aparecem aqui.</div> : (log || []).slice(0, 5).map((entry, i) => <p key={i} className="life-small" style={{ borderBottom: i < 4 ? `1px solid ${THEME.border}` : 'none', paddingBottom: 6, marginBottom: 6 }}>{entry}</p>)}</Card>
      </div>
    )}

    {tab === 'atributos' && (
      <Card>
        <div className="wpg-section-label">ATRIBUTOS</div>
        {attrs.length === 0 ? <div className="life-empty">Sem atributos registrados.</div> : attrs.map(([k, v]) => (
          <AttrBar key={k} label={ATTR_LABELS[k] || k} value={v} potential={player.potential?.[k]} />
        ))}
      </Card>
    )}

    {tab === 'contrato' && (
      <Card>
        <div className="wpg-section-label">CONTRATO</div>
        {player.contract ? <>
          <p className="profile-row">Clube <b>{club?.name || player.contract.clubId}</b></p>
          <p className="profile-row">Salário mensal <b>R$ {player.contract.salary.toLocaleString('pt-BR')} <span style={{ color: THEME.textSecondary, fontWeight: 400 }}>({SALARY_STATUS_LABELS[player.salaryStatus] || 'pendente oficial'})</span></b></p>
          <p className="profile-row">Temporada de assinatura <b>{player.contract.signedSeason}</b></p>
          <p className="profile-row">Duração <b>{player.contract.durationSeasons} temporada(s)</b></p>
          <p className="profile-row">Expira em <b>{player.contract.expiresSeason}</b></p>
          <p className="profile-row">Multa rescisória (estimada) <b>R$ {buyout?.toLocaleString('pt-BR')}</b></p>
        </> : <div className="life-empty">Ainda sem contrato profissional — jogador da base, sem clube registrado formalmente.</div>}
        {player.loan && <p className="life-small" style={{ marginTop: 10 }}>Empréstimo ativo: <b>{player.loan.toClubId}</b></p>}
        {(onRequestTransfer || onRequestLoan) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {onRequestTransfer && <button onClick={onRequestTransfer} disabled={!!player.wantsTransfer} style={{ flex: 1, padding: '11px 0', fontSize: 12, fontWeight: 700, border: `1px solid ${THEME.gold}`, background: 'transparent', color: THEME.gold, opacity: player.wantsTransfer ? 0.4 : 1 }}>
              {player.wantsTransfer ? 'PEDIDO FEITO' : 'PEDIR TRANSFERÊNCIA'}
            </button>}
            {onRequestLoan && <button onClick={onRequestLoan} disabled={!!player.wantsLoan} style={{ flex: 1, padding: '11px 0', fontSize: 12, fontWeight: 700, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: THEME.textSecondary, opacity: player.wantsLoan ? 0.4 : 1 }}>
              {player.wantsLoan ? 'PEDIDO FEITO' : 'PEDIR EMPRÉSTIMO'}
            </button>}
          </div>
        )}
      </Card>
    )}

    {tab === 'financas' && economyState && (
      <>
        <Card elevated style={{ marginBottom: 10, textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: THEME.textSecondary }}>Patrimônio líquido</p>
          <p className="display" style={{ fontSize: 26, fontWeight: 700, color: THEME.gold }}>R$ {netWorth.toLocaleString('pt-BR')}</p>
          <p style={{ fontSize: 11, color: THEME.textSecondary, marginTop: 2 }}>conta + investimentos + imóveis</p>
        </Card>
        <Card style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: THEME.textSecondary }}>Saldo em conta</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: THEME.gold }}>R$ {economyState.balance.toLocaleString('pt-BR')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: THEME.textSecondary }}>Investido (rende {Math.round(INVESTMENT_SEASONAL_RETURN * 100)}%/temporada)</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>R$ {economyState.investments.toLocaleString('pt-BR')}</span>
          </div>
          {onInvest && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, marginBottom: economyState.investments > 0 ? 8 : 0 }}>
              {INVESTMENT_AMOUNTS.map(amount => (
                <button key={amount} onClick={() => onInvest(amount)} disabled={amount > economyState.balance}
                  style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: amount > economyState.balance ? THEME.textSecondary : THEME.gold, opacity: amount > economyState.balance ? 0.4 : 1 }}>
                  +R$ {(amount / 1000)}mil
                </button>
              ))}
            </div>
          )}
          {onWithdrawInvestments && economyState.investments > 0 && (
            <button onClick={onWithdrawInvestments} style={{ width: '100%', padding: '8px 0', fontSize: 11, fontWeight: 700, border: 'none', background: 'transparent', color: THEME.textSecondary, textDecoration: 'underline' }}>
              Sacar tudo (R$ {economyState.investments.toLocaleString('pt-BR')})
            </button>
          )}
        </Card>
        <Card style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 8 }}>Imóveis {economyState.properties.length > 0 ? `(${economyState.properties.length})` : ''}</p>
          {economyState.properties.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12 }}>{p.name}</span>
              <span style={{ fontSize: 12, color: THEME.textSecondary }}>manutenção R$ {p.upkeep.toLocaleString('pt-BR')}/temp.</span>
            </div>
          ))}
          {onBuyProperty && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: economyState.properties.length > 0 ? 10 : 0 }}>
              {PROPERTY_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => onBuyProperty(opt.id)} disabled={opt.cost > economyState.balance}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 10px', fontSize: 12, border: `1px solid ${THEME.cardElevated}`, background: 'transparent', color: opt.cost > economyState.balance ? THEME.textSecondary : THEME.text, opacity: opt.cost > economyState.balance ? 0.4 : 1 }}>
                  <span>{opt.name}</span>
                  <span style={{ fontWeight: 700 }}>R$ {opt.cost.toLocaleString('pt-BR')}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
        {lifeState && (
          <Card style={{ marginBottom: 10 }}>
            <div className="wpg-section-label">VIDA FORA DE CAMPO</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: THEME.textSecondary }}>Fãs</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: THEME.gold }}>{lifeState.fans}</span>
            </div>
            <AttrBar label="Treinador" value={lifeState.relations.coach} />
            <AttrBar label="Torcida" value={lifeState.relations.crowd} />
            <AttrBar label="Mídia" value={lifeState.relations.media} />
          </Card>
        )}
        {onReset && (
          <button onClick={onReset} style={{ width: '100%', padding: '10px 0', background: 'transparent', border: 'none', color: THEME.textSecondary, fontSize: 12 }}>
            Reiniciar carreira
          </button>
        )}
      </>
    )}

    {tab === 'estatisticas' && (
      <Card>
        <div className="wpg-section-label">ESTATÍSTICAS DA TEMPORADA</div>
        <div className="profile-grid" style={{ marginTop: 0 }}>
          <div className="life-stats" style={{ border: `1px solid ${THEME.border}` }}><div><b>{apps}</b><span>Jogos</span></div><div><b>{stats?.goals || 0}</b><span>Gols</span></div><div><b>{stats?.assists || 0}</b><span>Assist.</span></div></div>
        </div>
        <p className="profile-row" style={{ marginTop: 10 }}>Nota média <b>{avgRating}</b></p>
      </Card>
    )}

    {tab === 'noticias' && (
      <Card>
        <div className="wpg-section-label">NOTÍCIAS DO MERCADO</div>
        {(transferNews || []).length === 0 ? <div className="life-empty">Nenhuma notícia no momento.</div> : (transferNews || []).map(n => <div key={n.id} className="life-news"><b>WPG</b><span>{n.text}</span></div>)}
      </Card>
    )}
  </div>;
}

export { LifeScreen, PlayerProfileScreen };

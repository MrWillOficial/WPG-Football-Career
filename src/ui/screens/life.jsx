import React, { useMemo, useState } from 'react';
import { Badge, Card, ClubMonogram, THEME } from '../system.jsx';
import { SOCIAL_TONES } from '../../engines/life/socialEngine.js';

function Metric({ label, value, tone = THEME.green }) {
  return <div style={{ marginBottom: 9 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: THEME.textSecondary, marginBottom: 4 }}><span>{label}</span><b style={{ color: THEME.text }}>{Math.round(value)}</b></div><div style={{ height: 5, background: THEME.cardElevated }}><div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: tone }} /></div></div>;
}

function LifeScreen({ player, club, socialState, socialPosts, onPublish, onComment }) {
  const [commentTarget, setCommentTarget] = useState(null);
  const [selectedTone, setSelectedTone] = useState(null);
  const [section, setSection] = useState('overview');
  const posts = socialPosts || [];
  const tones = useMemo(() => SOCIAL_TONES, []);
  const context = posts[0]?.context || 'Aconteceu algo no seu mundo. Essa é sua chance de se manifestar.';

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

    <div className="life-grid">
      <aside className="life-left">
        <Card><div className="wpg-section-label">Minha imagem</div><div className="life-reputation-ring">{socialState.reputation}<small>REPUTAÇÃO</small></div><Metric label="Torcida" value={socialState.relationships.crowd} /><Metric label="Treinador" value={socialState.relationships.coach} /><Metric label="Vestiário" value={socialState.relationships.dressingRoom} /><Metric label="Mídia" value={socialState.relationships.media} /><Metric label="Diretoria" value={socialState.relationships.board} tone={THEME.gold} /></Card>
        <Card><div className="wpg-section-label">Identidade</div><p className="life-small">Camisa: <b>{player.shirtNumber ?? 'Pendente oficial'}</b></p><p className="life-small">Seguidores: <b>{(socialState.followers || 0).toLocaleString('pt-BR')}</b></p><p className="life-small">Polêmica: <b>{socialState.controversy}</b></p><p className="life-small">Respeito: <b>{socialState.respect}</b></p></Card>
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
  </div>;
}

function PlayerProfileScreen({ player, club, socialState }) {
  const attrs = Object.entries(player.attrs || {});
  return <div className="screen-page profile-page">
    <div className="profile-hero"><div className="profile-avatar"><span>{player.name?.slice(0,1) || 'W'}</span></div><div className="profile-main"><div className="wpg-kicker">CARREIRA › PERFIL</div><h1 className="display profile-name">{player.name} <span>#{player.shirtNumber ?? '—'}</span></h1><p>{player.position} · {club?.name || 'Sem clube'} · {player.age} anos</p><div className="profile-meta"><span>Camisa <b>{player.shirtNumber ?? 'pendente oficial'}</b></span><span>OVR <b>{Math.round(player.overall)}</b></span><span>Potencial <b>{player.potential ? `${Math.round(Math.min(...Object.values(player.potential)))}–${Math.round(Math.max(...Object.values(player.potential)))}` : '—'}</b></span></div></div><div className="profile-side"><div className="ovr-ring"><b>{Math.round(player.overall)}</b><span>OVR</span></div></div></div>
    <div className="profile-grid"><Card><div className="wpg-section-label">INFORMAÇÕES DO JOGADOR</div><p className="profile-row">Idade <b>{player.age}</b></p><p className="profile-row">Posição <b>{player.detailedPosition || player.position}</b></p><p className="profile-row">Arquétipo <b>{player.archetype || 'Pendente'}</b></p><p className="profile-row">Reputação <b>{socialState?.reputation ?? player.reputation ?? 0}</b></p></Card><Card><div className="wpg-section-label">POSIÇÃO E FUNÇÃO</div><div className="profile-pitch"><span>{player.detailedPosition || player.position}</span></div><p className="life-small">Função: <b>{player.functions?.join(', ') || 'Pendente'}</b></p><p className="life-small">Especialização: <b>{player.specialization || 'Pendente'}</b></p></Card><Card><div className="wpg-section-label">ATRIBUTOS</div>{attrs.map(([k,v]) => <div key={k} className="profile-attr"><span>{k}</span><div><i style={{width:`${Math.max(0,Math.min(100,v))}%`}} /></div><b>{Math.round(v)}</b></div>)}</Card></div>
  </div>;
}

export { LifeScreen, PlayerProfileScreen };

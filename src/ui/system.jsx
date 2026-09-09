import React from 'react';
/* ============================================================================
   DESIGN SYSTEM — tokens + componentes base (Direção Visual V2)
============================================================================ */

const THEME = {
  bg: '#080808',
  panel: '#101010',
  card: '#141414',
  cardElevated: '#1A1A1A',
  orange: '#FF6A00',
  gold: '#FF6A00',
  green: '#36C275',
  text: '#F5F5F5',
  textSecondary: '#929292',
  red: '#E05252',
  border: '#292929',
  fontDisplay: "'Barlow Condensed', sans-serif",
  fontBody: "'Inter', sans-serif",
};

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      html, body, #root { margin: 0; min-height: 100%; background: ${THEME.bg}; }
      body { background: ${THEME.bg}; }
      .display { font-family: ${THEME.fontDisplay}; letter-spacing: -0.02em; }
      .app-root { background: ${THEME.bg}; color: ${THEME.text}; font-family: ${THEME.fontBody}; min-height: 100vh; }
      button, input { font-family: inherit; }
      button { cursor: pointer; transition: transform .15s ease, background .15s ease, border-color .15s ease, opacity .15s ease; }
      button:hover:not(:disabled) { transform: translateY(-1px); }
      button:disabled { cursor: default; }
      .wpg-shell { min-height: 100vh; display: flex; background: ${THEME.bg}; }
      .wpg-sidebar { position: fixed; inset: 0 auto 0 0; width: 224px; background: #0B0B0B; border-right: 1px solid ${THEME.border}; z-index: 20; display: flex; flex-direction: column; }
      .wpg-brand { padding: 24px 20px 20px; border-bottom: 1px solid ${THEME.border}; }
      .wpg-brand-mark { font-family: ${THEME.fontDisplay}; font-size: 43px; font-weight: 800; line-height: .82; color: ${THEME.orange}; letter-spacing: -.06em; }
      .wpg-brand-sub { font-size: 9px; letter-spacing: 3px; color: #BDBDBD; margin-top: 7px; }
      .wpg-brand-desc { font-size: 8px; letter-spacing: 1.3px; color: #666; margin-top: 9px; text-transform: uppercase; }
      .wpg-nav { padding: 18px 10px; overflow-y: auto; }
      .wpg-nav-section { margin: 18px 10px 7px; font-size: 9px; font-weight: 700; letter-spacing: 1.6px; color: #666; }
      .wpg-nav-section:first-child { margin-top: 0; }
      .wpg-nav-item { width: 100%; border: 0; background: transparent; color: #999; padding: 10px 11px; display: flex; align-items: center; gap: 11px; text-align: left; font-size: 12px; font-weight: 600; border-left: 2px solid transparent; }
      .wpg-nav-item.active { color: ${THEME.orange}; background: linear-gradient(90deg, rgba(255,106,0,.16), transparent); border-left-color: ${THEME.orange}; }
      .wpg-nav-icon { width: 18px; text-align: center; font-size: 14px; }
      .wpg-main { width: calc(100% - 224px); margin-left: 224px; min-height: 100vh; }
      .wpg-topbar { height: 58px; border-bottom: 1px solid ${THEME.border}; background: rgba(8,8,8,.96); display: flex; align-items: center; justify-content: space-between; padding: 0 28px; position: sticky; top: 0; z-index: 10; }
      .wpg-breadcrumb { font-size: 11px; color: #777; letter-spacing: .6px; text-transform: uppercase; }
      .wpg-breadcrumb strong { color: #DDD; }
      .wpg-season-pill { display: flex; align-items: center; gap: 14px; font-size: 11px; color: #999; }
      .wpg-season-pill b { color: #FFF; font-family: ${THEME.fontDisplay}; font-size: 17px; }
      .screen-page { width: min(1180px, calc(100% - 48px)); margin: 0 auto; padding: 28px 0 42px; }
      .wpg-kicker { color: ${THEME.orange}; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
      .wpg-title { font-family: ${THEME.fontDisplay}; font-size: 34px; line-height: .98; margin: 5px 0 0; font-weight: 800; }
      .wpg-card { border: 1px solid ${THEME.border}; background: linear-gradient(145deg, #151515, #101010); }
      .wpg-card:hover { border-color: #3A3A3A; }
      .wpg-section-label { font-size: 10px; color: #777; font-weight: 700; letter-spacing: 1.3px; margin: 0 0 9px; text-transform: uppercase; }
      .wpg-accent-line { height: 2px; width: 38px; background: ${THEME.orange}; margin-top: 10px; }
      .wpg-mobile-nav { display: none; }
      @media (max-width: 800px) {
        .wpg-sidebar { display: none; }
        .wpg-main { width: 100%; margin-left: 0; }
        .wpg-topbar { padding: 0 16px; height: 54px; }
        .screen-page { width: calc(100% - 28px); padding: 18px 0 86px; }
        .wpg-mobile-nav { position: fixed; display: flex; left: 10px; right: 10px; bottom: 10px; height: 62px; background: rgba(18,18,18,.97); border: 1px solid ${THEME.border}; z-index: 30; box-shadow: 0 10px 40px rgba(0,0,0,.45); }
        .wpg-mobile-nav button { flex: 1; background: transparent; border: 0; color: #777; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 9px; }
        .wpg-mobile-nav button.active { color: ${THEME.orange}; }
      }
    `}</style>
  );
}

function Card({ children, elevated, style, onClick }) {
  return (
    <div onClick={onClick} className="wpg-card" style={{ background: elevated ? THEME.cardElevated : THEME.card, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function Badge({ children, tone = 'neutral', style }) {
  const tones = {
    gold: { background: THEME.orange, color: '#0A0A0A' },
    green: { background: THEME.green, color: THEME.bg },
    red: { background: THEME.red, color: THEME.text },
    neutral: { background: THEME.cardElevated, color: THEME.textSecondary },
  };
  return (
    <span style={{ ...tones[tone], fontSize: 11, fontWeight: 700, padding: '3px 8px', letterSpacing: 0.4, textTransform: 'uppercase', ...style }}>
      {children}
    </span>
  );
}

function AttrBar({ label, value, potential }) {
  const shown = Math.round(value);
  return (
    <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: THEME.textSecondary, width: 96 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: THEME.cardElevated, position: 'relative' }}>
        <div style={{ width: `${(value / 99) * 100}%`, height: 6, background: THEME.gold }} />
        {potential != null && (
          <div style={{ position: 'absolute', top: -2, left: `${(potential / 99) * 100}%`, width: 2, height: 10, background: THEME.textSecondary }} />
        )}
      </div>
      <span style={{ fontSize: 12, width: potential != null ? 56 : 24, textAlign: 'right', fontWeight: 600 }}>
        {shown}{potential != null && <span style={{ color: THEME.textSecondary, fontWeight: 400 }}> /{Math.round(potential)}</span>}
      </span>
    </div>
  );
}

// FormaDots — só apresenta resultados que matchHistory já produz (Passo 1-4).
// Nenhum cálculo novo: recebe um array de 'W'|'D'|'L' já pronto.
function FormaDots({ results, size = 16 }) {
  const color = (r) => r === 'W' ? THEME.green : r === 'L' ? THEME.red : THEME.textSecondary;
  if (!results || results.length === 0) {
    return <span style={{ fontSize: 10, color: THEME.textSecondary }}>—</span>;
  }
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {results.map((r, i) => (
        <span key={i} style={{
          width: size, height: size, borderRadius: '50%', background: color(r),
          color: THEME.bg, fontSize: size * 0.55, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {r}
        </span>
      ))}
    </div>
  );
}

function ClubMonogram({ club, size = 44 }) {
  const branding = club.branding || { type: 'monogram', text: club.name.slice(0, 2).toUpperCase() };

  // Caminho já preparado: quando um clube tiver branding.type === 'licensed' com
  // um escudo real (via Data Importer), basta renderizar a imagem aqui — nenhum
  // componente que consome <ClubMonogram club={...} /> precisa mudar.
  if (branding.type === 'licensed' && branding.logo) {
    return <img src={branding.logo} alt={club.name} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />;
  }

  const text = branding.text || club.name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, background: club.color, color: '#fff', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, flexShrink: 0,
    }}>
      {text}
    </div>
  );
}

const NAV_ITEMS = [
  { id: 'home', icon: '⌂', label: 'Visão Geral' },
  { id: 'profile', icon: '◉', label: 'Perfil do Jogador' },
  { id: 'carreira', icon: '▣', label: 'Carreira' },
  { id: 'mundo', icon: '◈', label: 'Mundo' },
  { id: 'life', icon: '✦', label: 'Life' },
  { id: 'voce', icon: '●', label: 'Finanças' },
];

const WPG_NAV_GROUPS = [
  { label: 'CARREIRA', items: [
    { id: 'home', icon: '⌂', label: 'Visão Geral' },
    { id: 'profile', icon: '◉', label: 'Perfil do Jogador' },
    { id: 'carreira', icon: '▣', label: 'Calendário / Carreira' },
    { id: 'home', icon: '▤', label: 'Jogos' },
    { id: 'home', icon: '◇', label: 'Treino' },
    { id: 'home', icon: '↗', label: 'Desenvolvimento' },
    { id: 'home', icon: '✓', label: 'Objetivos' },
  ] },
  { label: 'COMPETIÇÕES', items: [
    { id: 'mundo', icon: '≡', label: 'Tabelas' },
    { id: 'mundo', icon: '▧', label: 'Resultados' },
    { id: 'mundo', icon: '◌', label: 'Fases' },
    { id: 'mundo', icon: '▥', label: 'Estatísticas' },
  ] },
  { label: 'MUNDO', items: [
    { id: 'mundo', icon: '▤', label: 'Notícias' },
    { id: 'mundo', icon: '€', label: 'Mercado' },
    { id: 'mundo', icon: '♟', label: 'Clubes' },
    { id: 'mundo', icon: '★', label: 'Jovens Talentos' },
    { id: 'mundo', icon: '🏆', label: 'Competições' },
  ] },
  { label: 'LIFE', items: [
    { id: 'life', icon: '✦', label: 'Visão Geral' },
    { id: 'life', icon: '♙', label: 'Minha Rede' },
    { id: 'life', icon: '▤', label: 'Publicações' },
    { id: 'life', icon: '◫', label: 'Entrevistas' },
    { id: 'life', icon: '◇', label: 'Minha Imagem' },
    { id: 'life', icon: '♡', label: 'Relacionamentos' },
  ] },
  { label: 'DADOS', items: [
    { id: 'carreira', icon: '▥', label: 'Estatísticas' },
    { id: 'carreira', icon: '↺', label: 'Histórico' },
    { id: 'carreira', icon: '▦', label: 'Registros' },
  ] },
];

function WPGShell({ active, onChange, player, club, seasonYear, children }) {
  return (
    <div className="wpg-shell">
      <aside className="wpg-sidebar">
        <div className="wpg-brand">
          <div className="wpg-brand-mark">WPG</div>
          <div className="wpg-brand-sub">PROJECT</div>
          <div className="wpg-brand-desc">Football Career Simulation</div>
        </div>
        <nav className="wpg-nav">
          {WPG_NAV_GROUPS.map((group, gi) => (
            <div key={group.label}>
              <div className="wpg-nav-section">{group.label}</div>
              {group.items.map(item => (
                <button key={`${group.label}-${item.id}`} className={`wpg-nav-item ${active === item.id ? 'active' : ''}`} onClick={() => onChange(item.id)}>
                  <span className="wpg-nav-icon">{item.icon}</span><span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '18px 20px', borderTop: `1px solid ${THEME.border}` }}>
          <div className="display" style={{ color: THEME.orange, fontSize: 18, fontWeight: 700 }}>MORE THAN THE GAME</div>
          <div style={{ color: '#555', fontSize: 8, letterSpacing: 1.5, marginTop: 5 }}>WPG PROJECT</div>
        </div>
      </aside>
      <main className="wpg-main">
        <header className="wpg-topbar">
          <div className="wpg-breadcrumb">WPG PROJECT &nbsp;›&nbsp; <strong>{NAV_ITEMS.find(n => n.id === active)?.label || 'Carreira'}</strong></div>
          <div className="wpg-season-pill"><span>{club?.name || 'CARREIRA'}</span><b>{seasonYear}</b></div>
        </header>
        {children}
        <div className="wpg-mobile-nav">
          {NAV_ITEMS.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onChange(item.id)}><span style={{fontSize:18}}>{item.icon}</span><span>{item.label}</span></button>)}
        </div>
      </main>
    </div>
  );
}


export { THEME, GlobalStyle, Card, Badge, AttrBar, FormaDots, ClubMonogram, NAV_ITEMS, WPG_NAV_GROUPS, WPGShell };

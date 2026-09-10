import React from 'react';
/* ============================================================================
   DESIGN SYSTEM — tokens + componentes base (Direção Visual V2)
============================================================================ */

// Direção Visual V3 — "estádio à noite": preto com temperatura (não cinza
// neutro) + laranja WPG como brasa, não como cone de trânsito. Um aço-frio
// entra só em condição/carga física pra não deixar tudo laranja-sobre-preto.
// Documentado/aprovado via protótipo antes de entrar aqui — ver histórico.
const THEME = {
  bg: '#120E0A',
  panel: '#0E0B08',
  card: '#1C160F',
  cardElevated: '#241C13',
  orange: '#F2660F',
  gold: '#F2660F',
  accentStrong: '#FF8A3D',
  accentSoft: '#432612',
  green: '#4FAE7A',
  warn: '#D9A441',
  steel: '#6E93AE',
  text: '#F5EEE3',
  textSecondary: '#B4A38C',
  textFaint: '#7C6E5A',
  red: '#C24F45',
  border: '#382A19',
  borderSoft: '#2A2015',
  fontDisplay: "'Anton', 'Arial Narrow', sans-serif",
  fontBody: "'Inter', sans-serif",
  fontMono: "'JetBrains Mono', 'SF Mono', monospace",
};

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
      * { box-sizing: border-box; }
      html, body, #root { margin: 0; min-height: 100%; background: ${THEME.bg}; }
      body {
        background: ${THEME.bg};
        background-image:
          radial-gradient(circle at 12% 0%, rgba(242,102,15,0.08), transparent 45%),
          radial-gradient(circle at 100% 25%, rgba(110,147,174,0.05), transparent 40%);
        background-attachment: fixed;
      }
      .display { font-family: ${THEME.fontDisplay}; letter-spacing: 0.01em; }
      .mono { font-family: ${THEME.fontMono}; font-variant-numeric: tabular-nums; }
      .app-root { background: transparent; color: ${THEME.text}; font-family: ${THEME.fontBody}; min-height: 100vh; }
      button, input { font-family: inherit; }
      button { cursor: pointer; border-radius: 10px; transition: transform .15s ease, background .15s ease, border-color .15s ease, opacity .15s ease; }
      button:hover:not(:disabled) { transform: translateY(-1px); }
      button:disabled { cursor: default; }
      button:focus-visible { outline: 2px solid ${THEME.accentStrong}; outline-offset: 2px; }
      .wpg-shell { min-height: 100vh; display: flex; background: transparent; }
      .wpg-sidebar { position: fixed; inset: 0 auto 0 0; width: 224px; background: ${THEME.panel}; border-right: 1px solid ${THEME.border}; z-index: 20; display: flex; flex-direction: column; }
      .wpg-brand { padding: 24px 20px 20px; border-bottom: 1px solid ${THEME.border}; }
      .wpg-brand-mark { font-family: ${THEME.fontDisplay}; font-size: 40px; line-height: .86; color: ${THEME.orange}; letter-spacing: -.01em; }
      .wpg-brand-sub { font-size: 9px; letter-spacing: 3px; color: ${THEME.textSecondary}; margin-top: 7px; }
      .wpg-brand-desc { font-size: 8px; letter-spacing: 1.3px; color: ${THEME.textFaint}; margin-top: 9px; text-transform: uppercase; }
      .wpg-nav { padding: 18px 10px; overflow-y: auto; }
      .wpg-nav-section { margin: 18px 10px 7px; font-size: 9px; font-weight: 700; letter-spacing: 1.6px; color: ${THEME.textFaint}; }
      .wpg-nav-section:first-child { margin-top: 0; }
      .wpg-nav-item { width: 100%; border: 0; background: transparent; color: ${THEME.textSecondary}; padding: 10px 11px; display: flex; align-items: center; gap: 11px; text-align: left; font-size: 12px; font-weight: 600; border-left: 2px solid transparent; border-radius: 0 8px 8px 0; }
      .wpg-nav-item.active { color: ${THEME.accentStrong}; background: linear-gradient(90deg, ${THEME.accentSoft}, transparent); border-left-color: ${THEME.orange}; }
      .wpg-nav-icon { width: 18px; text-align: center; font-size: 14px; }
      .wpg-main { width: calc(100% - 224px); margin-left: 224px; min-height: 100vh; }
      .wpg-topbar { height: 58px; border-bottom: 1px solid ${THEME.border}; background: rgba(18,14,10,.92); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: space-between; padding: 0 28px; position: sticky; top: 0; z-index: 10; }
      .wpg-breadcrumb { font-size: 11px; color: ${THEME.textFaint}; letter-spacing: .6px; text-transform: uppercase; }
      .wpg-breadcrumb strong { color: ${THEME.text}; }
      .wpg-season-pill { display: flex; align-items: center; gap: 14px; font-size: 11px; color: ${THEME.textSecondary}; }
      .wpg-season-pill b { color: ${THEME.text}; font-family: ${THEME.fontMono}; font-size: 14px; }
      .screen-page { width: min(1180px, calc(100% - 48px)); margin: 0 auto; padding: 28px 0 42px; }
      .wpg-kicker { color: ${THEME.orange}; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; font-family: ${THEME.fontMono}; }
      .wpg-title { font-family: ${THEME.fontDisplay}; font-size: 34px; line-height: .98; margin: 5px 0 0; letter-spacing: 0.01em; }
      .wpg-card { border: 1px solid ${THEME.borderSoft}; background: linear-gradient(155deg, ${THEME.card}, ${THEME.panel} 130%); border-radius: 16px; box-shadow: 0 1px 0 rgba(255,255,255,0.02) inset; }
      .wpg-card:hover { border-color: ${THEME.border}; }
      .wpg-section-label { font-size: 10px; color: ${THEME.textFaint}; font-weight: 700; letter-spacing: 1.3px; margin: 0 0 9px; text-transform: uppercase; font-family: ${THEME.fontMono}; }
      .wpg-accent-line { height: 2px; width: 38px; background: ${THEME.orange}; margin-top: 10px; }
      .wpg-mobile-nav { display: none; }
      @media (max-width: 800px) {
        .wpg-sidebar { display: none; }
        .wpg-main { width: 100%; margin-left: 0; }
        .wpg-topbar { padding: 0 16px; height: 54px; }
        .screen-page { width: calc(100% - 28px); padding: 18px 0 92px; }
        .wpg-mobile-nav { position: fixed; display: flex; left: 10px; right: 10px; bottom: 10px; height: 64px; background: linear-gradient(160deg, ${THEME.cardElevated}, ${THEME.panel}); border: 1px solid ${THEME.border}; border-radius: 20px; z-index: 30; box-shadow: 0 16px 40px -12px rgba(0,0,0,.6); }
        .wpg-mobile-nav button { flex: 1; background: transparent; border: 0; color: ${THEME.textFaint}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 9px; font-weight: 600; letter-spacing: 0.02em; }
        .wpg-mobile-nav button span:first-child { width: 26px; height: 26px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
        .wpg-mobile-nav button.active { color: ${THEME.accentStrong}; }
        .wpg-mobile-nav button.active span:first-child { background: ${THEME.accentSoft}; border: 1px solid rgba(242,102,15,0.4); }
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
    gold: { background: THEME.orange, color: THEME.bg },
    green: { background: THEME.green, color: THEME.bg },
    red: { background: THEME.red, color: THEME.text },
    neutral: { background: THEME.cardElevated, color: THEME.textSecondary },
  };
  return (
    <span style={{ ...tones[tone], fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, letterSpacing: 0.4, textTransform: 'uppercase', ...style }}>
      {children}
    </span>
  );
}

// Escala absoluta 0-99 pra current E potencial (não current/potencial) —
// assim o traço de potencial mostra a folga real até o teto, não vira sempre
// a borda direita da barra.
function AttrBar({ label, value, potential }) {
  const shown = Math.round(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: THEME.text, fontWeight: 600, width: 96 }}>{label}</span>
      <div style={{ flex: 1, height: 7, background: THEME.panel, borderRadius: 5, position: 'relative' }}>
        <div style={{ width: `${(value / 99) * 100}%`, height: '100%', borderRadius: 5, background: THEME.orange }} />
        {potential != null && (
          <div style={{ position: 'absolute', top: -2, left: `${(potential / 99) * 100}%`, width: 2, height: 11, borderRadius: 1, background: THEME.steel }} />
        )}
      </div>
      <span className="mono" style={{ fontSize: 12, width: potential != null ? 60 : 24, textAlign: 'right', fontWeight: 600, color: THEME.text }}>
        {shown}{potential != null && <span style={{ color: THEME.textFaint, fontWeight: 500 }}> /{Math.round(potential)}</span>}
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

  // Identidade official/generic: quando um clube tiver branding.type ===
  // 'licensed' com um escudo cujo uso seja verificado (via Data Importer),
  // basta renderizar a imagem aqui — nenhum componente que consome
  // <ClubMonogram club={...} /> precisa mudar. Até lá (e pra qualquer clube
  // sem asset com uso permitido), cai automaticamente no monograma genérico
  // abaixo, no padrão visual do WPG. Nunca inserir aqui um escudo achado na
  // internet sem verificar a origem/condições de uso.
  if (branding.type === 'licensed' && branding.logo) {
    return <img src={branding.logo} alt={club.name} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />;
  }

  const text = branding.text || club.name.slice(0, 2).toUpperCase();
  return (
    <div className="display" style={{
      width: size, height: size, borderRadius: size * 0.24, background: club.color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, flexShrink: 0,
      border: '1px solid rgba(255,255,255,0.12)',
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
              {group.items.map((item, ii) => (
                <button key={`${group.label}-${item.id}-${ii}`} className={`wpg-nav-item ${active === item.id ? 'active' : ''}`} onClick={() => onChange(item.id)}>
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

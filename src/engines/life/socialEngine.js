/**
 * WPG Social Engine — domínio puro.
 * Não contém UI nem acesso a rede externa. Todas as consequências são
 * determinísticas e persistíveis.
 */

const SOCIAL_TONES = [
  { id: 'provocador', label: 'Provocador', icon: '🔥', text: 'Hoje o dia é nosso.', impact: { popularity: 3, reputation: 1, engagement: 8, controversy: 10, crowd: 5, respect: -3 } },
  { id: 'confiante', label: 'Confiante', icon: '😎', text: 'Mais uma. Seguimos.', impact: { popularity: 3, reputation: 2, engagement: 4, controversy: 1, crowd: 3, respect: 1 } },
  { id: 'frio', label: 'Frio', icon: '❄️', text: '3 pontos. Próximo.', impact: { popularity: 0, reputation: 2, engagement: 1, controversy: 0, crowd: 1, respect: 3 } },
  { id: 'respeitoso', label: 'Respeitoso', icon: '🤝', text: 'Grande jogo. Respeito sempre.', impact: { popularity: 1, reputation: 3, engagement: 2, controversy: -1, crowd: 2, respect: 6 } },
  { id: 'humor', label: 'Humor', icon: '😂', text: 'Acordaram cedo hoje? 😂', impact: { popularity: 5, reputation: 1, engagement: 9, controversy: 4, crowd: 4, respect: 0 } },
  { id: 'torcedor', label: 'Torcedor', icon: '❤️', text: 'Que noite! Obrigado, Nação!', impact: { popularity: 5, reputation: 2, engagement: 7, controversy: 0, crowd: 8, respect: 2 } },
  { id: 'humilde', label: 'Humilde', icon: '🙏', text: 'Trabalho de todos. Muito feliz.', impact: { popularity: 1, reputation: 4, engagement: 2, controversy: -2, crowd: 4, respect: 7 } },
  { id: 'enigmatico', label: 'Enigmático', icon: '👀', text: 'Algumas coisas não precisam ser ditas.', impact: { popularity: 3, reputation: 0, engagement: 6, controversy: 6, crowd: 1, respect: 0 } },
  { id: 'motivacional', label: 'Motivacional', icon: '💪', text: 'Juntos somos mais fortes.', impact: { popularity: 2, reputation: 3, engagement: 3, controversy: -1, crowd: 4, respect: 5 } },
  { id: 'polemico', label: 'Polêmico', icon: '💀', text: 'Quem viu, viu.', impact: { popularity: 4, reputation: -1, engagement: 12, controversy: 16, crowd: 2, respect: -6 } },
];

function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, value)); }

function createSocialState(player = {}) {
  return {
    followers: Math.max(100, Number(player.followers) || 100),
    reputation: clamp(Number(player.reputation) || 5),
    popularity: 10,
    engagement: 10,
    controversy: 0,
    respect: 50,
    relationships: { crowd: 50, coach: 50, dressingRoom: 50, media: 50, board: 50 },
    posts: [],
    comments: [],
    notifications: [],
    history: [],
  };
}

function getSocialTone(id) { return SOCIAL_TONES.find(t => t.id === id) || null; }

function applyImpact(state, impact = {}) {
  const next = { ...state, relationships: { ...state.relationships } };
  for (const key of ['reputation', 'popularity', 'engagement', 'controversy', 'respect']) {
    if (typeof impact[key] === 'number') next[key] = clamp((next[key] || 0) + impact[key]);
  }
  if (typeof impact.crowd === 'number') next.relationships.crowd = clamp(next.relationships.crowd + impact.crowd);
  return next;
}

function publishSocialPost(state, player, toneId, context = {}) {
  const tone = getSocialTone(toneId);
  if (!tone) return { state, post: null };
  const next = applyImpact(state, tone.impact);
  const followerDelta = Math.max(1, Math.round((next.engagement + tone.impact.engagement * 2) * 3));
  next.followers += followerDelta;
  const post = {
    id: `post-${Date.now()}-${tone.id}`,
    authorId: player?.id || 'player',
    authorName: player?.displayName || player?.name || 'Jogador',
    tone: tone.id,
    toneLabel: tone.label,
    text: context.customText || tone.text,
    context: context.context || null,
    createdAt: context.createdAt || new Date().toISOString(),
    reactions: { likes: Math.max(12, followerDelta * 2), comments: 0, reposts: Math.max(1, Math.round(followerDelta / 4)) },
  };
  next.posts = [post, ...next.posts].slice(0, 50);
  next.history = [{ type: 'post', postId: post.id, tone: tone.id, context: post.context }, ...next.history].slice(0, 100);
  return { state: next, post };
}

function commentOnSocialPost(state, player, targetPost, toneId, context = {}) {
  const tone = getSocialTone(toneId);
  if (!tone || !targetPost) return { state, comment: null };
  const impact = { ...tone.impact, engagement: Math.round(tone.impact.engagement / 2) };
  const next = applyImpact(state, impact);
  const comment = {
    id: `comment-${Date.now()}-${tone.id}`,
    authorId: player?.id || 'player',
    authorName: player?.displayName || player?.name || 'Jogador',
    targetPostId: targetPost.id,
    tone: tone.id,
    toneLabel: tone.label,
    text: context.customText || tone.text,
    createdAt: context.createdAt || new Date().toISOString(),
  };
  next.comments = [comment, ...next.comments].slice(0, 100);
  next.history = [{ type: 'comment', commentId: comment.id, targetPostId: targetPost.id, tone: tone.id }, ...next.history].slice(0, 100);
  return { state: next, comment };
}


function appendSystemPost(state, { authorId, authorName, text, context = null, createdAt = null, reactions = {} } = {}) {
  const post = {
    id: `system-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    authorId: authorId || 'system',
    authorName: authorName || 'WPG Sports',
    authorType: 'system',
    tone: 'system',
    toneLabel: 'Notícia',
    text: text || '',
    context,
    createdAt: createdAt || new Date().toISOString(),
    reactions: { likes: reactions.likes || 0, comments: reactions.comments || 0, reposts: reactions.reposts || 0 },
  };
  return { ...state, posts: [post, ...state.posts].slice(0, 50), history: [{ type: 'system_post', postId: post.id, context }, ...state.history].slice(0, 100) };
}

function syncSocialToPlayer(player, socialState) {
  if (!player) return player;
  return {
    ...player,
    reputation: socialState.reputation,
    social: {
      followers: socialState.followers,
      popularity: socialState.popularity,
      engagement: socialState.engagement,
      controversy: socialState.controversy,
      respect: socialState.respect,
    },
  };
}

export { SOCIAL_TONES, createSocialState, getSocialTone, publishSocialPost, commentOnSocialPost, appendSystemPost, syncSocialToPlayer };

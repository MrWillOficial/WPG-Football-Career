import { getOfficialSalaryRecord } from '../economy/contractsEconomy.js';
import { PLAYER_DATABASE_SOURCE, OFFICIAL_PLAYER_DATABASE, OFFICIAL_PLAYER_DATABASE_COMPLETE, PLAYER_DATABASE_EXPECTED_CLUBS, PLAYER_DATABASE_EXPECTED_CLUBS_BY_COMPETITION } from '../../data/players/professional/officialPlayerDatabase.js';
import { OFFICIAL_ACADEMY_PLAYER_DATABASE, OFFICIAL_ACADEMY_DATABASE_COMPLETE } from '../../data/players/academy/officialAcademyDatabase.js';
const POSITIONS = [
  { id: 'GOL', label: 'Goleiro' },
  { id: 'ZAG', label: 'Zagueiro' },
  { id: 'MEI', label: 'Meio-campo' },
  { id: 'ATA', label: 'Atacante' },
];

/* ============================================================================
   PLAYER DATA MODEL V1 — ponte entre a base real e o motor atual

   Regra desta etapa:
   - a base real pode guardar posição detalhada;
   - o Match/Progression Engine atual continua operando nas 4 posições legadas;
   - registeredClub/currentClub ficam separados;
   - nenhum OVR/atributo/potencial é inventado para jogador real nesta camada.

   Quando a coleta oficial da Série A 2026 entrar, ela será normalizada por
   normalizeRegisteredPlayer() e poderá conviver com os mocks sem quebrá-los.
============================================================================ */
const DETAILED_POSITIONS = [
  { id: 'GOL', label: 'Goleiro', legacy: 'GOL' },
  { id: 'ZAG', label: 'Zagueiro', legacy: 'ZAG' },
  { id: 'LD', label: 'Lateral-direito', legacy: 'ZAG' },
  { id: 'LE', label: 'Lateral-esquerdo', legacy: 'ZAG' },
  { id: 'VOL', label: 'Volante', legacy: 'MEI' },
  { id: 'MC', label: 'Meio-campista', legacy: 'MEI' },
  { id: 'MEI', label: 'Meia-atacante', legacy: 'MEI' },
  { id: 'MD', label: 'Meia-direita', legacy: 'MEI' },
  { id: 'ME', label: 'Meia-esquerda', legacy: 'MEI' },
  { id: 'PD', label: 'Ponta-direita', legacy: 'ATA' },
  { id: 'PE', label: 'Ponta-esquerda', legacy: 'ATA' },
  { id: 'SA', label: 'Segundo atacante', legacy: 'ATA' },
  { id: 'CA', label: 'Centroavante', legacy: 'ATA' },
];
const DETAILED_POSITION_MAP = Object.fromEntries(DETAILED_POSITIONS.map(p => [p.id, p]));

function detailedPositionToLegacy(position) {
  return DETAILED_POSITION_MAP[position]?.legacy || position;
}

// ---------------------------------------------------------------------------
// PLAYER PROFILE V1.2
// Posição -> Função -> Arquétipo -> especialização.
// Esta camada é determinística e serve para jogadores criados pelo usuário.
// Jogadores reais só recebem função/arquétipo quando a posição estiver
// confirmada por fonte de dados; nunca inferimos uma posição de um nome.
// ---------------------------------------------------------------------------
const POSITION_FUNCTIONS = {
  GOL: ['Goleiro'],
  ZAG: ['Defensor central'],
  LD: ['Lateral'],
  LE: ['Lateral'],
  VOL: ['Primeiro volante', 'Volante organizador', 'Box-to-Box'],
  MC: ['Maestro', 'Organizador', 'Box-to-Box', 'Criador'],
  MEI: ['Criador', 'Meia-atacante'],
  MD: ['Ponta/ala', 'Criador'],
  ME: ['Ponta/ala', 'Criador'],
  PD: ['Driblador', 'Criador', 'Finalizador', 'Ala ofensivo'],
  PE: ['Driblador', 'Criador', 'Finalizador', 'Ala ofensivo'],
  SA: ['Segundo atacante', 'Atacante móvel', 'Criador'],
  CA: ['Matador', 'Atacante móvel', 'Pivô', 'Falso 9'],
};

const ARCHETYPE_PROFILES = {
  'Matador': { finalizacao: 1.12, velocidade: 1.02, passe: 0.92, defesa: 0.72, fisico: 1.02 },
  'Atacante móvel': { finalizacao: 1.04, velocidade: 1.12, passe: 0.96, defesa: 0.72, fisico: 0.98 },
  'Pivô': { finalizacao: 1.02, velocidade: 0.86, passe: 1.02, defesa: 0.74, fisico: 1.14 },
  'Falso 9': { finalizacao: 0.98, velocidade: 0.96, passe: 1.12, defesa: 0.70, fisico: 0.94 },
  'Driblador': { finalizacao: 1.02, velocidade: 1.14, passe: 1.02, defesa: 0.70, fisico: 0.90 },
  'Criador': { finalizacao: 0.94, velocidade: 0.98, passe: 1.14, defesa: 0.76, fisico: 0.90 },
  'Finalizador': { finalizacao: 1.10, velocidade: 1.04, passe: 0.90, defesa: 0.70, fisico: 0.96 },
  'Ala ofensivo': { finalizacao: 1.00, velocidade: 1.10, passe: 1.00, defesa: 0.82, fisico: 0.96 },
  'Maestro': { finalizacao: 0.88, velocidade: 0.90, passe: 1.18, defesa: 0.82, fisico: 0.92 },
  'Organizador': { finalizacao: 0.90, velocidade: 0.94, passe: 1.16, defesa: 0.92, fisico: 0.94 },
  'Box-to-Box': { finalizacao: 0.96, velocidade: 1.02, passe: 1.02, defesa: 1.02, fisico: 1.08 },
  'Primeiro volante': { finalizacao: 0.76, velocidade: 0.88, passe: 1.00, defesa: 1.14, fisico: 1.08 },
  'Volante organizador': { finalizacao: 0.80, velocidade: 0.90, passe: 1.12, defesa: 1.06, fisico: 1.02 },
  'Defensor central': { finalizacao: 0.54, velocidade: 0.84, passe: 0.94, defesa: 1.18, fisico: 1.14 },
  'Lateral': { finalizacao: 0.78, velocidade: 1.10, passe: 1.00, defesa: 1.02, fisico: 1.00 },
  'Goleiro': { finalizacao: 0.30, velocidade: 0.70, passe: 0.86, defesa: 1.24, fisico: 1.08 },
  'Meia-atacante': { finalizacao: 1.00, velocidade: 1.00, passe: 1.10, defesa: 0.72, fisico: 0.90 },
  'Ponta/ala': { finalizacao: 0.98, velocidade: 1.10, passe: 1.02, defesa: 0.82, fisico: 0.94 },
  'Segundo atacante': { finalizacao: 1.04, velocidade: 1.06, passe: 1.02, defesa: 0.72, fisico: 0.94 },
};

function derivePlayerProfile(position, attrs = {}) {
  const detailed = DETAILED_POSITION_MAP[position] ? position : null;
  if (!detailed) return { position: null, legacyPosition: null, functions: [], archetype: null, specialization: null };
  const functions = POSITION_FUNCTIONS[detailed] || [];
  const archetype = functions[0] || null;
  return {
    position: detailed,
    legacyPosition: detailedPositionToLegacy(detailed),
    functions,
    archetype,
    specialization: archetype ? `${detailed}:${archetype}` : null,
    profileMultipliers: archetype ? ARCHETYPE_PROFILES[archetype] : null,
  };
}

function makePlayerId(clubId, name) {
  const slug = String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${clubId}-${slug || 'player'}`;
}

function normalizeRegisteredPlayer(raw) {
  if (!raw || !raw.clubId || !raw.name) return null;
  const detailedPosition = raw.position || raw.detailedPosition || null;
  const profile = derivePlayerProfile(detailedPosition);
  return {
    id: raw.id || makePlayerId(raw.clubId, raw.name),
    clubId: raw.clubId,
    name: raw.name,
    displayName: raw.displayName || raw.name,
    age: Number.isFinite(raw.age) ? raw.age : null,
    birthDate: raw.birthDate || null,
    position: detailedPosition,
    legacyPosition: profile.legacyPosition,
    functions: raw.functions || profile.functions,
    archetype: raw.archetype || profile.archetype,
    specialization: raw.specialization || profile.specialization,
    registeredClub: raw.registeredClub || raw.clubId,
    currentClub: raw.currentClub || raw.clubId,
    relationshipType: raw.relationshipType || 'unknown',
    relationshipStatus: raw.relationshipStatus || 'pending_official',
    loan: raw.loan ? {
      status: raw.loan.status || 'pending_official',
      originClub: raw.loan.originClub || raw.registeredClub || raw.clubId,
      destinationClub: raw.loan.destinationClub || raw.currentClub || raw.clubId,
      startDate: raw.loan.startDate || null,
      endDate: raw.loan.endDate || null,
      optionToBuy: raw.loan.optionToBuy ?? null,
      obligationToBuy: raw.loan.obligationToBuy ?? null,
      source: raw.loan.source || null,
    } : null,
    registrationHistory: Array.isArray(raw.registrationHistory) ? raw.registrationHistory : [],
    loanHistory: Array.isArray(raw.loanHistory) ? raw.loanHistory : [],
    competition: raw.competition || null,
    source: raw.source || 'official_cbf',
    dataStatus: raw.dataStatus || 'validated',
    attrs: raw.attrs || null,
    overall: Number.isFinite(raw.overall) ? raw.overall : null,
    potential: raw.potential || null,
  };
}

function getRosterPlayerName(playerOrString) {
  return typeof playerOrString === 'string' ? playerOrString : (playerOrString?.displayName || playerOrString?.name || 'jogador do time');
}

function validateRegisteredPlayerRecord(player) {
  const errors = [];
  if (!player?.id) errors.push('id');
  if (!player?.clubId) errors.push('clubId');
  if (!player?.name) errors.push('name');
  if (player?.age != null && (!Number.isInteger(player.age) || player.age < 14 || player.age > 60)) errors.push('age');
  if (player?.position != null && !DETAILED_POSITION_MAP[player.position]) errors.push('position');
  if (player?.birthDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(player.birthDate)) errors.push('birthDate');
  if (player?.attrs != null && (typeof player.attrs !== 'object' || Object.values(player.attrs).some(v => !Number.isFinite(v) || v < 0 || v > 99))) errors.push('attrs');
  if (player?.overall != null && (!Number.isFinite(player.overall) || player.overall < 0 || player.overall > 99)) errors.push('overall');
  if (!player?.registeredClub) errors.push('registeredClub');
  if (!player?.currentClub) errors.push('currentClub');
  if (!['permanent', 'loan', 'unknown'].includes(player?.relationshipType)) errors.push('relationshipType');
  if (!['confirmed', 'pending_official'].includes(player?.relationshipStatus)) errors.push('relationshipStatus');
  if (player?.relationshipType === 'loan' && player?.relationshipStatus !== 'confirmed') errors.push('loan_must_be_officially_confirmed');
  if (player?.loan != null) {
    if (typeof player.loan !== 'object') errors.push('loan');
    else {
      if (!['confirmed', 'pending_official'].includes(player.loan.status)) errors.push('loan.status');
      if (player.loan.status === 'confirmed' && player.relationshipType !== 'loan') errors.push('loan_relationship_mismatch');
      if (!player.loan.originClub) errors.push('loan.originClub');
      if (!player.loan.destinationClub) errors.push('loan.destinationClub');
    }
  }
  return { valid: errors.length === 0, errors };
}

function validateRegisteredPlayerDatabase(players) {
  const normalized = (players || []).map(normalizeRegisteredPlayer).filter(Boolean);
  const ids = new Set();
  const duplicates = [];
  const invalid = [];
  normalized.forEach(player => {
    if (ids.has(player.id)) duplicates.push(player.id);
    ids.add(player.id);
    const check = validateRegisteredPlayerRecord(player);
    if (!check.valid) invalid.push({ id: player.id, errors: check.errors });
  });
  return { total: normalized.length, valid: invalid.length === 0 && duplicates.length === 0, duplicates, invalid, players: normalized };
}

// Registry V1: a base oficial entra aqui quando for coletada. O array vazio é
// deliberado: ausência de dado oficial nunca vira jogador inventado.
// Fonte oficial primária da base profissional: CBF Série A 2026.
// A coleção é incremental, mas NÃO pode ativar parcialmente um elenco oficial:
// enquanto não houver cobertura completa validada, o jogo mantém o roster
// narrativo/mock como fallback para não esconder jogadores por acidente.
function validateAcademyDatabase(players) {
  const normalized = (players || []).map(normalizeRegisteredPlayer).filter(Boolean);
  const ids = new Set();
  const duplicates = [];
  normalized.forEach(p => { if (ids.has(p.id)) duplicates.push(p.id); ids.add(p.id); });
  return {
    total: normalized.length,
    duplicates,
    valid: duplicates.length === 0,
    complete: OFFICIAL_ACADEMY_DATABASE_COMPLETE,
    source: 'CBF Campeonato Brasileiro Sub-20 2026',
  };
}

function getAcademyPlayers(clubId) {
  return OFFICIAL_ACADEMY_PLAYER_DATABASE
    .filter(p => p.registeredClub === clubId || p.clubId === clubId)
    .map(normalizeRegisteredPlayer);
}

const ACADEMY_DATABASE_SELF_CHECK = validateAcademyDatabase(OFFICIAL_ACADEMY_PLAYER_DATABASE);

function resolveAcademyCompensation(player, clubId, seasonYear = 2026) {
  const official = getOfficialSalaryRecord(player?.id, clubId, seasonYear);
  if (official && Number.isFinite(official.monthly)) {
    return { monthly: official.monthly, source: official.source || 'official', status: 'official' };
  }
  return { monthly: null, source: 'pending_official', status: 'pending_official' };
}

function validateOfficialCoverage(players) {
  const normalized = (players || []).map(normalizeRegisteredPlayer).filter(Boolean);
  const clubs = new Set(normalized.map(p => p.registeredClub || p.clubId));
  const missingClubs = PLAYER_DATABASE_EXPECTED_CLUBS.filter(id => !clubs.has(id));
  return { totalPlayers: normalized.length, clubsCovered: clubs.size, expectedClubs: PLAYER_DATABASE_EXPECTED_CLUBS.length, missingClubs, complete: missingClubs.length === 0 && normalized.length > 0 };
}

function validateOfficialCoverageByCompetition(players) {
  const normalized = (players || []).map(normalizeRegisteredPlayer).filter(Boolean);
  const result = {};
  for (const [competition, expectedClubs] of Object.entries(PLAYER_DATABASE_EXPECTED_CLUBS_BY_COMPETITION)) {
    const scoped = normalized.filter(p => p.competition === competition);
    const clubs = new Set(scoped.map(p => p.registeredClub || p.clubId));
    const missingClubs = expectedClubs.filter(id => !clubs.has(id));
    result[competition] = { totalPlayers: scoped.length, clubsCovered: clubs.size, expectedClubs: expectedClubs.length, missingClubs, complete: missingClubs.length === 0 && scoped.length > 0 };
  }
  result.valid = Object.values(result).every(v => v && typeof v === 'object' && v.complete);
  return result;
}

const PLAYER_DATA_MODEL_VERSION = '1.2';
const PLAYER_DATA_MODEL_CHECK = validateRegisteredPlayerDatabase(OFFICIAL_PLAYER_DATABASE);
const PLAYER_DATABASE_COVERAGE_CHECK = validateOfficialCoverage(OFFICIAL_PLAYER_DATABASE);
const PLAYER_DATABASE_COVERAGE_BY_COMPETITION_CHECK = validateOfficialCoverageByCompetition(OFFICIAL_PLAYER_DATABASE);

function normalizeClubRoster(club) {
  const roster = Array.isArray(club?.roster) ? club.roster : [];
  return roster.map(entry => {
    if (typeof entry === 'string') {
      return {
        id: makePlayerId(club.id, entry),
        clubId: club.id,
        name: entry,
        displayName: entry,
        age: null,
        birthDate: null,
        position: null,
        legacyPosition: null,
        registeredClub: club.id,
        currentClub: club.id,
        competition: null,
        source: 'mock_narrative',
        dataStatus: 'mock',
      };
    }
    return normalizeRegisteredPlayer({ ...entry, clubId: entry.clubId || club.id });
  }).filter(Boolean);
}

function getClubRosterPlayers(club) {
  if (!club) return [];
  const official = OFFICIAL_PLAYER_DATABASE.filter(p => p.registeredClub === club.id || p.clubId === club.id);
  // Cobertura parcial nunca substitui o elenco inteiro. Só ativa a fonte
  // oficial quando a coleta da competição tiver sido explicitamente fechada
  // e validada.
  if (OFFICIAL_PLAYER_DATABASE_COMPLETE && official.length > 0) return official;
  return normalizeClubRoster(club);
}

function validatePlayerModelSelfCheck() {
  const result = validateRegisteredPlayerDatabase(OFFICIAL_PLAYER_DATABASE);
  if (!result.valid) throw new Error(`Player Data Model V${PLAYER_DATA_MODEL_VERSION} inválido: ${JSON.stringify(result.invalid)}`);
  return {
    ...result,
    source: PLAYER_DATABASE_SOURCE,
    complete: OFFICIAL_PLAYER_DATABASE_COMPLETE,
    coverage: validateOfficialCoverage(OFFICIAL_PLAYER_DATABASE),
    activationSafe: !OFFICIAL_PLAYER_DATABASE_COMPLETE || (result.valid && validateOfficialCoverage(OFFICIAL_PLAYER_DATABASE).complete),
  };
}
const PLAYER_DATABASE_SELF_CHECK = validatePlayerModelSelfCheck();
const WEIGHTS = {
  GOL: { defesa: 0.5, fisico: 0.3, passe: 0.1, velocidade: 0.05, finalizacao: 0.05 },
  ZAG: { defesa: 0.45, fisico: 0.25, passe: 0.15, velocidade: 0.1, finalizacao: 0.05 },
  MEI: { passe: 0.35, velocidade: 0.2, finalizacao: 0.15, defesa: 0.15, fisico: 0.15 },
  ATA: { finalizacao: 0.4, velocidade: 0.3, passe: 0.15, fisico: 0.1, defesa: 0.05 },
};
const ATTR_LABELS = { finalizacao: 'Finalização', passe: 'Passe', velocidade: 'Velocidade', defesa: 'Defesa', fisico: 'Físico' };

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function computeOverall(position, attrs) {
  const w = WEIGHTS[position];
  let sum = 0;
  for (const k in w) sum += (attrs[k] || 0) * w[k];
  return Math.round(sum);
}

/* ============================================================================
   PLAYER PROGRESSION ENGINE — isolado. Só ele decide como attrs/overall evoluem.
   Match/Competition/Season continuam recebendo números prontos e não sabem que
   por baixo existe treino composto, decimal ou potencial. computeOverall() acima
   não mudou: já recebia número e arredondava só a saída — decimal é transparente
   pra ele.

   Corte desta etapa (deliberado): intensidade/fadiga ficam para o Fitness Engine
   (item 5 da fila), pra não misturar dois riscos na mesma implementação. Aqui só
   entra o núcleo: treino composto + potencial + desaceleração.
============================================================================ */

// Equivalente a trainings.json — cada treino distribui um ganho-base entre vários
// atributos por peso. "Treino ≠ atributo": o jogador escolhe a atividade, não o
// número que quer subir.
const TRAININGS = [
  { id: 'finishing', name: 'Finalizações', effects: { finalizacao: 0.7, passe: 0.15, fisico: 0.15 } },
  { id: 'short_pass', name: 'Passe curto', effects: { passe: 0.7, velocidade: 0.15, finalizacao: 0.15 } },
  { id: 'sprint', name: 'Sprint', effects: { velocidade: 0.7, fisico: 0.3 } },
  { id: 'gym', name: 'Academia', effects: { fisico: 0.7, defesa: 0.3 } },
  { id: 'free_kick', name: 'Cobrança de falta', effects: { finalizacao: 0.5, passe: 0.35, fisico: 0.15 } },
];

const BASE_TRAINING_GAIN = 0.9; // "pontos de treino" totais distribuídos por sessão, antes da desaceleração

/* ============================================================================
   INTENSIDADE / CARGA SEMANAL — MVP do sistema de treinamento profissional
   (proposta validada em conversa, seções 8/10/16 do documento de referência):
   intensidade real por sessão, ganho probabilístico (variância individual) e
   carga acumulada que reduz o aproveitamento quando alta. Tudo entra pelo
   `modifiers` que applyTraining já aceitava — decelerate/applyTraining/
   TRAININGS continuam exatamente como estavam.
============================================================================ */
const TRAINING_INTENSITIES = [
  { id: 'conservador', label: 'Conservador', gainMultiplier: 0.7, conditionMultiplier: 0.6, loadMultiplier: 0.6 },
  { id: 'equilibrado', label: 'Equilibrado', gainMultiplier: 1.0, conditionMultiplier: 1.0, loadMultiplier: 1.0 },
  { id: 'intensivo', label: 'Intensivo', gainMultiplier: 1.4, conditionMultiplier: 1.6, loadMultiplier: 1.6 },
];
const WEEKLY_LOAD_PER_SESSION = 18; // intensivo satura a carga em ~4 sessões seguidas sem descanso
const WEEKLY_LOAD_REST_DECAY = 22;
const WEEKLY_LOAD_SAFE_THRESHOLD = 45; // abaixo disso, carga acumulada não penaliza o ganho

// Dois jogadores no mesmo plano não evoluem exatamente igual.
function individualVarianceModifier() { return (v) => v * (0.8 + Math.random() * 0.4); }
// Carga alta reduz o quanto a sessão rende — fadiga real reduzindo resposta ao
// treino, além (não em vez) da condição física do dia.
function trainingLoadPenalty(weeklyLoad) {
  const over = Math.max(0, (weeklyLoad || 0) - WEEKLY_LOAD_SAFE_THRESHOLD);
  return clamp(1 - over / 80, 0.35, 1);
}
function applyWeeklyLoad(weeklyLoad, intensity) {
  return clamp((weeklyLoad || 0) + WEEKLY_LOAD_PER_SESSION * intensity.loadMultiplier, 0, 100);
}
function decayWeeklyLoad(weeklyLoad) {
  return clamp((weeklyLoad || 0) - WEEKLY_LOAD_REST_DECAY, 0, 100);
}

// Curva de desaceleração: quanto mais perto do potencial, menor o ganho.
function decelerate(current, potential, rawGain) {
  if (potential <= current) return 0;
  return rawGain * (potential - current) / potential;
}

// Função genérica de composição de modificadores. Não conhece treino, treinador,
// fitness, calendário, partida ou qualquer outro domínio — só recebe um número
// e uma lista de transformações. Com lista vazia, devolve o valor de entrada
// sem alteração (reduce sobre array vazio retorna o initialValue).
function composeModifiers(baseValue, modifiers = []) {
  return modifiers.reduce((value, modifier) => {
    if (typeof modifier === 'function') return modifier(value);
    if (modifier && typeof modifier.multiplier === 'number') return value * modifier.multiplier;
    if (modifier && typeof modifier.flat === 'number') return value + modifier.flat;
    return value;
  }, baseValue);
}

// Recebe o jogador e o id do treino escolhido; devolve attrs decimais atualizados
// + overall recalculado (via computeOverall, sem alterar essa função). Pura.
// `modifiers` é o ponto de extensão pra Growth Profile/Development Focus/Trainer
// no futuro — hoje sempre vazio, então o resultado é idêntico ao anterior.
function applyTraining(player, trainingId, modifiers = []) {
  const training = TRAININGS.find(t => t.id === trainingId);
  if (!training) return player;

  const attrs = { ...player.attrs };
  for (const [attr, weight] of Object.entries(training.effects)) {
    const current = attrs[attr] || 0;
    const potential = player.potential[attr] ?? 99;
    const baseGain = BASE_TRAINING_GAIN * weight;
    const modifiedGain = composeModifiers(baseGain, modifiers);
    const gain = decelerate(current, potential, modifiedGain);
    attrs[attr] = clamp(current + gain, 0, 99);
  }
  return { ...player, attrs, overall: computeOverall(player.position, attrs) };
}


export { POSITIONS, DETAILED_POSITIONS, DETAILED_POSITION_MAP, detailedPositionToLegacy, POSITION_FUNCTIONS, ARCHETYPE_PROFILES, derivePlayerProfile, makePlayerId, normalizeRegisteredPlayer, getRosterPlayerName, validateRegisteredPlayerRecord, validateRegisteredPlayerDatabase, PLAYER_DATABASE_SOURCE, OFFICIAL_PLAYER_DATABASE, OFFICIAL_ACADEMY_PLAYER_DATABASE, OFFICIAL_ACADEMY_DATABASE_COMPLETE, validateAcademyDatabase, getAcademyPlayers, ACADEMY_DATABASE_SELF_CHECK, resolveAcademyCompensation, OFFICIAL_PLAYER_DATABASE_COMPLETE, PLAYER_DATABASE_EXPECTED_CLUBS, validateOfficialCoverage, PLAYER_DATA_MODEL_VERSION, PLAYER_DATA_MODEL_CHECK, PLAYER_DATABASE_COVERAGE_CHECK, PLAYER_DATABASE_COVERAGE_BY_COMPETITION_CHECK, validateOfficialCoverageByCompetition, normalizeClubRoster, getClubRosterPlayers, validatePlayerModelSelfCheck, PLAYER_DATABASE_SELF_CHECK, WEIGHTS, ATTR_LABELS, clamp, computeOverall, TRAININGS, BASE_TRAINING_GAIN, decelerate, composeModifiers, applyTraining, TRAINING_INTENSITIES, individualVarianceModifier, trainingLoadPenalty, applyWeeklyLoad, decayWeeklyLoad };

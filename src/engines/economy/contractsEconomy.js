import { COMPETITION_TEMPLATES } from '../../data/competitions/brazil2026.js';
import { RIVALRIES } from '../match/matchState.js';
import { clamp } from '../player/playerEngine.js';
/* ============================================================================
   CONTRACT / TRANSFER ENGINE — camada mínima de economia. Não conhece Match,
   Competition, Calendar ou Fitness Engine — só recebe números (overall,
   reputação, idade, status) e devolve decisões/valores. Reaproveita
   COMPETITION_TEMPLATES/RIVALRIES já existentes; não cria estrutura paralela.

   UNIDADE CANÔNICA: `salary` é sempre MENSAL em todo o sistema. A única
   conversão pra anual acontece dentro de computeBuyoutClause (× 12, uma vez).

   FONTE dos valores-base: relatório ANRESF/CBF Academy (2026) sobre contratos
   assinados entre clubes brasileiros na janela de transferências — Série A
   ~R$143k/mês, Série B ~R$26,5k/mês, Série C ~R$10,1k/mês, Série D ~R$3,7k/mês
   (piso R$1.621, salário mínimo). Cruzado com reportagens de mercado sobre
   Série C/D. NÃO são valores definitivos — candidatos a recalibração quando
   dados mais detalhados existirem.
============================================================================ */

const OFFICIAL_SALARY_REGISTRY = [];
const OFFICIAL_SALARY_SOURCE = {
  provider: 'CBF/ANRESF', seasonYear: 2026,
  status: 'official_framework_individual_values_not_public',
  url: 'https://www.cbf.com.br/a-cbf/noticias/escala-campeonato-brasileiro-serie-a/2017/cbf-instala-agencia-de-regulacao-e-da-inicio-a-implementacao-do-fair-play-financeiro-no-brasil',
};
// Faixas abaixo são ECONOMIA DO JOGO, não salários reais. Um valor individual
// só vira oficial quando entrar em OFFICIAL_SALARY_REGISTRY com fonte verificável.
const ESTIMATED_SALARY_BANDS = {
  estadual_sp: { base: 1900, floor: 1621, starMultiplier: 6 },
  serie_d: { base: 3700, floor: 1621, starMultiplier: 12 },
  serie_d_2026: { base: 3700, floor: 1621, starMultiplier: 12 },
  serie_c: { base: 10100, floor: 3000, starMultiplier: 8 },
  serie_b: { base: 26500, floor: 8000, starMultiplier: 8 },
  serie_a: { base: 143000, floor: 20000, starMultiplier: 10 },
};

const STATUS_MULTIPLIERS = { prospect: 0.3, squad_player: 0.6, starter: 1.0, key_player: 1.8, star: 3.5 };
const TIER_ORDER = ['estadual_sp', 'serie_d_2026', 'serie_c_2026', 'serie_b_2026', 'serie_a_2026'];

// Status derivado do que já existe hoje (overall vs. média da competição,
// presença na temporada, reputação) — não é escolhido manualmente.
function evaluatePlayerStatus(player, apps, totalRounds, competitionAvgOverall) {
  const overallGap = player.overall - competitionAvgOverall;
  const appRate = totalRounds > 0 ? apps / totalRounds : 0;
  const score = overallGap / 5 + appRate * 3 + (player.reputation - 5) / 5;
  let status;
  if (score >= 6) status = 'star';
  else if (score >= 3.5) status = 'key_player';
  else if (score >= 1.5) status = 'starter';
  else if (score >= 0) status = 'squad_player';
  else status = 'prospect';
  return { status, score };
}

function computeSalary(competitionFamily, status, params = ESTIMATED_SALARY_BANDS) {
  const band = params[competitionFamily] || params.estadual_sp;
  const multiplier = STATUS_MULTIPLIERS[status] ?? 0.6;
  return Math.round(clamp(band.base * multiplier, band.floor, band.base * band.starMultiplier));
}

function getOfficialSalaryRecord(playerId, clubId, seasonYear = 2026) {
  return OFFICIAL_SALARY_REGISTRY.find(r => r.playerId === playerId && r.clubId === clubId && r.seasonYear === seasonYear) || null;
}

function resolvePlayerSalary(player, competitionFamily, status, seasonYear = 2026) {
  const official = getOfficialSalaryRecord(player?.id, player?.registeredClub || player?.clubId, seasonYear);
  if (official && Number.isFinite(official.monthly)) return { monthly: official.monthly, source: official.source || 'official', status: 'official' };
  return { monthly: computeSalary(competitionFamily, status), source: 'game_estimate', status: 'estimated_pending_official' };
}

function makeContract(clubId, salary, seasonYear, durationSeasons = 2) {
  return { clubId, salary, signedSeason: seasonYear, durationSeasons, expiresSeason: seasonYear + durationSeasons };
}

const BUYOUT_FORMULA_PARAMS = { annualMultiplier: 1.5, reputationDivisor: 15, remainingWeight: 0.25 };
// Multa entre clubes — não movimenta o saldo do jogador (não existe economia
// de clube nesta versão, só a do jogador). Fica exibida como contexto/realismo.
function computeBuyoutClause(contract, player, seasonYear, params = BUYOUT_FORMULA_PARAMS) {
  const remaining = Math.max(0, contract.expiresSeason - seasonYear);
  const annualSalary = contract.salary * 12; // única conversão mensal→anual do sistema inteiro
  const base = annualSalary * params.annualMultiplier;
  const reputationFactor = 1 + player.reputation / params.reputationDivisor;
  const remainingFactor = 1 + remaining * params.remainingWeight;
  return Math.round(base * reputationFactor * remainingFactor);
}

// Compensação quando o CLUBE demite sem comprador (paga ao jogador, ao
// contrário da multa entre clubes).
function computeReleaseCompensation(contract, seasonYear) {
  const remaining = Math.max(0, contract.expiresSeason - seasonYear);
  return Math.round(remaining * contract.salary * 12 * 0.5);
}

const CLUB_DECISION_PARAMS = {
  releaseThreshold: -2,
  // Calibração ajustada após simulação de estresse (100 carreiras × 15
  // temporadas): com highStatus/prospectLowApps=2, o clube NUNCA agia por
  // conta própria (2 nunca alcança o limiar de 3) — só reagia a pedido do
  // jogador. Subindo pra 3, o clube também age sozinho ocasionalmente,
  // exatamente como "clube decide primeiro" pretendia desde o desenho original.
  saleWeights: { wantsTransfer: 3, highStatus: 3 },
  loanWeights: { wantsLoan: 3, prospectLowApps: 3 },
};

// CLUBE decide primeiro — pesos configuráveis, nunca hardcoded por nome de
// clube. Devolve uma ação; o jogador só reage depois (ver resolveContractDecision).
function clubSeasonDecision(contract, status, statusScore, seasonYear, playerRequestFlags, appRate, params = CLUB_DECISION_PARAMS) {
  const contractExpiring = contract.expiresSeason - seasonYear <= 0;
  if (contractExpiring && statusScore <= params.releaseThreshold) return 'release';

  let saleWeight = 0;
  if (playerRequestFlags.wantsTransfer) saleWeight += params.saleWeights.wantsTransfer;
  if (status === 'key_player' || status === 'star') saleWeight += params.saleWeights.highStatus;
  if (saleWeight >= 3) return 'consider_sale';

  let loanWeight = 0;
  if (playerRequestFlags.wantsLoan) loanWeight += params.loanWeights.wantsLoan;
  if (status === 'prospect' && appRate < 0.3) loanWeight += params.loanWeights.prospectLowApps;
  if (loanWeight >= 3) return 'offer_loan';

  return contractExpiring ? 'renew' : 'keep_as_is';
}

// "Qual clube REALMENTE teria motivo pra querer esse jogador?" — não é
// sorteio simples: idade, overall relativo, reputação e status compõem um
// score de interesse que decide se um tier ACIMA do atual é plausível.
function computeDemandScore(player, status, competitionAvgOverall, playerRequestFlags) {
  let score = (player.overall - competitionAvgOverall) / 5;
  score += STATUS_MULTIPLIERS[status] ?? 0.6;
  score += (30 - player.age) / 15; // mais jovem = mais valorizado pro nível acima (potencial)
  score += player.reputation / 10;
  if (playerRequestFlags.wantsTransfer) score += 0.5;
  return score;
}

function generateTransferOffers(player, status, currentFamily, competitionAvgOverall, playerRequestFlags) {
  const demand = computeDemandScore(player, status, competitionAvgOverall, playerRequestFlags);
  const currentIndex = TIER_ORDER.indexOf(currentFamily);
  let targetFamily = currentFamily;
  if (demand >= 4 && currentIndex < TIER_ORDER.length - 1) targetFamily = TIER_ORDER[currentIndex + 1];

  const template = COMPETITION_TEMPLATES[targetFamily];
  if (!template) return [];
  const clubs = Array.isArray(template.clubs) ? template.clubs : Object.values(template.clubs || {});
  if (clubs.length === 0) return [];
  const targetClub = clubs[Math.floor(Math.random() * clubs.length)];
  const proposedSalary = computeSalary(targetFamily, status);
  return [{ clubId: targetClub.id, clubName: targetClub.name, family: targetFamily, proposedSalary, proposedDuration: 2 }];
}

// Empréstimo: destino plausível pro NÍVEL ATUAL (não sobe de tier — jogador
// precisa de minutos, não de um salto que ele ainda não teria motivo real pra dar).
function generateLoanOffer(currentFamily) {
  const template = COMPETITION_TEMPLATES[currentFamily];
  if (!template) return null;
  const clubs = Array.isArray(template.clubs) ? template.clubs : Object.values(template.clubs || {});
  if (clubs.length === 0) return null;
  const targetClub = clubs[Math.floor(Math.random() * clubs.length)];
  return { clubId: targetClub.id, clubName: targetClub.name, family: currentFamily, durationSeasons: 1 };
}

/* ============================================================================
   ECONOMY / LIFESTYLE ENGINE — camada isolada, igual ao Contract/Transfer:
   só recebe números (saldo, valor, upkeep) e devolve números. Não conhece
   Match, Competition, Season nem Contract. `economyState.balance` continua
   sendo a MESMA fonte de dinheiro do salário — investir/comprar imóvel só
   move dinheiro de um lugar pro outro, nunca cria dinheiro do nada.

   PATRIMÔNIO LÍQUIDO = saldo em conta + investimentos + soma do valor dos
   imóveis. Retorno de investimento e manutenção de imóveis são SINTÉTICOS
   (não representam mercado real ou preços reais de imóveis) — documentado
   aqui, não escondido.
============================================================================ */
const INVESTMENT_SEASONAL_RETURN = 0.06; // sintético — 6% por temporada, fixo (sem risco/volatilidade nesta v1)
const PROPERTY_OPTIONS = [
  { id: 'apto_pequeno', name: 'Apartamento pequeno', cost: 80000, upkeep: 400 },
  { id: 'apto_medio', name: 'Apartamento médio', cost: 250000, upkeep: 1200 },
  { id: 'casa_grande', name: 'Casa grande', cost: 600000, upkeep: 3000 },
  { id: 'mansao', name: 'Mansão', cost: 1500000, upkeep: 8000 },
];
const INVESTMENT_AMOUNTS = [5000, 20000, 100000];

function computeNetWorth(economyState) {
  const propertiesValue = economyState.properties.reduce((sum, p) => sum + p.value, 0);
  return economyState.balance + economyState.investments + propertiesValue;
}
function investAmount(economyState, amount) {
  if (amount <= 0 || amount > economyState.balance) return economyState; // nunca investe mais do que tem
  return { ...economyState, balance: economyState.balance - amount, investments: economyState.investments + amount };
}
function withdrawAllInvestments(economyState) {
  if (economyState.investments <= 0) return economyState;
  return { ...economyState, balance: economyState.balance + economyState.investments, investments: 0 };
}
function buyProperty(economyState, propertyId) {
  const option = PROPERTY_OPTIONS.find(p => p.id === propertyId);
  if (!option || option.cost > economyState.balance) return economyState; // nunca compra o que não pode pagar
  const newProperty = { id: `${propertyId}_${Date.now()}`, optionId: propertyId, name: option.name, value: option.cost, upkeep: option.upkeep };
  return { ...economyState, balance: economyState.balance - option.cost, properties: [...economyState.properties, newProperty] };
}
// Chamado UMA vez por virada de temporada (nunca por rodada — upkeep e
// retorno de investimento são anuais, diferente do salário que já é por
// rodada). Nunca deixa o saldo ficar negativo por causa de upkeep — se não
// dá pra pagar tudo, paga o que dá, sem inventar dívida (fora de escopo).
function applyAnnualEconomyUpdate(economyState) {
  const totalUpkeep = economyState.properties.reduce((sum, p) => sum + p.upkeep, 0);
  const newBalance = Math.max(0, economyState.balance - totalUpkeep);
  const newInvestments = Math.round(economyState.investments * (1 + INVESTMENT_SEASONAL_RETURN));
  return { ...economyState, balance: newBalance, investments: newInvestments };
}

const POSITIONS = [
  { id: 'GOL', label: 'Goleiro' },
  { id: 'ZAG', label: 'Zagueiro' },
  { id: 'MEI', label: 'Meio-campo' },
  { id: 'ATA', label: 'Atacante' },
];


export { OFFICIAL_SALARY_REGISTRY, OFFICIAL_SALARY_SOURCE, ESTIMATED_SALARY_BANDS, STATUS_MULTIPLIERS, TIER_ORDER, evaluatePlayerStatus, computeSalary, getOfficialSalaryRecord, resolvePlayerSalary, makeContract, BUYOUT_FORMULA_PARAMS, computeBuyoutClause, computeReleaseCompensation, CLUB_DECISION_PARAMS, clubSeasonDecision, computeDemandScore, generateTransferOffers, generateLoanOffer, INVESTMENT_SEASONAL_RETURN, PROPERTY_OPTIONS, INVESTMENT_AMOUNTS, computeNetWorth, investAmount, withdrawAllInvestments, buyProperty, applyAnnualEconomyUpdate, POSITIONS };

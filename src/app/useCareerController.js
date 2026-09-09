import { useState, useEffect, useCallback } from 'react';
import { appStorage } from '../core/storage.js';
import { advanceOtherDivisions, applyDivisionResult, computePromotionRelegation, freshStandings, generateFixtures, resolveRound, sortStandings } from '../engines/match/matchEngine.js';
import { ALL_CLUBS_MAP, BRASILEIRAO_TIEBREAK_CHAIN, COMPETITION_TEMPLATES, SERIE_A_2026_CLUBS, SERIE_B_2026_CLUBS, getActiveClubsMap, initialClubDivision } from '../data/competitions/brazil2026.js';
import { ATTR_LABELS, DETAILED_POSITION_MAP, TRAININGS, applyTraining, clamp, computeOverall, derivePlayerProfile, detailedPositionToLegacy } from '../engines/player/playerEngine.js';
import { SERIE_D_2026_ASSIGNMENT, SERIE_D_2026_CLUB_IDS, SERIE_D_2026_NEXT_STAGE, SERIE_D_2026_STAGE_LABELS, SERIE_D_2026_TIEBREAK_CHAIN, resolveSerieD2026UpTo } from '../data/competitions/serieD2026.js';
import { TIER_ORDER, applyAnnualEconomyUpdate, buyProperty, clubSeasonDecision, computeBuyoutClause, computeReleaseCompensation, computeSalary, evaluatePlayerStatus, generateLoanOffer, generateTransferOffers, investAmount, makeContract, resolvePlayerSalary, withdrawAllInvestments } from '../engines/economy/contractsEconomy.js';
import { CompetitionEngineV2 } from '../engines/competition/CompetitionEngineV2.js';
import { SERIE_C_2026_CLUBS, SERIE_C_2026_FASE1_TIEBREAK_CHAIN, SERIE_C_2026_FASE2_TIEBREAK_CHAIN, resolveSerieC2026UpTo } from '../data/competitions/serieC2026.js';
import { applyLifeChoice, applyMatchCost, applyRestRecovery, applyTrainingCost, buildRoundToDay, crossesNewMonth, findEligibleLifeEvent, getDayType, matchModifier } from '../engines/life/lifeCalendarFitness.jsx';
import { CLUBS_MAP } from '../data/_mock/mockData.js';
import { computeClubEffectiveStrength, getMatchContext, historyForCompetition } from '../engines/match/matchState.js';
import { advanceOfficialWorldDivisions } from '../engines/world/officialWorldSeason.js';
import { appendSystemPost, commentOnSocialPost, createSocialState, publishSocialPost, syncSocialToPlayer } from '../engines/life/socialEngine.js';
import { createPlayerRegistration } from '../data/players/playerRegistration.js';
import { generateTransferNews } from '../ui/screens/world.jsx';
const STORAGE_KEY = 'slice-v2';

export function useCareerController() {
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState('create'); // create, club-select, season, match, season-end
  const [tab, setTab] = useState('home');
  const [player, setPlayer] = useState(null);
  const [seasonYear, setSeasonYear] = useState(2027);
  const [competition, setCompetition] = useState(null);
  const [standings, setStandings] = useState({});
  const [fixtures, setFixtures] = useState([]);
  const [round, setRound] = useState(0);
  const [userClubId, setUserClubId] = useState(null);
  const [stats, setStats] = useState({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
  const [log, setLog] = useState([]);
  const [promotionResult, setPromotionResult] = useState(null);
  const [seasonHistory, setSeasonHistory] = useState([]);
  const [academyState, setAcademyState] = useState({ week: 0, totalWeeks: 26, matches: 0, goals: 0, assists: 0 });
  const [seasonStartSnapshot, setSeasonStartSnapshot] = useState(null);

  const [trainPick, setTrainPick] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingWeek, setPendingWeek] = useState(null);

  // LIFE Slice 1 — corte estrito: só coach/crowd/media + fans. Sem teammates/board.
  const [lifeState, setLifeState] = useState({ relations: { coach: 50, crowd: 50, media: 50 }, fans: 100 });
  const [interviewHistory, setInterviewHistory] = useState([]); // personalidade emerge daqui, nunca vira número
  const [pendingLifeEvent, setPendingLifeEvent] = useState(null); // { event, resumePhase }

  // Calendar + Fitness Engine — dayIndex é a única fonte de tempo; roundToDay
  // nunca é persistido, é sempre derivado de competition.calendar_pattern.
  const [dayIndex, setDayIndex] = useState(0);
  const [fitnessState, setFitnessState] = useState({ condition: 100 });
  const [trainingSkipStreak, setTrainingSkipStreak] = useState(0); // decisão comportamental, não física

  // matchHistory — fonte de verdade pra Form/Momentum/Morale (Passo 2). Nasce
  // aqui, alimentado só pela orquestração; resolveRound nunca escreve nele.
  const [matchHistory, setMatchHistory] = useState({}); // { [clubId]: [{ result, round, competitionId, opponentId, homeAway }] }

  // Mundo Persistente — em que divisão cada clube está agora. Fonte única de
  // verdade pra montar o roster de qualquer competição, substituindo a lista
  // estática por template que existia antes.
  const [worldState, setWorldState] = useState({ clubDivision: initialClubDivision() });

  // Contract/Transfer Engine — infraestrutura mínima, preparada pro Economy/
  // Lifestyle assumir depois sem reescrever nada disso.
  const [economyState, setEconomyState] = useState({ balance: 0, investments: 0, properties: [] });
  const [pendingContractDecision, setPendingContractDecision] = useState(null); // { type: 'loan'|'transfer', offer, ownFamily, nextWorldState }

  // ---- Série D 2026 (Competition Engine V2) — estado da carreira real ----
  // `serieD2026Demo` (nome histórico, mantido pra não mexer em mais lugares
  // do que o necessário) guarda o progresso do jogador pela temporada:
  // grupo, resultados acumulados, fase atual do mata-mata, campanha.
  const [serieD2026Demo, setSerieD2026Demo] = useState(null); // { groupId, groupClubIds, matchResults, result: null|{...} }
  const [serieC2026State, setSerieC2026State] = useState(null); // { customClubIds, droppedOfficialClubId, resultsHistory, rngSeed, stageId, currentOpponentId, hostsSecondLeg, groupClubIds, matchResults, result }
  const [serieB2026State, setSerieB2026State] = useState(null); // { customClubIds, droppedOfficialClubId, matchResults, result, playoffSeed, playoffOpponentId, playoffMatchResults }
  const [serieA2026State, setSerieA2026State] = useState(null); // { customClubIds, droppedOfficialClubId, matchResults, result }
  const [transferNews, setTransferNews] = useState([]);
  const [socialState, setSocialState] = useState(createSocialState());
  useEffect(() => {
    if (competition && competition.participants && competition.participants.length > 4) {
      setTransferNews(generateTransferNews(competition.participants, userClubId, ALL_CLUBS_MAP, 4));
    }
  }, [competition?.id]);

  useEffect(() => {
    (async () => {
      try {
        const res = await appStorage.get(STORAGE_KEY);
        if (res && res.value) {
          const d = JSON.parse(res.value);
          setPhase(d.phase); setPlayer(d.player ? { age: 17, reputation: 5, contract: null, loan: null, wantsTransfer: false, wantsLoan: false, ...d.player } : d.player); setSeasonYear(d.seasonYear);
          setCompetition(d.competition); setStandings(d.standings || {});
          setFixtures(d.fixtures || []); setRound(d.round || 0);
          setUserClubId(d.userClubId); setStats(d.stats); setLog(d.log || []);
          setPromotionResult(d.promotionResult || null);
          setSeasonHistory(d.seasonHistory || []);
          setAcademyState(d.academyState || { week: 0, totalWeeks: 26, matches: 0, goals: 0, assists: 0 });
          setSeasonStartSnapshot(d.seasonStartSnapshot || null);
          setLifeState(d.lifeState || { relations: { coach: 50, crowd: 50, media: 50 }, fans: 100 });
          setInterviewHistory(d.interviewHistory || []);
          setDayIndex(d.dayIndex || 0);
          setFitnessState(d.fitnessState || { condition: 100 });
          setTrainingSkipStreak(d.trainingSkipStreak || 0);
          setMatchHistory(d.matchHistory || {});
          setWorldState(d.worldState || { clubDivision: initialClubDivision() });
          setEconomyState({ balance: 0, investments: 0, properties: [], ...(d.economyState || {}) });
          setSocialState(d.socialState || createSocialState(d.player || {}));
          // Progresso de campanha (Série D/C/B/A) e telas pendentes (partida em
          // andamento, evento de vida, decisão de contrato) nunca eram salvos —
          // um recarregamento da aba no meio de qualquer um desses (comum no
          // navegador do celular: tela apagar, trocar de app) deixava `phase`
          // restaurado mas o dado que aquela fase precisa vindo `null`, o que
          // trava a tela (preta, sem nada pra clicar) ou quebra bem no fim do
          // grupo/mata-mata (acesso a campo de objeto nulo).
          setSerieD2026Demo(d.serieD2026Demo || null);
          setSerieC2026State(d.serieC2026State || null);
          setSerieB2026State(d.serieB2026State || null);
          setSerieA2026State(d.serieA2026State || null);
          setPendingWeek(d.pendingWeek || null);
          setPendingLifeEvent(d.pendingLifeEvent || null);
          setPendingContractDecision(d.pendingContractDecision || null);
        }
      } catch (e) { /* nada salvo ainda */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const d = { phase, player, seasonYear, competition, standings, fixtures, round, userClubId, stats, log, promotionResult, seasonHistory, seasonStartSnapshot, lifeState, interviewHistory, dayIndex, fitnessState, trainingSkipStreak, matchHistory, economyState, worldState, academyState, socialState, serieD2026Demo, serieC2026State, serieB2026State, serieA2026State, pendingWeek, pendingLifeEvent, pendingContractDecision };
    appStorage.set(STORAGE_KEY, JSON.stringify(d)).catch(() => {});
  }, [loaded, phase, player, seasonYear, competition, standings, fixtures, round, userClubId, stats, log, promotionResult, seasonHistory, seasonStartSnapshot, lifeState, interviewHistory, dayIndex, fitnessState, trainingSkipStreak, matchHistory, economyState, worldState, academyState, socialState, serieD2026Demo, serieC2026State, serieB2026State, serieA2026State, pendingWeek, pendingLifeEvent, pendingContractDecision]);

  const pushLog = useCallback((msg) => setLog(prev => [msg, ...prev].slice(0, 30)), []);

  // Semana de base: decisão real do jogador (treinar UMA atividade escolhida,
  // ou descansar) — antes disso a Academia escolhia o treino sozinha por
  // rodízio e nunca narrava nada, então toda semana parecia igual e vazia.
  // Reaproveita exatamente o mesmo TRAININGS/applyTraining do profissional,
  // nenhuma mecânica nova.
  function advanceAcademyWeek(decision, trainingId) {
    if (!player || phase !== 'academy') return;
    const nextWeek = academyState.week + 1;
    let finalPlayer = player;
    let weekMsg;

    if (decision === 'train' && trainingId) {
      finalPlayer = applyTraining(player, trainingId);
      const training = TRAININGS.find(t => t.id === trainingId);
      const deltas = Object.keys(training.effects)
        .map(attr => ({ label: ATTR_LABELS[attr], delta: finalPlayer.attrs[attr] - player.attrs[attr] }))
        .filter(d => d.delta > 0.01);
      weekMsg = deltas.length
        ? `Base, semana ${nextWeek} — treino de ${training.name}: ${deltas.map(d => `${d.label} +${d.delta.toFixed(2)}`).join(', ')}.`
        : `Base, semana ${nextWeek} — treino de ${training.name}.`;
    } else {
      weekMsg = `Base, semana ${nextWeek} — descanso.`;
    }

    const matchWeek = nextWeek % 2 === 0;
    const performance = finalPlayer.overall + (nextWeek % 7);
    const goal = matchWeek && performance >= 50 && nextWeek % 5 === 0 ? 1 : 0;
    const assist = matchWeek && performance >= 47 && nextWeek % 6 === 0 ? 1 : 0;
    const nextAcademy = { ...academyState, week: nextWeek, matches: academyState.matches + (matchWeek ? 1 : 0), goals: academyState.goals + goal, assists: academyState.assists + assist };

    // Marcos narrados só quando o próprio dado já calculado cruza algo real
    // (primeiro jogo/gol/assistência) — nada inventado, só destacado.
    let milestone = null;
    if (matchWeek) {
      if (nextAcademy.matches === 1) milestone = 'Seu primeiro jogo pelo time sub-20!';
      else if (goal && nextAcademy.goals === 1) milestone = 'Seu primeiro gol na formação!';
      else if (assist && nextAcademy.assists === 1) milestone = 'Sua primeira assistência na formação!';
      else if (goal) milestone = 'Marcou no jogo da semana.';
      else if (assist) milestone = 'Deu assistência no jogo da semana.';
    }
    pushLog(milestone ? `${weekMsg} ${milestone}` : weekMsg);

    setPlayer({ ...finalPlayer, age: nextWeek >= academyState.totalWeeks ? 17 : finalPlayer.age, careerPhase: nextWeek >= academyState.totalWeeks ? 'professional' : 'academy', academyStatus: nextWeek >= academyState.totalWeeks ? 'graduated' : 'youth_player' });
    setAcademyState(nextAcademy);
    setShowPicker(false);
    if (nextWeek >= academyState.totalWeeks) {
      setPhase('club-select');
      pushLog(`${player.name} concluiu a temporada-base da formação: ${nextAcademy.matches} jogos, ${nextAcademy.goals} gols e ${nextAcademy.assists} assistências.`);
    }
  }

  function startCareer(name, position) {
    const base = () => 32 + Math.random() * 14;
    const detailedPosition = DETAILED_POSITION_MAP[position] ? position : null;
    const legacyPosition = detailedPosition ? detailedPositionToLegacy(detailedPosition) : position;
    const attrs = { finalizacao: base(), passe: base(), velocidade: base(), defesa: base(), fisico: base() };
    // Potencial nasce na criação e fica fixo (idade/lesão/contexto ficam fora deste escopo).
    const potential = {};
    for (const k in attrs) potential[k] = clamp(attrs[k] + 15 + Math.random() * 25, attrs[k] + 10, 99);
    const overall = computeOverall(legacyPosition, attrs);
    const profile = derivePlayerProfile(detailedPosition, attrs);
    setPlayer({
      id: `career-${Date.now()}`, name, displayName: name, position: legacyPosition, detailedPosition,
      functions: profile.functions, archetype: profile.archetype, specialization: profile.specialization,
      registeredClub: null, currentClub: null, playerSource: 'career_created',
      attrs, potential, overall, age: 16, careerPhase: 'academy', academyStatus: 'youth_player', salarySource: 'pending_official', salaryStatus: 'pending_official', reputation: 5, shirtNumber: null, registration: createPlayerRegistration({ shirtNumberStatus: 'pending_official' }), contract: null, loan: null, wantsTransfer: false, wantsLoan: false,
    });
    setAcademyState({ week: 0, totalWeeks: 26, matches: 0, goals: 0, assists: 0 });
    const freshSocial = createSocialState({ reputation: 5 });
    setSocialState(freshSocial);
    setPhase('academy');
  }

  function chooseClub(clubId) {
    const groupId = SERIE_D_2026_ASSIGNMENT[clubId];
    const groupClubIds = SERIE_D_2026_CLUB_IDS.filter(id => SERIE_D_2026_ASSIGNMENT[id] === groupId);
    const cfg = {
      id: `serie_d_2026_${seasonYear}`, name: `Brasileirão Série D 2026 — Grupo ${groupId}`,
      family: 'serie_d_2026', format: 'league', participants: groupClubIds,
      promotion: { count: 4, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    const salaryResolution = resolvePlayerSalary(player, cfg.family, 'prospect', seasonYear);
    const salary = salaryResolution.monthly;
    const contract = makeContract(clubId, salary, seasonYear, 2);
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(groupClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(groupClubIds, true));
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setUserClubId(clubId);
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => syncSocialToPlayer({ ...p, clubId, registeredClub: clubId, currentClub: clubId, shirtNumber: null, registration: createPlayerRegistration({ clubId, seasonYear, competitionId: cfg.family, shirtNumberStatus: 'pending_official' }), contract, salarySource: salaryResolution.source, salaryStatus: salaryResolution.status }, socialState));
    setSeasonStartSnapshot({ overall: player.overall, reputation: player.reputation });
    setSerieD2026Demo({
      groupId, groupClubIds, droppedOfficialClubId: null, customClubIds: SERIE_D_2026_CLUB_IDS, customAssignment: SERIE_D_2026_ASSIGNMENT,
      rngSeed: Math.floor(Math.random() * 1000000), resultsHistory: {},
      stageId: null, currentOpponentId: null, hostsSecondLeg: null,
      matchResults: [], accessSecured: false, result: null,
    });
    setPhase('season'); setTab('home');
    pushLog(`${player.name} assinou com o ${ALL_CLUBS_MAP[clubId].name} para disputar o ${cfg.name}.`);
  }

  // Sorteio SIMULADO dos grupos pra temporadas seguintes (2027+) — só 2026
  // tem sorteio oficial da CBF publicado. Documentado explicitamente: isso
  // NUNCA deve ser confundido com dado real, é só continuidade de carreira.
  function redrawSerieD2026GroupsForNewSeason(myClubId) {
    const shuffled = SERIE_D_2026_CLUB_IDS.filter(id => id !== myClubId);
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const insertAt = Math.floor(Math.random() * (shuffled.length + 1));
    shuffled.splice(insertAt, 0, myClubId);
    const assignment = {};
    shuffled.forEach((id, i) => { assignment[id] = `A${String(Math.floor(i / 6) + 1).padStart(2, '0')}`; });
    return assignment;
  }

  // Sai da tela de resultado — sempre continua a carreira pra próxima
  // temporada (não existe mais "voltar" pra um estado anterior; a Série D
  // 2026 É a carreira agora). Usado tanto quando eliminado quanto após
  // conseguir acesso (Série C real ainda não existe no motor novo — ver
  // startNewSerieD2026Season).
  function exitSerieD2026Demo() {
    if (serieD2026Demo && serieD2026Demo.accessSecured) { startSerieC2026Season(); return; }
    startNewSerieD2026Season();
  }

  // Monta o confronto de ida e volta de UMA fase de mata-mata — reaproveita
  // o mesmo loop de temporada existente (2 rodadas, 1 jogo cada, mandos
  // invertidos). Nenhuma tela/engine nova precisa existir pra isso funcionar.
  function beginSerieD2026Tie(stageId, opponentId, hostsSecondLeg) {
    const homeLeg1 = hostsSecondLeg ? opponentId : userClubId;
    const awayLeg1 = hostsSecondLeg ? userClubId : opponentId;
    const cfg = {
      id: `serie_d_2026_${stageId}`, name: `Série D 2026 — ${SERIE_D_2026_STAGE_LABELS[stageId]} (TESTE)`,
      family: 'serie_d_2026', format: 'league', participants: [userClubId, opponentId],
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings([userClubId, opponentId]));
    setFixtures([[[homeLeg1, awayLeg1]], [[awayLeg1, homeLeg1]]]);
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSerieD2026Demo(prev => ({ ...prev, stageId, currentOpponentId: opponentId, hostsSecondLeg, matchResults: [], result: null }));
    setPhase('season'); setTab('home');
    pushLog(`[TESTE] ${SERIE_D_2026_STAGE_LABELS[stageId]}: você enfrenta ${ALL_CLUBS_MAP[opponentId]?.name || opponentId} — ida e volta.`);
  }

  // Fim de uma temporada da Série D 2026 (com ou sem acesso) — como não
  // existe mais Paulista pra "voltar", isso sempre inicia a temporada
  // seguinte com o MESMO jogador/clube. Enquanto a Série C real não existir
  // no motor novo, alcançar o acesso também leva pra uma nova temporada de
  // Série D — deixado claro na tela de resultado, nunca escondido.
  function startNewSerieD2026Season() {
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    const newAssignment = redrawSerieD2026GroupsForNewSeason(userClubId);
    const groupId = newAssignment[userClubId];
    const groupClubIds = Object.keys(newAssignment).filter(id => newAssignment[id] === groupId);
    const cfg = {
      id: `serie_d_2026_${seasonYear + 1}`, name: `Brasileirão Série D — Grupo ${groupId}`,
      family: 'serie_d_2026', format: 'league', participants: groupClubIds,
      promotion: { count: 4, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(groupClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(groupClubIds, true));
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1 }));
    setSerieD2026Demo({
      groupId, groupClubIds, droppedOfficialClubId: null, customClubIds: SERIE_D_2026_CLUB_IDS, customAssignment: newAssignment,
      rngSeed: Math.floor(Math.random() * 1000000), resultsHistory: {},
      stageId: null, currentOpponentId: null, hostsSecondLeg: null,
      matchResults: [], accessSecured: false, result: null,
    });
    setPhase('season'); setTab('home');
    pushLog(`Nova temporada — Grupo ${groupId} (sorteio simulado; só 2026 tem sorteio oficial da CBF).`);
  }

  // ---- Série C 2026 (Competition Engine V2) — entrada e fases jogáveis ----
  // Reaproveita o mesmo loop de temporada (Match/Fitness/telas) — só muda a
  // origem dos dados (20 clubes reais, 3 fases). Entrada acontece quando o
  // jogador consegue acesso na Série D (semifinalista/playoff) OU ao
  // continuar uma carreira já na Série C.
  function startSerieC2026Season(customClubIdsOverride) {
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    let customClubIds = customClubIdsOverride;
    if (!customClubIds) {
      // Primeira entrada: substitui um clube real aleatório pelo do jogador —
      // mesmo princípio já usado na Série D (o clube do jogador não é um dos
      // 20 oficiais da Série C 2026, precisa ocupar o lugar de um deles).
      const dropIndex = Math.floor(Math.random() * SERIE_C_2026_CLUBS.length);
      customClubIds = SERIE_C_2026_CLUBS.map((name, i) => (i === dropIndex ? userClubId : name));
      pushLog(`Acesso à Série C 2026! Você assume o lugar de ${SERIE_C_2026_CLUBS[dropIndex]} entre os 20 clubes reais.`);
    }
    const cfg = {
      id: `serie_c_2026_${seasonYear + 1}`, name: 'Brasileirão Série C 2026 — 1ª Fase',
      family: 'serie_c_2026', format: 'league', participants: customClubIds,
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] }, // desempate real usa a cadeia oficial (ver season-end)
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(customClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(customClubIds, false)); // Art. 14 — turno único
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1 }));
    setSerieC2026State({
      customClubIds, rngSeed: Math.floor(Math.random() * 1000000), resultsHistory: {},
      stageId: 'fase1', currentOpponentId: null, hostsSecondLeg: null, groupClubIds: null,
      matchResults: [], accessSecured: false, result: null,
    });
    setPhase('season'); setTab('home');
  }

  // Fase 2 — grupo de 4 (turno e returno, 6 rodadas). Diferente da Série D:
  // aqui o jogador joga a fase inteira contra os outros 3 do grupo, não um
  // confronto de mata-mata contra 1 adversário só.
  function beginSerieC2026Fase2(groupClubIds) {
    const cfg = {
      id: 'serie_c_2026_fase2', name: 'Brasileirão Série C 2026 — 2ª Fase (Grupo)',
      family: 'serie_c_2026', format: 'league', participants: groupClubIds,
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(groupClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(groupClubIds, true)); // Art. 17 — turno e returno
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSerieC2026State(prev => ({ ...prev, stageId: 'fase2', groupClubIds, matchResults: [], result: null }));
    setPhase('season'); setTab('home');
    pushLog(`2ª Fase da Série C 2026: grupo de 4 (turno e returno).`);
  }

  // Fase 3 — final, ida e volta entre os 2 finalistas.
  function beginSerieC2026Final(opponentId, hostsSecondLeg) {
    const homeLeg1 = hostsSecondLeg ? opponentId : userClubId;
    const awayLeg1 = hostsSecondLeg ? userClubId : opponentId;
    const cfg = {
      id: 'serie_c_2026_final', name: 'Brasileirão Série C 2026 — Final',
      family: 'serie_c_2026', format: 'league', participants: [userClubId, opponentId],
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings([userClubId, opponentId]));
    setFixtures([[[homeLeg1, awayLeg1]], [[awayLeg1, homeLeg1]]]);
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSerieC2026State(prev => ({ ...prev, stageId: 'fase3_final', currentOpponentId: opponentId, hostsSecondLeg, matchResults: [], result: null }));
    setPhase('season'); setTab('home');
    pushLog(`Final da Série C 2026: você enfrenta ${ALL_CLUBS_MAP[opponentId]?.name || opponentId} — ida e volta.`);
  }

  // Sai da tela de resultado da Série C — decide a temporada seguinte:
  // rebaixado volta pra Série D; promovido (Art. 5 — top2 do grupo, ou
  // campeão/vice) vai pra Série B de verdade; meio de tabela repete a Série C.
  function exitSerieC2026Season() {
    const outcome = serieC2026State?.result?.outcomeType;
    if (outcome === 'relegated') { startNewSerieD2026Season(); return; }
    if (['promoted', 'finalist', 'champion', 'runner_up'].includes(outcome)) { startSerieB2026Season(); return; }
    startSerieC2026Season();
  }

  // ---- Série B 2026 — entrada, playoff de acesso, e saída de temporada ----
  function startSerieB2026Season(customClubIdsOverride) {
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    let customClubIds = customClubIdsOverride;
    if (!customClubIds) {
      const dropIndex = Math.floor(Math.random() * SERIE_B_2026_CLUBS.length);
      customClubIds = SERIE_B_2026_CLUBS.map((name, i) => (i === dropIndex ? userClubId : name));
      pushLog(`Acesso à Série B 2026! Você assume o lugar de ${SERIE_B_2026_CLUBS[dropIndex]} entre os 20 clubes reais.`);
    }
    const cfg = {
      id: `serie_b_2026_${seasonYear + 1}`, name: 'Brasileirão Série B 2026',
      family: 'serie_b_2026', format: 'league', participants: customClubIds,
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(customClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(customClubIds, true));
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1 }));
    setSerieB2026State({ customClubIds, matchResults: [], result: null, playoffOpponentId: null, playoffHostsSecondLeg: null, playoffAmIBetterSeed: null, playoffMatchResults: [] });
    setPhase('season'); setTab('home');
  }

  function beginSerieB2026Playoff(opponentId, hostsSecondLeg, amIBetterSeed) {
    const homeLeg1 = hostsSecondLeg ? opponentId : userClubId;
    const awayLeg1 = hostsSecondLeg ? userClubId : opponentId;
    const cfg = {
      id: 'serie_b_2026_playoff', name: 'Brasileirão Série B 2026 — Playoff de Acesso',
      family: 'serie_b_2026', format: 'league', participants: [userClubId, opponentId],
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings([userClubId, opponentId]));
    setFixtures([[[homeLeg1, awayLeg1]], [[awayLeg1, homeLeg1]]]);
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSerieB2026State(prev => ({ ...prev, playoffOpponentId: opponentId, playoffHostsSecondLeg: hostsSecondLeg, playoffAmIBetterSeed: amIBetterSeed, playoffMatchResults: [], result: null }));
    setPhase('season'); setTab('home');
    pushLog(`Playoff de acesso da Série B 2026: você enfrenta ${ALL_CLUBS_MAP[opponentId]?.name || opponentId} — ida e volta, sem pênaltis.`);
  }

  function exitSerieB2026Season() {
    const outcome = serieB2026State?.result?.outcomeType;
    if (outcome === 'relegated') { startSerieC2026Season(); return; }
    if (outcome === 'promoted_direct' || outcome === 'promoted_playoff') { startSerieA2026Season(); return; }
    startSerieB2026Season();
  }

  // ---- Série A 2026 — entrada e saída de temporada (topo da pirâmide) ----
  function startSerieA2026Season(customClubIdsOverride) {
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    let customClubIds = customClubIdsOverride;
    if (!customClubIds) {
      const dropIndex = Math.floor(Math.random() * SERIE_A_2026_CLUBS.length);
      customClubIds = SERIE_A_2026_CLUBS.map((name, i) => (i === dropIndex ? userClubId : name));
      pushLog(`Acesso à Série A 2026! Você assume o lugar de ${SERIE_A_2026_CLUBS[dropIndex]} entre os 20 clubes reais — o topo do futebol brasileiro.`);
    }
    const cfg = {
      id: `serie_a_2026_${seasonYear + 1}`, name: 'Brasileirão Série A 2026',
      family: 'serie_a_2026', format: 'league', participants: customClubIds,
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(customClubIds));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(customClubIds, true));
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1 }));
    setSerieA2026State({ customClubIds, matchResults: [], result: null });
    setPhase('season'); setTab('home');
  }

  function exitSerieA2026Season() {
    const outcome = serieA2026State?.result?.outcomeType;
    if (outcome === 'relegated') { startSerieB2026Season(); return; }
    startSerieA2026Season();
  }

  function togglePicker() { setShowPicker(s => !s); }

  // Dia de treino: Treinar / Descansar / Não quero treinar são três decisões
  // com significados diferentes — nunca a mesma coisa por baixo.
  function advanceTrainingDay(decision, trainingId) {
    let finalPlayer = player;
    let newCondition = fitnessState.condition;
    let newSkipStreak = trainingSkipStreak;
    let logMsg = '';

    if (decision === 'train') {
      finalPlayer = applyTraining(player, trainingId);
      newCondition = applyTrainingCost(fitnessState.condition);
      newSkipStreak = 0;
      const training = TRAININGS.find(t => t.id === trainingId);
      const deltas = Object.keys(training.effects)
        .map(attr => ({ label: ATTR_LABELS[attr], delta: finalPlayer.attrs[attr] - player.attrs[attr] }))
        .filter(d => d.delta > 0.01);
      logMsg = deltas.length
        ? `Treino (${training.name}): ${deltas.map(d => `${d.label} +${d.delta.toFixed(2)}`).join(', ')}.`
        : `Treino (${training.name}) concluído.`;
    } else if (decision === 'rest') {
      newCondition = applyRestRecovery(fitnessState.condition);
      newSkipStreak = 0;
      logMsg = 'Você optou por descansar e recuperar a condição física.';
    } else if (decision === 'skip') {
      // Fisicamente tratado como descanso — a diferença é comportamental, não física.
      newCondition = applyRestRecovery(fitnessState.condition);
      newSkipStreak = trainingSkipStreak + 1;
      const wasFatigued = fitnessState.condition < 50;
      const penalty = wasFatigued ? -1 : -3; // desgastado recentemente = mais compreensível
      setLifeState(prev => ({ ...prev, relations: { ...prev.relations, coach: clamp(prev.relations.coach + penalty, 0, 100) } }));
      logMsg = wasFatigued
        ? 'Você optou por não treinar. O departamento físico entende o desgaste recente.'
        : 'Você optou por não treinar sem justificativa aparente. O treinador não gostou.';
    }

    setPlayer(finalPlayer);
    setFitnessState({ condition: newCondition });
    setTrainingSkipStreak(newSkipStreak);
    pushLog(logMsg);
    setTrainPick(null);
    setShowPicker(false);

    // LIFE só entra quando o comportamento vira algo narrativamente relevante —
    // não a cada falta isolada.
    if (decision === 'skip' && newSkipStreak >= 3) {
      const event = findEligibleLifeEvent({ type: 'behavior', skipStreak: newSkipStreak });
      if (event) {
        setPendingLifeEvent({ event, resumePhase: 'season', resetSkipStreak: true });
        setPhase('life-event');
        if (player.contract && crossesNewMonth(competition.family, seasonYear, dayIndex)) {
          setEconomyState(e => ({ ...e, balance: e.balance + player.contract.salary }));
        }
        setDayIndex(d => d + 1);
        return;
      }
    }
    if (player.contract && crossesNewMonth(competition.family, seasonYear, dayIndex)) {
      setEconomyState(e => ({ ...e, balance: e.balance + player.contract.salary }));
    }
    setDayIndex(d => d + 1);
  }

  // Dia de recuperação (o seguinte a uma partida): recuperação automática, sem
  // decisão do jogador — não é um dia de treino disponível.
  function advanceRecoveryDay() {
    setFitnessState({ condition: applyRestRecovery(fitnessState.condition) });
    pushLog('Dia de recuperação física após a partida.');
    if (player.contract && crossesNewMonth(competition.family, seasonYear, dayIndex)) {
      setEconomyState(e => ({ ...e, balance: e.balance + player.contract.salary }));
    }
    setDayIndex(d => d + 1);
  }

  function playWeek() {
    const roundFixtures = fixtures[round];
    if (!roundFixtures) return;

    // Fitness entra aqui como "jogador efetivo" — resolveRound nunca sabe disso.
    const effectivePlayer = { ...player, overall: player.overall * matchModifier(fitnessState.condition) };

    // Clubes ATIVOS da competição atual (Paulista ou Série D, o que estiver
    // valendo) — nunca o CLUBS_MAP fixo. Contexto é por CONFRONTO, por isso a
    // montagem percorre roundFixtures.
    const activeClubsMap = getActiveClubsMap(competition, userClubId);
    const effectiveClubsMap = {};
    roundFixtures.forEach(([homeId, awayId]) => {
      const context = getMatchContext(homeId, awayId);
      const homeResults = historyForCompetition(matchHistory[homeId] || [], competition.id);
      const awayResults = historyForCompetition(matchHistory[awayId] || [], competition.id);
      effectiveClubsMap[homeId] = { ...activeClubsMap[homeId], overall: computeClubEffectiveStrength(activeClubsMap[homeId].overall, homeResults, context) };
      effectiveClubsMap[awayId] = { ...activeClubsMap[awayId], overall: computeClubEffectiveStrength(activeClubsMap[awayId].overall, awayResults, context) };
    });

    const { newStandings, userMatchInfo, playerDelta, matchResults } = resolveRound(roundFixtures, effectiveClubsMap, standings, userClubId, effectivePlayer, round, competition.id, fitnessState.condition);
    const matchCondition = applyMatchCost(fitnessState.condition);
    setPendingWeek({ userMatchInfo, playerDelta, newStandings, nextRound: round + 1, matchCondition, matchResults });
    setPhase('match');
  }

  function continueAfterMatch() {
    const { userMatchInfo, playerDelta, newStandings, nextRound, matchCondition, matchResults } = pendingWeek;
    let finalPlayer = player;
    let finalStats = stats;

    if (userMatchInfo) {
      if (userMatchInfo.calledUp) {
        finalStats = { apps: stats.apps + 1, goals: stats.goals + playerDelta.goals, assists: stats.assists + playerDelta.assists, ratingSum: stats.ratingSum + playerDelta.rating };
        const repDelta = playerDelta.rating >= 7.5 ? 2 : playerDelta.rating <= 4.5 ? -1 : 0;
        finalPlayer = { ...finalPlayer, reputation: clamp(finalPlayer.reputation + repDelta, 1, 30) };
        pushLog(`Rodada ${round + 1}: ${userMatchInfo.home} ${userMatchInfo.gh}x${userMatchInfo.ga} ${userMatchInfo.away} — nota ${userMatchInfo.rating.toFixed(1)}${playerDelta.goals ? `, ${playerDelta.goals} gol(s)` : ''}${playerDelta.assists ? `, ${playerDelta.assists} assist.` : ''}.`);
        const socialText = `${userMatchInfo.home} ${userMatchInfo.gh} x ${userMatchInfo.ga} ${userMatchInfo.away}. ${playerDelta.goals ? `${player.name} marcou e chamou a atenção. ` : ''}${playerDelta.assists ? `${player.name} ainda participou com assistência. ` : ''}Mais um capítulo da temporada.`;
        setSocialState(prev => appendSystemPost(prev, { authorId: 'wpg-match', authorName: 'WPG Sports', text: socialText, context: 'Resultado da rodada' }));
      } else {
        pushLog(`Rodada ${round + 1}: ${userMatchInfo.home} ${userMatchInfo.gh}x${userMatchInfo.ga} ${userMatchInfo.away} — você ficou no banco.`);
        setSocialState(prev => appendSystemPost(prev, { authorId: 'wpg-match', authorName: 'WPG Sports', text: `${userMatchInfo.home} ${userMatchInfo.gh} x ${userMatchInfo.ga} ${userMatchInfo.away}. ${player.name} acompanhou a partida do banco.`, context: 'Resultado da rodada' }));
      }
    }

    setPlayer(finalPlayer);
    setStats(finalStats);
    setStandings(newStandings);
    setRound(nextRound);
    setFitnessState({ condition: matchCondition });
    setDayIndex(d => d + 1);
    setPendingWeek(null);

    // Salário é mensal de verdade agora (ver crossesNewMonth) — creditado
    // em qualquer avanço de dia que vire o mês, não mais por rodada.
    if (player.contract && crossesNewMonth(competition.family, seasonYear, dayIndex)) {
      setEconomyState(e => ({ ...e, balance: e.balance + player.contract.salary }));
    }

    // matchHistory nasce aqui — resolveRound só devolveu o fato bruto (matchResults);
    // é a orquestração que decide como registrar, pro ponto de vista de cada clube.
    setMatchHistory(prev => {
      const next = { ...prev };
      matchResults.forEach(({ homeId, awayId, gh, ga, round: r, competitionId }) => {
        const homeResult = gh > ga ? 'W' : gh < ga ? 'L' : 'D';
        const awayResult = gh > ga ? 'L' : gh < ga ? 'W' : 'D';
        next[homeId] = [...(next[homeId] || []), { result: homeResult, round: r, competitionId, opponentId: awayId, homeAway: 'home' }];
        next[awayId] = [...(next[awayId] || []), { result: awayResult, round: r, competitionId, opponentId: homeId, homeAway: 'away' }];
      });
      return next;
    });

    // Série D 2026 (demo) — acumula os resultados brutos desta fase, pro
    // confronto direto/campanha funcionarem de verdade no fim dela.
    // Nunca toca matchHistory nem nada do caminho legado.
    if (serieD2026Demo) {
      setSerieD2026Demo(prev => (prev ? { ...prev, matchResults: [...prev.matchResults, ...matchResults] } : prev));
    }
    // Série C 2026 — mesmo princípio.
    if (serieC2026State) {
      setSerieC2026State(prev => (prev ? { ...prev, matchResults: [...prev.matchResults, ...matchResults] } : prev));
    }
    // Série B 2026 — acumula na liga OU no playoff, dependendo de qual está rolando.
    if (serieB2026State) {
      setSerieB2026State(prev => (prev ? (
        prev.playoffOpponentId
          ? { ...prev, playoffMatchResults: [...prev.playoffMatchResults, ...matchResults] }
          : { ...prev, matchResults: [...prev.matchResults, ...matchResults] }
      ) : prev));
    }
    // Série A 2026 — liga pura, sem mata-mata/playoff nenhum.
    if (serieA2026State) {
      setSerieA2026State(prev => (prev ? { ...prev, matchResults: [...prev.matchResults, ...matchResults] } : prev));
    }

    // Decide qual seria a próxima fase (season ou season-end) exatamente como antes.
    let nextPhase = 'season';
    if (nextRound >= fixtures.length && competition.family === 'serie_d_2026' && !serieD2026Demo.stageId) {
      // ---- Série D 2026 (Competition Engine V2) — fim da Fase 1 (grupo real) ----
      const rows = Object.values(newStandings).map(r => ({ ...r, sg: r.gp - r.gc }));
      const allGroupResults = [...serieD2026Demo.matchResults, ...matchResults];
      const { sorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(rows, SERIE_D_2026_TIEBREAK_CHAIN, {
        headToHeadResults: allGroupResults, drawSeed: `serieD2026demo_${serieD2026Demo.groupId}`,
      });
      const myPosition = sorted.findIndex(r => r.club_id === userClubId) + 1;
      const advanced = myPosition <= 4;
      const resultsHistory = { fase1_grupos: allGroupResults };

      let nextTie = null, campaignSoFar = null;
      try {
        if (advanced) {
          const resolved = resolveSerieD2026UpTo('fase2_r64', serieD2026Demo.customClubIds, serieD2026Demo.customAssignment, resultsHistory, serieD2026Demo.rngSeed);
          campaignSoFar = resolved.resolvedStages.fase1_grupos.finalCampaign;
          const myPair = resolved.resolvedStages.fase2_r64.roundsPlayed[0].pairings.find(p => p.includes(userClubId));
          if (myPair) {
            const opponentId = myPair[0] === userClubId ? myPair[1] : myPair[0];
            nextTie = { stageId: 'fase2_r64', opponentId, hostsSecondLeg: myPair[1] === userClubId };
          }
        }
      } catch (e) { console.error('[Série D 2026 demo] erro ao calcular a Fase 2:', e); }

      setSerieD2026Demo(prev => ({ ...prev, resultsHistory, campaignSoFar, result: { position: myPosition, total: sorted.length, advanced, nextTie, phaseReached: 'fase1_grupos', outcomeType: advanced ? null : 'eliminated' } }));
      pushLog(`[TESTE] Fim da Fase 1 — Grupo ${serieD2026Demo.groupId}: você terminou em ${myPosition}º lugar. ${advanced ? 'Avançou pra Fase 2!' : 'Não avançou.'}`);
      nextPhase = 'serie-d-2026-result';
    } else if (nextRound >= fixtures.length && competition.family === 'serie_d_2026' && serieD2026Demo.stageId) {
      // ---- Série D 2026 — fim de UM confronto de mata-mata (ida+volta reais) ----
      const stageId = serieD2026Demo.stageId;
      const opponentId = serieD2026Demo.currentOpponentId;
      const isPlayoff = stageId === 'playoff';
      const me = newStandings[userClubId], opp = newStandings[opponentId];
      const allTieResults = [...serieD2026Demo.matchResults, ...matchResults];

      let iWon;
      if (isPlayoff) {
        // Art. 21: pontos por perna decidem primeiro; empate → saldo; empate → campanha. NUNCA pênaltis.
        if (me.pts !== opp.pts) iWon = me.pts > opp.pts;
        else {
          const mySg = me.gp - me.gc, oppSg = opp.gp - opp.gc;
          if (mySg !== oppSg) iWon = mySg > oppSg;
          else {
            const campaignNow = CompetitionEngineV2.addPhaseToCampaign(serieD2026Demo.campaignSoFar || CompetitionEngineV2.initCampaignTracker([userClubId, opponentId]), allTieResults);
            const { sorted: campSorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(
              [CompetitionEngineV2.campaignRow(campaignNow, userClubId), CompetitionEngineV2.campaignRow(campaignNow, opponentId)],
              SERIE_D_2026_TIEBREAK_CHAIN, { drawSeed: `playoff_final:${userClubId}:${opponentId}` }
            );
            iWon = campSorted[0].club_id === userClubId;
          }
        }
      } else {
        // Art. 17: saldo de gols agregado decide; empate → pênaltis (sorteio determinístico, sem minigame).
        const mySg = me.gp - me.gc, oppSg = opp.gp - opp.gc;
        if (mySg !== oppSg) iWon = mySg > oppSg;
        else iWon = CompetitionEngineV2.deterministicHash(`penaltis:${stageId}:${userClubId}`) < CompetitionEngineV2.deterministicHash(`penaltis:${stageId}:${opponentId}`);
      }

      const pairForHistory = serieD2026Demo.hostsSecondLeg ? [opponentId, userClubId] : [userClubId, opponentId];
      const leg1Raw = allTieResults[0], leg2Raw = allTieResults[1];
      const resultsHistory = {
        ...serieD2026Demo.resultsHistory,
        [stageId]: { myId: userClubId, leg1: { gh: leg1Raw.gh, ga: leg1Raw.ga }, leg2: { gh: leg2Raw.gh, ga: leg2Raw.ga }, penaltyWinner: iWon ? userClubId : opponentId },
      };

      let nextTie = null, outcomeType = null, accessSecured = serieD2026Demo.accessSecured, campaignSoFar = serieD2026Demo.campaignSoFar;
      try {
        if (stageId === 'fase5_quartas') {
          if (iWon) {
            accessSecured = true; // Art. 6 — semifinalista já garante acesso, decida o que decidir a seguir
            const resolved = resolveSerieD2026UpTo('fase6_semifinal', serieD2026Demo.customClubIds, serieD2026Demo.customAssignment, resultsHistory, serieD2026Demo.rngSeed);
            campaignSoFar = resolved.resolvedStages.fase5_quartas.finalCampaign;
            const myPair = resolved.resolvedStages.fase6_semifinal.roundsPlayed[0].pairings.find(p => p.includes(userClubId));
            if (myPair) { const oid = myPair[0] === userClubId ? myPair[1] : myPair[0]; nextTie = { stageId: 'fase6_semifinal', opponentId: oid, hostsSecondLeg: myPair[1] === userClubId }; }
            outcomeType = 'access_semifinalist';
          } else {
            const resolved = resolveSerieD2026UpTo('playoff', serieD2026Demo.customClubIds, serieD2026Demo.customAssignment, resultsHistory, serieD2026Demo.rngSeed);
            campaignSoFar = resolved.resolvedStages.fase5_quartas.finalCampaign;
            const myPair = resolved.resolvedStages.playoff.roundsPlayed[0].pairings.find(p => p.includes(userClubId));
            if (myPair) { const oid = myPair[0] === userClubId ? myPair[1] : myPair[0]; nextTie = { stageId: 'playoff', opponentId: oid, hostsSecondLeg: myPair[1] === userClubId }; }
            outcomeType = 'eliminated_to_playoff';
          }
        } else if (stageId === 'playoff') {
          outcomeType = iWon ? 'access_playoff' : 'eliminated';
        } else if (stageId === 'fase7_final') {
          outcomeType = iWon ? 'champion' : 'runner_up';
        } else if (stageId === 'fase6_semifinal') {
          outcomeType = iWon ? null : 'eliminated_after_access';
          if (iWon) {
            const resolved = resolveSerieD2026UpTo('fase7_final', serieD2026Demo.customClubIds, serieD2026Demo.customAssignment, resultsHistory, serieD2026Demo.rngSeed);
            campaignSoFar = resolved.resolvedStages.fase6_semifinal.finalCampaign;
            const myPair = resolved.resolvedStages.fase7_final.roundsPlayed[0].pairings.find(p => p.includes(userClubId));
            if (myPair) { const oid = myPair[0] === userClubId ? myPair[1] : myPair[0]; nextTie = { stageId: 'fase7_final', opponentId: oid, hostsSecondLeg: myPair[1] === userClubId }; }
          }
        } else {
          // fase2_r64, fase3_r32, fase4_oitavas — segue a sequência normal ou elimina.
          if (iWon) {
            const next = SERIE_D_2026_NEXT_STAGE[stageId];
            const resolved = resolveSerieD2026UpTo(next, serieD2026Demo.customClubIds, serieD2026Demo.customAssignment, resultsHistory, serieD2026Demo.rngSeed);
            campaignSoFar = resolved.resolvedStages[stageId].finalCampaign;
            const myPair = resolved.resolvedStages[next].roundsPlayed[0].pairings.find(p => p.includes(userClubId));
            if (myPair) { const oid = myPair[0] === userClubId ? myPair[1] : myPair[0]; nextTie = { stageId: next, opponentId: oid, hostsSecondLeg: myPair[1] === userClubId }; }
          } else {
            outcomeType = 'eliminated';
          }
        }
      } catch (e) { console.error(`[Série D 2026 demo] erro ao avançar de ${stageId}:`, e); outcomeType = outcomeType || 'error'; }

      setSerieD2026Demo(prev => ({ ...prev, resultsHistory, campaignSoFar, accessSecured, result: { iWon, phaseReached: stageId, opponentId, nextTie, outcomeType } }));
      pushLog(`[TESTE] ${SERIE_D_2026_STAGE_LABELS[stageId]}: você ${iWon ? 'avançou' : 'foi eliminado'} contra ${ALL_CLUBS_MAP[opponentId]?.name || opponentId}.`);
      nextPhase = 'serie-d-2026-result';
    } else if (nextRound >= fixtures.length && competition.family === 'serie_c_2026') {
      // ---- Série C 2026 (Competition Engine V2) — fim de fase ----
      const stageId = serieC2026State.stageId;

      if (stageId === 'fase1') {
        // Art. 14/16 — liga única, 20 clubes, SEM confronto direto.
        const rows = Object.values(newStandings).map(r => ({ ...r, sg: r.gp - r.gc }));
        const allResults = [...serieC2026State.matchResults, ...matchResults];
        const { sorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(rows, SERIE_C_2026_FASE1_TIEBREAK_CHAIN, { drawSeed: 'serie_c_2026_fase1' });
        const myPosition = sorted.findIndex(r => r.club_id === userClubId) + 1;
        const advanced = myPosition <= 8; // Art. 15
        const relegated = myPosition >= 19; // Art. 42 (2 últimos de 20)
        const resultsHistory = { fase1: allResults };

        let nextGroupInfo = null;
        if (advanced) {
          try {
            const resolved = resolveSerieC2026UpTo('fase2', serieC2026State.customClubIds, resultsHistory, serieC2026State.rngSeed);
            const myGroupId = resolved.resolvedStages.fase2.assignment[userClubId];
            const groupClubIds = Object.keys(resolved.resolvedStages.fase2.assignment).filter(id => resolved.resolvedStages.fase2.assignment[id] === myGroupId);
            nextGroupInfo = { groupClubIds };
          } catch (e) { console.error('[Série C 2026] erro ao calcular a 2ª Fase:', e); }
        }
        const outcomeType = advanced ? 'advance_fase2' : (relegated ? 'relegated' : 'mid_table');
        setSerieC2026State(prev => ({ ...prev, resultsHistory, result: { phaseReached: 'fase1', position: myPosition, total: sorted.length, outcomeType, nextGroupInfo } }));
        pushLog(`[Série C 2026] Fim da 1ª Fase: ${myPosition}º de ${sorted.length}.`);
        nextPhase = 'serie-c-2026-result';
      } else if (stageId === 'fase2') {
        // Art. 17/20 — grupo de 4, COM confronto direto (só entre 2, sem reaplicação).
        const rows = Object.values(newStandings).map(r => ({ ...r, sg: r.gp - r.gc }));
        const allGroupResults = [...serieC2026State.matchResults, ...matchResults];
        const { sorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(rows, SERIE_C_2026_FASE2_TIEBREAK_CHAIN, { headToHeadResults: allGroupResults, drawSeed: 'serie_c_2026_fase2' });
        const myPosition = sorted.findIndex(r => r.club_id === userClubId) + 1;
        const promoted = myPosition <= 2; // Art. 5
        const isFinalist = myPosition === 1; // Art. 19 — só o 1º de cada grupo
        const resultsHistory = { ...serieC2026State.resultsHistory, fase2: allGroupResults };

        let nextTie = null;
        if (isFinalist) {
          try {
            const resolved = resolveSerieC2026UpTo('fase3_final', serieC2026State.customClubIds, resultsHistory, serieC2026State.rngSeed);
            const myPair = resolved.resolvedStages.fase3_final.roundsPlayed[0].pairings.find(p => p.includes(userClubId));
            if (myPair) { const oid = myPair[0] === userClubId ? myPair[1] : myPair[0]; nextTie = { opponentId: oid, hostsSecondLeg: myPair[1] === userClubId }; }
          } catch (e) { console.error('[Série C 2026] erro ao calcular a final:', e); }
        }
        const outcomeType = isFinalist ? 'finalist' : (promoted ? 'promoted' : 'eliminated_fase2');
        setSerieC2026State(prev => ({ ...prev, resultsHistory, result: { phaseReached: 'fase2', position: myPosition, outcomeType, nextTie } }));
        pushLog(`[Série C 2026] Fim da 2ª Fase: ${myPosition}º do grupo.`);
        nextPhase = 'serie-c-2026-result';
      } else if (stageId === 'fase3_final') {
        // Art. 21 — saldo agregado decide; empate → pênaltis (sorteio determinístico). SEM campanha aqui.
        const opponentId = serieC2026State.currentOpponentId;
        const me = newStandings[userClubId], opp = newStandings[opponentId];
        const mySg = me.gp - me.gc, oppSg = opp.gp - opp.gc;
        const iWon = mySg !== oppSg ? mySg > oppSg : CompetitionEngineV2.deterministicHash(`penaltis:serie_c_final:${userClubId}`) < CompetitionEngineV2.deterministicHash(`penaltis:serie_c_final:${opponentId}`);
        const outcomeType = iWon ? 'champion' : 'runner_up'; // promoção já garantida desde a fase2
        setSerieC2026State(prev => ({ ...prev, result: { phaseReached: 'fase3_final', outcomeType, opponentId } }));
        pushLog(`[Série C 2026] Final: você ${iWon ? 'venceu' : 'perdeu'} contra ${ALL_CLUBS_MAP[opponentId]?.name || opponentId}.`);
        nextPhase = 'serie-c-2026-result';
      }
    } else if (nextRound >= fixtures.length && competition.family === 'serie_b_2026') {
      // ---- Série B 2026 — liga (com playoff de acesso) ou fim do playoff ----
      if (!serieB2026State.playoffOpponentId) {
        // Fim da liga (38 rodadas) — mesma cadeia oficial de A/B.
        const rows = Object.values(newStandings).map(r => ({ ...r, sg: r.gp - r.gc }));
        const allResults = [...serieB2026State.matchResults, ...matchResults];
        const { sorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(rows, BRASILEIRAO_TIEBREAK_CHAIN, { headToHeadResults: allResults, drawSeed: 'serie_b_2026_liga' });
        const myPosition = sorted.findIndex(r => r.club_id === userClubId) + 1;

        let outcomeType, nextTie = null;
        if (myPosition <= 2) {
          outcomeType = 'promoted_direct';
        } else if (myPosition <= 6) {
          // 3ºx6º, 4ºx5º — mando/desempate sempre pro melhor posicionado do par (sem campanha computada, o seed já é a resposta).
          const amIBetterSeed = myPosition <= 4;
          const mirrorPosition = myPosition === 3 ? 6 : myPosition === 6 ? 3 : myPosition === 4 ? 5 : 4;
          const opponentId = sorted[mirrorPosition - 1].club_id;
          nextTie = { opponentId, hostsSecondLeg: amIBetterSeed, amIBetterSeed };
          outcomeType = 'playoff_needed';
        } else if (myPosition >= 17) {
          outcomeType = 'relegated';
        } else {
          outcomeType = 'mid_table';
        }
        setSerieB2026State(prev => ({ ...prev, result: { phaseReached: 'liga', position: myPosition, total: sorted.length, outcomeType, nextTie } }));
        pushLog(`[Série B 2026] Fim da temporada: ${myPosition}º de ${sorted.length}.`);
        nextPhase = 'serie-b-2026-result';
      } else {
        // Fim do playoff — Art. próprio: sem pênaltis, seed fixo decide o empate agregado.
        const opponentId = serieB2026State.playoffOpponentId;
        const amIBetterSeed = serieB2026State.playoffAmIBetterSeed;
        const me = newStandings[userClubId], opp = newStandings[opponentId];
        const mySg = me.gp - me.gc, oppSg = opp.gp - opp.gc;
        const iWon = mySg !== oppSg ? mySg > oppSg : amIBetterSeed; // empate agregado → melhor campanha (seed) vence
        const outcomeType = iWon ? 'promoted_playoff' : 'eliminated_playoff';
        setSerieB2026State(prev => ({ ...prev, result: { phaseReached: 'playoff', outcomeType, opponentId } }));
        pushLog(`[Série B 2026] Playoff: você ${iWon ? 'venceu' : 'perdeu'} contra ${ALL_CLUBS_MAP[opponentId]?.name || opponentId}.`);
        nextPhase = 'serie-b-2026-result';
      }
    } else if (nextRound >= fixtures.length && competition.family === 'serie_a_2026') {
      // ---- Série A 2026 — topo da pirâmide, liga pura, sem mata-mata ----
      const rows = Object.values(newStandings).map(r => ({ ...r, sg: r.gp - r.gc }));
      const allResults = [...serieA2026State.matchResults, ...matchResults];
      const { sorted } = CompetitionEngineV2.sortStandingsWithTiebreakChain(rows, BRASILEIRAO_TIEBREAK_CHAIN, { headToHeadResults: allResults, drawSeed: 'serie_a_2026_liga' });
      const myPosition = sorted.findIndex(r => r.club_id === userClubId) + 1;
      const outcomeType = myPosition === 1 ? 'champion' : (myPosition >= 17 ? 'relegated' : 'mid_table');
      setSerieA2026State(prev => ({ ...prev, result: { phaseReached: 'liga', position: myPosition, total: sorted.length, outcomeType } }));
      pushLog(`[Série A 2026] Fim da temporada: ${myPosition}º de ${sorted.length}.`);
      nextPhase = 'serie-a-2026-result';
    } else if (nextRound >= fixtures.length) {
      const sorted = sortStandings(newStandings, competition.tiebreakers);
      const promo = computePromotionRelegation(competition, sorted);
      const position = sorted.findIndex(r => r.club_id === userClubId) + 1;
      const promoted = promo.promoted.includes(userClubId);
      const relegated = promo.relegated.includes(userClubId);
      const record = {
        year: seasonYear, club: getActiveClubsMap()[userClubId].name, competition: competition.name,
        position, totalClubs: sorted.length, games: finalStats.apps, goals: finalStats.goals,
        assists: finalStats.assists, avgRating: finalStats.apps ? Number((finalStats.ratingSum / finalStats.apps).toFixed(1)) : null,
        overallStart: seasonStartSnapshot.overall, overallEnd: finalPlayer.overall,
        reputationStart: seasonStartSnapshot.reputation, reputationEnd: finalPlayer.reputation,
        promoted, relegated, target: promoted ? promo.promotion_target : (relegated ? promo.relegation_target : null),
      };
      setSeasonHistory(prev => [...prev, record]);
      setPromotionResult({ position, total: sorted.length, promoted, relegated, target: record.target });
      pushLog(`Fim da temporada ${seasonYear}: ${getActiveClubsMap()[userClubId].name} terminou em ${position}º lugar.`);
      // Mundo Persistente: promoção/rebaixamento valem pra TODOS os clubes
      // dessa divisão, não só pro jogador — corrige o "clube some" quando
      // outro clube muda de divisão independente da sua trajetória.
      setWorldState(ws => ({ clubDivision: applyDivisionResult(ws.clubDivision, competition.family, promo) }));
      nextPhase = 'season-end';
    }

    // LIFE entra aqui, e só aqui: fato puro derivado do que já foi calculado acima.
    // resolveRound/playWeek nunca sabem que isso existe.
    const lifeContext = (userMatchInfo && userMatchInfo.calledUp)
      ? { type: 'match_performance', goals: playerDelta.goals, assists: playerDelta.assists, rating: playerDelta.rating,
          matchWon: userMatchInfo.isUserHome ? userMatchInfo.gh > userMatchInfo.ga : userMatchInfo.ga > userMatchInfo.gh,
          isFirstCareerGoal: stats.goals === 0 && playerDelta.goals > 0 }
      : null;
    const eligibleEvent = lifeContext ? findEligibleLifeEvent(lifeContext) : null;

    if (eligibleEvent) {
      setPendingLifeEvent({ event: eligibleEvent, resumePhase: nextPhase });
      setPhase('life-event');
    } else {
      setPhase(nextPhase);
      if (nextPhase === 'season') setTab('home');
    }
  }

  function chooseLifePosture(postureId) {
    const { event, resumePhase, resetSkipStreak, setsTransferRequest, setsLoanRequest } = pendingLifeEvent;
    const effects = applyLifeChoice(event, postureId);
    if (effects) {
      setLifeState(prev => ({
        relations: {
          coach: clamp(prev.relations.coach + (effects.relations?.coach || 0), 0, 100),
          crowd: clamp(prev.relations.crowd + (effects.relations?.crowd || 0), 0, 100),
          media: clamp(prev.relations.media + (effects.relations?.media || 0), 0, 100),
        },
        fans: Math.max(0, prev.fans + (effects.fans || 0)),
      }));
      setInterviewHistory(prev => [...prev, { eventId: event.id, posture: postureId, year: seasonYear, round: round + 1 }]);
      pushLog(`Entrevista: você respondeu de forma ${postureId}.`);
    }
    if (resetSkipStreak) setTrainingSkipStreak(0);
    // O pedido em si (transferência/empréstimo) só é REGISTRADO aqui — quem
    // decide se ele vira algo real é clubSeasonDecision, na próxima transição.
    if (setsTransferRequest) setPlayer(p => ({ ...p, wantsTransfer: true }));
    if (setsLoanRequest) setPlayer(p => ({ ...p, wantsLoan: true }));
    setPendingLifeEvent(null);
    setPhase(resumePhase);
    if (resumePhase === 'season') setTab('home');
  }

  function requestTransfer() {
    const event = findEligibleLifeEvent({ type: 'behavior', action: 'transfer_request' });
    if (event) setPendingLifeEvent({ event, resumePhase: 'season', setsTransferRequest: true });
    setPhase('life-event'); setTab('home');
  }

  function requestLoan() {
    const event = findEligibleLifeEvent({ type: 'behavior', action: 'loan_request' });
    if (event) setPendingLifeEvent({ event, resumePhase: 'season', setsLoanRequest: true });
    setPhase('life-event'); setTab('home');
  }

  // Vida Financeira — cada handler só chama o Economy Engine puro (que já
  // recusa sozinho operações sem dinheiro suficiente) e atualiza o estado.
  function handleInvest(amount) { setEconomyState(e => investAmount(e, amount)); }
  function handleWithdrawInvestments() { setEconomyState(e => withdrawAllInvestments(e)); }
  function handleBuyProperty(propertyId) { setEconomyState(e => buyProperty(e, propertyId)); }

  // Montagem da temporada em si — reaproveitada tanto pelo caminho direto
  // (sem decisão pendente) quanto depois de resolver uma decisão de contrato.
  //
  // `nextWorldState` já vem PRONTO (com o clube do jogador na divisão certa e
  // as outras divisões já avançadas) — esta função só lê dele, nunca decide
  // quem está em cada divisão. targetFamily é sempre uma string simples
  // ('estadual_sp', 'serie_d', ...), nunca mais um objeto de template inteiro.
  function finalizeNextSeason(nextPlayer, targetClubId, targetFamily, nextWorldState, logMsg) {
    const ids = Object.keys(nextWorldState.clubDivision).filter(id => nextWorldState.clubDivision[id] === targetFamily);
    if (!ids.includes(targetClubId)) ids.push(targetClubId); // segurança — não deveria acontecer se o worldState já foi atualizado corretamente
    const template = COMPETITION_TEMPLATES[targetFamily] || COMPETITION_TEMPLATES.estadual_sp;
    const cfg = template.makeConfig(seasonYear + 1, ids);
    if (logMsg) pushLog(logMsg);

    setWorldState(nextWorldState);
    setCompetition(cfg);
    setStandings(freshStandings(ids));
    setFixtures(generateFixtures(cfg));
    setRound(0);
    setDayIndex(0);
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    setUserClubId(targetClubId);
    setPlayer(nextPlayer);
    setSeasonStartSnapshot({ overall: nextPlayer.overall, reputation: nextPlayer.reputation });
    setPromotionResult(null);
    setPendingContractDecision(null);
    setPhase('season'); setTab('home');
  }

  function continueNextSeason() {
    // Salário agora é creditado por rodada (ver continueAfterMatch) — nada
    // a pagar aqui na transição em si, evita pagar duas vezes.

    const activeMap = ALL_CLUBS_MAP;
    const clubsInDivision = Object.keys(worldState.clubDivision).filter(id => worldState.clubDivision[id] === competition.family);
    const avgOverall = clubsInDivision.reduce((s, id) => s + activeMap[id].overall, 0) / clubsInDivision.length;
    const totalRounds = fixtures.length;
    const appRate = totalRounds > 0 ? stats.apps / totalRounds : 0;
    const { status, score } = evaluatePlayerStatus(player, stats.apps, totalRounds, avgOverall);
    const requestFlags = { wantsTransfer: !!player.wantsTransfer, wantsLoan: !!player.wantsLoan };

    // Mundo Persistente: a divisão que o jogador acabou de jogar já foi
    // atualizada (ver continueAfterMatch, no fim de temporada) — aqui só
    // avançamos TODAS AS OUTRAS divisões que existem hoje, de forma leve.
    const nextWorldState = { clubDivision: advanceOfficialWorldDivisions(worldState.clubDivision, competition.family, seasonYear + 1) };
    // targetFamily de "ficar no seu próprio clube" é sempre onde o Mundo
    // Persistente já colocou ele — reflete promoção/rebaixamento automaticamente.
    const ownFamily = nextWorldState.clubDivision[userClubId] || competition.family;
    const promotedUp = ownFamily !== competition.family && TIER_ORDER.indexOf(ownFamily) > TIER_ORDER.indexOf(competition.family);
    const relegatedDown = ownFamily !== competition.family && TIER_ORDER.indexOf(ownFamily) < TIER_ORDER.indexOf(competition.family);
    const divisionChangeLog = promotedUp ? `Promovido! Você agora disputa: ${COMPETITION_TEMPLATES[ownFamily]?.makeConfig?.(0, [])?.name || ownFamily}.`
      : relegatedDown ? `Rebaixado. Você agora disputa: ${COMPETITION_TEMPLATES[ownFamily]?.makeConfig?.(0, [])?.name || ownFamily}.`
      : null;

    // Retorno de empréstimo — o clube de ORIGEM reassume antes de qualquer
    // nova decisão de mercado; a divisão de origem já foi atualizada acima
    // (o Mundo Persistente também simula a divisão do clube emprestador).
    if (player.loan && seasonYear + 1 >= player.loan.returnSeason) {
      const parentClubId = player.loan.parentClubId;
      const parentFamily = nextWorldState.clubDivision[parentClubId] || player.loan.parentContract.clubId;
      const restoredPlayer = { ...player, age: player.age + 1, contract: player.loan.parentContract, loan: null, wantsTransfer: false, wantsLoan: false };
      finalizeNextSeason(restoredPlayer, parentClubId, parentFamily, nextWorldState, 'Fim do empréstimo. Você retorna ao clube de origem.');
      return;
    }

    const decision = clubSeasonDecision(player.contract, status, score, seasonYear, requestFlags, appRate);

    // Mudança de divisão (promoção OU rebaixamento) tem precedência sobre o
    // mercado de contrato — não faz sentido o clube negociar/emprestar/
    // dispensar você na mesma transição em que sua divisão mudou por mérito
    // esportivo. O mercado volta a ser avaliado normalmente a partir da nova
    // divisão, na temporada seguinte.
    const divisionChanged = promotedUp || relegatedDown;

    if (decision === 'offer_loan' && !divisionChanged) {
      const offer = generateLoanOffer(competition.family);
      if (offer) {
        setPendingContractDecision({ type: 'loan', offer, ownFamily, nextWorldState, status });
        setPhase('contract-decision');
        return;
      }
    }

    if (decision === 'consider_sale' && !divisionChanged) {
      const offers = generateTransferOffers(player, status, competition.family, avgOverall, requestFlags);
      if (offers.length > 0) {
        setPendingContractDecision({ type: 'transfer', offer: offers[0], ownFamily, nextWorldState, status });
        setPhase('contract-decision');
        return;
      }
    }

    if (decision === 'release' && !divisionChanged) {
      const offers = generateTransferOffers(player, status, competition.family, avgOverall, { wantsTransfer: true, wantsLoan: false });
      const oldClubName = activeMap[userClubId]?.name;
      if (offers.length > 0) {
        const offer = offers[0];
        const compensation = computeReleaseCompensation(player.contract, seasonYear);
        setEconomyState(e => ({ ...e, balance: e.balance + compensation }));
        const nextPlayer = { ...player, age: player.age + 1, contract: makeContract(offer.clubId, offer.proposedSalary, seasonYear + 1, offer.proposedDuration), wantsTransfer: false, wantsLoan: false };
        finalizeNextSeason(nextPlayer, offer.clubId, offer.family, nextWorldState, `Dispensado pelo ${oldClubName} (compensação recebida). Assinou com o ${offer.clubName}.`);
      } else {
        // Fallback de segurança: sem interessados, o clube reconsidera e renova.
        const salary = computeSalary(competition.family, status);
        const nextPlayer = { ...player, age: player.age + 1, contract: makeContract(userClubId, salary, seasonYear + 1, 2), wantsTransfer: false, wantsLoan: false };
        finalizeNextSeason(nextPlayer, userClubId, ownFamily, nextWorldState, `O ${oldClubName} avaliou dispensar você, mas não houve interessados — contrato renovado.`);
      }
      return;
    }

    if (decision === 'renew') {
      const salary = computeSalary(competition.family, status);
      const nextPlayer = { ...player, age: player.age + 1, contract: makeContract(userClubId, salary, seasonYear + 1, 2), wantsTransfer: false, wantsLoan: false };
      finalizeNextSeason(nextPlayer, userClubId, ownFamily, nextWorldState, divisionChangeLog || `Contrato renovado com o ${activeMap[userClubId]?.name}.`);
      return;
    }

    // keep_as_is — comportamento preservado, nada muda no vínculo.
    const nextPlayer = { ...player, age: player.age + 1, wantsTransfer: false, wantsLoan: false };
    finalizeNextSeason(nextPlayer, userClubId, ownFamily, nextWorldState, divisionChangeLog);
  }

  // JOGADOR reage à decisão do clube — aceitar ou recusar.
  function resolveContractDecision(accepted) {
    const { type, offer, ownFamily, nextWorldState } = pendingContractDecision;

    if (!accepted) {
      setLifeState(prev => ({ ...prev, relations: { ...prev.relations, coach: clamp(prev.relations.coach - 3, 0, 100) } }));
      const label = type === 'loan' ? 'o empréstimo' : 'a proposta de transferência';
      const nextPlayer = { ...player, age: player.age + 1, wantsTransfer: false, wantsLoan: false };
      finalizeNextSeason(nextPlayer, userClubId, ownFamily, nextWorldState, `Você recusou ${label}. O clube não gostou da recusa.`);
      return;
    }

    if (type === 'loan') {
      const nextPlayer = {
        ...player, age: player.age + 1, wantsTransfer: false, wantsLoan: false,
        loan: { parentClubId: userClubId, parentContract: player.contract, loanClubId: offer.clubId, returnSeason: seasonYear + 1 + offer.durationSeasons },
      };
      finalizeNextSeason(nextPlayer, offer.clubId, offer.family, nextWorldState, `Empréstimo aceito! Você joga pelo ${offer.clubName} nesta temporada.`);
      return;
    }

    if (type === 'transfer') {
      const buyout = computeBuyoutClause(player.contract, player, seasonYear);
      const oldClubName = ALL_CLUBS_MAP[userClubId]?.name;
      const nextPlayer = { ...player, age: player.age + 1, contract: makeContract(offer.clubId, offer.proposedSalary, seasonYear + 1, offer.proposedDuration), wantsTransfer: false, wantsLoan: false };
      finalizeNextSeason(nextPlayer, offer.clubId, offer.family, nextWorldState, `Transferência aceita! Multa de R$ ${buyout.toLocaleString('pt-BR')} paga ao ${oldClubName}. Você assinou com o ${offer.clubName}.`);
    }
  }

  function handleSocialPublish(toneId, context = {}) {
    const result = publishSocialPost(socialState, player, toneId, context);
    if (!result.post) return;
    setSocialState(result.state);
    setPlayer(prev => syncSocialToPlayer(prev, result.state));
    pushLog(`${player?.name || 'Jogador'} publicou uma mensagem em tom ${result.post.toneLabel.toLowerCase()}.`);
  }

  function handleSocialComment(targetPost, toneId, context = {}) {
    const result = commentOnSocialPost(socialState, player, targetPost, toneId, context);
    if (!result.comment) return;
    setSocialState(result.state);
    setPlayer(prev => syncSocialToPlayer(prev, result.state));
    pushLog(`${player?.name || 'Jogador'} comentou uma publicação de ${targetPost.authorName}.`);
  }

  function resetCareer() {
    appStorage.delete(STORAGE_KEY).catch(() => {});
    setPhase('create'); setPlayer(null); setSeasonYear(2027); setCompetition(null);
    setStandings({}); setFixtures([]); setRound(0); setUserClubId(null);
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 }); setLog([]); setPromotionResult(null);
    setSeasonHistory([]); setSeasonStartSnapshot(null); setAcademyState({ week: 0, totalWeeks: 26, matches: 0, goals: 0, assists: 0 }); setTrainPick(null); setShowPicker(false); setPendingWeek(null);
    setLifeState({ relations: { coach: 50, crowd: 50, media: 50 }, fans: 100 });
    setInterviewHistory([]); setPendingLifeEvent(null);
    setDayIndex(0); setFitnessState({ condition: 100 }); setTrainingSkipStreak(0);
    setMatchHistory({});
    setEconomyState({ balance: 0, investments: 0, properties: [] }); setPendingContractDecision(null);
    setWorldState({ clubDivision: initialClubDivision() });
    setSocialState(createSocialState());
    setTab('home');
  }


  const activeClubsMap = (userClubId && competition) ? getActiveClubsMap(competition, userClubId) : CLUBS_MAP;
  const club = userClubId ? activeClubsMap[userClubId] : null;
  const roundToDay = competition ? buildRoundToDay(fixtures.length, competition.calendar_pattern) : {};
  const dayType = competition ? getDayType(dayIndex, roundToDay) : null;

  return { loaded, setLoaded, socialState, handleSocialPublish, handleSocialComment, academyState, advanceAcademyWeek, phase, setPhase, tab, setTab, player, setPlayer, seasonYear, setSeasonYear, competition, setCompetition, standings, setStandings, fixtures, setFixtures, round, setRound, userClubId, setUserClubId, stats, setStats, log, setLog, promotionResult, setPromotionResult, seasonHistory, setSeasonHistory, seasonStartSnapshot, setSeasonStartSnapshot, trainPick, setTrainPick, showPicker, setShowPicker, pendingWeek, setPendingWeek, lifeState, setLifeState, interviewHistory, setInterviewHistory, pendingLifeEvent, setPendingLifeEvent, dayIndex, setDayIndex, fitnessState, setFitnessState, trainingSkipStreak, setTrainingSkipStreak, matchHistory, setMatchHistory, worldState, setWorldState, economyState, setEconomyState, pendingContractDecision, setPendingContractDecision, serieD2026Demo, setSerieD2026Demo, serieC2026State, setSerieC2026State, serieB2026State, setSerieB2026State, serieA2026State, setSerieA2026State, transferNews, setTransferNews, pushLog, startCareer, chooseClub, redrawSerieD2026GroupsForNewSeason, exitSerieD2026Demo, beginSerieD2026Tie, startNewSerieD2026Season, startSerieC2026Season, beginSerieC2026Fase2, beginSerieC2026Final, exitSerieC2026Season, startSerieB2026Season, beginSerieB2026Playoff, exitSerieB2026Season, startSerieA2026Season, exitSerieA2026Season, togglePicker, advanceTrainingDay, advanceRecoveryDay, playWeek, continueAfterMatch, chooseLifePosture, requestTransfer, requestLoan, handleInvest, handleWithdrawInvestments, handleBuyProperty, finalizeNextSeason, continueNextSeason, resolveContractDecision, resetCareer };
}

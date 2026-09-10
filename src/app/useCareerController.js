import { useState, useEffect, useCallback } from 'react';
import { appStorage } from '../core/storage.js';
import { advanceOtherDivisions, applyDivisionResult, computePromotionRelegation, freshStandings, generateFixtures, resolveRound, sortStandings } from '../engines/match/matchEngine.js';
import { ALL_CLUBS_MAP, BRASILEIRAO_TIEBREAK_CHAIN, COMPETITION_TEMPLATES, SERIE_A_2026_CLUBS, SERIE_B_2026_CLUBS, getActiveClubsMap, initialClubDivision } from '../data/competitions/brazil2026.js';
import { ATTR_LABELS, DETAILED_POSITION_MAP, TRAININGS, TRAINING_INTENSITIES, applyTraining, applyWeeklyLoad, clamp, computeOverall, decayWeeklyLoad, derivePlayerProfile, detailedPositionToLegacy, individualVarianceModifier, trainingLoadPenalty } from '../engines/player/playerEngine.js';
import { SERIE_D_2026_ASSIGNMENT, SERIE_D_2026_CLUB_IDS, SERIE_D_2026_NEXT_STAGE, SERIE_D_2026_STAGE_LABELS, SERIE_D_2026_TIEBREAK_CHAIN, resolveSerieD2026UpTo } from '../data/competitions/serieD2026.js';
import { TIER_ORDER, applyAnnualEconomyUpdate, buyProperty, clubSeasonDecision, computeBuyoutClause, computeReleaseCompensation, computeSalary, evaluatePlayerStatus, generateLoanOffer, generateTransferOffers, investAmount, makeContract, resolvePlayerSalary, withdrawAllInvestments } from '../engines/economy/contractsEconomy.js';
import { CompetitionEngineV2 } from '../engines/competition/CompetitionEngineV2.js';
import { COPINHA_OWN_ID, COPINHA_OWN_NAME, COPINHA_ROUND_LABELS, COPINHA_TOTAL_ROUNDS, drawCopinhaOpponents, evaluateCopinhaScouting, pickScoutedClub } from '../engines/competition/copinhaEngine.js';
import { SERIE_C_2026_CLUBS, SERIE_C_2026_FASE1_TIEBREAK_CHAIN, SERIE_C_2026_FASE2_TIEBREAK_CHAIN, resolveSerieC2026UpTo } from '../data/competitions/serieC2026.js';
import { applyLifeChoice, applyMatchCost, applyRestRecovery, applyTrainingCost, buildRoundToDay, crossedMilestone, crossesNewMonth, describeMatchPerformance, findEligibleLifeEvent, getDayType, matchModifier, MILESTONE_APPS_THRESHOLDS, MILESTONE_GOALS_THRESHOLDS } from '../engines/life/lifeCalendarFitness.jsx';
import { CLUBS_MAP } from '../data/_mock/mockData.js';
import { computeClubEffectiveStrength, getMatchContext, historyForCompetition } from '../engines/match/matchState.js';
import { advanceOfficialWorldDivisions } from '../engines/world/officialWorldSeason.js';
import { appendSystemPost, commentOnSocialPost, createSocialState, publishSocialPost, syncSocialToPlayer } from '../engines/life/socialEngine.js';
import { createPlayerRegistration } from '../data/players/playerRegistration.js';
import { isShirtNumberAvailable } from '../data/players/shirtNumbers.js';
import { generateTransferNews } from '../ui/screens/world.jsx';
export const STORAGE_KEY = 'slice-v2';

// Universo real de clubes de cada divisão 2026 — usado só pra calcular a
// média de overall da divisão (evaluatePlayerStatus) na virada de temporada,
// sem depender de quem está no grupo/mata-mata daquele momento específico
// (que pode ser só 2 clubes, no meio de um confronto).
const FAMILY_CLUB_IDS = {
  serie_d_2026: SERIE_D_2026_CLUB_IDS,
  serie_c_2026: SERIE_C_2026_CLUBS,
  serie_b_2026: SERIE_B_2026_CLUBS,
  serie_a_2026: SERIE_A_2026_CLUBS,
};

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
  // Copinha: { round, opponents: [3 nomes reais], stats: {apps,goals,assists,ratingSum}, roundsWon, pendingMatch: {userMatchInfo}|null, result: {tier,label,scoutedClub}|null }
  const [copinhaState, setCopinhaState] = useState(null);
  const [seasonStartSnapshot, setSeasonStartSnapshot] = useState(null);

  const [trainPick, setTrainPick] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingWeek, setPendingWeek] = useState(null);

  // LIFE Slice 1 — corte estrito: só coach/crowd/media + fans. Sem teammates/board.
  const [lifeState, setLifeState] = useState({ relations: { coach: 50, crowd: 50, media: 50 }, fans: 100 });
  const [interviewHistory, setInterviewHistory] = useState([]); // personalidade emerge daqui, nunca vira número
  const [pendingLifeEvent, setPendingLifeEvent] = useState(null); // { event, resumePhase }

  // Calendar + Fitness Engine — dayIndex é a única fonte de tempo (data de
  // calendário, salário mensal) e NUNCA reseta dentro da mesma temporada —
  // só assim o mês vira de verdade entre fase de grupo e mata-mata (ver
  // crossesNewMonth). Mas detectar "hoje é dia de jogo" (getDayType) precisa
  // de uma contagem relativa ao INÍCIO DA FASE ATUAL, não ao calendário
  // absoluto — roundToDay é sempre construído do zero pra cada fase nova
  // (fixtures.length daquela fase, dia 0 = primeiro dia dela). Por isso
  // stageDayIndex existe separado: reseta em toda troca de fase (mesmo as
  // que não resetam dayIndex), incrementa junto com ele. Sem essa separação,
  // um dayIndex acumulado de 25+ nunca mais bate com um roundToDay que só
  // conhece os dias 3 e 7 da fase nova — treino vira looping infinito porque
  // getDayType nunca mais retorna 'match'.
  const [dayIndex, setDayIndex] = useState(0);
  const [stageDayIndex, setStageDayIndex] = useState(0);
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
          setStageDayIndex(d.stageDayIndex || 0);
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
          setCopinhaState(d.copinhaState || null);
        }
      } catch (e) { /* nada salvo ainda */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const d = { phase, player, seasonYear, competition, standings, fixtures, round, userClubId, stats, log, promotionResult, seasonHistory, seasonStartSnapshot, lifeState, interviewHistory, dayIndex, stageDayIndex, fitnessState, trainingSkipStreak, matchHistory, economyState, worldState, academyState, socialState, serieD2026Demo, serieC2026State, serieB2026State, serieA2026State, pendingWeek, pendingLifeEvent, pendingContractDecision, copinhaState };
    appStorage.set(STORAGE_KEY, JSON.stringify(d)).catch(() => {});
  }, [loaded, phase, player, seasonYear, competition, standings, fixtures, round, userClubId, stats, log, promotionResult, seasonHistory, seasonStartSnapshot, lifeState, interviewHistory, dayIndex, stageDayIndex, fitnessState, trainingSkipStreak, matchHistory, economyState, worldState, academyState, socialState, serieD2026Demo, serieC2026State, serieB2026State, serieA2026State, pendingWeek, pendingLifeEvent, pendingContractDecision, copinhaState]);

  const pushLog = useCallback((msg) => setLog(prev => [msg, ...prev].slice(0, 30)), []);

  // Semana de base: decisão real do jogador (treinar UMA atividade escolhida,
  // ou descansar) — antes disso a Academia escolhia o treino sozinha por
  // rodízio e nunca narrava nada, então toda semana parecia igual e vazia.
  // Reaproveita exatamente o mesmo TRAININGS/applyTraining do profissional,
  // nenhuma mecânica nova.
  function advanceAcademyWeek(decision, trainingId, intensityId) {
    if (!player || phase !== 'academy') return;
    const nextWeek = academyState.week + 1;
    let finalPlayer = player;
    let weekMsg;

    if (decision === 'train' && trainingId) {
      const intensity = TRAINING_INTENSITIES.find(i => i.id === intensityId) || TRAINING_INTENSITIES[1];
      const modifiers = [{ multiplier: intensity.gainMultiplier }, individualVarianceModifier(), (v) => v * trainingLoadPenalty(player.weeklyLoad)];
      const trained = applyTraining(player, trainingId, modifiers);
      finalPlayer = { ...trained, weeklyLoad: applyWeeklyLoad(player.weeklyLoad, intensity) };
      const training = TRAININGS.find(t => t.id === trainingId);
      const deltas = Object.keys(training.effects)
        .map(attr => ({ label: ATTR_LABELS[attr], delta: finalPlayer.attrs[attr] - player.attrs[attr] }))
        .filter(d => d.delta > 0.01);
      const overtrained = finalPlayer.weeklyLoad > 70 ? ' Carga alta — considere descansar.' : '';
      weekMsg = (deltas.length
        ? `Base, semana ${nextWeek} — treino de ${training.name} (${intensity.label}): ${deltas.map(d => `${d.label} +${d.delta.toFixed(2)}`).join(', ')}.`
        : `Base, semana ${nextWeek} — treino de ${training.name} (${intensity.label}).`) + overtrained;
    } else {
      finalPlayer = { ...finalPlayer, weeklyLoad: decayWeeklyLoad(player.weeklyLoad) };
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
      pushLog(`${player.name} concluiu a temporada-base da formação: ${nextAcademy.matches} jogos, ${nextAcademy.goals} gols e ${nextAcademy.assists} assistências.`);
      // Antes de escolher o primeiro clube, uma chance na Copinha -- ver
      // startCopinha() e copinhaEngine.js.
      startCopinha();
    }
  }

  // ---- COPINHA (Copa São Paulo de Futebol Júnior) ----
  // Mata-mata curto entre a formação e a escolha do primeiro clube
  // profissional -- ver copinhaEngine.js pro porquê e a lógica pura.
  function startCopinha() {
    const opponents = drawCopinhaOpponents([SERIE_D_2026_CLUB_IDS, SERIE_C_2026_CLUBS, SERIE_B_2026_CLUBS, SERIE_A_2026_CLUBS], ALL_CLUBS_MAP);
    setCopinhaState({ round: 0, opponents, stats: { apps: 0, goals: 0, assists: 0, ratingSum: 0 }, roundsWon: 0, pendingMatch: null, result: null });
    setPhase('copinha-intro');
  }

  // Resolve UMA partida da Copinha reaproveitando o mesmo Match Engine já
  // validado pela liga (resolveRound) -- o lado do jogador é a "Seleção da
  // Copinha" sintética (overall = do próprio jogador, nunca reivindica ser a
  // base de um clube real). Condição física fixa em 100 -- evento avulso
  // curto, não vale a pena encadear com o Fitness Engine da temporada.
  function resolveCopinhaRound(round, opponents) {
    const opponentId = opponents[round];
    const clubsMapForMatch = { ...ALL_CLUBS_MAP, [COPINHA_OWN_ID]: { id: COPINHA_OWN_ID, name: COPINHA_OWN_NAME, overall: player.overall } };
    const isUserHome = Math.random() < 0.5;
    const fixtures = isUserHome ? [[COPINHA_OWN_ID, opponentId]] : [[opponentId, COPINHA_OWN_ID]];
    const standingsMap = freshStandings([COPINHA_OWN_ID, opponentId]);
    const { userMatchInfo } = resolveRound(fixtures, clubsMapForMatch, standingsMap, COPINHA_OWN_ID, player, round, 'copinha_2026', 100);
    return userMatchInfo;
  }

  function beginCopinhaMatch() {
    const userMatchInfo = resolveCopinhaRound(copinhaState.round, copinhaState.opponents);
    setCopinhaState(cs => ({ ...cs, pendingMatch: { userMatchInfo } }));
    setPhase('copinha-match');
  }

  function continueCopinhaMatch() {
    const { userMatchInfo } = copinhaState.pendingMatch;
    const isUserWin = userMatchInfo.isUserHome ? userMatchInfo.gh > userMatchInfo.ga : userMatchInfo.ga > userMatchInfo.gh;
    const nextStats = {
      apps: copinhaState.stats.apps + (userMatchInfo.calledUp ? 1 : 0),
      goals: copinhaState.stats.goals + (userMatchInfo.calledUp ? userMatchInfo.goals : 0),
      assists: copinhaState.stats.assists + (userMatchInfo.calledUp ? userMatchInfo.assists : 0),
      ratingSum: copinhaState.stats.ratingSum + (userMatchInfo.calledUp ? userMatchInfo.rating : 0),
    };
    const nextRoundsWon = copinhaState.roundsWon + (isUserWin ? 1 : 0);
    pushLog(`Copinha — ${COPINHA_ROUND_LABELS[copinhaState.round]}: ${userMatchInfo.home} ${userMatchInfo.gh}x${userMatchInfo.ga} ${userMatchInfo.away}${userMatchInfo.calledUp ? ` (nota ${userMatchInfo.rating.toFixed(1)})` : ' (você ficou no banco)'}.`);

    if (!isUserWin || nextRoundsWon >= COPINHA_TOTAL_ROUNDS) {
      const tier = evaluateCopinhaScouting({ roundsWon: nextRoundsWon, ...nextStats });
      const scoutedClub = pickScoutedClub(tier.id, { serie_d_forte: SERIE_D_2026_CLUB_IDS, serie_c: SERIE_C_2026_CLUBS, serie_b: SERIE_B_2026_CLUBS, serie_a: SERIE_A_2026_CLUBS, clubsMap: ALL_CLUBS_MAP });
      setCopinhaState(cs => ({ ...cs, roundsWon: nextRoundsWon, stats: nextStats, pendingMatch: null, result: { tier: tier.id, label: tier.label, championRun: isUserWin, scoutedClub } }));
      setPhase('copinha-result');
    } else {
      const nextRound = copinhaState.round + 1;
      const nextMatchInfo = resolveCopinhaRound(nextRound, copinhaState.opponents);
      setCopinhaState(cs => ({ ...cs, round: nextRound, roundsWon: nextRoundsWon, stats: nextStats, pendingMatch: { userMatchInfo: nextMatchInfo } }));
    }
  }

  // Entrada de estreante direto na Série C/B/A via observação da Copinha --
  // deliberadamente NÃO reaproveita startSerieC/B/A2026Season (aquelas são
  // pra TRANSIÇÃO de temporada de um profissional já em campo: incrementam
  // ano/idade e fazem upkeep econômico anual, tudo errado pra uma primeira
  // entrada). Espelha chooseClub (Série D) na filosofia: sem incrementos,
  // clube real assumido diretamente, sem precisar "derrubar" ninguém da
  // lista oficial (mesma simplificação já usada pela Série D).
  function enterProLeagueAsRookieViaCopinha(family, clubNames, competitionName, clubId) {
    const cfg = {
      id: `${family}_${seasonYear}`, name: competitionName,
      family, format: 'league', participants: clubNames,
      promotion: { count: 0, target_competition_id: null }, relegation: { count: 0, target_competition_id: null },
      tiebreakers: ['pts', 'v', 'sg', 'gp'], calendar_pattern: { match_intervals: [3, 4] },
    };
    const salaryResolution = resolvePlayerSalary(player, family, 'prospect', seasonYear);
    const contract = makeContract(clubId, salaryResolution.monthly, seasonYear, 2);
    setCompetition(cfg);
    setStandings(CompetitionEngineV2.freshStandings(clubNames));
    setFixtures(CompetitionEngineV2.buildLeagueFixtures(clubNames, true));
    setRound(0);
    setDayIndex(0);
    setStageDayIndex(0);
    setFitnessState({ condition: 100 });
    setUserClubId(clubId);
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => syncSocialToPlayer({ ...p, clubId, registeredClub: clubId, currentClub: clubId, shirtNumber: null, registration: createPlayerRegistration({ clubId, seasonYear, competitionId: family, shirtNumberStatus: 'pending_official' }), contract, salarySource: salaryResolution.source, salaryStatus: salaryResolution.status }, socialState));
    setSeasonStartSnapshot({ overall: player.overall, reputation: player.reputation });
    if (family === 'serie_c_2026') setSerieC2026State({ customClubIds: clubNames, rngSeed: Math.floor(Math.random() * 1000000), resultsHistory: {}, stageId: 'fase1', currentOpponentId: null, hostsSecondLeg: null, groupClubIds: null, matchResults: [], accessSecured: false, result: null });
    if (family === 'serie_b_2026') setSerieB2026State({ customClubIds: clubNames, matchResults: [], result: null, playoffOpponentId: null, playoffHostsSecondLeg: null, playoffAmIBetterSeed: null, playoffMatchResults: [] });
    if (family === 'serie_a_2026') setSerieA2026State({ customClubIds: clubNames, matchResults: [], result: null });
    setPhase('season'); setTab('home');
    pushLog(`Copinha: ${player.name} foi observado e assinou direto com o ${ALL_CLUBS_MAP[clubId]?.name || clubId} para disputar a ${competitionName}.`);
  }

  function finishCopinha() {
    const { result } = copinhaState;
    if (!result || result.tier === 'normal') { setPhase('club-select'); return; }
    if (result.tier === 'serie_d_forte') {
      pushLog(`Copinha: sua campanha chamou a atenção do ${ALL_CLUBS_MAP[result.scoutedClub]?.name || result.scoutedClub} -- convite direto, sem passar pela lista de interessados.`);
      chooseClub(result.scoutedClub);
      return;
    }
    const familyMap = {
      serie_c: ['serie_c_2026', SERIE_C_2026_CLUBS, 'Brasileirão Série C 2026 — 1ª Fase'],
      serie_b: ['serie_b_2026', SERIE_B_2026_CLUBS, 'Brasileirão Série B 2026'],
      serie_a: ['serie_a_2026', SERIE_A_2026_CLUBS, 'Brasileirão Série A 2026'],
    };
    const [family, clubNames, competitionName] = familyMap[result.tier];
    enterProLeagueAsRookieViaCopinha(family, clubNames, competitionName, result.scoutedClub);
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
      attrs, potential, overall, age: 16, careerPhase: 'academy', academyStatus: 'youth_player', salarySource: 'pending_official', salaryStatus: 'pending_official', reputation: 5, weeklyLoad: 0, shirtNumber: null, registration: createPlayerRegistration({ shirtNumberStatus: 'pending_official' }), contract: null, loan: null, wantsTransfer: false, wantsLoan: false,
      // Aparência -- estrutura pronta pra escolha futura (o jogador poderá
      // trocar entre várias ilustrações/estilos disponíveis); hoje só existe
      // uma opção, então nenhuma UI de seleção é necessária ainda, mas a
      // Central e o perfil nunca devem depender de um id fixo aqui.
      appearanceId: 'default',
      // Dados físicos -- reservados pra quando o jogo passar a usá-los (podem
      // futuramente influenciar arquétipo/gameplay); null/[] até lá, nunca
      // um valor inventado.
      height: null, weight: null, dominantFoot: null, secondaryPositions: [],
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
    setStageDayIndex(0); // temporada nova de verdade -- reseta os dois
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

  // Escolha de número de camisa -- configurável pelo jogador, considerando
  // os números já ocupados no elenco do clube atual (ver shirtNumbers.js:
  // hoje nenhum clube modela elenco individual, então tudo de 1-99 fica
  // disponível até a coleta oficial de elenco existir). "official" aqui
  // significa "confirmado no registro deste clube/temporada", não uma fonte
  // externa -- o jogador é fictício, então não há CBF pra validar contra.
  function chooseShirtNumber(number) {
    const currentClub = userClubId && competition ? getActiveClubsMap(competition, userClubId)[userClubId] : null;
    if (!isShirtNumberAvailable(currentClub, number)) return;
    setPlayer(p => ({ ...p, shirtNumber: number, registration: { ...p.registration, shirtNumber: number, shirtNumberStatus: 'official', source: 'official' } }));
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

  // ---- Renovação de contrato & pedido de transferência entre temporadas ----
  // Roda em toda virada real de temporada (Série D/C/B/A) — resolve dois
  // problemas reportados: contrato que vencia e nunca era renovado (o
  // jogador seguia jogando com data de expiração já passada), e pedido de
  // transferência (wantsTransfer, botão "PEDIR TRANSFERÊNCIA" na tela de
  // Mundo) que nunca era avaliado pelo mercado, ficando "pendente" pra sempre.
  //
  // allowMarket=false quando a virada já é uma mudança de divisão por
  // mérito esportivo (promoção/rebaixamento) — mesma precedência que já
  // existia no antigo continueNextSeason (nunca usado na prática pelo fluxo
  // real Série D/C/B/A, mas com a lógica certa): divisão nunca concorre com
  // mercado no mesmo ciclo. Contrato ainda é checado/renovado nesse caso.
  //
  // Empréstimo (wantsLoan) fica fora deste escopo: exigiria rastrear volta
  // ao clube de origem ao longo de várias temporadas, e não foi o que foi
  // reportado — nunca inventar solução pra um problema que não foi pedido.
  function computeSeasonContractUpdate(family, allowMarket) {
    // Empréstimo em andamento tem precedência sobre TUDO — mudança de
    // divisão, pedido do jogador, decisão do clube. É um evento agendado
    // (returnSeason), não uma decisão desta virada. Duração de empréstimo é
    // sempre da MESMA family (ver generateLoanOffer: "não sobe de tier"),
    // então nunca precisa redirecionar pra outra função de início de temporada.
    if (player.loan) {
      if (seasonYear + 1 >= player.loan.returnSeason) {
        return {
          effectiveClubId: player.loan.parentClubId, targetFamily: player.loan.parentFamily || family, customClubIdsOverride: null,
          contract: player.loan.parentContract, loan: null, wantsTransfer: false, wantsLoan: false,
          logMsg: `Fim do empréstimo. Você retorna ao ${ALL_CLUBS_MAP[player.loan.parentClubId]?.name || 'clube de origem'}.`,
        };
      }
      // Ainda no meio do empréstimo — segue jogando pelo clube emprestador,
      // sem reavaliar mercado nem contrato (o vínculo real é com o clube de
      // origem, intocado até o retorno).
      return {
        effectiveClubId: userClubId, targetFamily: family, customClubIdsOverride: null,
        contract: player.contract, loan: player.loan, wantsTransfer: false, wantsLoan: false, logMsg: null,
      };
    }

    const participantIds = FAMILY_CLUB_IDS[family] || [];
    const withOverall = participantIds.map(id => ALL_CLUBS_MAP[id]?.overall).filter(v => Number.isFinite(v));
    const avgOverall = withOverall.length ? withOverall.reduce((s, v) => s + v, 0) / withOverall.length : 50;
    const totalRounds = fixtures.length;
    const appRate = totalRounds > 0 ? stats.apps / totalRounds : 0;
    const { status, score } = evaluatePlayerStatus(player, stats.apps, totalRounds, avgOverall);
    const contractOnFile = player.contract || makeContract(userClubId, computeSalary(family, status), seasonYear, 2);

    const customOverrideFor = (targetFamily) =>
      targetFamily === 'serie_c_2026' ? SERIE_C_2026_CLUBS :
      targetFamily === 'serie_b_2026' ? SERIE_B_2026_CLUBS :
      targetFamily === 'serie_a_2026' ? SERIE_A_2026_CLUBS : null; // serie_d_2026 usa redrawSerieD2026GroupsForNewSeason, não precisa de override
    const findOffer = (requestFlags) => generateTransferOffers(player, status, family, avgOverall, requestFlags).filter(o => o.clubId !== userClubId)[0] || null;
    const findLoanOffer = () => { const o = generateLoanOffer(family); return o && o.clubId !== userClubId ? o : null; };
    const renewIfExpired = () => {
      const expired = !player.contract || (player.contract.expiresSeason - seasonYear <= 0);
      return expired ? makeContract(userClubId, computeSalary(family, status), seasonYear + 1, 2) : player.contract;
    };
    const makeLoan = (offer) => ({ parentClubId: userClubId, parentFamily: family, parentContract: contractOnFile, loanClubId: offer.clubId, returnSeason: seasonYear + 1 + offer.durationSeasons });

    if (allowMarket) {
      // Pedido do JOGADOR (botões "PEDIR TRANSFERÊNCIA"/"PEDIR EMPRÉSTIMO")
      // tem prioridade sobre a avaliação do clube. Transferência antes de
      // empréstimo — mais drástico, é o que o jogador mais provavelmente
      // quer se pediu os dois.
      if (player.wantsTransfer) {
        const offer = findOffer({ wantsTransfer: true, wantsLoan: false });
        if (offer) {
          return {
            effectiveClubId: offer.clubId, targetFamily: offer.family, customClubIdsOverride: customOverrideFor(offer.family),
            contract: makeContract(offer.clubId, offer.proposedSalary, seasonYear + 1, offer.proposedDuration),
            loan: null, wantsTransfer: false, wantsLoan: !!player.wantsLoan,
            logMsg: `Transferência aceita! Você assinou com o ${offer.clubName}.`,
          };
        }
        // Sem proposta desta vez — o pedido segue registrado, tenta de novo na próxima temporada.
        return {
          effectiveClubId: userClubId, targetFamily: family, customClubIdsOverride: null,
          contract: renewIfExpired(), loan: null, wantsTransfer: true, wantsLoan: !!player.wantsLoan,
          logMsg: 'Você pediu transferência, mas nenhuma proposta chegou desta vez. O pedido continua registrado.',
        };
      }

      if (player.wantsLoan) {
        const offer = findLoanOffer();
        if (offer) {
          return {
            effectiveClubId: offer.clubId, targetFamily: family, customClubIdsOverride: null,
            contract: contractOnFile, loan: makeLoan(offer), wantsTransfer: false, wantsLoan: false,
            logMsg: `Empréstimo aceito! Você joga pelo ${offer.clubName} nesta temporada.`,
          };
        }
        return {
          effectiveClubId: userClubId, targetFamily: family, customClubIdsOverride: null,
          contract: renewIfExpired(), loan: null, wantsTransfer: false, wantsLoan: true,
          logMsg: 'Você pediu empréstimo, mas nenhuma proposta chegou desta vez. O pedido continua registrado.',
        };
      }

      // CLUBE decide primeiro (sem pedido do jogador) — mesmo motor de decisão
      // que já existia isolado em contractsEconomy.js (clubSeasonDecision),
      // nunca chamado por nenhum fluxo real até agora.
      const requestFlags = { wantsTransfer: false, wantsLoan: false };
      const decision = clubSeasonDecision(contractOnFile, status, score, seasonYear, requestFlags, appRate);

      if (decision === 'consider_sale') {
        const offer = findOffer(requestFlags);
        if (offer) {
          return {
            effectiveClubId: offer.clubId, targetFamily: offer.family, customClubIdsOverride: customOverrideFor(offer.family),
            contract: makeContract(offer.clubId, offer.proposedSalary, seasonYear + 1, offer.proposedDuration),
            loan: null, wantsTransfer: false, wantsLoan: false,
            logMsg: `O ${ALL_CLUBS_MAP[userClubId]?.name} avaliou negociar sua saída e aceitou uma proposta: você assinou com o ${offer.clubName}.`,
          };
        }
      }

      if (decision === 'release') {
        const oldClubName = ALL_CLUBS_MAP[userClubId]?.name;
        const offer = findOffer({ wantsTransfer: true, wantsLoan: false });
        if (offer) {
          const compensation = computeReleaseCompensation(contractOnFile, seasonYear);
          setEconomyState(e => ({ ...e, balance: e.balance + compensation }));
          return {
            effectiveClubId: offer.clubId, targetFamily: offer.family, customClubIdsOverride: customOverrideFor(offer.family),
            contract: makeContract(offer.clubId, offer.proposedSalary, seasonYear + 1, offer.proposedDuration),
            loan: null, wantsTransfer: false, wantsLoan: false,
            logMsg: `Dispensado pelo ${oldClubName} (compensação de R$ ${compensation.toLocaleString('pt-BR')} recebida). Assinou com o ${offer.clubName}.`,
          };
        }
        // Sem interessados — o clube reconsidera e renova.
        return {
          effectiveClubId: userClubId, targetFamily: family, customClubIdsOverride: null,
          contract: makeContract(userClubId, computeSalary(family, status), seasonYear + 1, 2), loan: null, wantsTransfer: false, wantsLoan: false,
          logMsg: `O ${oldClubName} avaliou dispensar você, mas não houve interessados — contrato renovado.`,
        };
      }

      if (decision === 'offer_loan') {
        const offer = findLoanOffer();
        if (offer) {
          return {
            effectiveClubId: offer.clubId, targetFamily: family, customClubIdsOverride: null,
            contract: contractOnFile, loan: makeLoan(offer), wantsTransfer: false, wantsLoan: false,
            logMsg: `O ${ALL_CLUBS_MAP[userClubId]?.name} avaliou que você precisa de minutos e fechou um empréstimo: você joga pelo ${offer.clubName} nesta temporada.`,
          };
        }
        // Sem clube interessado em pegar emprestado — cai no fallback abaixo.
      }

      // decision === 'renew' | 'keep_as_is' (ou 'offer_loan' sem oferta) —
      // nada de mercado pra resolver; só garante que o contrato nunca fica
      // com data vencida.
      const nextContract = renewIfExpired();
      return {
        effectiveClubId: userClubId, targetFamily: family, customClubIdsOverride: null,
        contract: nextContract, loan: null, wantsTransfer: false, wantsLoan: false,
        logMsg: nextContract !== player.contract ? `Contrato renovado com o ${ALL_CLUBS_MAP[userClubId]?.name || 'clube'}.` : null,
      };
    }

    // Mudança de divisão (promoção/rebaixamento por mérito esportivo) — o
    // mercado não é avaliado neste ciclo (mesma precedência do antigo
    // continueNextSeason), mas o contrato ainda não pode ficar vencido, e um
    // pedido pendente não pode ser apagado por uma virada que nem chegou a
    // avaliá-lo — preserva `wantsTransfer`/`wantsLoan` como estão.
    const divisionChangeContract = renewIfExpired();
    return {
      effectiveClubId: userClubId, targetFamily: family, customClubIdsOverride: null,
      contract: divisionChangeContract, loan: null, wantsTransfer: !!player.wantsTransfer, wantsLoan: !!player.wantsLoan,
      logMsg: divisionChangeContract !== player.contract ? `Contrato renovado com o ${ALL_CLUBS_MAP[userClubId]?.name || 'clube'}.` : null,
    };
  }

  // Empacota o resultado de computeSeasonContractUpdate no formato que as 4
  // funções startXSeason esperam em `opts` — usado por toda saída de
  // temporada (Série D/C/B/A), evita repetir a mesma forma 8 vezes.
  function contractOpts(u) {
    return { effectiveClubId: u.effectiveClubId, contractPatch: { contract: u.contract, loan: u.loan, wantsTransfer: u.wantsTransfer, wantsLoan: u.wantsLoan }, logMsg: u.logMsg };
  }

  // Sai da tela de resultado — sempre continua a carreira pra próxima
  // temporada (não existe mais "voltar" pra um estado anterior; a Série D
  // 2026 É a carreira agora). Usado tanto quando eliminado quanto após
  // conseguir acesso (Série C real ainda não existe no motor novo — ver
  // startNewSerieD2026Season).
  function exitSerieD2026Demo() {
    // Empréstimo em andamento tem precedência sobre o resultado esportivo —
    // o clube emprestador pode até ter conseguido acesso, mas quem está
    // definindo o destino do jogador é o empréstimo, não a campanha dele.
    if (player.loan) {
      const u = computeSeasonContractUpdate('serie_d_2026', false);
      startNewSerieD2026Season(contractOpts(u));
      return;
    }
    if (serieD2026Demo && serieD2026Demo.accessSecured) {
      const u = computeSeasonContractUpdate('serie_d_2026', false); // mudança de divisão — sem mercado
      startSerieC2026Season(u.customClubIdsOverride, contractOpts(u));
      return;
    }
    const u = computeSeasonContractUpdate('serie_d_2026', true);
    startNewSerieD2026Season(contractOpts(u));
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
    // dayIndex NÃO reseta aqui — mata-mata é a MESMA temporada/family da fase
    // de grupo que acabou de terminar. Resetar o calendário de volta pro
    // início fixo da family a cada troca de fase (grupo → mata-mata) fazia o
    // salário mensal quase nunca cair: cada mata-mata é curto demais (poucos
    // dias) pra cruzar um mês sozinho contando do zero (ver crossesNewMonth).
    // stageDayIndex SIM reseta — getDayType precisa contar os dias desta
    // fase nova a partir do zero pra saber quando é dia de jogo (roundToDay
    // é sempre construído do zero também). Sem isso, "hoje é dia de jogo"
    // nunca mais batia contra um dayIndex que já vinha lá de trás — treino
    // virava um loop infinito bem no dia em que devia ser partida.
    setStageDayIndex(0);
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
  function startNewSerieD2026Season(opts = {}) {
    const { effectiveClubId = userClubId, contractPatch = null, logMsg: marketLogMsg = null } = opts;
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    if (effectiveClubId !== userClubId) setUserClubId(effectiveClubId); // transferência de mercado mudou de clube
    const newAssignment = redrawSerieD2026GroupsForNewSeason(effectiveClubId);
    const groupId = newAssignment[effectiveClubId];
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
    setStageDayIndex(0); // temporada nova de verdade -- reseta os dois
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1, ...(contractPatch || {}) }));
    setSerieD2026Demo({
      groupId, groupClubIds, droppedOfficialClubId: null, customClubIds: SERIE_D_2026_CLUB_IDS, customAssignment: newAssignment,
      rngSeed: Math.floor(Math.random() * 1000000), resultsHistory: {},
      stageId: null, currentOpponentId: null, hostsSecondLeg: null,
      matchResults: [], accessSecured: false, result: null,
    });
    setPhase('season'); setTab('home');
    pushLog(`Nova temporada — Grupo ${groupId} (sorteio simulado; só 2026 tem sorteio oficial da CBF).`);
    if (marketLogMsg) pushLog(marketLogMsg);
  }

  // ---- Série C 2026 (Competition Engine V2) — entrada e fases jogáveis ----
  // Reaproveita o mesmo loop de temporada (Match/Fitness/telas) — só muda a
  // origem dos dados (20 clubes reais, 3 fases). Entrada acontece quando o
  // jogador consegue acesso na Série D (semifinalista/playoff) OU ao
  // continuar uma carreira já na Série C.
  function startSerieC2026Season(customClubIdsOverride, opts = {}) {
    const { effectiveClubId = userClubId, contractPatch = null, logMsg: marketLogMsg = null } = opts;
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    if (effectiveClubId !== userClubId) setUserClubId(effectiveClubId); // transferência de mercado mudou de clube
    let customClubIds = customClubIdsOverride;
    if (!customClubIds) {
      // Primeira entrada: substitui um clube real aleatório pelo do jogador —
      // mesmo princípio já usado na Série D (o clube do jogador não é um dos
      // 20 oficiais da Série C 2026, precisa ocupar o lugar de um deles).
      const dropIndex = Math.floor(Math.random() * SERIE_C_2026_CLUBS.length);
      customClubIds = SERIE_C_2026_CLUBS.map((name, i) => (i === dropIndex ? effectiveClubId : name));
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
    setStageDayIndex(0); // temporada nova de verdade -- reseta os dois
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1, ...(contractPatch || {}) }));
    setSerieC2026State({
      customClubIds, rngSeed: Math.floor(Math.random() * 1000000), resultsHistory: {},
      stageId: 'fase1', currentOpponentId: null, hostsSecondLeg: null, groupClubIds: null,
      matchResults: [], accessSecured: false, result: null,
    });
    setPhase('season'); setTab('home');
    if (marketLogMsg) pushLog(marketLogMsg);
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
    // dayIndex NÃO reseta — mesma temporada da 1ª fase que acabou de terminar
    // (ver comentário equivalente em beginSerieD2026Tie sobre o salário mensal).
    setStageDayIndex(0); // fase nova -- getDayType precisa contar do zero (ver beginSerieD2026Tie)
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
    // dayIndex NÃO reseta — mesma temporada da 2ª fase que acabou de terminar.
    setStageDayIndex(0); // fase nova -- getDayType precisa contar do zero (ver beginSerieD2026Tie)
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
    if (player.loan) {
      const u = computeSeasonContractUpdate('serie_c_2026', false);
      startSerieC2026Season(SERIE_C_2026_CLUBS, contractOpts(u));
      return;
    }
    const outcome = serieC2026State?.result?.outcomeType;
    if (outcome === 'relegated') {
      const u = computeSeasonContractUpdate('serie_c_2026', false); // mudança de divisão — sem mercado
      startNewSerieD2026Season(contractOpts(u));
      return;
    }
    if (['promoted', 'finalist', 'champion', 'runner_up'].includes(outcome)) {
      const u = computeSeasonContractUpdate('serie_c_2026', false);
      startSerieB2026Season(u.customClubIdsOverride, contractOpts(u));
      return;
    }
    const u = computeSeasonContractUpdate('serie_c_2026', true);
    if (u.targetFamily === 'serie_b_2026') {
      // Transferência de mercado levou pra um tier acima mesmo sem acesso
      // esportivo (ver generateTransferOffers/computeDemandScore).
      startSerieB2026Season(u.customClubIdsOverride, contractOpts(u));
      return;
    }
    startSerieC2026Season(u.customClubIdsOverride, contractOpts(u));
  }

  // ---- Série B 2026 — entrada, playoff de acesso, e saída de temporada ----
  function startSerieB2026Season(customClubIdsOverride, opts = {}) {
    const { effectiveClubId = userClubId, contractPatch = null, logMsg: marketLogMsg = null } = opts;
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    if (effectiveClubId !== userClubId) setUserClubId(effectiveClubId); // transferência de mercado mudou de clube
    let customClubIds = customClubIdsOverride;
    if (!customClubIds) {
      const dropIndex = Math.floor(Math.random() * SERIE_B_2026_CLUBS.length);
      customClubIds = SERIE_B_2026_CLUBS.map((name, i) => (i === dropIndex ? effectiveClubId : name));
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
    setStageDayIndex(0); // temporada nova de verdade -- reseta os dois
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1, ...(contractPatch || {}) }));
    setSerieB2026State({ customClubIds, matchResults: [], result: null, playoffOpponentId: null, playoffHostsSecondLeg: null, playoffAmIBetterSeed: null, playoffMatchResults: [] });
    setPhase('season'); setTab('home');
    if (marketLogMsg) pushLog(marketLogMsg);
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
    // dayIndex NÃO reseta — mesma temporada da fase de liga que acabou de terminar.
    setStageDayIndex(0); // fase nova -- getDayType precisa contar do zero (ver beginSerieD2026Tie)
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setSerieB2026State(prev => ({ ...prev, playoffOpponentId: opponentId, playoffHostsSecondLeg: hostsSecondLeg, playoffAmIBetterSeed: amIBetterSeed, playoffMatchResults: [], result: null }));
    setPhase('season'); setTab('home');
    pushLog(`Playoff de acesso da Série B 2026: você enfrenta ${ALL_CLUBS_MAP[opponentId]?.name || opponentId} — ida e volta, sem pênaltis.`);
  }

  function exitSerieB2026Season() {
    if (player.loan) {
      const u = computeSeasonContractUpdate('serie_b_2026', false);
      startSerieB2026Season(SERIE_B_2026_CLUBS, contractOpts(u));
      return;
    }
    const outcome = serieB2026State?.result?.outcomeType;
    if (outcome === 'relegated') {
      const u = computeSeasonContractUpdate('serie_b_2026', false);
      startSerieC2026Season(u.customClubIdsOverride, contractOpts(u));
      return;
    }
    if (outcome === 'promoted_direct' || outcome === 'promoted_playoff') {
      const u = computeSeasonContractUpdate('serie_b_2026', false);
      startSerieA2026Season(u.customClubIdsOverride, contractOpts(u));
      return;
    }
    const u = computeSeasonContractUpdate('serie_b_2026', true);
    if (u.targetFamily === 'serie_a_2026') {
      startSerieA2026Season(u.customClubIdsOverride, contractOpts(u));
      return;
    }
    startSerieB2026Season(u.customClubIdsOverride, contractOpts(u));
  }

  // ---- Série A 2026 — entrada e saída de temporada (topo da pirâmide) ----
  function startSerieA2026Season(customClubIdsOverride, opts = {}) {
    const { effectiveClubId = userClubId, contractPatch = null, logMsg: marketLogMsg = null } = opts;
    setSeasonYear(y => y + 1);
    setEconomyState(e => applyAnnualEconomyUpdate(e)); // upkeep de imóveis + retorno de investimento, uma vez por temporada
    if (effectiveClubId !== userClubId) setUserClubId(effectiveClubId); // transferência de mercado mudou de clube
    let customClubIds = customClubIdsOverride;
    if (!customClubIds) {
      const dropIndex = Math.floor(Math.random() * SERIE_A_2026_CLUBS.length);
      customClubIds = SERIE_A_2026_CLUBS.map((name, i) => (i === dropIndex ? effectiveClubId : name));
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
    setStageDayIndex(0); // temporada nova de verdade -- reseta os dois
    setFitnessState({ condition: 100 });
    setStats({ apps: 0, goals: 0, assists: 0, ratingSum: 0 });
    setPlayer(p => ({ ...p, age: p.age + 1, ...(contractPatch || {}) }));
    setSerieA2026State({ customClubIds, matchResults: [], result: null });
    setPhase('season'); setTab('home');
    if (marketLogMsg) pushLog(marketLogMsg);
  }

  function exitSerieA2026Season() {
    if (player.loan) {
      const u = computeSeasonContractUpdate('serie_a_2026', false);
      startSerieA2026Season(SERIE_A_2026_CLUBS, contractOpts(u));
      return;
    }
    const outcome = serieA2026State?.result?.outcomeType;
    if (outcome === 'relegated') {
      const u = computeSeasonContractUpdate('serie_a_2026', false);
      startSerieB2026Season(u.customClubIdsOverride, contractOpts(u));
      return;
    }
    // Topo da pirâmide — mercado nunca sobe tier a partir daqui (TIER_ORDER acaba em serie_a_2026).
    const u = computeSeasonContractUpdate('serie_a_2026', true);
    startSerieA2026Season(u.customClubIdsOverride, contractOpts(u));
  }

  function togglePicker() { setShowPicker(s => !s); }

  // Dia de treino: Treinar / Descansar / Não quero treinar são três decisões
  // com significados diferentes — nunca a mesma coisa por baixo.
  function advanceTrainingDay(decision, trainingId, intensityId) {
    let finalPlayer = player;
    let newCondition = fitnessState.condition;
    let newSkipStreak = trainingSkipStreak;
    let logMsg = '';

    if (decision === 'train') {
      const intensity = TRAINING_INTENSITIES.find(i => i.id === intensityId) || TRAINING_INTENSITIES[1];
      const modifiers = [{ multiplier: intensity.gainMultiplier }, individualVarianceModifier(), (v) => v * trainingLoadPenalty(player.weeklyLoad)];
      const trained = applyTraining(player, trainingId, modifiers);
      finalPlayer = { ...trained, weeklyLoad: applyWeeklyLoad(player.weeklyLoad, intensity) };
      newCondition = applyTrainingCost(fitnessState.condition, intensity.conditionMultiplier);
      newSkipStreak = 0;
      const training = TRAININGS.find(t => t.id === trainingId);
      const deltas = Object.keys(training.effects)
        .map(attr => ({ label: ATTR_LABELS[attr], delta: finalPlayer.attrs[attr] - player.attrs[attr] }))
        .filter(d => d.delta > 0.01);
      const overtrained = finalPlayer.weeklyLoad > 70 ? ' Carga alta — considere descansar.' : '';
      logMsg = (deltas.length
        ? `Treino (${training.name}, ${intensity.label}): ${deltas.map(d => `${d.label} +${d.delta.toFixed(2)}`).join(', ')}.`
        : `Treino (${training.name}, ${intensity.label}) concluído.`) + overtrained;
    } else if (decision === 'rest') {
      newCondition = applyRestRecovery(fitnessState.condition);
      newSkipStreak = 0;
      finalPlayer = { ...finalPlayer, weeklyLoad: decayWeeklyLoad(player.weeklyLoad) };
      logMsg = 'Você optou por descansar e recuperar a condição física.';
    } else if (decision === 'skip') {
      // Fisicamente tratado como descanso — a diferença é comportamental, não física.
      newCondition = applyRestRecovery(fitnessState.condition);
      finalPlayer = { ...finalPlayer, weeklyLoad: decayWeeklyLoad(player.weeklyLoad) };
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
        setStageDayIndex(d => d + 1);
        return;
      }
    }
    if (player.contract && crossesNewMonth(competition.family, seasonYear, dayIndex)) {
      setEconomyState(e => ({ ...e, balance: e.balance + player.contract.salary }));
    }
    setDayIndex(d => d + 1);
    setStageDayIndex(d => d + 1);
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
    setStageDayIndex(d => d + 1);
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

    // Usado tanto no log/rede social (texto corrido) quanto no LIFE_EVENT
    // elegível (entrevista) logo abaixo — mesmo fato, calculado uma vez só.
    const matchWon = userMatchInfo ? (userMatchInfo.isUserHome ? userMatchInfo.gh > userMatchInfo.ga : userMatchInfo.ga > userMatchInfo.gh) : false;

    if (userMatchInfo) {
      if (userMatchInfo.calledUp) {
        finalStats = { apps: stats.apps + 1, goals: stats.goals + playerDelta.goals, assists: stats.assists + playerDelta.assists, ratingSum: stats.ratingSum + playerDelta.rating };
        const repDelta = playerDelta.rating >= 7.5 ? 2 : playerDelta.rating <= 4.5 ? -1 : 0;
        finalPlayer = { ...finalPlayer, reputation: clamp(finalPlayer.reputation + repDelta, 1, 30) };
        const flavor = describeMatchPerformance({ goals: playerDelta.goals, assists: playerDelta.assists, rating: playerDelta.rating, matchWon, started: userMatchInfo.started, enteredMinute: userMatchInfo.enteredMinute });
        pushLog(`Rodada ${round + 1}: ${userMatchInfo.home} ${userMatchInfo.gh}x${userMatchInfo.ga} ${userMatchInfo.away} — nota ${userMatchInfo.rating.toFixed(1)}.${flavor ? ` ${flavor}` : ''}`);
        const socialText = `${userMatchInfo.home} ${userMatchInfo.gh} x ${userMatchInfo.ga} ${userMatchInfo.away}. ${flavor || 'Mais um capítulo da temporada.'}`;
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
    setStageDayIndex(d => d + 1);
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
          matchWon, started: userMatchInfo.started, enteredMinute: userMatchInfo.enteredMinute,
          isFirstCareerGoal: stats.goals === 0 && playerDelta.goals > 0 }
      : null;
    let eligibleEvent = lifeContext ? findEligibleLifeEvent(lifeContext) : null;
    let resolvedContext = lifeContext;
    // Marco de carreira (10/25/50... jogos ou gols) só é considerado quando a
    // própria partida não rendeu nenhuma entrevista mais específica acima —
    // prioridade sempre pro que aconteceu NESSE jogo (hat-trick, gol
    // decisivo etc.), marco vira o "prato de resistência" só em partidas sem
    // nada mais notável pra comentar. Comparação usa stats (antes) vs.
    // finalStats (depois) pra disparar só no jogo exato em que o total cruza
    // o limiar, nunca de novo depois.
    if (!eligibleEvent) {
      const appsMilestone = crossedMilestone(stats.apps, finalStats.apps, MILESTONE_APPS_THRESHOLDS);
      const goalsMilestone = crossedMilestone(stats.goals, finalStats.goals, MILESTONE_GOALS_THRESHOLDS);
      const milestoneContext = appsMilestone != null
        ? { type: 'career_milestone', kind: 'apps', value: appsMilestone }
        : goalsMilestone != null
          ? { type: 'career_milestone', kind: 'goals', value: goalsMilestone }
          : null;
      if (milestoneContext) {
        eligibleEvent = findEligibleLifeEvent(milestoneContext);
        resolvedContext = milestoneContext;
      }
    }
    // Alguns eventos têm prompt dinâmico (função do que aconteceu no jogo);
    // resolve pra string aqui, já que é o único lugar com o contexto em mãos —
    // a tela de entrevista só sabe renderizar texto.
    const resolvedEvent = eligibleEvent
      ? { ...eligibleEvent, prompt: typeof eligibleEvent.prompt === 'function' ? eligibleEvent.prompt(resolvedContext) : eligibleEvent.prompt }
      : null;

    if (resolvedEvent) {
      setPendingLifeEvent({ event: resolvedEvent, resumePhase: nextPhase });
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
    setStageDayIndex(0); // temporada nova de verdade -- reseta os dois
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
    setDayIndex(0); setStageDayIndex(0); setFitnessState({ condition: 100 }); setTrainingSkipStreak(0);
    setMatchHistory({});
    setEconomyState({ balance: 0, investments: 0, properties: [] }); setPendingContractDecision(null);
    setWorldState({ clubDivision: initialClubDivision() });
    setSocialState(createSocialState());
    setTab('home');
  }


  const activeClubsMap = (userClubId && competition) ? getActiveClubsMap(competition, userClubId) : CLUBS_MAP;
  const club = userClubId ? activeClubsMap[userClubId] : null;
  const roundToDay = competition ? buildRoundToDay(fixtures.length, competition.calendar_pattern) : {};
  const dayType = competition ? getDayType(stageDayIndex, roundToDay) : null;

  return { loaded, setLoaded, socialState, handleSocialPublish, handleSocialComment, academyState, advanceAcademyWeek, phase, setPhase, tab, setTab, player, setPlayer, seasonYear, setSeasonYear, competition, setCompetition, standings, setStandings, fixtures, setFixtures, round, setRound, userClubId, setUserClubId, stats, setStats, log, setLog, promotionResult, setPromotionResult, seasonHistory, setSeasonHistory, seasonStartSnapshot, setSeasonStartSnapshot, trainPick, setTrainPick, showPicker, setShowPicker, pendingWeek, setPendingWeek, lifeState, setLifeState, interviewHistory, setInterviewHistory, pendingLifeEvent, setPendingLifeEvent, dayIndex, setDayIndex, stageDayIndex, setStageDayIndex, fitnessState, setFitnessState, trainingSkipStreak, setTrainingSkipStreak, matchHistory, setMatchHistory, worldState, setWorldState, economyState, setEconomyState, pendingContractDecision, setPendingContractDecision, serieD2026Demo, setSerieD2026Demo, serieC2026State, setSerieC2026State, serieB2026State, setSerieB2026State, serieA2026State, setSerieA2026State, transferNews, setTransferNews, pushLog, startCareer, chooseClub, chooseShirtNumber, redrawSerieD2026GroupsForNewSeason, exitSerieD2026Demo, beginSerieD2026Tie, startNewSerieD2026Season, startSerieC2026Season, beginSerieC2026Fase2, beginSerieC2026Final, exitSerieC2026Season, startSerieB2026Season, beginSerieB2026Playoff, exitSerieB2026Season, startSerieA2026Season, exitSerieA2026Season, togglePicker, advanceTrainingDay, advanceRecoveryDay, playWeek, continueAfterMatch, chooseLifePosture, requestTransfer, requestLoan, handleInvest, handleWithdrawInvestments, handleBuyProperty, finalizeNextSeason, continueNextSeason, resolveContractDecision, resetCareer, copinhaState, beginCopinhaMatch, continueCopinhaMatch, finishCopinha };
}

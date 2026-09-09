import React from 'react';
import { useCareerController } from './useCareerController.js';
import { AcademyScreen, CareiraScreen, ClubSelectScreen, ContractDecisionScreen, CreateScreen, GlobalStyle, HomeScreen, LifeEventScreen, MatchScreen, MundoScreen, SeasonEndScreen, SerieA2026ResultScreen, SerieB2026ResultScreen, SerieC2026ResultScreen, SerieD2026ResultScreen, VoceScreen, WPGShell, LifeScreen, PlayerProfileScreen } from '../ui/WPGUI.jsx';
import { getActiveClubsMap } from '../data/competitions/brazil2026.js';
import { CLUBS_MAP } from '../data/_mock/mockData.js';
import { buildRoundToDay, getDayType } from '../engines/life/lifeCalendarFitness.jsx';
import { sortStandings } from '../engines/match/matchEngine.js';

export function CareerApp() {
  const { loaded, setLoaded, academyState, advanceAcademyWeek, phase, setPhase, tab, setTab, player, setPlayer, seasonYear, setSeasonYear, competition, setCompetition, standings, setStandings, fixtures, setFixtures, round, setRound, userClubId, setUserClubId, stats, setStats, log, setLog, promotionResult, setPromotionResult, seasonHistory, setSeasonHistory, seasonStartSnapshot, setSeasonStartSnapshot, trainPick, setTrainPick, showPicker, setShowPicker, pendingWeek, setPendingWeek, lifeState, setLifeState, interviewHistory, setInterviewHistory, pendingLifeEvent, setPendingLifeEvent, dayIndex, setDayIndex, stageDayIndex, setStageDayIndex, fitnessState, setFitnessState, trainingSkipStreak, setTrainingSkipStreak, matchHistory, setMatchHistory, worldState, setWorldState, economyState, setEconomyState, pendingContractDecision, setPendingContractDecision, socialState, handleSocialPublish, handleSocialComment, serieD2026Demo, setSerieD2026Demo, serieC2026State, setSerieC2026State, serieB2026State, setSerieB2026State, serieA2026State, setSerieA2026State, transferNews, setTransferNews, pushLog, startCareer, chooseClub, redrawSerieD2026GroupsForNewSeason, exitSerieD2026Demo, beginSerieD2026Tie, startNewSerieD2026Season, startSerieC2026Season, beginSerieC2026Fase2, beginSerieC2026Final, exitSerieC2026Season, startSerieB2026Season, beginSerieB2026Playoff, exitSerieB2026Season, startSerieA2026Season, exitSerieA2026Season, togglePicker, advanceTrainingDay, advanceRecoveryDay, playWeek, continueAfterMatch, chooseLifePosture, requestTransfer, requestLoan, handleInvest, handleWithdrawInvestments, handleBuyProperty, finalizeNextSeason, continueNextSeason, resolveContractDecision, resetCareer } = useCareerController();
  if (!loaded) return null;
  const activeClubsMap = (userClubId && competition) ? getActiveClubsMap(competition, userClubId) : CLUBS_MAP;
  const club = userClubId ? activeClubsMap[userClubId] : null;
  const roundToDay = competition ? buildRoundToDay(fixtures.length, competition.calendar_pattern) : {};
  // getDayType usa stageDayIndex (relativo ao início da fase atual), NUNCA
  // dayIndex (calendário absoluto, contínuo entre fases pro salário mensal
  // funcionar — ver comentário em useCareerController.js). roundToDay é
  // sempre construído do zero pra fase atual, então precisa de um contador
  // que também comece do zero nela, senão nunca mais bate com nenhum dia
  // de jogo (treino vira um loop infinito).
  const dayType = competition ? getDayType(stageDayIndex, roundToDay) : null;

  return (
    <div className="app-root">
      <GlobalStyle />
      {phase === 'create' && <CreateScreen onStart={startCareer} />}
      {phase === 'academy' && player && <AcademyScreen player={player} state={academyState} seasonYear={seasonYear} log={log} showPicker={showPicker} onTogglePicker={togglePicker} onAdvance={advanceAcademyWeek} />}
      {phase === 'club-select' && player && <ClubSelectScreen player={player} onChoose={chooseClub} />}

      {phase === 'season' && player && competition && club && (
        <WPGShell active={tab} onChange={setTab} player={player} club={club} seasonYear={seasonYear}>
          {tab === 'home' && (
            <HomeScreen
              player={player} club={club} competition={competition} round={round} totalRounds={fixtures.length}
              fixtures={fixtures} log={log} dayType={dayType} condition={fitnessState.condition} matchHistory={matchHistory} clubsMap={activeClubsMap} stats={stats} economyState={economyState}
              trainPick={trainPick} showPicker={showPicker}
              onTogglePicker={togglePicker}
              onSelectTrainingActivity={(id, intensityId) => advanceTrainingDay('train', id, intensityId)}
              onRest={() => advanceTrainingDay('rest')}
              onSkipTraining={() => advanceTrainingDay('skip')}
              onAdvanceRecovery={advanceRecoveryDay}
              onPlay={playWeek}
              dayIndex={dayIndex} seasonYear={seasonYear}
            />
          )}
          {tab === 'carreira' && <CareiraScreen competition={competition} round={round} totalRounds={fixtures.length} stats={stats} log={log} />}
          {tab === 'mundo' && <MundoScreen competition={competition} standings={sortStandings(standings, competition.tiebreakers)} userClubId={userClubId} matchHistory={matchHistory} clubsMap={activeClubsMap} transferNews={transferNews} />}
          {tab === 'profile' && <PlayerProfileScreen player={player} club={club} socialState={socialState} stats={stats} log={log} transferNews={transferNews} seasonYear={seasonYear} />}
          {tab === 'life' && <LifeScreen player={player} club={club} socialState={socialState} socialPosts={socialState.posts} onPublish={handleSocialPublish} onComment={handleSocialComment} interviewHistory={interviewHistory} />}
          {tab === 'voce' && <VoceScreen player={player} club={club} lifeState={lifeState} economyState={economyState} onReset={resetCareer} onRequestTransfer={requestTransfer} onRequestLoan={requestLoan} onInvest={handleInvest} onWithdrawInvestments={handleWithdrawInvestments} onBuyProperty={handleBuyProperty} />}
        </WPGShell>
      )}

      {phase === 'match' && pendingWeek?.userMatchInfo && <MatchScreen match={pendingWeek.userMatchInfo} clubsMap={activeClubsMap} preMatchCondition={fitnessState.condition} onContinue={continueAfterMatch} />}
      {phase === 'life-event' && pendingLifeEvent && <LifeEventScreen event={pendingLifeEvent.event} onChoose={chooseLifePosture} />}
      {phase === 'season-end' && promotionResult && <SeasonEndScreen player={player} result={promotionResult} stats={stats} onContinue={continueNextSeason} />}
      {phase === 'contract-decision' && pendingContractDecision && <ContractDecisionScreen decision={pendingContractDecision} clubsMap={activeClubsMap} onDecide={resolveContractDecision} />}
      {phase === 'serie-d-2026-result' && serieD2026Demo && <SerieD2026ResultScreen demo={serieD2026Demo} onExit={exitSerieD2026Demo} onPlayNext={(tie) => beginSerieD2026Tie(tie.stageId, tie.opponentId, tie.hostsSecondLeg)} stats={stats} fans={lifeState.fans} />}
      {phase === 'serie-c-2026-result' && serieC2026State && <SerieC2026ResultScreen state={serieC2026State} onExit={exitSerieC2026Season} onPlayFase2={beginSerieC2026Fase2} onPlayFinal={beginSerieC2026Final} stats={stats} fans={lifeState.fans} />}
      {phase === 'serie-b-2026-result' && serieB2026State && <SerieB2026ResultScreen state={serieB2026State} onExit={exitSerieB2026Season} onPlayPlayoff={beginSerieB2026Playoff} stats={stats} fans={lifeState.fans} />}
      {phase === 'serie-a-2026-result' && serieA2026State && <SerieA2026ResultScreen state={serieA2026State} onExit={exitSerieA2026Season} stats={stats} fans={lifeState.fans} />}
    </div>
  );
}

import { ClubMonogram, pickScorer } from '../../ui/WPGUI.jsx';
import { COMPETITION_TEMPLATES, getActiveClubsMap } from '../competitions/brazil2026.js';
import { generateLeagueFixtures } from '../../engines/match/matchEngine.js';
/* ============================================================================
   DADOS MOCKADOS — inalterado em relação ao vertical slice (Fase 1)
============================================================================ */

const STATE = { id: 'SP', name: 'São Paulo' };
const FEDERATION = { id: 'fpf', state_id: 'SP', name: 'Federação Paulista de Futebol (mock)' };

// branding: estrutura preparada para trocar 'monogram' por 'licensed' (escudo real)
// no futuro sem alterar nenhum componente que consome `club` — ver ClubMonogram.
//
// roster: hoje só nomes fictícios, usados apenas pra narração de gols do
// adversário — não afeta overall do clube, não é jogador simulado de verdade.
// Formato pensado pra evoluir: no futuro, cada string vira um objeto
// { name, ovr, attrs }, e pickScorer passa a escolher por peso
// (atributo ofensivo) em vez de sorteio uniforme — sem mudar quem consome.
const CLUBS = [
  { id: 'vila_nova', name: 'EC Vila Nova', color: '#1F6F4A', overall: 62, branding: { type: 'monogram', text: 'EVN' }, roster: ['Bruno Alves', 'Kaique Silva', 'Rafael Dutra', 'Emerson Paz', 'Diego Moura'] },
  { id: 'rio_preto', name: 'AA Rio Preto', color: '#C0392B', overall: 65, branding: { type: 'monogram', text: 'ARP' }, roster: ['Anderson Reis', 'Lucas Prado', 'Thiago Nunes', 'Caio Ramos', 'Everton Dias'] },
  { id: 'litoral', name: 'SC Litoral', color: '#1B5FA8', overall: 60, branding: { type: 'monogram', text: 'SCL' }, roster: ['Marcelo Souza', 'Felipe Costa', 'Igor Barros', 'Renan Teles', 'Douglas Melo'] },
  { id: 'serrano', name: 'CA Serrano', color: '#8B5E2A', overall: 58, branding: { type: 'monogram', text: 'CAS' }, roster: ['Gustavo Lima', 'Wesley Rocha', 'Alan Freitas', 'Jonas Pereira', 'Vinícius Aguiar'] },
  { id: 'bandeirantes', name: 'União Bandeirantes', color: '#4A4A4A', overall: 68, branding: { type: 'monogram', text: 'UB' }, roster: ['Matheus Farias', 'Léo Martins', 'Samuel Borges', 'Ricardo Assis', 'Elias Cardoso'] },
  { id: 'ferroviario', name: 'Ferroviário SP', color: '#D4A72C', overall: 61, branding: { type: 'monogram', text: 'FSP' }, roster: ['André Vieira', 'Cauã Ribeiro', 'Otávio Sales', 'Breno Xavier', 'Nathan Correia'] },
  { id: 'independente', name: 'Independente FC', color: '#6C3483', overall: 59, branding: { type: 'monogram', text: 'IND' }, roster: ['Fábio Andrade', 'Júlio Bezerra', 'Wallace Duarte', 'Kevin Monteiro', 'Sérgio Bastos'] },
  { id: 'sorocaba', name: 'Atlético Sorocaba', color: '#A93226', overall: 64, branding: { type: 'monogram', text: 'ASC' }, roster: ['Robson Guedes', 'Ederson Brito', 'Vitor Hugo Lacerda', 'Paulo Machado', 'Iago Ferraz'] },
];
const CLUBS_MAP = Object.fromEntries(CLUBS.map(c => [c.id, c]));

function makeCompetitionConfig(seasonYear, participantIds) {
  return {
    id: `estadual_sp_${seasonYear}`,
    name: 'Campeonato Paulista (mock)',
    family: 'estadual_sp', // chave de lookup em COMPETITION_TEMPLATES
    federation_id: FEDERATION.id,
    format: 'league',
    season_id: `season_${seasonYear}`,
    participants: participantIds,
    promotion: { count: 2, target_competition_id: 'serie_d' },
    relegation: { count: 0, target_competition_id: null },
    tiebreakers: ['pts', 'sg', 'gp'],
    calendar_pattern: { match_intervals: [3, 4] }, // Calendar Engine lê daqui — nunca hardcoded por competição
  };
}

/* ============================================================================
   SÉRIE D — 7 clubes fictícios novos. O 8º participante é sempre o clube do
   próprio jogador quando ele é promovido (ver continueNextSeason/getActiveClubsMap)
   — mantém a liga com 8 participantes, mesmo tamanho do Paulista, número par
   exigido por generateLeagueFixtures. Série D só passa a existir de verdade
   quando o SEU clube sobe; se outro clube terminar em posição de acesso, o
   Paulista simplesmente continua igual na temporada seguinte (ver continueNextSeason).
============================================================================ */

const SERIE_D_CLUBS = [
  { id: 'norte_clube', name: 'EC Norte', color: '#2E7D6B', overall: 66, branding: { type: 'monogram', text: 'EN' }, roster: ['Adalberto Nogueira', 'Rogério Kessler', 'Vinícius Tavares', 'Elenilson Braga', 'Fabrício Odei'] },
  { id: 'serra_verde', name: 'AA Serra Verde', color: '#3E8914', overall: 70, branding: { type: 'monogram', text: 'ASV' }, roster: ['Gilmar Petronilho', 'Cristiano Rezende', 'Danilo Weber', 'Adriano Falcão', 'Márcio Guimarães'] },
  { id: 'litoral_sul', name: 'SC Litoral Sul', color: '#16679A', overall: 63, branding: { type: 'monogram', text: 'SLS' }, roster: ['Ivo Cadorna', 'Renato Piancó', 'Sávio Marchesi', 'Otoniel Braz', 'Uriel Santana'] },
  { id: 'planalto', name: 'CA Planalto', color: '#8E4A2E', overall: 68, branding: { type: 'monogram', text: 'CAP' }, roster: ['Wander Vilhena', 'Élcio Marinho', 'Diogo Casagrande', 'Robério Tolentino', 'Nilton Espírito Santo'] },
  { id: 'central_fc', name: 'União Central FC', color: '#B08D1F', overall: 72, branding: { type: 'monogram', text: 'UCF' }, roster: ['Jefferson Icó', 'Paulo Vitor Anchieta', 'Rangel Coimbra', 'Bismarck Lira', 'Deyvid Marreiro'] },
  { id: 'vale_ferroviario', name: 'Ferroviário do Vale', color: '#5B3A29', overall: 64, branding: { type: 'monogram', text: 'FDV' }, roster: ['Osnei Cavalcanti', 'Tarcísio Bandeira', 'Yuri Aparecido', 'Genildo Prado', 'Wagner Sepúlveda'] },
  { id: 'popular_ac', name: 'Popular Atlético Clube', color: '#7A1F3D', overall: 67, branding: { type: 'monogram', text: 'PAC' }, roster: ['Jorge Wilson Kato', 'Nataniel Borba', 'Cassiano Redivo', 'Elber Dourado', 'Thomaz Vilar'] },
  { id: 'porto_azul', name: 'EC Porto Azul', color: '#1C4E80', overall: 65, branding: { type: 'monogram', text: 'EPA' }, roster: ['Aluísio Ferrer', 'Benedito Amaral', 'Cauê Mendonça', 'Hélio Trindade', 'Ronivon Castilho'] },
];

function makeSerieDConfig(seasonYear, participantIds) {
  return {
    id: `serie_d_${seasonYear}`,
    name: 'Série D (mock)',
    family: 'serie_d',
    federation_id: null, // competição nacional, não amarrada a uma federação estadual
    format: 'league',
    season_id: `season_${seasonYear}`,
    participants: participantIds,
    promotion: { count: 2, target_competition_id: 'serie_c' }, // stub — Série C ainda não implementada; sem template, o Mundo Persistente não move ninguém até ela existir
    relegation: { count: 2, target_competition_id: 'estadual_sp' }, // real — fecha o ciclo com o Paulista, mantém as duas divisões sempre com 8 clubes
    tiebreakers: ['pts', 'sg', 'gp'],
    calendar_pattern: { match_intervals: [3, 4] },
  };
}


export { STATE, FEDERATION, CLUBS, CLUBS_MAP, makeCompetitionConfig, SERIE_D_CLUBS, makeSerieDConfig };

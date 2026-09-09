import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const BASE_URL = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;
const SEASON = 2026;

if (!API_KEY) {
  console.error('API_FOOTBALL_KEY ausente. Nenhuma chamada externa será feita.');
  process.exit(2);
}

async function api(pathname, params = {}) {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY ausente');
  const url = new URL(`${BASE_URL}${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const response = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
  if (!response.ok) throw new Error(`API-Football HTTP ${response.status}`);
  const body = await response.json();
  if (body.errors && Object.keys(body.errors).length) throw new Error(JSON.stringify(body.errors));
  return body;
}

async function resolveLeague(search) {
  const body = await api('/leagues', { country: 'Brazil', season: SEASON, search });
  return body.response || [];
}

async function fetchAllPlayers(leagueId) {
  const all = [];
  let page = 1;
  while (true) {
    const body = await api('/players', { league: leagueId, season: SEASON, page });
    all.push(...(body.response || []));
    if (!body.paging || page >= body.paging.total) break;
    page += 1;
  }
  return all;
}

const leagues = {};
for (const name of ['Serie A', 'Serie B', 'Serie C', 'Serie D']) {
  const matches = await resolveLeague(name);
  const exact = matches.find(x => x.league?.name?.toLowerCase() === name.toLowerCase()) || matches[0];
  leagues[name] = exact ? { id: exact.league.id, name: exact.league.name, country: exact.country?.name } : null;
}

const out = { provider: 'API-Football', seasonYear: SEASON, leagues, fetchedAt: new Date().toISOString(), players: {} };
for (const [name, league] of Object.entries(leagues)) {
  if (!league) continue;
  out.players[name] = await fetchAllPlayers(league.id);
  console.log(`${name}: ${out.players[name].length} registros`);
}

const output = process.env.OUTPUT || path.resolve('backend/data/api-football-2026.json');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(out, null, 2));
console.log(`Gravado em ${output}`);

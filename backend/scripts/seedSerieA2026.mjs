import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SERIE_A_2026_ROSTER_SOURCES } from '../../src/data/official/serieA2026/serieA2026RosterSources.js';

const root = path.resolve(new URL('.', import.meta.url).pathname, '../..');
const dbPath = path.join(root, 'backend/database/wpg-data.sqlite');
const schemaPath = path.join(root, 'backend/database/schema.sql');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(fs.readFileSync(schemaPath, 'utf8'));

db.prepare(`INSERT OR REPLACE INTO api_sources (id, provider, base_url, status, priority, notes) VALUES (?, ?, ?, ?, ?, ?)`).run(
  'cbf', 'CBF', 'https://www.cbf.com.br', 'official_primary', 1, 'Primary identity and competition registration source.'
);
db.prepare(`INSERT OR REPLACE INTO api_sources (id, provider, base_url, status, priority, notes) VALUES (?, ?, ?, ?, ?, ?)`).run(
  'api-football', 'API-Football / API-Sports', 'https://v3.football.api-sports.io', 'adapter_ready_key_required', 2, 'Current-season player profiles/statistics; requires API_FOOTBALL_KEY.'
);
db.prepare(`INSERT OR REPLACE INTO api_sources (id, provider, base_url, status, priority, notes) VALUES (?, ?, ?, ?, ?, ?)`).run(
  'dados-futebol', 'Dados Futebol', 'https://api.dadosfutebol.com.br/v1', 'candidate_enrichment_key_required', 3, 'Brazil-focused structured football API; requires DADOS_FUTEBOL_API_KEY.'
);

const insertClub = db.prepare(`INSERT OR REPLACE INTO clubs (id, official_name, competition, season_year, cbf_team_id, cbf_team_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
for (const club of SERIE_A_2026_ROSTER_SOURCES) {
  insertClub.run(club.id, club.name, club.competition, club.seasonYear, club.cbfTeamId, club.url, club.status);
}

const run = db.prepare(`INSERT INTO collection_runs (competition, season_year, provider, started_at, completed_at, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const now = new Date().toISOString();
run.run('serie_a_2026', 2026, 'CBF', now, now, 'source_registry_complete_roster_import_pending', '20/20 official CBF team roster pages registered. Individual player import awaits complete extraction/API ingestion; no fields are invented.');

db.close();
console.log(JSON.stringify({ dbPath, clubs: SERIE_A_2026_ROSTER_SOURCES.length, status: 'ok' }, null, 2));

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DB_PATH = path.join(ROOT, 'backend', 'database', 'wpg-data.sqlite');
const clubsRoot = path.join(ROOT, 'src', 'data', 'clubs', 'brazil');
const db = new DatabaseSync(DB_PATH);

db.exec(fs.readFileSync(path.join(ROOT, 'backend', 'database', 'schema.sql'), 'utf8'));

const rows = [];
for (const division of ['serie-a', 'serie-b', 'serie-c', 'serie-d']) {
  const dir = path.join(clubsRoot, division);
  for (const slug of fs.readdirSync(dir)) {
    const file = path.join(dir, slug, 'club.json');
    if (!fs.existsSync(file)) continue;
    const club = JSON.parse(fs.readFileSync(file, 'utf8'));
    const source = club.officialSource || null;
    rows.push({
      id: club.id,
      name: club.name,
      competition: club.competition,
      season: club.seasonYear,
      cbfTeamId: source?.teamId ? String(source.teamId) : null,
      cbfUrl: source?.url ? `${source.url}${source.url.includes('?') ? '' : '?tab=atletas'}` : `https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/${division}/2026`,
    });
  }
}

// A-specific roster source registry has team IDs even though the club JSON intentionally keeps membership-only data.
const aSource = fs.readFileSync(path.join(ROOT, 'src/data/official/serieA2026/serieA2026RosterSources.js'), 'utf8');
for (const m of aSource.matchAll(/\['([^']+)','([^']+)','([^']+)'\]/g)) {
  const row = rows.find(r => r.id === m[1]);
  if (row) { row.cbfTeamId = m[3]; row.cbfUrl = `https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-a/2026/${m[3]}?tab=atletas`; }
}

// C-specific roster source registry.
const cSource = fs.readFileSync(path.join(ROOT, 'src/data/official/serieC2026OfficialRosterCoverage.js'), 'utf8');
for (const m of cSource.matchAll(/\['([^']+)',(\d+),'([^']+)'\]/g)) {
  const row = rows.find(r => r.id === m[1]);
  if (row) { row.cbfTeamId = m[2]; row.cbfUrl = `https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-c/2026/${m[2]}?tab=atletas`; }
}

const upsertClub = db.prepare(`INSERT INTO clubs(id,official_name,competition,season_year,cbf_team_id,cbf_team_url,status) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET official_name=excluded.official_name,competition=excluded.competition,season_year=excluded.season_year,cbf_team_id=excluded.cbf_team_id,cbf_team_url=excluded.cbf_team_url,status=excluded.status`);
const insertSource = db.prepare(`INSERT INTO source_records(entity_type,entity_id,season_year,provider,source_url,source_status,retrieved_at,notes) VALUES(?,?,?,?,?,?,?,?)`);
const upsertTarget = db.prepare(`INSERT INTO collection_targets(competition,season_year,club_id,provider,priority,status,last_attempt,notes) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(competition,season_year,club_id,provider) DO UPDATE SET status=excluded.status,notes=excluded.notes`);

for (const r of rows) {
  upsertClub.run(r.id,r.name,r.competition,r.season,r.cbfTeamId,r.cbfUrl,'official_membership_verified_pending_individual_roster');
  insertSource.run('club',r.id,r.season,'CBF',r.cbfUrl,'official_membership_source','2026-09-08T00:00:00Z','Official CBF club/athlete source; individual player normalization pending.');
  upsertTarget.run(r.competition,r.season,r.id,'CBF',1,'source_verified',null,'Primary source; collect individual roster records.');
  upsertTarget.run(r.competition,r.season,r.id,'API-Football',2,'pending_api_key',null,'Secondary enrichment provider; requires API_FOOTBALL_KEY.');
  if (r.competition !== 'serie_d_2026') upsertTarget.run(r.competition,r.season,r.id,'FootyStats',3,'auxiliary_available',null,'Auxiliary 2026 player-statistics source; never treated as official registration.');
  else upsertTarget.run(r.competition,r.season,r.id,'FootyStats',3,'not_covered_for_player_stats',null,'FootyStats 2026 Série D page currently reports no player statistics; do not use for roster identity.');
}

const counts = db.prepare(`SELECT competition, COUNT(*) clubs FROM clubs GROUP BY competition ORDER BY competition`).all();
const targets = db.prepare(`SELECT competition,provider,status,COUNT(*) n FROM collection_targets GROUP BY competition,provider,status ORDER BY competition,provider,status`).all();
console.log(JSON.stringify({ clubs: rows.length, counts, targets }, null, 2));

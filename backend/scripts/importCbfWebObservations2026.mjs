import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DB_PATH = path.join(ROOT, 'backend', 'database', 'wpg-data.sqlite');
const INPUT = path.join(ROOT, 'backend', 'data', 'cbf-2026', 'cbfWebVerifiedObservations2026.json');
const db = new DatabaseSync(DB_PATH);
const data = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

const competitionFromUrl = (url) => {
  const m = String(url).match(/\/serie-([abcd])\/2026/);
  return m ? `serie_${m[1]}_2026` : 'unknown_2026';
};

const insert = db.prepare(`
  INSERT INTO cbf_player_observations
    (registered_club_id, name, nickname, current_club_name, competition, season_year,
     source_provider, source_url, observation_status, relationship_type, relationship_status)
  VALUES (?, ?, ?, ?, ?, ?, 'CBF', ?, 'staging_only', 'unknown', 'pending_official')
`);

let inserted = 0;
let skipped = 0;
for (const row of data.observations || []) {
  const competition = competitionFromUrl(row.sourceUrl);
  const exists = db.prepare(`SELECT 1 FROM cbf_player_observations WHERE registered_club_id=? AND name=? AND source_url=? LIMIT 1`).get(row.registeredClub, row.name, row.sourceUrl);
  if (exists) { skipped++; continue; }
  insert.run(row.registeredClub, row.name, row.nickname || null, row.currentClub || null, competition, data.seasonYear || 2026, row.sourceUrl);
  inserted++;
}

const summary = {
  inserted,
  skipped,
  totalRows: db.prepare(`SELECT COUNT(*) AS n FROM cbf_player_observations WHERE season_year=2026`).get().n,
  differentCurrentClub: db.prepare(`SELECT COUNT(*) AS n FROM cbf_player_observations WHERE season_year=2026 AND current_club_name IS NOT NULL AND lower(current_club_name) NOT IN (lower(registered_club_id))`).get().n,
  loansConfirmed: db.prepare(`SELECT COUNT(*) AS n FROM cbf_player_observations WHERE season_year=2026 AND relationship_type='loan' AND relationship_status='confirmed'`).get().n,
  rule: 'Current club difference is an observation only; transfer history must confirm loan/permanent relationship.'
};
fs.writeFileSync(path.join(ROOT, 'backend', 'data', 'cbf-2026', 'web-observation-import-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

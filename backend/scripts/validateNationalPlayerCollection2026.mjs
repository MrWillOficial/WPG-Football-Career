import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const db = new DatabaseSync(path.join(ROOT, 'backend', 'database', 'wpg-data.sqlite'));
const expected = {serie_a_2026:20, serie_b_2026:20, serie_c_2026:20, serie_d_2026:96};
const clubs = Object.fromEntries(db.prepare(`SELECT competition, COUNT(*) n FROM clubs WHERE season_year=2026 GROUP BY competition`).all().map(r=>[r.competition,r.n]));
const targets = Object.fromEntries(db.prepare(`SELECT competition, COUNT(DISTINCT club_id) n FROM collection_targets WHERE season_year=2026 GROUP BY competition`).all().map(r=>[r.competition,r.n]));
const observations = db.prepare(`SELECT COUNT(*) n FROM cbf_player_observations WHERE season_year=2026`).get().n;
const malformed = db.prepare(`SELECT COUNT(*) n FROM cbf_player_observations WHERE season_year=2026 AND (name='' OR source_url='' OR registered_club_id='')`).get().n;
const duplicates = db.prepare(`SELECT COUNT(*) n FROM (SELECT registered_club_id,name,source_url,COUNT(*) c FROM cbf_player_observations WHERE season_year=2026 GROUP BY registered_club_id,name,source_url HAVING c>1)`).get().n;
const players = db.prepare(`SELECT COUNT(*) n FROM players`).get().n;
const confirmedLoans = db.prepare(`SELECT COUNT(*) n FROM player_loans WHERE season_year=2026 AND status='confirmed'`).get().n;
const result = {
  seasonYear:2026,
  clubCoverage: Object.fromEntries(Object.keys(expected).map(k=>[k,{expected:expected[k],actual:clubs[k]||0,ok:(clubs[k]||0)===expected[k]}])),
  collectionTargets: Object.fromEntries(Object.keys(expected).map(k=>[k,{expected:expected[k],actual:targets[k]||0,ok:(targets[k]||0)===expected[k]}])),
  cbfWebObservations:{rows:observations,malformed,duplicates,ok:malformed===0&&duplicates===0},
  playersInOfficialDb:players,
  confirmedLoans,
  playerActivationSafe: players>0 && Object.values(expected).every(k=>false),
  policy:'CBF is primary. API-Football is enrichment only. Registered→Current never auto-classifies a loan; transfer evidence is required.'
};
result.ok = Object.values(result.clubCoverage).every(v=>v.ok) && Object.values(result.collectionTargets).every(v=>v.ok) && result.cbfWebObservations.ok && confirmedLoans===0;
fs.writeFileSync(path.join(ROOT,'backend','NATIONAL_PLAYER_COLLECTION_VALIDATION_2026.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
process.exit(result.ok?0:1);

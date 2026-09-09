import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DB_PATH = path.join(ROOT, 'backend', 'database', 'wpg-data.sqlite');
const db = new DatabaseSync(DB_PATH);
const schema = fs.readFileSync(path.join(ROOT, 'backend', 'database', 'schema.sql'), 'utf8');
db.exec(schema);
console.log(JSON.stringify({
  database: DB_PATH,
  registrationHistory: db.prepare("SELECT COUNT(*) AS n FROM player_registration_history").get().n,
  loans: db.prepare("SELECT COUNT(*) AS n FROM player_loans").get().n,
  status: 'ready_for_official_player_import'
}, null, 2));

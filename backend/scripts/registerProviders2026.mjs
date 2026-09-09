import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const db = new DatabaseSync(path.join(ROOT,'backend/database/wpg-data.sqlite'));
const upsert = db.prepare(`INSERT INTO api_sources(id,provider,base_url,status,priority,notes) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,base_url=excluded.base_url,status=excluded.status,priority=excluded.priority,notes=excluded.notes`);
upsert.run('cbf','CBF','https://www.cbf.com.br','official_primary',1,'Primary identity, competition membership and official athlete pages.');
upsert.run('api-football','API-Football / API-Sports','https://v3.football.api-sports.io','adapter_ready_key_required',2,'Current-season profiles and statistics. League IDs are resolved dynamically for Brazil/2026; requires API_FOOTBALL_KEY.');
upsert.run('dados-futebol','Dados Futebol','https://api.dadosfutebol.com.br/v1','candidate_enrichment_key_required',3,'Brazil-focused structured football API; requires API key.');
upsert.run('footystats','FootyStats','https://footystats.org','auxiliary_2026',4,'Auxiliary 2026 player statistics for A/B/C. Serie D 2026 currently reports no player statistics.');
const run = db.prepare(`INSERT INTO collection_runs(competition,season_year,provider,started_at,completed_at,status,notes) VALUES(?,?,?,?,?,?,?)`);
const now = new Date().toISOString();
for (const c of ['serie_a_2026','serie_b_2026','serie_c_2026','serie_d_2026']) {
  run.run(c,2026,'CBF',now,now,'source_registry_complete','Official CBF club sources registered; individual player normalization pending.');
  run.run(c,2026,'API-Football',now,null,'blocked_missing_key','Adapter ready; actual API collection requires API_FOOTBALL_KEY.');
}
console.log('providers registered');

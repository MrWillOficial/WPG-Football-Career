import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DB_PATH = path.join(ROOT, 'backend', 'database', 'wpg-data.sqlite');
const OUT_DIR = path.join(ROOT, 'backend', 'data', 'cbf-2026');
fs.mkdirSync(OUT_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
const clubs = db.prepare(`SELECT id, competition, season_year, cbf_team_id, cbf_team_url FROM clubs WHERE season_year=2026 AND cbf_team_url IS NOT NULL AND competition IN ('serie_a_2026','serie_b_2026','serie_c_2026','serie_d_2026') ORDER BY id`).all();

function clean(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}
function decodeEntities(v) {
  return clean(v)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '));
}
function extractRows(html) {
  const rows = [];
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => stripTags(m[1]));
    if (cells.length >= 3 && cells[0] && cells[1] && cells[2]) {
      const [name, nickname, currentClub] = cells;
      if (!/^nome$/i.test(name) && !/^clube atual$/i.test(currentClub)) rows.push({ name, nickname, currentClub });
    }
  }
  return rows;
}
function fallbackRows(html) {
  const rows = [];
  const re = /<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
  for (const m of html.matchAll(re)) rows.push({ name: decodeEntities(m[1]), nickname: decodeEntities(m[2]), currentClub: decodeEntities(m[3]) });
  return rows;
}

const results = [];
const queue = [...clubs];
const workers = Array.from({ length: 20 }, async () => {
  while (queue.length) {
    const club = queue.shift();
  const url = club.cbf_team_url.includes('tab=atletas') ? club.cbf_team_url : `${club.cbf_team_url}${club.cbf_team_url.includes('?') ? '&' : '?'}tab=atletas`;
  const result = { clubId: club.id, competition: club.competition, seasonYear: club.season_year, url, status: 'pending', count: 0, rows: [], error: null };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'WPG-Official-Data-Collector/2026' } });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const rows = extractRows(html);
    const finalRows = rows.length ? rows : fallbackRows(html);
    result.rows = finalRows.map(r => ({ ...r, registeredClub: club.id, source: 'CBF', sourceUrl: url, dataStatus: 'official_cbf_observed' }));
    result.count = result.rows.length;
    result.status = result.count ? 'collected' : 'empty_official_page';
  } catch (error) {
    result.status = 'fetch_failed';
    result.error = String(error?.message || error);
  }
    results.push(result);
  }
});
await Promise.all(workers);
results.sort((a,b) => a.clubId.localeCompare(b.clubId));

const summary = {
  generatedAt: new Date().toISOString(),
  source: 'CBF',
  seasonYear: 2026,
  totalClubs: results.length,
  competitions: Object.fromEntries([...new Set(results.map(r => r.competition))].sort().map(c => [c, { clubs: results.filter(r => r.competition === c).length, collectedClubs: results.filter(r => r.competition === c && r.status === 'collected').length, observedPlayers: results.filter(r => r.competition === c).reduce((n, r) => n + r.count, 0) }])),
  collectedClubs: results.filter(r => r.status === 'collected').length,
  pendingClubs: results.filter(r => r.status !== 'collected').length,
  totalObservedPlayers: results.reduce((n, r) => n + r.count, 0),
  activationSafe: false,
  rule: 'Observed CBF rows are staging-only until complete club coverage and identity/position validation are closed. Registered→Current never implies loan by itself.',
};

fs.writeFileSync(path.join(OUT_DIR, 'roster-observations-2026.json'), JSON.stringify({ summary, clubs: results }, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'collection-summary-2026.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

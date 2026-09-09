import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'node:sqlite';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const dbPath = path.join(root, 'backend', 'database', 'wpg-data.sqlite');
const db = new sqlite3.DatabaseSync(dbPath);
const count = table => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
const competitions = db.prepare(`SELECT competition, COUNT(*) AS clubs, COUNT(DISTINCT id) AS unique_clubs FROM clubs GROUP BY competition ORDER BY competition`).all();
const targets = db.prepare(`SELECT competition, provider, status, COUNT(*) AS n FROM collection_targets GROUP BY competition, provider, status ORDER BY competition, provider, status`).all();
const players = count('players');
const registrations = count('player_registrations');
const errors = [];
for (const row of competitions) {
  const expected = { serie_a_2026: 20, serie_b_2026: 20, serie_c_2026: 20, serie_d_2026: 96 }[row.competition];
  if (expected && (row.clubs !== expected || row.unique_clubs !== expected)) errors.push(`${row.competition}: ${row.clubs}/${expected}`);
}
const report = { generatedAt: new Date().toISOString(), competitions, targets, players, registrations, validation: { errors, valid: errors.length === 0, playerActivationSafe: players > 0 && registrations > 0 } };
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;

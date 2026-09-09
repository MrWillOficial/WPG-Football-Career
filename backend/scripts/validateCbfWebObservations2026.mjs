import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const file = path.join(ROOT, 'backend/data/cbf-2026/cbfWebVerifiedObservations2026.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const seen = new Set();
const duplicates = [];
const malformed = [];
const candidateRelationships = [];
const registeredNameMap = {
  corinthians: 'Corinthians', bahia: 'Bahia', gremio: 'Grêmio', vitoria: 'Vitória', bragantino: 'Red Bull Bragantino',
  'atletico-mg': 'Atlético Mineiro', botafogo: 'Botafogo', 'sao-paulo': 'São Paulo', santos: 'Santos FC', cruzeiro: 'Cruzeiro',
  internacional: 'Internacional', fluminense: 'Fluminense', 'athletico-pr': 'Athletico Paranaense', chapecoense: 'Chapecoense',
  coritiba: 'Coritiba SAF', palmeiras: 'Palmeiras'
};
for (const row of data.observations) {
  const key = `${row.registeredClub}|${row.name}|${row.sourceUrl}`;
  if (seen.has(key)) duplicates.push(key);
  seen.add(key);
  if (!row.registeredClub || !row.name || !row.nickname || !row.currentClub || !row.sourceUrl) malformed.push(row);
  if (row.currentClub !== registeredNameMap[row.registeredClub]) candidateRelationships.push(row);
}
const report = { source: data.source, seasonYear: data.seasonYear, observations: data.observations.length, duplicates: duplicates.length, malformed: malformed.length, currentClubDifferent: candidateRelationships.length, activationSafe: false, loanConfirmed: 0, loanClassificationRule: 'currentClub difference alone never confirms a loan' };
fs.writeFileSync(path.join(ROOT, 'backend/data/cbf-2026/web-observation-validation.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (duplicates.length || malformed.length) process.exit(1);

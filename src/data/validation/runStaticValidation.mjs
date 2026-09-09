import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SOCIAL_TONES } from '../../engines/life/socialEngine.js';
import { SERIE_B_2026_OFFICIAL_COVERAGE_CHECK } from '../official/serieB2026OfficialCoverage.js';
import { SERIE_C_2026_OFFICIAL_ROSTER_COVERAGE_CHECK } from '../official/serieC2026OfficialRosterCoverage.js';

const root = path.resolve(process.cwd());
const src = path.join(root, 'src');
const jsFiles = [];
function walk(dir) { for (const name of fs.readdirSync(dir)) { const p=path.join(dir,name); const st=fs.statSync(p); if(st.isDirectory()) walk(p); else if(/\.js$/.test(name)) jsFiles.push(p); } }
walk(src);
for (const f of jsFiles) execFileSync(process.execPath, ['--check', f], { stdio:'ignore' });
if (SOCIAL_TONES.length !== 10) throw new Error('social_tones_invalid');
if (!SERIE_B_2026_OFFICIAL_COVERAGE_CHECK.valid) throw new Error('serie_b_coverage_invalid');
if (!SERIE_C_2026_OFFICIAL_ROSTER_COVERAGE_CHECK.valid) throw new Error('serie_c_coverage_invalid');
console.log(JSON.stringify({ jsSyntax: true, socialTones: SOCIAL_TONES.length, serieB: SERIE_B_2026_OFFICIAL_COVERAGE_CHECK, serieC: SERIE_C_2026_OFFICIAL_ROSTER_COVERAGE_CHECK }, null, 2));

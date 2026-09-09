import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const ROOT=path.resolve(new URL('../..',import.meta.url).pathname);
const db=new DatabaseSync(path.join(ROOT,'backend','database','wpg-data.sqlite'));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const clubAliases={
 'sao paulo':'sao-paulo','corinthians':'corinthians','flamengo':'flamengo','palmeiras':'palmeiras','santos':'santos','botafogo':'botafogo','gremio':'gremio','atletico mineiro':'atletico-mineiro','atletico mg':'atletico-mineiro','cruzeiro':'cruzeiro','internacional':'internacional','fluminense':'fluminense','bahia':'bahia','vitoria':'vitoria','mirassol':'mirassol','red bull bragantino':'red_bull_bragantino','bragantino':'red_bull_bragantino','chapecoense':'chapecoense','athletico paranaense':'athletico_paranaense','coritiba':'coritiba','remo':'remo','vasco':'vasco','fortaleza':'fortaleza','ceara':'ceara','sport':'sport','cuiaba':'cuiaba','juventude':'juventude','america':'america-mg','atletico go':'atletico-go','nautico':'nautico','juventude':'juventude','ponte preta':'ponte-preta','vila nova':'vila-nova','sao bernardo':'sao-bernardo'
};
function canonClub(s){let x=norm(s).replace(/\b(saf|s a f|s a|futebol clube|futebol|clube|fc|ec)\b/g,' ').replace(/\b(sp|rj|mg|ba|rs|pr|sc|pe|ce|go|es|mt|al|pb|rn|ma|pi|df)\b/g,' ').replace(/\s+/g,' ').trim(); return clubAliases[x]||x;}
const obs=db.prepare(`SELECT id,name,registered_club_id,current_club_name FROM cbf_player_observations WHERE season_year=2026`).all();
const transfers=db.prepare(`SELECT id,player_name,origin_club_name,destination_club_name,transfer_type FROM player_transfer_evidence WHERE season_year=2026 AND transfer_status='confirmed'`).all();
let confirmed=0;
for(const o of obs){
 const matches=transfers.filter(t=>norm(t.player_name)===norm(o.name));
 const hit=matches.find(t=>canonClub(t.destination_club_name)===canonClub(o.current_club_name) && canonClub(t.origin_club_name)===canonClub(o.registered_club_id));
 if(hit){db.prepare(`UPDATE cbf_player_observations SET relationship_type=?,relationship_status='confirmed',observation_status='transfer_reconciled' WHERE id=?`).run(hit.transfer_type,o.id);confirmed++;}
}
const summary={observations:obs.length,transferEvidence:transfers.length,reconciled:confirmed,stillPending:db.prepare(`SELECT COUNT(*) n FROM cbf_player_observations WHERE season_year=2026 AND relationship_status='pending_official'`).get().n};
console.log(JSON.stringify(summary,null,2));

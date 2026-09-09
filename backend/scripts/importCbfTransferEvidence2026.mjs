import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const DB_PATH = path.join(ROOT, 'backend', 'database', 'wpg-data.sqlite');
const db = new DatabaseSync(DB_PATH);
const sourceUrl = 'https://stcbfsiteprdimgbrs.blob.core.windows.net/img-site/cdn/Lista_das_40_operacoes_domesticas_onerosas_vendas_e_emprestimos_com_valore_3b8b7611d1.pdf';

const rows = [
['2026-01-05','Victor Gabriel DA CONCEIÇÃO RIBEIRO','loan','Sport - PE','Internacional - RS','Primeira'],
['2026-01-05','Robert Dos Santos CONCEICAO','loan','Atlético Mineiro Saf - MG','Chapecoense - SC','Primeira'],
['2026-01-06','Bruno DE LARA FUCHS','loan','Atlético Mineiro Saf - MG','Palmeiras - SP','Primeira'],
['2026-01-07','Willian ESTEFANI MACHADO','permanent','Ceará - CE','Mirassol - SP','Primeira'],
['2026-01-07','Alix Vinicius DE SOUZA SAMPAIO','loan','Atlético - GO','Red Bull Bragantino - SP','Primeira'],
['2026-01-07','Denilson Alves BORGES','permanent','Cuiabá Saf - MT','Mirassol - SP','Primeira'],
['2026-01-07','Jemmes Bruno RIBEIRO DA SILVA','permanent','Mirassol - SP','Fluminense - RJ','Primeira'],
['2026-01-07','JOSE ALDO SOARES DE OLIVEIRA FILHO','permanent','Ituano - SP','Mirassol - SP','Primeira'],
['2026-01-08','Marlon RODRIGUES FREITAS','permanent','Botafogo - RJ','Palmeiras - SP','Primeira'],
['2026-01-08','Jose IVALDO ALMEIDA SILVA','loan','Cruzeiro Saf - MG','Santos - SP','Primeira'],
['2026-01-09','Marlon RODRIGUES XAVIER','permanent','Cruzeiro Saf - MG','Grêmio - RS','Primeira'],
['2026-01-09','Paulo Roberto Da Silva JUNIOR','loan','America Saf - MG','Red Bull Bragantino - SP','Primeira'],
['2026-01-09','Ronaldo DE OLIVEIRA STRADA','permanent','Atlético - GO','Bahia - BA','Primeira'],
['2026-01-09','Camilo REIJERS DE OLIVEIRA','loan','Grêmio - RS','Chapecoense - SC','Primeira'],
['2026-01-12','Bruno Mateus Do Nascimento APARECIDO','loan','Gremio Novorizontino - Saf - SP','Red Bull Bragantino - SP','Primeira'],
['2026-01-12','Guilherme Antonio ARANA LOPES','permanent','Atlético Mineiro Saf - MG','Fluminense - RJ','Primeira'],
['2026-01-14','Vitor EDUARDO DA SILVA MATOS','permanent','Internacional - RS','Flamengo - RJ','Primeira'],
['2026-01-15','Mateus Da Silva DUARTE','permanent','Cuiabá Saf - MT','Vitória - BA','Primeira'],
['2026-01-16','Igor Marques Paciencia CARDOSO','permanent','Juventude - RS','Mirassol - SP','Primeira'],
['2026-01-19','Breno Henrique Vasconcelos LOPES','permanent','Fortaleza Ec Saf - CE','Coritiba S.a.f. - PR','Primeira'],
['2026-01-20','Victor Hugo GOMES SILVA','permanent','Flamengo - RJ','Atlético Mineiro Saf - MG','Primeira'],
['2026-01-20','ERICK DE ARRUDA SERAFIM','loan','São Paulo - SP','Vitória - BA','Primeira'],
['2026-01-21','Gustavo NONATO SANTANA','permanent','Santos - SP','Fluminense - RJ','Primeira'],
['2026-01-22','Gabriel BARALHAS DOS SANTOS','permanent','Atlético - GO','Vitória - BA','Primeira'],
['2026-01-22','Vitor Teixeira SANTOS','loan','Barra Futebol Clube - SC','Red Bull Bragantino - SP','Primeira'],
['2026-01-26','JEFFERSON DAVID SAVARINO QUINTERO','permanent','Botafogo - RJ','Fluminense - RJ','Primeira'],
['2026-01-27','Luan Ribeiro AMPARO','loan','Grêmio Desportivo Prudente - SP','Palmeiras - SP','Primeira'],
['2026-01-28','Claudio Henrique DE JESUS PASSOS','loan','Desportivo Brasil Participacoes Ltda - SP','Athletico Paranaense - PR','Primeira'],
['2026-01-28','Gabriel da Silva Santos','loan','Ibrachina FC - SP','Palmeiras - SP','Primeira'],
['2026-01-29','BELEN AQUINO MOREIRA','permanent','Internacional - RS','Corinthians - SP','Primeira'],
['2026-01-30','JOSE HERRERA ARES','permanent','Fortaleza Ec Saf - CE','Red Bull Bragantino - SP','Primeira'],
['2026-01-07','WELLINGTON GONZAGA DE ASSIS FILHO','permanent','Ac Paranavaí - PR','Sao Bernardo Fc - SP','Segunda'],
['2026-01-07','Rai Dos Reis RAMOS','permanent','Gremio Novorizontino - Saf - SP','Juventude - RS','Segunda'],
['2026-01-08','JONAS GABRIEL DA SILVA NUNES','permanent','Botafogo - SP','Náutico - PE','Segunda'],
['2026-01-09','Gebson Gomes dos Santos','permanent','Maringa Futebol Clube S.a.f. - PR','Atlético - GO','Segunda'],
['2026-01-09','Vinicius Nelson De Souza ZANOCELO','loan','Santos - SP','Ceará - CE','Segunda'],
['2026-01-13','Fernando Augusto PEREIRA BUENO JUNIOR','permanent','Athletico Paranaense - PR','Ceará - CE','Segunda'],
['2026-01-16','Hedhe Halls Rocha Da SILVA','loan','Vila Nova - GO','Sport - PE','Segunda'],
['2026-01-22','Guilherme De Almeida MANSANO','permanent','Sfera Futebol Clube SAF - SP','Cuiabá Saf - MT','Segunda'],
['2026-01-29','Max ALVES DA SILVA','loan','Cuiabá Saf - MT','Sport - PE','Segunda']
];

const ins = db.prepare(`INSERT INTO player_transfer_evidence
(player_name,origin_club_name,destination_club_name,transfer_type,transfer_status,season_year,source_provider,source_url,evidence_text,transfer_date)
VALUES (?,?,?,?, 'confirmed',2026,'CBF',?,?,?)`);
for (const [date,name,type,origin,dest,division] of rows) ins.run(name,origin,dest,type,sourceUrl,`${date} | ${division} | ${type}` ,date);

const summary={
 totalOperations:db.prepare(`SELECT COUNT(*) n FROM player_transfer_evidence WHERE season_year=2026`).get().n,
 confirmedLoans:db.prepare(`SELECT COUNT(*) n FROM player_transfer_evidence WHERE season_year=2026 AND transfer_type='loan'`).get().n,
 confirmedPermanent:db.prepare(`SELECT COUNT(*) n FROM player_transfer_evidence WHERE season_year=2026 AND transfer_type='permanent'`).get().n,
 source:'CBF official attachment',
 scope:'40 domestic onerous operations (sales and loans with amounts payable) from January 2026; this is evidence for the listed operations, not a complete national transfer history.'
};
fs.writeFileSync(path.join(ROOT,'backend','data','cbf-2026','transfer-evidence-summary-2026.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));

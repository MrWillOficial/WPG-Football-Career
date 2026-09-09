# Série A 2026 — Coleta de jogadores

## Fonte primária
CBF, páginas oficiais de atletas/equipes da Série A 2026.

## Fonte auxiliar candidata
API-Football / API-Sports, temporada 2026, Brasileirão ID 71. O endpoint `/players` aceita `league + season` ou `team + season` e retorna perfil e estatísticas de temporada. A integração está preparada, mas exige `API_FOOTBALL_KEY`.

Dados Futebol também foi registrado como provedor brasileiro candidato para enriquecimento; exige `DADOS_FUTEBOL_API_KEY`.

## Regra WPG
CBF é autoridade para identidade/registro/clube. APIs externas podem enriquecer estatísticas e campos auxiliares, mas nunca sobrescrevem silenciosamente a fonte primária.

Nenhum OVR, atributo, potencial, salário ou posição é inventado para preencher lacunas.

## Estado desta rodada
- 20/20 clubes da Série A 2026 com fonte CBF oficial registrada.
- Banco SQLite criado em `backend/database/wpg-data.sqlite`.
- Schema preparado para jogadores, registros por clube/temporada, número de camisa e uniformes.
- Importação integral dos jogadores ainda fica pendente até ingestão completa/normalização.

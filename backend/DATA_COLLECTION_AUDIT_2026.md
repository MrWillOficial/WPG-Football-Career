# WPG — Auditoria da Coleta Nacional 2026

Data da auditoria: 2026-09-09

## Cobertura estrutural

| Competição | Clubes | Fonte CBF | Alvo API-Football | Jogadores efetivamente importados |
|---|---:|---|---|---:|
| Série A | 20 | 20/20 | 20/20 | 0 |
| Série B | 20 | 20/20 | 20/20 | 0 |
| Série C | 20 | 20/20 | 20/20 | 0 |
| Série D | 96 | 96/96 | 96/96 | 0 |

## Por que o contador de jogadores está 0?

A coleta individual foi deliberadamente bloqueada quando a fonte externa exige autenticação. O adapter API-Football está pronto para resolver automaticamente os IDs das competições brasileiras de 2026 e paginar `/players` por liga/equipe, mas exige `API_FOOTBALL_KEY`.

A CBF permanece como fonte primária de identidade/registro. Durante a auditoria foram verificadas páginas oficiais de clubes e registrados 39 observations individuais em staging, incluindo divergências Registrado → Atual. Esses registros ainda não ativam a base oficial porque a cobertura completa e a normalização individual ainda não foram fechadas.

**Não preencher com mocks. Não ativar base parcial. Divergência Registrado → Atual nunca confirma empréstimo sozinha.**

## Fontes auxiliares encontradas

- API-Football/API-Sports: `/players?league={leagueId}&season=2026&page={page}` e `/players?team={teamId}&season=2026&page={page}`.
- FootyStats: bases 2026 de jogadores para Série A, B e C; serve apenas para estatística auxiliar. A página da Série D 2026 atualmente informa que não há estatísticas de jogadores disponíveis.
- Dados Futebol: API brasileira estruturada; requer chave própria.

## Regra de ativação

`players > 0` e `player_registrations > 0` **não são suficientes** para ativar a base. Também é necessário validar cobertura por clube, duplicidade, fonte, temporada e conflito de clube atual.

## Staging CBF verificado

- `backend/data/cbf-2026/cbfWebVerifiedObservations2026.json`: 39 observações diretamente verificadas em páginas oficiais CBF durante esta etapa.
- `backend/data/cbf-2026/web-observation-validation.json`: 39 observações, 0 duplicidades, 0 registros malformados e 0 empréstimos automaticamente confirmados.
- `backend/scripts/collectCbf2026Rosters.mjs`: coletor oficial preparado para extração integral; o ambiente de execução local não conseguiu resolver a rede da CBF, portanto ele não foi usado para fabricar/importar dados.

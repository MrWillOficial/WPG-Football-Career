# Official Data

Central de rastreabilidade para dados reais. A validação de cobertura é obrigatória antes de ativar uma coleção como fonte do jogo.

## Série B 2026 — cobertura oficial

`serieB2026OfficialCoverage.js` registra as 20 páginas oficiais da CBF para a Série B 2026 e seus IDs de clube. O registro valida a fonte oficial de clube/elenco, mas mantém a importação completa dos jogadores separada: recortes parciais da página da CBF nunca são tratados como elenco completo.

Fonte primária: CBF — Campeonato Brasileiro Série B 2026.

## Coleta nacional de jogadores 2026

A infraestrutura de banco SQLite cobre 156 clubes (20 A + 20 B + 20 C + 96 D), com alvos separados para CBF, API-Football e fontes auxiliares. A base profissional individual permanece bloqueada até a importação verificável por jogador.

API-Football é usada como enriquecimento atual de temporada quando uma chave válida estiver disponível; o resolvedor de competição consulta os IDs de 2026 dinamicamente em vez de fixar IDs sem confirmação.

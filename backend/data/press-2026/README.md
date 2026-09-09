# Coleta via imprensa — 2026

Camada de coleta DISTINTA da CBF verificada (`backend/data/cbf-2026/`). Existe
porque o ambiente de execução não resolve a rede da CBF/sites oficiais de
clube (confirmado de novo em 2026-09-09 — `curl`/`WebFetch` bloqueados pelo
proxy de saída). A busca web (WebSearch) continua acessível e traz matérias
de apresentação de elenco publicadas por veículos esportivos locais e pelos
próprios clubes em redes sociais/sites — não é CBF/BID, mas é a fonte real
mais próxima disponível hoje neste ambiente.

**Nunca confundir com dado oficial.** Nenhum registro aqui ativa
`OFFICIAL_PLAYER_DATABASE` nem qualquer base ativa do jogo. Decisão do
usuário (2026-09-09): coletar por imprensa e marcar status como pendente,
em vez de pausar de novo — mas sem nunca apagar essa distinção de confiança.

## Status possíveis por clube

- `press_pending_official`: uma matéria de apresentação de elenco (do clube
  ou de veículo local) foi encontrada e lista nomes/posições. Ainda não foi
  cruzada com CBF/BID nem canal oficial do clube — pode incluir jogador que
  saiu depois da matéria, reforço anunciado que não assinou, etc.
- `not_found_via_press`: a busca não encontrou nenhuma lista de elenco
  divulgada pra esse clube. Fica vazio — nunca preenchido com jogador
  inventado só pra não deixar em branco.

## Posição

Guardada como veio na matéria (`positionRaw`, ex: "Atacante", "Volante",
"Lateral-direito") — nunca mapeada pra uma posição detalhada mais específica
do jogo (ex: CA vs SA vs PD) quando a fonte só disse "Atacante". Mapear isso
seria inventar uma informação que a fonte não confirmou.

## Metodologia por clube

1. Busca: `"<nome do clube>" elenco 2026 jogadores`.
2. Se achar matéria de apresentação/anúncio de elenco → registra nomes,
   posição como veio na fonte, e a(s) URL(s) usada(s) em `sources`.
2b. Vários resultados às vezes citam SÓ parte do elenco (reforços, ou só
   "principais nomes") — registra o que a matéria realmente lista, nunca
   completa o resto "por dedução".
3. Se não achar nada → `not_found_via_official-press`, array de jogadores
   vazio, segue pro próximo clube.
4. Nunca decide sozinho se um jogador tá emprestado ou saiu do clube —
   isso exigiria fonte que confirme a transferência, fora de escopo aqui.

## Progresso

- `serieD-press-rosters.json` — **COMPLETO** (96/96 clubes, grupos A01→A16).
  Ver campo `_progress` de cada arquivo pro estado exato.
- `serieC-press-rosters.json` — **COMPLETO** (20/20 clubes).
- `serieB-press-rosters.json` — **COMPLETO** (19/20 encontrados, 1 não
  encontrado via imprensa: Botafogo-SP).
- `serieA-press-rosters.json` — **COMPLETO** (20/20 clubes).

**Coleta via imprensa das 4 divisões (D, C, B, A) concluída em 2026-09-09**
-- 156 de 157 clubes com pelo menos alguma cobertura de elenco (só
Botafogo-SP ficou `not_found_via_press`), profundidade bem variável por
clube (de um único nome a elencos completos discriminados por posição).
Vários cruzamentos de validação entre fontes independentes confirmaram
transferências reais de jogadores entre clubes já cadastrados no próprio
jogo (documentados nos campos `notes` de cada clube envolvido) e algumas
contradições entre fontes foram mantidas como estão, sem tentar resolver
(fora de escopo desta coleta).

Ordem de coleta: "sempre começa de baixo" (pedido explícito do usuário) —
Série D primeiro (concluída), depois C, depois B, depois A, cada uma na
ordem dos clubes conforme aparece em `SERIE_C_2026_CLUBS` /
`SERIE_B_2026_CLUBS` / `SERIE_A_2026_CLUBS` no próprio jogo
(`src/data/competitions/`).

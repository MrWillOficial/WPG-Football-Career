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

Ver `serieD-press-rosters.json` → campo `_progress`. Ordem de coleta segue a
ordem dos grupos da Série D 2026 (A01 → A16), do zero — "sempre começa de
baixo" (pedido explícito do usuário).

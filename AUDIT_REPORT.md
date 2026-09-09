# WPG PROJECT — Auditoria Final do Snapshot

## Escopo

Este pacote consolida as alterações feitas depois da validação B/C/D e inclui a camada nacional da Copa do Brasil 2026.

## Competições

- Série A 2026: 20 clubes, liga de 38 rodadas, 4 rebaixados.
- Série B 2026: 20 clubes, 2 acessos diretos, playoff 3º×6º e 4º×5º, 4 rebaixados.
- Série C 2026: 20 clubes, 1ª fase única, 2 grupos na fase 2, 4 acessos e 2 rebaixamentos.
- Série D 2026: 96 clubes, 16 grupos de 6, 64 classificados, 6 acessos; quatro semifinalistas + dois vencedores do playoff.
- Copa do Brasil 2026: 126 clubes, nove fases, Série A entrando na 5ª fase, final em jogo único.

## Arquitetura adicionada/corrigida

- `CompetitionEngineV2` aceita múltiplos outcomes de promoção/rebaixamento.
- `CompetitionEngineV2` aceita participantes compostos por múltiplas fontes (`combined`).
- Nova cutline `rankRange` para recortes como 3º–6º.
- Simulação oficial leve das divisões A/B/C/D para o Mundo Persistente, usando resultados sintéticos determinísticos isolados e nunca apresentados como resultados reais.
- Mundo Persistente inicializado com A/B/C/D 2026.
- Academia-base de 26 semanas: 16 → 17 anos, desenvolvimento e estatísticas de formação antes do primeiro contrato profissional.
- Seleção inicial limitada a clubes que demonstram interesse, em vez de listar todos os 96 clubes.
- Mercado de transferências/empréstimos corrigido para trabalhar com mapas de clubes e não arrays inexistentes.
- Registro oficial de cobertura de participação CBF para A/B/C/D.
- Registro de fontes CBF para clubes A/B/C/D.
- Base profissional permanece fechada para ativação parcial enquanto os elencos oficiais completos não forem verificados.
- Copa do Brasil 2026 separada do Brasileirão, com critérios de entrada e fases configuráveis.
- Âncoras oficiais de calendário da Copa do Brasil: 18–19/02 (1ª fase) e 06/12 (final); demais janelas permanecem pendentes quando não verificadas.
- `lifeCalendarFitness.js` foi convertido para `.jsx` porque continha JSX real e não deve permanecer com extensão `.js`.
- Removida duplicação de constantes no `playerEngine.js` que causava erro de sintaxe.

## Auditoria automática

- 0 falhas em `node --check` para todos os arquivos `.js`.
- 0 JSON inválidos.
- 20 clubes A.
- 20 clubes B.
- 20 clubes C.
- 96 clubes D.
- Os self-checks existentes de A/B/C/D permanecem presentes.

## Limite deliberado

A coleção completa de jogadores profissionais A/B/C/D **não foi marcada como completa**. O jogo não ativa uma base parcial como se fosse oficial e não inventa posição, OVR, atributos, potencial ou salário individual.


## Incremento de auditoria — WPG Life / Social / Identidade do jogador

- Corrigidos imports relativos quebrados nas telas em `src/ui/screens/*`.
- Todas as 12 telas JSX foram analisadas pelo parser JSX do TypeScript: 0 erros.
- Todos os imports relativos JS/JSX foram resolvidos contra a árvore atual: 0 faltas.
- `WPG Social Engine` adicionado com 10 tons de publicação, comentários e consequências persistíveis.
- Registro de camisa adicionado como dado contextual clube + temporada; número não pertence à identidade permanente.
- Registro de uniformes 2026 adicionado com estado `pending_official_asset` por padrão; nenhum escudo/licença foi inventado.
- Perfil do jogador e Life passaram a coexistir dentro do mesmo shell WPG.
- Fontes oficiais CBF de páginas de elenco da Série B e Série C estão registradas separadamente da normalização individual.
- A importação profissional completa continua bloqueada até que cada registro individual esteja verificável; nenhum OVR, potencial, posição ou salário foi inventado.

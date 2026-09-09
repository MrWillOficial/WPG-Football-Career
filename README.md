# WPG PROJECT — Football Career Simulation

Jogo independente de carreira de futebol, com arquitetura modular e dados separados do código.

## Princípios

1. **Dados reais separados do motor** — clubes, jogadores, competições e fontes não ficam misturados com UI.
2. **Cada clube tem seu próprio diretório** — mudanças em um clube não exigem alterar outro.
3. **Mundo Aberto isolado** — estado e simulação do universo ficam separados da carreira do jogador.
4. **Sem invenção de dado oficial** — informação sem fonte verificável permanece `pending_official`.
5. **Mocks isolados** — conteúdo sintético fica exclusivamente em `src/data/_mock` e em demos/testes explicitamente marcados.
6. **Engines independentes** — competição, calendário, partida, jogador, economia e vida possuem fronteiras próprias.

## Estrutura

```text
src/
├── app/                         # composição da aplicação
├── components/                  # componentes reutilizáveis (cresce conforme necessário)
├── screens/                     # telas por domínio (cresce conforme necessário)
├── engines/
│   ├── competition/             # Competition Engine V2
│   ├── economy/                 # contratos, salários e economia
│   ├── life/                    # calendário, vida e fitness
│   ├── match/                   # partida e estado de forma
│   └── player/                  # modelo/progressão do jogador
├── data/
│   ├── clubs/brazil/             # 156 clubes atuais organizados individualmente
│   │   ├── serie-a/<clube>/
│   │   ├── serie-b/<clube>/
│   │   ├── serie-c/<clube>/
│   │   └── serie-d/<clube>/
│   ├── competitions/             # regras/configurações de competições
│   ├── players/                  # registros profissionais e de base
│   ├── official/                 # rastreabilidade/validação/cobertura
│   └── _mock/                    # dados artificiais isolados
├── world/
│   ├── open-world/               # Mundo Aberto
│   ├── world-state/              # estado persistente do universo
│   └── world-simulation/         # simulação fora da carreira
└── ui/                           # sistema visual e telas compartilhadas
```

## Dados de clube

Cada clube possui, desde o início, espaço próprio para:

- `club.json`
- `squad.json`
- `academy.json`
- `staff.json`
- `history.json`
- `sources.json`

Arquivos ainda não coletados oficialmente ficam explicitamente pendentes; não recebem números inventados.

## Estado atual da migração

O antigo vertical slice foi dividido em módulos sem alterar deliberadamente as regras já validadas. A migração é incremental: primeiro separam-se responsabilidades e dados; depois cada domínio pode ser refinado sem voltar ao arquivo monolítico.

## Estado consolidado — WPG Life / Identidade 2026

A base agora inclui o `WPG Social Engine`, registro contextual de número de camisa por clube/temporada, estrutura de uniformes oficiais 2026 sem exigir escudos licenciados, perfil do jogador e Life dentro do mesmo shell visual.

A validação de fonte de elenco da Série B e Série C usa páginas oficiais da CBF para confirmar os campos de equipe `Nome`, `Apelido` e `Clube Atual`. A normalização individual completa continua deliberadamente bloqueada até que os registros possam ser verificados sem inferência.

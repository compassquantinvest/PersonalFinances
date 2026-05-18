# PersonalFinances

Dashboard pessoal para acompanhar patrimonio, compras, dividendos e comparativos com carteiras recomendadas.

## Escopo inicial

- Resumo geral da carteira
- Cadastro de compras
- Cadastro de dividendos
- Comparacao da alocacao com carteiras modelo da XP, Suno e Finclass
- Persistencia local em `SQLite`, com migracao automatica do estado salvo no navegador
- Cotacoes quase em tempo real para `Acoes` e `FIIs` via backend local

## Cotacoes em tempo real

O projeto usa um servidor local em `Node` para consultar a `brapi.dev` para a carteira e faz fallback do panorama de mercado para a `HG Brasil` quando necessario.

1. Copie o arquivo de exemplo:

```bash
cp .env.server.example .env.server
```

2. Edite `.env.server` e preencha `BRAPI_TOKEN` com seu token da brapi. Se quiser, tambem pode preencher `HG_BRASIL_KEY` para melhorar o fallback do bloco de mercado.

## Rodando localmente

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev
```

Frontend: `http://localhost:5173`
Backend e banco local: `http://localhost:3001/api/health`

Na primeira execucao do backend com o frontend aberto, o app faz bootstrap automatico das colecoes (`membros`, `ativos`, `transacoes`, `dividendos` e `carteiras de pesquisa`) para o arquivo SQLite em `data/personal-finances.sqlite`, reaproveitando o que ja estiver salvo no navegador.

## Proximos passos

- Adicionar relatorios derivados em SQLite (dividendos mensais, custo medio, P/L realizado por periodo)
- Integrar importacao de notas, CEI ou planilhas
- Adicionar cotacao para outras classes com fontes especificas

## Extra: padrao de numeros primos (2D e 3D)

Se quiser visualizar padroes de primos:

```bash
node scripts/prime-pattern.mjs 21 200
```

- Primeiro parametro: tamanho da espiral de Ulam (use numero impar).
- Segundo parametro: limite maximo para gerar pontos 3D em forma de helice.

A saida mostra:
- Mapa 2D com `●` para primos e `·` para nao primos.
- Lista CSV (`n,x,y,z`) para plotagem 3D em qualquer ferramenta.

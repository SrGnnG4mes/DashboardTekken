# dashboardtekken

Meu perfil de Tekken 8: forma recente, evolução do rating, aproveitamento contra cada personagem e histórico de partidas. Os dados vêm do [ewgf.gg](https://ewgf.gg).

## Perfis

Cada conta tem o próprio endereço: `?perfil=bushinfrv`, `?perfil=larper`. A primeira conta em `TEKKEN_IDS` é a que abre por padrão.

## Pentágono de status

Calculado a partir das partidas do filtro escolhido (Todas, Ranqueadas ou Sala), de 0 a 100:

| Eixo | Como é calculado |
|---|---|
| Vitórias | % de partidas ganhas |
| Rounds | % de rounds ganhos |
| Round decisivo | % de vitórias nas lutas que foram ao último round (3–2, 2–3) |
| Contra mais fortes | % de vitórias contra oponentes com Tekken Power maior |
| Matchups | % dos personagens enfrentados em que você tem 50% ou mais |

O pentágono do próprio ewgf não está disponível pela API no plano grátis, por isso este é calculado aqui.

## Como funciona

```
GitHub Action (a cada 6h) ──► API do ewgf (com token) ──► data/battles.json ──► site no GitHub Pages
```

A API do ewgf exige um token, que não pode ficar no código do site (qualquer um veria). Por isso quem chama a API é o GitHub Action, que guarda o token nos *Secrets*. O site só lê os JSON já prontos.

No plano grátis do ewgf a API devolve só as últimas 50 partidas, com 24h de atraso, e 100 requisições por dia. Como o Action junta as partidas novas com as antigas a cada execução, o histórico aqui cresce sem limite. Cada execução gasta 2 requisições por conta.

## Configuração

1. **Token do ewgf**: entre no ewgf.gg, vá em Configurações → aba Developer e gere um token.
2. No repositório, em **Settings → Secrets and variables → Actions**:
   - aba *Secrets*: crie `EWGF_TOKEN` com o token.
   - aba *Variables*: crie `TEKKEN_IDS` com seus Tekken IDs separados por vírgula, a conta principal primeiro. Ex.: `abc123def456,5n9hjG2j2E6f`
3. Em **Settings → Pages**: *Source* = "Deploy from a branch", branch `main`, pasta `/ (root)`.
4. Em **Actions → Atualizar partidas → Run workflow** para buscar os dados pela primeira vez.

O site fica em `https://<seu-usuario>.github.io/dashboardtekken/`.

## Rodar localmente

```bash
node scripts/sample.mjs          # gera dados de exemplo
python3 -m http.server 8000      # abre http://localhost:8000

# com dados reais:
EWGF_TOKEN=... TEKKEN_IDS=id1,id2 node scripts/fetch.mjs
```

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html`, `styles.css`, `app.js` | o site |
| `scripts/fetch.mjs` | busca no ewgf e acumula em `data/` |
| `scripts/tekken.mjs` | nomes de personagens/ranks e normalização dos dados |
| `scripts/sample.mjs` | dados de exemplo |
| `.github/workflows/update.yml` | agenda a coleta |
| `data/raw/` | respostas brutas da API (fora do git, só para depurar) |

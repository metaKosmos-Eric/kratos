# Kratos — Treino & Alimentação (PWA)

App pessoal pra acompanhar treino, cargas, peso corporal e alimentação.
100% offline: nada sai do aparelho. Sem build, sem servidor de backend, sem dependências.

## Telas
- **Hoje** — treino do dia + anel/barras de macros consumidos vs meta + atalhos.
- **Treino** — plano editável (Fase A/B), edição de exercícios e dias, e registro de cargas (peso×reps por série).
- **Comida** — busca na base brasileira embutida, quantidade com prévia de macros, log agrupado por refeição.
- **Evolução** — resumo da semana (proteína X/7, kcal média, Δ peso), gráfico de peso corporal e progressão de carga por exercício.
- **Perfil** — dados + metas (calculadas por Mifflin-St Jeor ou na mão), backup export/import (.json) e reset.

## Estrutura
```
fit-app/
├─ index.html            # shell + nav inferior
├─ manifest.webmanifest  # PWA instalável
├─ sw.js                 # service worker (cache offline do app)
├─ css/styles.css        # tema dark/lime
├─ icons/                # ícones gerados (192/512/maskable + svg)
└─ js/
   ├─ app.js             # roteador + todas as telas
   ├─ db.js              # IndexedDB (stores, seed, backup) + cálculo de metas
   ├─ data.js            # base de alimentos BR + plano de treino (seed)
   └─ charts.js          # gráficos SVG (linha/barra) sem libs
```

## Rodar localmente
Precisa ser servido por HTTP (service worker não roda em `file://`):
```bash
# da pasta metaKosmos:
python -m http.server 5500 --directory fit-app
# abre http://localhost:5500
```
No Claude Code: preview `fit-app` (já no `.claude/launch.json`).

## Instalar no celular
Para "instalar" como app na tela inicial, precisa de **HTTPS**. Opções:
- **Netlify Drop** — arrasta a pasta `fit-app` em https://app.netlify.com/drop (mais rápido).
- **GitHub Pages** — sobe a pasta num repo e ativa Pages.

Depois é só abrir no celular → menu → "Adicionar à tela inicial".

## Backup
Os dados ficam só neste navegador/aparelho. Em **Perfil → Exportar backup** gera um `.json`;
**Importar backup** restaura. Faça isso antes de trocar de aparelho ou limpar o navegador.

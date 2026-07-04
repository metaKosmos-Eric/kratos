# Kratos — Treino & Alimentação (PWA)

App pessoal pra acompanhar treino, cargas, peso corporal e alimentação.
100% offline: nada sai do aparelho. Sem build, sem servidor de backend, sem dependências.

Tema **"Cinzas e Sangue"** (God of War): carvão quente + cinzas, vermelho-sangue como
único accent em repouso, ouro apenas em filetes e celebrações (Ω, meandro grego, louro).

## Telas
- **Hoje** — batalha do dia (com estado "treino selado"), streak de semanas, anel/barras de macros com count-up e atalhos.
- **Treino** — plano editável (Fase I/II). Registro de cargas com prefill da última sessão, steppers ±2,5kg/±1 rep, check de série que dispara **timer de descanso**, rascunho automático (localStorage) e **detecção de recorde pessoal**.
- **Comida** — chips de alimentos recentes (re-add em 1 toque), busca na base brasileira embutida, adicionar-e-continuar, edição por toque, delete com desfazer. Meta de proteína batida = celebração "Tributo pago" (1x/dia).
- **Evolução** — resumo da semana, peso corporal, progressão de carga (ponto dourado = PR) e **crônica de batalhas** (histórico de sessões, expansível e deletável).
- **Perfil** — dados + metas (calculadas por Mifflin-St Jeor ou na mão), backup export/import (.json) e reset.

## Celebrações
- **Selo de guerra** — treino salvo: carimbo Ω dourado + brasas + vibração.
- **Glória** — novo recorde: louros se desenhando, count-up da carga, brasas, vibração épica.
- **Tributo pago** — meta de proteína do dia: filete dourado na barra + mini-brasas + toast Ω.

`prefers-reduced-motion` degrada tudo pra feedback sóbrio.

## Estrutura
```
fit-app/
├─ index.html            # shell + splash (Ω se desenhando) + nav inferior
├─ manifest.webmanifest  # PWA instalável
├─ sw.js                 # service worker (cache offline do app + fontes)
├─ css/styles.css        # tema "Cinzas e Sangue"
├─ fonts/                # Cinzel + Inter (woff2 self-hosted, latin)
├─ icons/                # Ω sangue/bronze (192/512/maskable + svg)
└─ js/
   ├─ app.js             # roteador + todas as telas
   ├─ celebrate.js       # celebrações, brasas, haptics, count-up
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

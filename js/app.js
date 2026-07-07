// =====================================================================
// app.js — controlador, roteador e todas as telas do Kratos.
// Tema "Cinzas e Sangue": o app em repouso é cinza; brasa = vitória.
// =====================================================================
import * as db from "./db.js";
import { calcGoals } from "./db.js";
import { MEAL_TYPES } from "./data.js";
import { lineChart, barChart } from "./charts.js";
import { OMEGA_SVG, haptic, sparks, celebrateSeal, celebrateGloria, celebrateTributo, celebrateAscension, celebrateBoss, countUp } from "./celebrate.js";
import { computeSaga, RANKS, ACHIEVEMENTS } from "./saga.js";
import { spartanSVG } from "./spartan.js";

// ----------------------------- estado --------------------------------
const S = {
  route: "hoje", profile: null, plan: null, foods: [],
  prevT: null, prevDate: null,   // continuidade do count-up do macro card
  justAdded: null,               // id da última refeição (brandIn)
};

const PHASE_LABEL = { A: "Fase I · Fundação — sem 1–4", B: "Fase II · Fúria — sem 5–8" };
const PHASE_BTN = { A: "Fase I · Fundação", B: "Fase II · Fúria" };
const REST_SECONDS = { A: 90, B: 60 };

async function loadState() {
  S.profile = await db.get("profile", "me");
  S.plan = await db.get("plan", "current");
  S.foods = (await db.getAll("foods")).sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

// ----------------------------- helpers -------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r1 = (n) => Math.round(n * 10) / 10;
const r0 = (n) => Math.round(n);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function localISO(d) { const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return t.toISOString().slice(0, 10); }
function todayStr() { return localISO(new Date()); }
function lastNDays(n) {
  const out = []; const base = new Date();
  for (let i = n - 1; i >= 0; i--) { const d = new Date(base); d.setDate(base.getDate() - i); out.push(localISO(d)); }
  return out;
}
function dowShort(iso) { return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][new Date(iso + "T12:00").getDay()]; }
function prettyDate(iso) { const d = new Date(iso + "T12:00"); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
// chave da semana (segunda-feira como início)
function weekKey(iso) {
  const d = new Date(iso + "T12:00");
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - day);
  return localISO(d);
}

function macrosFor(food, qty) {
  const factor = food.per === "unid" ? qty : qty / 100;
  return { kcal: food.kcal * factor, p: food.p * factor, c: food.c * factor, f: food.f * factor };
}
function emptyMacros() { return { kcal: 0, p: 0, c: 0, f: 0 }; }
function addMacros(a, b) { return { kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f }; }

function todaysDay() {
  const map = { 1: "seg", 2: "ter", 3: "qua", 4: "qui", 5: "sex" };
  const id = map[new Date().getDay()];
  if (!id) return null;
  return activePlan().days.find((d) => d.id === id) || null;
}
function activePlan() { return S.plan.plans[S.plan.phase]; }

// ----------------------------- toast ---------------------------------
// opts: { err, omega, ms, action: { label, fn } }
function toast(msg, opts = {}) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const t = document.createElement("div");
  t.className = "toast" + (opts.err ? " err" : "");
  t.innerHTML = `${opts.omega ? OMEGA_SVG : ""}<span>${esc(msg)}</span>` +
    (opts.action ? `<button class="toast-act">${esc(opts.action.label)}</button>` : "");
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  const ms = opts.ms || (opts.action ? 5000 : 2200);
  const kill = () => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); };
  const timer = setTimeout(kill, ms);
  if (opts.action) $(".toast-act", t).addEventListener("click", () => {
    clearTimeout(timer); kill(); opts.action.fn();
  });
}

// ----------------------------- modal ---------------------------------
// Pilha de modais integrada ao histórico: botão "voltar" do Android
// fecha o modal do topo em vez de fechar o app.
const modalStack = [];
window.addEventListener("popstate", () => {
  const top = modalStack[modalStack.length - 1];
  if (top) top.doClose();
});

function modal(title, bodyHTML, onMount, opts = {}) {
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="x" aria-label="Fechar">✕</button></div>
    <div class="modal-body">${bodyHTML}</div>
  </div>`;
  const entry = { closing: false, requested: false };
  entry.doClose = () => {
    if (entry.closing) return; entry.closing = true;
    const i = modalStack.indexOf(entry); if (i >= 0) modalStack.splice(i, 1);
    back.classList.add("closing");
    back.addEventListener("animationend", () => back.remove(), { once: true });
    setTimeout(() => back.remove(), 420); // rede de segurança
    opts.onClose && opts.onClose();
  };
  const requestClose = () => {
    if (entry.requested || entry.closing) return;
    entry.requested = true;
    history.back(); // popstate -> doClose
  };
  back.addEventListener("click", (e) => { if (e.target === back) requestClose(); });
  $(".x", back).addEventListener("click", requestClose);
  document.body.appendChild(back);
  history.pushState({ modal: true }, "");
  modalStack.push(entry);
  onMount && onMount(back, requestClose);
  return { back, close: requestClose };
}

// =====================================================================
// RENDER PRINCIPAL
// =====================================================================
const NAV = [
  { id: "hoje", label: "Hoje", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { id: "saga", label: "Saga", icon: "M12 2l7 3v6c0 4.5-3 8-7 11-4-3-7-6.5-7-11V5z" },
  { id: "treino", label: "Treino", icon: "M6.5 6.5l11 11M3 7l4-4 3 3-4 4zM21 17l-4 4-3-3 4-4z" },
  { id: "comida", label: "Comida", icon: "M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3c-1.5 1-2 3-2 6s.5 4 2 4v8" },
  { id: "evolucao", label: "Evolução", icon: "M3 17l6-6 4 4 7-7M14 8h7v7" },
  { id: "perfil", label: "Perfil", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];

function render() {
  const app = $("#app");
  const view = VIEWS[S.route]();
  app.innerHTML = view.html;
  // re-dispara a entrada de corte seco
  app.style.animation = "none"; void app.offsetWidth; app.style.animation = "";
  view.mount && view.mount(app);
  $("#nav").innerHTML = NAV.map((n) => `
    <button class="nav-btn ${S.route === n.id ? "active" : ""}" data-route="${n.id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="${n.icon}"/></svg>
      <span>${n.label}</span>
    </button>`).join("");
  $("#nav").querySelectorAll("[data-route]").forEach((b) =>
    b.addEventListener("click", () => {
      if (S.route !== b.dataset.route) haptic("tick");
      S.route = b.dataset.route; window.scrollTo(0, 0); render();
    }));
}

function go(route) { S.route = route; window.scrollTo(0, 0); render(); }

// =====================================================================
// MACRO CARD (Hoje + Comida) — com count-up e ring animado
// =====================================================================
async function dayTotals(iso) {
  const log = await db.getByIndex("foodlog", "date", iso);
  return log.reduce((acc, e) => addMacros(acc, e), emptyMacros());
}

// =====================================================================
// SAGA (RPG) — cálculo + detecção de level-up/conquistas
// =====================================================================
async function currentSaga() {
  const [sessions, foodlog, bodylog] = await Promise.all([
    db.getAll("sessions"), db.getAll("foodlog"), db.getAll("bodylog"),
  ]);
  return computeSaga(sessions, foodlog, bodylog, S.profile);
}

function sagaSeenFrom(saga) {
  return {
    id: "state", level: saga.level, rankIndex: saga.rankIndex,
    bossesDefeated: saga.stats.bossesDefeated,
    achievements: saga.achievements.filter((a) => a.unlocked).map((a) => a.id),
  };
}

// silent=true (boot): só registra o estado, sem celebrar retroativo.
// senão: celebra ascensão e conquistas novas desde a última vez.
async function syncSaga({ silent = false, ascensionDelay = 300 } = {}) {
  const saga = await currentSaga();
  const seen = await db.get("saga", "state");
  if (silent || !seen) { await db.put("saga", sagaSeenFrom(saga)); return saga; }

  const prevAch = new Set(seen.achievements || []);
  const newAch = saga.achievements.filter((a) => a.unlocked && !prevAch.has(a.id));
  const leveledUp = saga.level > (seen.level || 1);
  const rankUp = saga.rankIndex > (seen.rankIndex || 0);
  const bossKilled = saga.stats.bossesDefeated > (seen.bossesDefeated || 0);
  await db.put("saga", sagaSeenFrom(saga));

  let after = ascensionDelay;
  if (leveledUp || rankUp) {
    setTimeout(() => celebrateAscension({
      rankName: saga.rank.name, level: saga.level,
      avatarSVG: spartanSVG(saga.rank.tier, { glow: true }), isRankUp: rankUp,
    }), ascensionDelay);
    after = ascensionDelay + (rankUp ? 3000 : 2200);
  }
  if (bossKilled) {
    setTimeout(() => celebrateBoss(saga.boss.name), after);
    after += 2600;
  }
  newAch.forEach((a, i) => setTimeout(() =>
    toast(`Conquista — ${a.name}`, { omega: true, ms: 2600 }), after + i * 900));
  return saga;
}

function macroCardHTML(g) {
  const bar = (key, label) => `<div class="mb ${key}">
    <div class="mb-top"><span>${label}</span><span><b data-val="${key}">0</b><i>/${g[key === "prot" ? "p" : key === "carb" ? "c" : "f"]}g</i></span></div>
    <div class="mb-track"><div class="mb-fill" data-fill="${key}"></div></div>
  </div>`;
  return `<div class="card macro-card" data-macrocard>
    <div class="macro-head">
      <div><div class="macro-kcal"><span data-kcal>0</span><i>/ ${g.kcal} kcal</i></div>
        <div class="macro-sub" data-macrosub>consumido hoje</div></div>
      <div class="ring" data-ring><span data-ringtxt>0%</span></div>
    </div>
    ${bar("prot", "Proteína")}${bar("carb", "Carbo")}${bar("fat", "Gordura")}
  </div>`;
}

function animateMacroCard(root, t, g) {
  const card = $("[data-macrocard]", root);
  if (!card) return;
  const today = todayStr();
  if (S.prevDate !== today) { S.prevT = null; S.prevDate = today; }
  const from = S.prevT || emptyMacros();

  // token por card: cancela loops rAF antigos se o card re-animar (ex: dois
  // adds rápidos), pra um loop obsoleto não sobrescrever o Ω de 100% depois.
  const animId = (card.__anim = (card.__anim || 0) + 1);

  countUp($("[data-kcal]", card), from.kcal, t.kcal, 700, r0);

  // ring via rAF (sem @property — funciona em qualquer WebView)
  const ring = $("[data-ring]", card);
  const txt = $("[data-ringtxt]", card);
  const p0 = g.kcal ? Math.min(100, (from.kcal / g.kcal) * 100) : 0;
  const p1 = g.kcal ? Math.min(100, (t.kcal / g.kcal) * 100) : 0;
  const showFull = () => { txt.innerHTML = `<span class="ring-omega">${OMEGA_SVG}</span>`; ring.classList.add("full-glow"); };
  if (reducedMotion()) {
    ring.style.setProperty("--p", p1);
    if (p1 >= 100) showFull(); else txt.textContent = r0(p1) + "%";
  } else {
    const t0 = performance.now(); const MS = 900;
    const step = (now) => {
      if (card.__anim !== animId) return; // superado por uma animação mais nova
      const k = Math.min(1, (now - t0) / MS);
      const v = p0 + (p1 - p0) * (1 - Math.pow(1 - k, 3));
      ring.style.setProperty("--p", v);
      if (p1 < 100) txt.textContent = r0(v) + "%";
      if (k < 1) requestAnimationFrame(step);
    };
    if (p1 >= 100) showFull();
    requestAnimationFrame(step);
  }

  // barras (escalonadas) + forgeFlash em >=100%
  const bars = [["prot", t.p, g.p], ["carb", t.c, g.c], ["fat", t.f, g.f]];
  const fillColor = {
    prot: "linear-gradient(90deg,#5E100B,#B32017)",
    carb: "var(--ash)",
    fat: "linear-gradient(90deg,#5E4E33,#8A7248)",
  };
  bars.forEach(([key, val, goal], i) => {
    const el = $(`[data-fill="${key}"]`, card);
    const valEl = $(`[data-val="${key}"]`, card);
    const pct = goal ? Math.min(100, (val / goal) * 100) : 0;
    el.style.background = fillColor[key];
    el.style.transitionDelay = (i * 60) + "ms";
    countUp(valEl, key === "prot" ? from.p : key === "carb" ? from.c : from.f, val, 700, r0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.width = pct + "%";
      if (pct >= 100) el.classList.add("done");
    }));
  });

  // subtítulo acionável: o que falta
  const subEl = $("[data-macrosub]", card);
  if (t.p >= g.p && t.kcal >= g.kcal) subEl.textContent = "tributos do dia pagos";
  else if (t.p < g.p) subEl.textContent = `faltam ${r0(g.p - t.p)}g de proteína`;
  else subEl.textContent = `faltam ${r0(g.kcal - t.kcal)} kcal`;

  S.prevT = t;
}

// =====================================================================
// VIEW: HOJE
// =====================================================================
const VIEWS = {};

VIEWS.hoje = () => {
  const day = todaysDay();
  const g = S.profile;
  const html = `
    <header class="topbar"><div><h1>${esc(g.name)}</h1>
      <p class="sub">${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
      <div data-streak></div></div>
      <span class="phase-pill">${S.plan.phase === "A" ? "Fase I" : "Fase II"}</span>
    </header>
    <section class="pad">
      <button class="saga-strip" data-act="goSaga" data-sagastrip></button>
      ${macroCardHTML(g)}
      <div class="section-label">A batalha de hoje</div>
      <div data-battle>${day ? `
        <div class="card day-today">
          <div class="dt-head">
            <span class="day-badge today">${esc(day.dow)}</span>
            <div><div class="day-title">${esc(day.name)}</div><div class="day-sub">${esc(day.sub)}</div></div>
          </div>
          <button class="btn-primary full" data-act="startToday">Entrar em batalha</button>
        </div>` : `
        <div class="rest-card"><strong>Descanso.</strong> Até Esparta descansa — caminhada leve, alongamento, sono.</div>`}
      </div>
      <div class="section-label">Arsenal</div>
      <div class="quick-grid">
        <button class="card quick" data-act="addFood"><b>+ Refeição</b><span>registrar tributo</span></button>
        <button class="card quick" data-act="addBody"><b>+ Peso corporal</b><span>${g.weightKg} kg atual</span></button>
      </div>
    </section>`;

  return {
    html,
    async mount(root) {
      const t = await dayTotals(todayStr());
      animateMacroCard(root, t, g);
      // streak + estado "selado"
      const sessions = await db.getAll("sessions");
      renderStreak($("[data-streak]", root), sessions);
      const todays = sessions.filter((s) => s.date === todayStr());
      if (day && todays.length) {
        const vol = todays.reduce((a, s) => a + (s.volume || 0), 0);
        const prCount = todays.reduce((a, s) => a + (s.prExercises?.length || 0), 0);
        $("[data-battle]", root).innerHTML = `
          <div class="card day-today sealed">
            <div class="sealed-row">${OMEGA_SVG}<span>Treino selado</span></div>
            <div class="sealed-sum">${esc(day.name)} · ${r0(vol)} kg de volume${prCount ? ` · ${prCount} recorde${prCount > 1 ? "s" : ""}` : ""}</div>
            <button class="btn-ghost full" data-act="startToday">Registrar novamente</button>
          </div>`;
      }
      root.querySelector('[data-act="startToday"]')?.addEventListener("click", () => day && startSession(day));
      root.querySelector('[data-act="addFood"]').addEventListener("click", () => addFoodFlow());
      root.querySelector('[data-act="addBody"]').addEventListener("click", () => addBodyFlow());

      // strip da Saga (avatar + nível + XP + missões), atalho pra aba Saga
      const strip = $("[data-sagastrip]", root);
      const saga = await currentSaga();
      const xpPct = saga.xpForLevel ? Math.min(100, (saga.xpIntoLevel / saga.xpForLevel) * 100) : 100;
      const doneM = saga.missions.filter((m) => m.done).length;
      strip.innerHTML = `
        <div class="strip-av tier${saga.rank.tier}">${spartanSVG(saga.rank.tier, { glow: true })}</div>
        <div class="strip-mid">
          <div class="strip-top"><b>${esc(saga.rank.name)}</b><span>Nv ${saga.level}</span></div>
          <div class="strip-xp"><div class="strip-xp-fill" style="width:${xpPct}%"></div></div>
          <div class="strip-sub">Missões ${doneM}/${saga.missions.length}${saga.boss.defeated ? " · chefe abatido ☠" : ` · chefe ${r0(saga.boss.dmg)}/${saga.boss.hp}`}</div>
        </div>
        <svg class="strip-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>`;
      strip.addEventListener("click", () => { haptic("tick"); go("saga"); });
    },
  };
};

// streak: semanas consecutivas com >= 3 treinos (semana atual não quebra)
function renderStreak(el, sessions) {
  if (!el) return;
  const perWeek = {};
  for (const s of sessions) {
    const wk = weekKey(s.date);
    (perWeek[wk] ||= new Set()).add(s.date);
  }
  const thisWk = weekKey(todayStr());
  let streak = 0;
  let cursor = thisWk;
  const back = (wk) => { const d = new Date(wk + "T12:00"); d.setDate(d.getDate() - 7); return localISO(d); };
  if ((perWeek[thisWk]?.size || 0) >= 3) { streak++; cursor = back(thisWk); }
  else cursor = back(thisWk); // semana em curso não conta nem quebra
  while ((perWeek[cursor]?.size || 0) >= 3) { streak++; cursor = back(cursor); }
  const thisCount = perWeek[thisWk]?.size || 0;
  if (streak >= 1) el.innerHTML = `<span class="streak-pill">${OMEGA_SVG} Fúria · ${streak} semana${streak > 1 ? "s" : ""}</span>`;
  else if (thisCount > 0) el.innerHTML = `<span class="streak-pill">${OMEGA_SVG} ${thisCount} batalha${thisCount > 1 ? "s" : ""} esta semana</span>`;
  else el.innerHTML = "";
}

// =====================================================================
// VIEW: SAGA (RPG)
// =====================================================================
VIEWS.saga = () => {
  const html = `
    <header class="topbar"><div><h1>Saga</h1><p class="sub">A ascensão de ${esc(S.profile.name)}</p></div></header>
    <section class="pad" id="sagaArea"><div class="loading">…</div></section>`;
  return { html, async mount() { await renderSaga(); } };
};

const ATTR_META = [
  { key: "forca", label: "Força", hint: "volume e recordes de carga" },
  { key: "furia", label: "Fúria", hint: "constância e streak de treinos" },
  { key: "vigor", label: "Vigor", hint: "disciplina na dieta (30 dias)" },
  { key: "resiliencia", label: "Resiliência", hint: "tempo e dias de jornada" },
];

async function renderSaga() {
  const root = $("#sagaArea");
  if (!root) return;
  const saga = await currentSaga();
  const xpPct = saga.xpForLevel ? Math.min(100, (saga.xpIntoLevel / saga.xpForLevel) * 100) : 100;
  const poderPct = Math.round((saga.poder / 400) * 100);
  const nextRank = saga.nextRank;
  const toNext = nextRank ? nextRank.minLevel - saga.level : 0;

  const attrBar = (m) => {
    const v = saga.attrs[m.key];
    return `<div class="attr">
      <div class="attr-top"><span>${m.label}</span><b>${v}</b></div>
      <div class="attr-track"><div class="attr-fill attr-${m.key}" style="width:0" data-attr="${v}"></div></div>
      <div class="attr-hint">${m.hint}</div>
    </div>`;
  };

  const trophies = saga.achievements.map((a) => `
    <div class="trophy ${a.unlocked ? "on" : "off"}" title="${esc(a.desc)}">
      <div class="trophy-ic">${a.unlocked ? OMEGA_SVG : "🔒"}</div>
      <div class="trophy-name">${esc(a.name)}</div>
      <div class="trophy-desc">${esc(a.desc)}</div>
    </div>`).join("");
  const unlocked = saga.achievements.filter((a) => a.unlocked).length;

  root.innerHTML = `
    <div class="card hero-card">
      <div class="hero-avatar tier${saga.rank.tier}">${spartanSVG(saga.rank.tier, { glow: true })}</div>
      <div class="hero-rank">${esc(saga.rank.name)}</div>
      <div class="hero-lvl">Nível <b>${saga.level}</b></div>
      <div class="xp-track"><div class="xp-fill" style="width:0" data-xp="${xpPct}"></div></div>
      <div class="xp-label">${saga.xpIntoLevel} / ${saga.xpForLevel} XP${nextRank ? ` · faltam ${toNext} nível${toNext > 1 ? "s" : ""} pra <b>${esc(nextRank.name)}</b>` : " · patente máxima"}</div>
    </div>

    <div class="section-label">Chefe da semana</div>
    <div class="card boss-card ${saga.boss.defeated ? "slain" : ""}">
      <div class="boss-head">
        <span class="boss-name">${esc(saga.boss.name)}</span>
        <span class="boss-hp">${saga.boss.defeated ? "ABATIDO ☠" : `${r0(saga.boss.remaining)} HP`}</span>
      </div>
      <div class="boss-track"><div class="boss-fill" style="width:0" data-boss="${Math.round((saga.boss.dmg / saga.boss.hp) * 100)}"></div></div>
      <div class="boss-hint">${saga.boss.defeated ? "Fera derrotada. A próxima surge na semana que vem." : "Treine, bata metas e quebre recordes esta semana pra abatê-lo."}</div>
    </div>

    <div class="section-label">Missões de hoje · ${saga.missions.filter((m) => m.done).length}/${saga.missions.length}</div>
    <div class="card mission-card">
      ${saga.missions.map((m) => `<div class="mission ${m.done ? "done" : ""}">
        <span class="mission-check">${m.done ? OMEGA_SVG : ""}</span>
        <span class="mission-label">${esc(m.label)}</span>
        <span class="mission-xp">+${m.xp}</span>
      </div>`).join("")}
    </div>

    <div class="card poder-card">
      <div><div class="poder-num" data-poder="${saga.poder}">0</div><div class="poder-lab">Poder de Guerra · ${poderPct}%</div></div>
      <div class="poder-omega">${OMEGA_SVG}</div>
    </div>

    <div class="section-label">Atributos</div>
    <div class="card">${ATTR_META.map(attrBar).join("")}</div>

    <div class="section-label">Troféus · ${unlocked}/${saga.achievements.length}</div>
    <div class="trophy-grid">${trophies}</div>

    <div class="section-label">Feitos de guerra</div>
    <div class="card stat-grid">
      <div><b>${saga.stats.sessions}</b><span>treinos</span></div>
      <div><b>${r0(saga.stats.totalVolume)}</b><span>kg de volume</span></div>
      <div><b>${saga.stats.totalPRs}</b><span>recordes</span></div>
      <div><b>${saga.stats.proteinDays}</b><span>dias na meta</span></div>
    </div>`;

  // anima barras e o número de poder
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll("[data-attr]").forEach((el) => { el.style.width = el.dataset.attr + "%"; });
    const xp = root.querySelector("[data-xp]"); if (xp) xp.style.width = xp.dataset.xp + "%";
    const boss = root.querySelector("[data-boss]"); if (boss) boss.style.width = boss.dataset.boss + "%";
  }));
  countUp(root.querySelector("[data-poder]"), 0, saga.poder, 800, r0);
}

// =====================================================================
// VIEW: TREINO
// =====================================================================
VIEWS.treino = () => {
  const pl = activePlan();
  const html = `
    <header class="topbar"><div><h1>Treino</h1><p class="sub">${esc(PHASE_LABEL[S.plan.phase])}</p></div></header>
    <section class="pad">
      <div class="phase-toggle">
        <button class="phase-btn ${S.plan.phase === "A" ? "active" : ""}" data-phase="A">${PHASE_BTN.A}</button>
        <button class="phase-btn ${S.plan.phase === "B" ? "active" : ""}" data-phase="B">${PHASE_BTN.B}</button>
      </div>
      <div class="tip">${esc(pl.tip)}</div>
      ${pl.days.map((d) => dayCardHTML(d)).join("")}
      <button class="btn-ghost full" data-act="addDay">+ Adicionar dia de treino</button>
    </section>`;

  return {
    html,
    mount(root) {
      root.querySelectorAll("[data-phase]").forEach((b) => b.addEventListener("click", async () => {
        S.plan.phase = b.dataset.phase; await db.put("plan", S.plan); haptic("tick"); render();
      }));
      root.querySelectorAll(".day-card .day-header").forEach((hd) =>
        hd.addEventListener("click", () => hd.closest(".day-card").classList.toggle("open")));
      root.querySelectorAll('[data-act="start"]').forEach((b) =>
        b.addEventListener("click", () => startSession(activePlan().days.find((d) => d.id === b.dataset.day))));
      root.querySelectorAll('[data-act="editDay"]').forEach((b) =>
        b.addEventListener("click", () => editDay(activePlan().days.find((d) => d.id === b.dataset.day))));
      root.querySelector('[data-act="addDay"]').addEventListener("click", () => addDay());
    },
  };
};

function dayCardHTML(d) {
  const isToday = todaysDay()?.id === d.id;
  const rows = d.exercises.map((x) => x.type === "cardio"
    ? `<tr class="cardio-row"><td>${esc(x.name)} <span class="cardio-tag">cardio</span></td><td>${x.duration} min</td></tr>`
    : `<tr><td>${esc(x.name)}</td><td>${x.sets} × ${esc(x.reps)}</td></tr>`).join("");
  return `<div class="day-card">
    <div class="day-header">
      <div class="day-left">
        <span class="day-badge${isToday ? " today" : ""}">${esc(d.dow)}</span>
        <div><div class="day-title">${esc(d.name)}</div><div class="day-sub">${esc(d.sub)}</div></div>
      </div>
      <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="day-body"><div class="day-in">
      <table class="ex-table">${rows}</table>
      <div class="day-actions">
        <button class="btn-primary" data-act="start" data-day="${d.id}">Registrar treino</button>
        <button class="btn-ghost" data-act="editDay" data-day="${d.id}">Editar</button>
      </div>
    </div></div>
  </div>`;
}

// ---- editar dia ----
// Trabalha numa CÓPIA dos exercícios; só grava no plano vivo ao salvar.
// Fechar sem salvar descarta tudo (não corrompe S.plan).
function editDay(day) {
  const work = structuredClone(day.exercises);
  const renderRows = () => work.map((x, i) => `
    <div class="edit-row" data-i="${i}">
      <input class="inp name" value="${esc(x.name)}" placeholder="Exercício"/>
      ${x.type === "cardio"
        ? `<input class="inp small" value="${x.duration}" inputmode="numeric"/> <span class="u">min</span>`
        : `<input class="inp tiny sets" value="${x.sets}" inputmode="numeric"/>×<input class="inp small reps" value="${esc(x.reps)}"/>`}
      <button class="del" data-del="${i}">✕</button>
    </div>`).join("");
  const body = `
    <div id="rows">${renderRows()}</div>
    <div class="row-add">
      <button class="btn-ghost" data-add="strength">+ Exercício</button>
      <button class="btn-ghost" data-add="cardio">+ Cardio</button>
    </div>
    <button class="btn-primary full" data-save>Salvar dia</button>`;
  modal(`Editar — ${day.name}`, body, (back, close) => {
    const collect = () => {
      back.querySelectorAll(".edit-row").forEach((row) => {
        const i = +row.dataset.i; const ex = work[i];
        ex.name = $(".name", row).value.trim();
        if (ex.type === "cardio") ex.duration = +$(".small", row).value || 0;
        else { ex.sets = +$(".sets", row).value || 0; ex.reps = $(".reps", row).value.trim(); }
      });
    };
    const rerender = () => { $("#rows", back).innerHTML = renderRows(); bind(); };
    const bind = () => {
      back.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        collect(); work.splice(+b.dataset.del, 1); rerender();
      }));
    };
    bind();
    back.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
      collect();
      work.push(b.dataset.add === "cardio"
        ? { name: "Cardio", type: "cardio", duration: 15 }
        : { name: "Novo exercício", sets: 3, reps: "10–12", type: "strength" });
      rerender();
    }));
    $("[data-save]", back).addEventListener("click", async () => {
      collect(); day.exercises = work; await db.put("plan", S.plan); close(); render(); toast("Dia atualizado");
    });
  });
}

function addDay() {
  const body = `
    <input id="nName" class="inp full" placeholder="Nome (ex: Peito + Tríceps)"/>
    <input id="nDow" class="inp full" placeholder="Sigla (ex: SEG)" maxlength="4"/>
    <button class="btn-primary full" data-save>Criar dia</button>`;
  modal("Novo dia de treino", body, (back, close) => {
    $("[data-save]", back).addEventListener("click", async () => {
      const name = $("#nName", back).value.trim(); if (!name) return toast("Dê um nome", { err: true });
      activePlan().days.push({
        id: db.uid(), dow: ($("#nDow", back).value.trim() || "—").toUpperCase(),
        color: "gray", name, sub: "", exercises: [],
      });
      await db.put("plan", S.plan); close(); render();
    });
  });
}

// =====================================================================
// REGISTRAR TREINO — prefill, steppers, timer de descanso, rascunho, PR
// =====================================================================

// histórico: últimas séries e melhor carga por exercício (qualquer dia)
async function historyMaps() {
  const all = (await db.getAll("sessions")).sort((a, b) => b.date.localeCompare(a.date));
  const lastSets = {}, best = {};
  for (const s of all) {
    for (const e of s.entries) {
      if (!(e.name in lastSets) && e.sets.length) lastSets[e.name] = e.sets;
      for (const st of e.sets) if (st.weight > 0) best[e.name] = Math.max(best[e.name] || 0, st.weight);
    }
  }
  return { lastSets, best };
}

// chave inclui a FASE (dias das duas fases compartilham id 'seg'..'sex')
const draftKey = (day) => `kratos-draft:${todayStr()}:${S.plan.phase}:${day.id}`;

async function startSession(day) {
  const { lastSets, best } = await historyMaps();
  const strength = day.exercises.filter((x) => x.type !== "cardio");
  if (!strength.length) return toast("Esse dia não tem exercícios de força", { err: true });

  const names = strength.map((x) => x.name);
  // rascunho salvo? restaura valores e séries extras.
  // Só aceita se a lista de exercícios bater (fase/edição do dia invalidam o índice).
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(draftKey(day)) || "null"); } catch { draft = null; }
  if (draft && (!Array.isArray(draft.names) || draft.names.length !== names.length
      || draft.names.some((n, i) => n !== names[i]))) {
    localStorage.removeItem(draftKey(day)); draft = null;
  }

  const extraSets = draft?.extra || {}; // xi -> nº total de séries
  const setRow = (xi, si, w, r, done) => `
    <div class="set-in${done ? " done" : ""}" data-row="${xi}_${si}">
      <button class="set-check" data-check="${xi}_${si}" title="Série feita">${si + 1}</button>
      <div class="stepgrp">
        <button class="step" data-stepw="${xi}_${si}" data-d="-2.5">−</button>
        <input class="inp" data-x="${xi}" data-s="${si}" data-k="w" inputmode="decimal" placeholder="kg" value="${w ?? ""}"/>
        <button class="step" data-stepw="${xi}_${si}" data-d="2.5">+</button>
      </div>
      <div class="stepgrp">
        <button class="step" data-stepr="${xi}_${si}" data-d="-1">−</button>
        <input class="inp" data-x="${xi}" data-s="${si}" data-k="r" inputmode="numeric" placeholder="reps" value="${r ?? ""}"/>
        <button class="step" data-stepr="${xi}_${si}" data-d="1">+</button>
      </div>
    </div>`;

  const exBlock = (x, xi) => {
    const prev = lastSets[x.name] || [];
    const nSets = extraSets[xi] || x.sets || 1;
    const bestW = best[x.name];
    const rows = Array.from({ length: nSets }, (_, si) => {
      const d = draft?.v?.[`${xi}_${si}`];
      const pv = prev[si] || prev[prev.length - 1];
      const w = d ? d.w : (pv?.weight || "");
      const r = d ? d.r : (pv?.reps || "");
      return setRow(xi, si, w, r, draft?.done?.includes(`${xi}_${si}`));
    }).join("");
    return `<div class="log-ex" data-ex="${xi}">
      <div class="log-ex-head"><b>${esc(x.name)}</b><span class="muted">${x.sets}×${esc(x.reps)}${bestW ? ` · recorde ${r1(bestW)}kg` : ""}</span></div>
      <div class="log-sets" data-sets="${xi}">${rows}</div>
      <button class="btn-ghost add-set" data-addset="${xi}">+ série</button>
    </div>`;
  };

  const body = `
    <div class="rest-chip" data-rest></div>
    <div>${strength.map(exBlock).join("")}
      <textarea id="snote" class="inp full" placeholder="Notas (opcional)" style="margin-top:12px">${esc(draft?.note || "")}</textarea>
      <button class="btn-primary full" data-save>Selar o treino</button>
    </div>`;

  let restTimer = null;
  const stopRest = () => { if (restTimer) { clearInterval(restTimer); restTimer = null; } };

  modal(`${day.dow} · ${day.name}`, body, (back, close) => {
    const restEl = $("[data-rest]", back);
    const startRest = () => {
      stopRest();
      let sec = REST_SECONDS[S.plan.phase] || 90;
      restEl.classList.add("on"); restEl.classList.remove("zero");
      const draw = () => {
        const m = Math.floor(sec / 60), s = String(sec % 60).padStart(2, "0");
        restEl.textContent = `Descanso · ${m}:${s}`;
      };
      draw();
      restTimer = setInterval(() => {
        sec--;
        if (sec <= 0) {
          stopRest(); restEl.classList.add("zero"); restEl.textContent = "À luta";
          haptic("rest");
          setTimeout(() => restEl.classList.remove("on"), 2500);
        } else draw();
      }, 1000);
    };
    restEl.addEventListener("click", () => { stopRest(); restEl.classList.remove("on"); });

    // rascunho: salva a cada mudança (debounce leve)
    let saveT = null;
    const saveDraft = () => {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        const v = {};
        back.querySelectorAll('[data-k="w"]').forEach((inp) => {
          const key = `${inp.dataset.x}_${inp.dataset.s}`;
          const r = back.querySelector(`[data-x="${inp.dataset.x}"][data-s="${inp.dataset.s}"][data-k="r"]`);
          v[key] = { w: inp.value, r: r ? r.value : "" };
        });
        const done = [...back.querySelectorAll(".set-in.done")].map((el) => el.dataset.row);
        const extra = {};
        back.querySelectorAll("[data-sets]").forEach((c) => { extra[c.dataset.sets] = c.children.length; });
        localStorage.setItem(draftKey(day), JSON.stringify({ v, done, extra, names, note: $("#snote", back).value }));
      }, 300);
    };
    back.addEventListener("input", saveDraft);

    // delegação: steppers, check de série, + série
    back.addEventListener("click", (e) => {
      const stepW = e.target.closest("[data-stepw]");
      const stepR = e.target.closest("[data-stepr]");
      if (stepW || stepR) {
        const el = stepW || stepR;
        const [xi, si] = el.dataset[stepW ? "stepw" : "stepr"].split("_");
        const inp = back.querySelector(`[data-x="${xi}"][data-s="${si}"][data-k="${stepW ? "w" : "r"}"]`);
        const d = parseFloat(el.dataset.d);
        const cur = parseFloat(inp.value) || 0;
        const next = Math.max(0, cur + d);
        inp.value = stepW ? (Math.round(next * 10) / 10) : Math.round(next);
        haptic("tick"); saveDraft();
        return;
      }
      const check = e.target.closest("[data-check]");
      if (check) {
        const row = check.closest(".set-in");
        const on = row.classList.toggle("done");
        if (on) { haptic("tick"); startRest(); }
        saveDraft();
        return;
      }
      const addSet = e.target.closest("[data-addset]");
      if (addSet) {
        const xi = addSet.dataset.addset;
        const cont = back.querySelector(`[data-sets="${xi}"]`);
        const si = cont.children.length;
        const lastW = cont.querySelector(`[data-s="${si - 1}"][data-k="w"]`)?.value || "";
        const lastR = cont.querySelector(`[data-s="${si - 1}"][data-k="r"]`)?.value || "";
        cont.insertAdjacentHTML("beforeend", setRow(+xi, si, lastW, lastR, false));
        haptic("tick"); saveDraft();
      }
    });

    // salvar (guard contra double-tap: não grava duas sessões nem dispara 2 celebrações)
    let saving = false;
    $("[data-save]", back).addEventListener("click", async () => {
      if (saving) return; saving = true;
      const entries = strength.map((x, xi) => {
        const setsArr = [];
        back.querySelectorAll(`[data-x="${xi}"][data-k="w"]`).forEach((wEl) => {
          const si = wEl.dataset.s;
          const w = parseFloat(wEl.value);
          const reps = parseInt(back.querySelector(`[data-x="${xi}"][data-s="${si}"][data-k="r"]`).value);
          if (!isNaN(w) || !isNaN(reps)) setsArr.push({ weight: isNaN(w) ? 0 : w, reps: isNaN(reps) ? 0 : reps });
        });
        return { name: x.name, sets: setsArr };
      }).filter((e) => e.sets.length);
      if (!entries.length) { saving = false; return toast("Preencha ao menos uma série", { err: true }); }

      // detecção de PR contra TODO o histórico (recalcula na hora)
      const { best: bestNow } = await historyMaps();
      const prs = [];
      for (const e of entries) {
        const w = e.sets.reduce((m, st) => Math.max(m, st.weight || 0), 0);
        if (w > 0 && bestNow[e.name] !== undefined && w > bestNow[e.name]) {
          prs.push({ name: e.name, prev: bestNow[e.name], now: w });
        }
      }
      const volume = entries.reduce((a, e) => a + e.sets.reduce((v, st) => v + (st.weight || 0) * (st.reps || 0), 0), 0);

      await db.put("sessions", {
        id: db.uid(), date: todayStr(), phase: S.plan.phase,
        dayId: day.id, dayName: day.name, entries,
        note: $("#snote", back).value.trim(),
        volume, pr: prs.length > 0, prExercises: prs.map((p) => p.name),
      });
      localStorage.removeItem(draftKey(day));
      stopRest();
      close();
      setTimeout(() => {
        if (prs.length) celebrateGloria(prs); else celebrateSeal();
        toast(prs.length ? "Recorde inscrito na crônica" : "Treino selado", { omega: true });
      }, 240);
      render();
      // ascensão entra DEPOIS da celebração do treino (gloria ~2.2s / selo ~1.4s)
      syncSaga({ ascensionDelay: 240 + (prs.length ? 2500 : 1700) });
    });
  }, { onClose: stopRest });

  if (draft) toast("Rascunho restaurado");
}

// =====================================================================
// VIEW: COMIDA
// =====================================================================
VIEWS.comida = () => {
  const html = `
    <header class="topbar"><div><h1>Comida</h1><p class="sub">Tributos de hoje</p></div>
      <button class="btn-primary sm" data-act="add" style="margin-top:2px">+ Adicionar</button></header>
    <section class="pad" id="foodArea"><div class="loading">…</div></section>`;
  return {
    html,
    async mount(root) {
      await renderFoodArea(root);
      root.querySelector('[data-act="add"]').addEventListener("click", () => addFoodFlow());
    },
  };
};

async function renderFoodArea(root) {
  const area = $("#foodArea", root);
  if (!area) return;
  const iso = todayStr();
  const log = await db.getByIndex("foodlog", "date", iso);
  const g = S.profile;
  const total = log.reduce((a, e) => addMacros(a, e), emptyMacros());
  const byMeal = {};
  for (const e of log) (byMeal[e.meal] ||= []).push(e);

  const groups = MEAL_TYPES.filter((m) => byMeal[m.id]?.length).map((m) => {
    const items = byMeal[m.id];
    const mt = items.reduce((a, e) => addMacros(a, e), emptyMacros());
    return `<div class="section-label">${m.label} · ${r0(mt.p)}g prot · ${r0(mt.kcal)} kcal</div>
      <div class="card meal-card">
        ${items.map((e) => `<div class="food-row${e.id === S.justAdded ? " just-in" : ""}" data-entry="${e.id}">
          <div><div class="fr-name">${esc(e.foodName)}</div>
            <div class="fr-sub">${r1(e.qty)}${e.per === "unid" ? " un" : " g"} · P ${r0(e.p)} C ${r0(e.c)} G ${r0(e.f)}</div></div>
          <div class="fr-right"><span class="kcal">${r0(e.kcal)}</span><button class="del" data-del="${e.id}">✕</button></div>
        </div>`).join("")}
      </div>`;
  }).join("");

  area.innerHTML = `${macroCardHTML(g)}
    ${groups || `<div class="empty">Nenhum tributo registrado hoje.<br>Toque em <b>+ Adicionar</b>.</div>`}`;
  animateMacroCard(area, total, g);
  S.justAdded = null;

  // deletar com toAsh + desfazer
  area.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async (e) => {
    e.stopPropagation();
    const id = b.dataset.del;
    const entry = log.find((x) => x.id === id);
    const row = b.closest(".food-row");
    row.classList.add("burning");
    let finished = false; // animationend + timeout de segurança: roda 1x só
    const finish = async () => {
      if (finished) return; finished = true;
      await db.del("foodlog", id);
      await refreshFoodViews();
      toast("Item removido", {
        action: { label: "Desfazer", fn: async () => { await db.put("foodlog", entry); await refreshFoodViews(); } },
      });
    };
    row.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, 400); // rede de segurança (reduced-motion)
  }));

  // tocar na linha = editar quantidade
  area.querySelectorAll(".food-row").forEach((row) => row.addEventListener("click", () => {
    const entry = log.find((x) => x.id === row.dataset.entry);
    if (!entry) return;
    const food = S.foods.find((f) => f.id === entry.foodId) || pseudoFood(entry);
    pickQty(food, entry.meal, { edit: entry });
  }));
}

// reconstrói a base por 100g/unidade a partir de um lançamento antigo
function pseudoFood(entry) {
  const factor = entry.per === "unid" ? entry.qty : entry.qty / 100;
  const f = factor || 1;
  return {
    id: entry.foodId, name: entry.foodName, per: entry.per,
    kcal: entry.kcal / f, p: entry.p / f, c: entry.c / f, f: entry.f / f,
  };
}

// ---- fluxo adicionar alimento ----
async function recentFoods(limit = 8) {
  const all = await db.getAll("foodlog");
  const byFood = new Map();
  for (const e of all) {
    const prev = byFood.get(e.foodId);
    const key = e.date + ":" + String(e.ts || 0).padStart(15, "0");
    if (!prev || key > prev.key) byFood.set(e.foodId, { key, e });
  }
  return [...byFood.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, limit).map((x) => x.e);
}

function addFoodFlow() {
  const mealOpts = MEAL_TYPES.map((m) => `<option value="${m.id}">${m.label}</option>`).join("");
  const body = `
    <select id="meal" class="inp full">${mealOpts}</select>
    <div class="recent-chips" data-recent></div>
    <input id="q" class="inp full" placeholder="Buscar alimento (ex: frango, ovo, arroz)" autocomplete="off"/>
    <div id="results" class="results"></div>
    <button class="btn-ghost full" data-newfood>+ Criar alimento novo</button>`;
  modal("Adicionar refeição", body, (back) => {
    $("#meal", back).value = guessMeal();
    const resultsEl = $("#results", back);

    const drawRecents = async () => {
      const rec = await recentFoods();
      const el = $("[data-recent]", back);
      if (!el) return;
      el.innerHTML = rec.map((e) => `<button class="chip" data-re="${e.id}">
        ${esc(e.foodName)} <i>· ${r1(e.qty)}${e.per === "unid" ? "un" : "g"}</i></button>`).join("");
      el.querySelectorAll("[data-re]").forEach((c) => c.addEventListener("click", async () => {
        const e = rec.find((x) => x.id === c.dataset.re);
        const food = S.foods.find((f) => f.id === e.foodId) || pseudoFood(e);
        await commitFood(food, e.qty, $("#meal", back).value);
        drawRecents();
      }));
    };
    drawRecents();

    const draw = (term) => {
      const t = term.trim().toLowerCase();
      const list = (t ? S.foods.filter((f) => f.name.toLowerCase().includes(t)) : S.foods).slice(0, 40);
      resultsEl.innerHTML = list.map((f) => `<button class="res" data-id="${f.id}">
        <span class="res-name">${esc(f.name)}</span>
        <span class="res-macro">${f.p}P · ${f.kcal}kcal /${f.per === "unid" ? "un" : "100g"}</span></button>`).join("")
        || `<div class="empty sm">Nada encontrado.</div>`;
      resultsEl.querySelectorAll(".res").forEach((b) => b.addEventListener("click", () =>
        pickQty(S.foods.find((f) => f.id === b.dataset.id), $("#meal", back).value, { onDone: () => { $("#q", back).value = ""; draw(""); drawRecents(); } })));
    };
    draw("");
    $("#q", back).addEventListener("input", (e) => draw(e.target.value));
    $("[data-newfood]", back).addEventListener("click", () => newFood(() => { draw($("#q", back).value); drawRecents(); }));
  });
}

function guessMeal() {
  const h = new Date().getHours();
  if (h < 10) return "cafe"; if (h < 14) return "almoco"; if (h < 17) return "pre"; if (h < 21) return "jantar"; return "lanche";
}

// atualiza a tela ativa (Comida ou Hoje) após qualquer mudança no foodlog
async function refreshFoodViews() {
  if (S.route === "comida") await renderFoodArea($("#app"));
  else if (S.route === "hoje") {
    const t = await dayTotals(todayStr());
    animateMacroCard($("#app"), t, S.profile);
  }
}

// grava um lançamento e cuida do TRIBUTO + refresh
async function commitFood(food, qty, meal, editEntry) {
  const m = macrosFor(food, qty);
  const id = editEntry ? editEntry.id : db.uid();
  const oldP = editEntry ? (editEntry.p || 0) : 0;
  await db.put("foodlog", {
    id, date: editEntry ? editEntry.date : todayStr(), meal,
    foodId: food.id, foodName: food.name, per: food.per, qty,
    ts: Date.now(), ...m,
  });
  S.justAdded = id;
  haptic("ok");
  // tributo dispara também via edição que cruza a meta (delta = p novo − p antigo),
  // desde que o lançamento seja de hoje.
  const forToday = !editEntry || editEntry.date === todayStr();
  const paid = forToday ? await maybeTributo(m.p - oldP) : false;
  if (!paid) toast(editEntry ? "Quantidade atualizada" : "Adicionado");
  await refreshFoodViews();
  syncSaga({ ascensionDelay: paid ? 3400 : 600 }); // bater meta pode subir nível
}

async function maybeTributo(addedP) {
  const g = S.profile;
  const key = "protDone:" + todayStr();
  if (localStorage.getItem(key)) return false;
  const t = await dayTotals(todayStr()); // já inclui o novo lançamento
  if (t.p >= g.p && t.p - addedP < g.p) {
    localStorage.setItem(key, "1");
    celebrateTributo(document.querySelector(".mb.prot"));
    toast("Tributo pago — proteína do dia", { omega: true, ms: 3200 });
    return true;
  }
  return false;
}

function pickQty(food, meal, opts = {}) {
  const unit = food.per === "unid";
  const editing = opts.edit;
  const def = editing ? editing.qty : (unit ? 1 : 100);
  const stepQ = unit ? 1 : 10;
  const body = `
    <div class="qty-head"><b>${esc(food.name)}</b><span class="muted">${r0(food.kcal)} kcal · ${r1(food.p)}g prot / ${unit ? "unidade" : "100 g"}</span></div>
    <div class="qty-row">
      <div class="stepgrp" style="flex:1">
        <button class="step" data-q="-${stepQ}">−</button>
        <input id="qty" class="inp" value="${def}" inputmode="decimal"/>
        <button class="step" data-q="${stepQ}">+</button>
      </div>
      <span class="u">${unit ? "unidade(s)" : "gramas"}</span>
    </div>
    <div id="preview" class="qty-prev"></div>
    <button class="btn-primary full" data-add>${editing ? "Salvar" : "Adicionar"}</button>`;
  modal(editing ? "Editar item" : esc(food.name), body, (back, close) => {
    const prev = $("#preview", back);
    const upd = () => {
      const m = macrosFor(food, parseFloat($("#qty", back).value) || 0);
      prev.innerHTML = `<b>${r0(m.kcal)}</b> kcal · P ${r0(m.p)} · C ${r0(m.c)} · G ${r0(m.f)}`;
    };
    upd();
    $("#qty", back).addEventListener("input", upd);
    back.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
      const inp = $("#qty", back);
      const next = Math.max(0, (parseFloat(inp.value) || 0) + parseFloat(b.dataset.q));
      inp.value = r1(next); haptic("tick"); upd();
    }));
    $("[data-add]", back).addEventListener("click", async () => {
      const qty = parseFloat($("#qty", back).value) || 0;
      if (qty <= 0) return toast("Quantidade inválida", { err: true });
      await commitFood(food, qty, meal, editing);
      close();
      opts.onDone && opts.onDone();
    });
  });
}

function newFood(onSaved) {
  const body = `
    <input id="fn" class="inp full" placeholder="Nome do alimento"/>
    <select id="fper" class="inp full"><option value="100g">Valores por 100 g</option><option value="unid">Valores por unidade</option></select>
    <div class="grid2">
      <label>Kcal<input id="fk" class="inp" inputmode="decimal" value="0"/></label>
      <label>Proteína (g)<input id="fp" class="inp" inputmode="decimal" value="0"/></label>
      <label>Carbo (g)<input id="fc" class="inp" inputmode="decimal" value="0"/></label>
      <label>Gordura (g)<input id="ff" class="inp" inputmode="decimal" value="0"/></label>
    </div>
    <button class="btn-primary full" data-save>Salvar alimento</button>`;
  modal("Novo alimento", body, (back, close) => {
    $("[data-save]", back).addEventListener("click", async () => {
      const name = $("#fn", back).value.trim(); if (!name) return toast("Dê um nome", { err: true });
      const food = { id: db.uid(), custom: true, group: "Custom", name, per: $("#fper", back).value,
        kcal: +$("#fk", back).value || 0, p: +$("#fp", back).value || 0, c: +$("#fc", back).value || 0, f: +$("#ff", back).value || 0 };
      await db.put("foods", food); await loadState(); close(); toast("Alimento forjado");
      onSaved && onSaved();
    });
  });
}

// =====================================================================
// VIEW: EVOLUÇÃO
// =====================================================================
VIEWS.evolucao = () => {
  const html = `
    <header class="topbar"><div><h1>Evolução</h1><p class="sub">A crônica da guerra</p></div></header>
    <section class="pad" id="evo"><div class="loading">…</div></section>`;
  return { html, async mount() { await renderEvo(); } };
};

let evoSel = null;

async function renderEvo() {
  const g = S.profile;
  const days = lastNDays(7);
  const protByDay = [];
  for (const iso of days) {
    const log = await db.getByIndex("foodlog", "date", iso);
    const p = log.reduce((a, e) => a + e.p, 0);
    protByDay.push({ label: dowShort(iso), y: p, on: p >= g.p * 0.9 });
  }
  const hit = protByDay.filter((d) => d.on).length;
  const avgKcal = await avgKcalLast(7);

  const body = (await db.getAll("bodylog")).sort((a, b) => a.date.localeCompare(b.date));
  const bodySeries = body.map((b) => ({ y: b.weightKg, label: prettyDate(b.date) }));
  const bDelta = body.length >= 2 ? r1(body[body.length - 1].weightKg - body[0].weightKg) : null;

  const sessions = (await db.getAll("sessions")).sort((a, b) => a.date.localeCompare(b.date));
  const exNames = [...new Set(sessions.flatMap((s) => s.entries.map((e) => e.name)))];
  const sel = (evoSel && exNames.includes(evoSel)) ? evoSel : (exNames[0] || "");
  const strSeries = strengthSeries(sessions, sel);

  const chron = [...sessions].reverse().slice(0, 12);

  const root = $("#evo");
  if (!root) return;
  root.innerHTML = `
    <div class="card insight">
      <div class="ins-head">Resumo da semana</div>
      <div class="ins-grid">
        <div><div class="ins-num">${hit}<i>/7</i></div><div class="ins-lab">dias na meta de proteína</div></div>
        <div><div class="ins-num">${avgKcal ? r0(avgKcal) : "—"}</div><div class="ins-lab">kcal média/dia</div></div>
        <div><div class="ins-num">${bDelta === null ? "—" : (bDelta > 0 ? "+" : "") + bDelta}<i>kg</i></div><div class="ins-lab">peso corporal (período)</div></div>
      </div>
      ${barChart(protByDay, { goal: g.p, h: 150 })}
    </div>

    <div class="section-label">Peso corporal</div>
    <div class="card">
      ${lineChart(bodySeries, { color: "#A6A099", emptyMsg: "O corpo ainda não foi pesado." })}
      <button class="btn-ghost full" data-act="addBody">+ Registrar peso de hoje</button>
    </div>

    <div class="section-label">Progressão de carga</div>
    <div class="card">
      ${exNames.length ? `<select id="exSel" class="inp full">
        ${exNames.map((n) => `<option ${n === sel ? "selected" : ""}>${esc(n)}</option>`).join("")}
      </select>${lineChart(strSeries, { color: "#C3271F" })}
      <div class="muted center">maior carga por treino (kg) · ponto dourado = recorde</div>`
      : `<div class="empty">A forja está fria.<br>Registre um treino pra acender.</div>`}
    </div>

    <div class="section-label">Crônica de batalhas</div>
    ${chron.length ? `<div class="card meal-card" style="padding:4px 16px">
      ${chron.map((s) => chronRowHTML(s)).join("")}
    </div>` : `<div class="empty">Nenhuma batalha registrada ainda.</div>`}`;

  root.querySelector('[data-act="addBody"]')?.addEventListener("click", () => addBodyFlow());
  root.querySelector("#exSel")?.addEventListener("change", (e) => { evoSel = e.target.value; renderEvo(); });

  // crônica: expandir + deletar (2 toques)
  root.querySelectorAll(".chron-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-delsess]")) return;
      row.classList.toggle("open");
    });
  });
  root.querySelectorAll("[data-delsess]").forEach((b) => b.addEventListener("click", async () => {
    if (b.dataset.armed) {
      await db.del("sessions", b.dataset.delsess);
      toast("Batalha apagada da crônica");
      renderEvo();
    } else {
      b.dataset.armed = "1"; b.textContent = "Confirmar exclusão?";
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "Apagar este treino"; } }, 2600);
    }
  }));
}

function chronRowHTML(s) {
  const bestOf = (e) => e.sets.reduce((m, st) => (st.weight > (m?.weight ?? -1) ? st : m), null);
  const vol = s.volume ?? s.entries.reduce((a, e) => a + e.sets.reduce((v, st) => v + (st.weight || 0) * (st.reps || 0), 0), 0);
  return `<div class="chron-row">
    <div class="chron-head">
      <span class="chron-date">${dowShort(s.date)} ${prettyDate(s.date)}</span>
      <span class="chron-name">${esc(s.dayName)}</span>
      ${s.pr ? `<span class="chron-pr">PR</span>` : ""}
      <span class="chron-vol">${r0(vol)} kg</span>
    </div>
    <div class="chron-body">
      ${s.entries.map((e) => {
        const b = bestOf(e);
        return `<div class="chron-ex"><span>${esc(e.name)}${s.prExercises?.includes(e.name) ? " ★" : ""}</span><span>${e.sets.length}× · melhor ${b ? `${r1(b.weight)}kg×${b.reps}` : "—"}</span></div>`;
      }).join("")}
      ${s.note ? `<div class="muted" style="margin-top:6px">"${esc(s.note)}"</div>` : ""}
      <button class="btn-danger chron-del" data-delsess="${s.id}">Apagar este treino</button>
    </div>
  </div>`;
}

function strengthSeries(sessions, name) {
  const out = [];
  for (const s of sessions) {
    const e = s.entries.find((x) => x.name === name);
    if (!e) continue;
    const best = e.sets.reduce((m, st) => Math.max(m, st.weight || 0), 0);
    if (best > 0) out.push({ y: best, label: prettyDate(s.date), pr: !!s.prExercises?.includes(name) });
  }
  return out;
}

async function avgKcalLast(n) {
  const days = lastNDays(n); let sum = 0, cnt = 0;
  for (const iso of days) {
    const log = await db.getByIndex("foodlog", "date", iso);
    if (log.length) { sum += log.reduce((a, e) => a + e.kcal, 0); cnt++; }
  }
  return cnt ? sum / cnt : 0;
}

function addBodyFlow() {
  const iso = todayStr();
  const body = `
    <div class="qty-row">
      <div class="stepgrp" style="flex:1">
        <button class="step" data-q="-0.1">−</button>
        <input id="bw" class="inp" inputmode="decimal" value="${S.profile.weightKg}"/>
        <button class="step" data-q="0.1">+</button>
      </div>
      <span class="u">kg</span>
    </div>
    <p class="muted">Registrando para hoje (${prettyDate(iso)}).</p>
    <button class="btn-primary full" data-save>Registrar na crônica</button>`;
  modal("Peso corporal", body, (back, close) => {
    back.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
      const inp = $("#bw", back);
      inp.value = r1(Math.max(0, (parseFloat(inp.value) || 0) + parseFloat(b.dataset.q)));
      haptic("tick");
    }));
    $("[data-save]", back).addEventListener("click", async () => {
      const w = parseFloat($("#bw", back).value); if (!w) return toast("Peso inválido", { err: true });
      await db.put("bodylog", { date: iso, weightKg: w });
      S.profile.weightKg = w;
      if (!S.profile.manual) Object.assign(S.profile, calcGoals(S.profile));
      await db.put("profile", S.profile);
      close(); haptic("ok"); toast("Registrado na crônica"); render();
      syncSaga({ ascensionDelay: 500 });
    });
  });
}

// =====================================================================
// VIEW: PERFIL
// =====================================================================
VIEWS.perfil = () => {
  const p = S.profile;
  const html = `
    <header class="topbar"><div><h1>Perfil & metas</h1><p class="sub">Ajuste seus dados e o app recalcula</p></div></header>
    <section class="pad">
      <div class="card form">
        <div class="grid2">
          <label>Peso (kg)<input id="pw" class="inp" inputmode="decimal" value="${p.weightKg}"/></label>
          <label>Altura (cm)<input id="ph" class="inp" inputmode="numeric" value="${p.heightCm}"/></label>
          <label>Idade<input id="pa" class="inp" inputmode="numeric" value="${p.age}"/></label>
          <label>Sexo<select id="ps" class="inp"><option value="m" ${p.sex === "m" ? "selected" : ""}>M</option><option value="f" ${p.sex === "f" ? "selected" : ""}>F</option></select></label>
          <label>Objetivo<select id="pg" class="inp">
            <option value="bulk" ${p.goal === "bulk" ? "selected" : ""}>Ganho de massa</option>
            <option value="manut" ${p.goal === "manut" ? "selected" : ""}>Manutenção</option>
            <option value="cut" ${p.goal === "cut" ? "selected" : ""}>Definição</option></select></label>
          <label>Atividade<select id="pact" class="inp">
            <option value="1.375" ${p.activity == 1.375 ? "selected" : ""}>Leve (1-2x)</option>
            <option value="1.55" ${p.activity == 1.55 ? "selected" : ""}>Moderado (3-4x)</option>
            <option value="1.6" ${p.activity == 1.6 ? "selected" : ""}>Alto (5x)</option>
            <option value="1.725" ${p.activity == 1.725 ? "selected" : ""}>Muito alto (6-7x)</option></select></label>
        </div>
        <label class="chk"><input type="checkbox" id="pman" ${p.manual ? "checked" : ""}/> Definir metas na mão (em vez de calcular)</label>
        <div id="goalsBox"></div>
        <button class="btn-primary full" data-act="saveProfile">Salvar e recalcular</button>
      </div>

      <div class="section-label">Como a meta foi calculada</div>
      <div class="card calc-explain" id="calcExplain"></div>

      <div class="section-label">Backup dos dados (ficam só neste aparelho)</div>
      <div class="card">
        <button class="btn-ghost full" data-act="export">⬇ Exportar backup (.json)</button>
        <button class="btn-ghost full" data-act="import">⬆ Importar backup</button>
        <input type="file" id="fileIn" accept="application/json" hidden/>
      </div>
      <div class="section-label danger-label">Ira dos deuses</div>
      <div class="card">
        <button class="btn-danger full" data-act="reset">Reduzir tudo a cinzas</button>
      </div>
      <p class="muted center" style="margin:18px 0 4px">KRATOS · PWA offline</p>
    </section>`;

  return {
    html,
    mount(root) {
      const drawGoals = () => {
        const man = $("#pman", root).checked;
        const g = man ? S.profile : calcGoals(readProfile(root));
        $("#goalsBox", root).innerHTML = `<div class="grid2 goals">
          <label>Kcal<input id="gk" class="inp" ${man ? "" : "disabled"} value="${g.kcal}"/></label>
          <label>Proteína<input id="gp" class="inp" ${man ? "" : "disabled"} value="${g.p}"/></label>
          <label>Carbo<input id="gc" class="inp" ${man ? "" : "disabled"} value="${g.c}"/></label>
          <label>Gordura<input id="gf" class="inp" ${man ? "" : "disabled"} value="${g.f}"/></label>
        </div>`;
        drawCalc();
      };
      const drawCalc = () => {
        const pr = readProfile(root);
        const sx = pr.sex === "f" ? -161 : 5;
        const bmr = 10 * pr.weightKg + 6.25 * pr.heightCm - 5 * pr.age + sx;
        const tdee = bmr * pr.activity;
        const surplus = pr.goal === "bulk" ? 350 : pr.goal === "cut" ? -400 : 0;
        $("#calcExplain", root).innerHTML = `
          <div class="ce-row"><span>TMB (Mifflin-St Jeor)</span><b>${r0(bmr)} kcal</b></div>
          <div class="ce-row"><span>× atividade ${pr.activity}</span><b>${r0(tdee)} kcal</b></div>
          <div class="ce-row"><span>${pr.goal === "bulk" ? "+350 superávit" : pr.goal === "cut" ? "−400 déficit" : "manutenção"}</span><b>${r0(tdee + surplus)} kcal</b></div>
          <div class="ce-row"><span>Proteína 2 g/kg · Gordura 0,9 g/kg</span><b>resto em carbo</b></div>`;
      };
      drawGoals();
      ["#pw", "#ph", "#pa", "#ps", "#pg", "#pact"].forEach((s) => $(s, root).addEventListener("input", drawGoals));
      $("#pman", root).addEventListener("change", drawGoals);

      $('[data-act="saveProfile"]', root).addEventListener("click", async () => {
        const man = $("#pman", root).checked;
        const prof = readProfile(root);
        if (man) { prof.kcal = +$("#gk", root).value; prof.p = +$("#gp", root).value; prof.c = +$("#gc", root).value; prof.f = +$("#gf", root).value; }
        else Object.assign(prof, calcGoals(prof));
        S.profile = prof; await db.put("profile", prof); haptic("ok"); toast("Perfil salvo"); render();
      });

      $('[data-act="export"]', root).addEventListener("click", async () => {
        const data = await db.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `kratos-backup-${todayStr()}.json`; a.click();
        URL.revokeObjectURL(a.href); toast("Backup exportado");
      });
      $('[data-act="import"]', root).addEventListener("click", () => $("#fileIn", root).click());
      $("#fileIn", root).addEventListener("change", async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          if (data._app !== "plano-eric") return toast("Arquivo inválido", { err: true });
          await db.importAll(data); await loadState(); toast("Backup restaurado"); render();
        } catch { toast("Erro ao ler arquivo", { err: true }); }
      });
      $('[data-act="reset"]', root).addEventListener("click", () => {
        modal("Reduzir tudo a cinzas?", `<p style="margin-bottom:4px">Treinos, refeições e pesos serão apagados. Não dá pra desfazer.</p>
          <button class="btn-danger full" data-yes>Sim — cinzas</button>`, (back, close) => {
          $("[data-yes]", back).addEventListener("click", async () => {
            for (const s of ["profile", "plan", "sessions", "foods", "foodlog", "bodylog", "saga"]) await db.clearStore(s);
            Object.keys(localStorage).filter((k) => k.startsWith("kratos-draft") || k.startsWith("protDone")).forEach((k) => localStorage.removeItem(k));
            await db.ensureSeed(); await loadState(); close(); S.route = "hoje"; S.prevT = null; render(); syncSaga({ silent: true }); toast("Tudo virou cinzas — recomeço");
          });
        });
      });
    },
  };
};

function readProfile(root) {
  const base = { ...S.profile };
  base.weightKg = +$("#pw", root).value || S.profile.weightKg;
  base.heightCm = +$("#ph", root).value || S.profile.heightCm;
  base.age = +$("#pa", root).value || S.profile.age;
  base.sex = $("#ps", root).value;
  base.goal = $("#pg", root).value;
  base.activity = +$("#pact", root).value;
  base.manual = $("#pman", root) ? $("#pman", root).checked : S.profile.manual;
  return base;
}

// =====================================================================
// BOOT
// =====================================================================
async function boot() {
  await db.ensureSeed();
  await loadState();
  render();
  syncSaga({ silent: true }); // registra o estado da saga sem celebrar retroativo
  const splash = document.getElementById("splash");
  if (splash) {
    setTimeout(() => {
      splash.style.transition = "opacity .25s";
      splash.style.opacity = "0";
      splash.addEventListener("transitionend", () => splash.remove(), { once: true });
      setTimeout(() => splash.remove(), 600);
    }, 420);
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}
boot();

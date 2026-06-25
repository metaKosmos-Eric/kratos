// =====================================================================
// app.js — controlador, roteador e todas as telas do app.
// =====================================================================
import * as db from "./db.js";
import { calcGoals } from "./db.js";
import { MEAL_TYPES } from "./data.js";
import { lineChart, barChart } from "./charts.js";

// ----------------------------- estado --------------------------------
const S = { route: "hoje", profile: null, plan: null, foods: [] };

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

function localISO(d) { const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return t.toISOString().slice(0, 10); }
function todayStr() { return localISO(new Date()); }
function lastNDays(n) {
  const out = []; const base = new Date();
  for (let i = n - 1; i >= 0; i--) { const d = new Date(base); d.setDate(base.getDate() - i); out.push(localISO(d)); }
  return out;
}
function dowShort(iso) { return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][new Date(iso + "T12:00").getDay()]; }
function prettyDate(iso) { const d = new Date(iso + "T12:00"); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }

// macros de um alimento para uma quantidade (g ou unidades)
function macrosFor(food, qty) {
  const factor = food.per === "unid" ? qty : qty / 100;
  return { kcal: food.kcal * factor, p: food.p * factor, c: food.c * factor, f: food.f * factor };
}
function emptyMacros() { return { kcal: 0, p: 0, c: 0, f: 0 }; }
function addMacros(a, b) { return { kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f }; }

// mapeia o dia da semana ao dia do plano
function todaysDay() {
  const map = { 1: "seg", 2: "ter", 3: "qua", 4: "qui", 5: "sex" };
  const id = map[new Date().getDay()];
  if (!id) return null;
  return activePlan().days.find((d) => d.id === id) || null;
}
function activePlan() { return S.plan.plans[S.plan.phase]; }

// ----------------------------- toast/modal ---------------------------
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2200);
}

function modal(title, bodyHTML, onMount) {
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="x" aria-label="Fechar">✕</button></div>
    <div class="modal-body">${bodyHTML}</div>
  </div>`;
  const close = () => back.remove();
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  $(".x", back).addEventListener("click", close);
  document.body.appendChild(back);
  onMount && onMount(back, close);
  return { back, close };
}

// =====================================================================
// RENDER PRINCIPAL
// =====================================================================
const NAV = [
  { id: "hoje", label: "Hoje", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { id: "treino", label: "Treino", icon: "M6.5 6.5l11 11M3 7l4-4 3 3-4 4zM21 17l-4 4-3-3 4-4z" },
  { id: "comida", label: "Comida", icon: "M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3c-1.5 1-2 3-2 6s.5 4 2 4v8" },
  { id: "evolucao", label: "Evolução", icon: "M3 17l6-6 4 4 7-7M14 8h7v7" },
  { id: "perfil", label: "Perfil", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];

function render() {
  const app = $("#app");
  const view = VIEWS[S.route]();
  app.innerHTML = view.html;
  view.mount && view.mount(app);
  // nav
  $("#nav").innerHTML = NAV.map((n) => `
    <button class="nav-btn ${S.route === n.id ? "active" : ""}" data-route="${n.id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${n.icon}"/></svg>
      <span>${n.label}</span>
    </button>`).join("");
  $("#nav").querySelectorAll("[data-route]").forEach((b) =>
    b.addEventListener("click", () => { S.route = b.dataset.route; window.scrollTo(0, 0); render(); }));
  app.scrollTop = 0;
}

function go(route) { S.route = route; render(); }

// =====================================================================
// VIEW: HOJE  (dashboard)
// =====================================================================
async function dayTotals(iso) {
  const log = await db.getByIndex("foodlog", "date", iso);
  return log.reduce((acc, e) => addMacros(acc, e), emptyMacros());
}

const VIEWS = {};

VIEWS.hoje = () => {
  const day = todaysDay();
  const g = S.profile;
  const html = `
    <header class="topbar"><div><h1>Olá, <span>${esc(g.name)}</span></h1>
      <p class="sub">${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p></div>
      <span class="phase-pill">Fase ${S.plan.phase}</span>
    </header>
    <section class="pad">
      <div id="macroCard" class="card macro-card"><div class="loading">…</div></div>

      <div class="section-label">Treino de hoje</div>
      ${day ? `
        <div class="card day-today">
          <div class="dt-head">
            <span class="day-badge badge-${day.color}">${day.dow}</span>
            <div><div class="day-title">${esc(day.name)}</div><div class="day-sub">${esc(day.sub)}</div></div>
          </div>
          <button class="btn-primary full" data-act="startToday">Iniciar / registrar treino</button>
        </div>` : `
        <div class="rest-card"><span>🌙</span><span><strong>Descanso.</strong> Caminhada leve, alongamento, sono de qualidade.</span></div>`}

      <div class="section-label">Atalhos</div>
      <div class="quick-grid">
        <button class="card quick" data-act="addFood"><b>+ Refeição</b><span>registrar comida</span></button>
        <button class="card quick" data-act="addBody"><b>+ Peso corporal</b><span>${g.weightKg} kg atual</span></button>
      </div>
    </section>`;

  return {
    html,
    async mount(root) {
      const t = await dayTotals(todayStr());
      $("#macroCard", root).outerHTML = macroCardHTML(t, g);
      root.querySelector('[data-act="startToday"]')?.addEventListener("click", () => day && startSession(day));
      root.querySelector('[data-act="addFood"]').addEventListener("click", () => addFoodFlow());
      root.querySelector('[data-act="addBody"]').addEventListener("click", () => addBodyFlow());
    },
  };
};

function macroBar(label, val, goal, color) {
  const pct = goal ? Math.min(100, (val / goal) * 100) : 0;
  return `<div class="mb">
    <div class="mb-top"><span>${label}</span><span>${r0(val)}<i>/${goal}g</i></span></div>
    <div class="mb-track"><div class="mb-fill" style="width:${pct}%;background:${color}"></div></div>
  </div>`;
}

function macroCardHTML(t, g) {
  const kpct = g.kcal ? Math.min(100, (t.kcal / g.kcal) * 100) : 0;
  return `<div id="macroCard" class="card macro-card">
    <div class="macro-head">
      <div><div class="macro-kcal">${r0(t.kcal)}<i>/ ${g.kcal} kcal</i></div>
        <div class="macro-sub">consumido hoje</div></div>
      <div class="ring" style="--p:${kpct}"><span>${r0(kpct)}%</span></div>
    </div>
    ${macroBar("Proteína", t.p, g.p, "var(--accent)")}
    ${macroBar("Carbo", t.c, g.c, "var(--blue)")}
    ${macroBar("Gordura", t.f, g.f, "var(--orange)")}
  </div>`;
}

// =====================================================================
// VIEW: TREINO (plano editável + iniciar sessão)
// =====================================================================
VIEWS.treino = () => {
  const pl = activePlan();
  const html = `
    <header class="topbar"><div><h1>Treino</h1><p class="sub">${esc(pl.label)}</p></div></header>
    <section class="pad">
      <div class="phase-toggle">
        <button class="phase-btn ${S.plan.phase === "A" ? "active" : ""}" data-phase="A">Fase A · base</button>
        <button class="phase-btn ${S.plan.phase === "B" ? "active" : ""}" data-phase="B">Fase B · intensidade</button>
      </div>
      <div class="tip">${esc(pl.tip)}</div>
      ${pl.days.map((d) => dayCardHTML(d)).join("")}
      <button class="btn-ghost full" data-act="addDay">+ Adicionar dia de treino</button>
    </section>`;

  return {
    html,
    mount(root) {
      root.querySelectorAll("[data-phase]").forEach((b) => b.addEventListener("click", async () => {
        S.plan.phase = b.dataset.phase; await db.put("plan", S.plan); render();
      }));
      root.querySelectorAll(".day-card .day-header").forEach((hd) =>
        hd.addEventListener("click", (e) => { if (!e.target.closest("[data-stop]")) hd.closest(".day-card").classList.toggle("open"); }));
      root.querySelectorAll('[data-act="start"]').forEach((b) =>
        b.addEventListener("click", () => startSession(pl.days.find((d) => d.id === b.dataset.day))));
      root.querySelectorAll('[data-act="editDay"]').forEach((b) =>
        b.addEventListener("click", () => editDay(pl.days.find((d) => d.id === b.dataset.day))));
      root.querySelector('[data-act="addDay"]').addEventListener("click", () => addDay());
    },
  };
};

function dayCardHTML(d) {
  const rows = d.exercises.map((x) => x.type === "cardio"
    ? `<tr class="cardio-row"><td>${esc(x.name)} <span class="cardio-tag">cardio</span></td><td>${x.duration} min</td></tr>`
    : `<tr><td>${esc(x.name)}</td><td>${x.sets} × ${esc(x.reps)}</td></tr>`).join("");
  return `<div class="day-card">
    <div class="day-header">
      <div class="day-left">
        <span class="day-badge badge-${d.color}">${d.dow}</span>
        <div><div class="day-title">${esc(d.name)}</div><div class="day-sub">${esc(d.sub)}</div></div>
      </div>
      <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="day-body">
      <table class="ex-table">${rows}</table>
      <div class="day-actions">
        <button class="btn-primary" data-act="start" data-day="${d.id}" data-stop>Registrar treino</button>
        <button class="btn-ghost" data-act="editDay" data-day="${d.id}" data-stop>Editar</button>
      </div>
    </div>
  </div>`;
}

// ---- editar dia (exercícios) ----
function editDay(day) {
  const renderRows = () => day.exercises.map((x, i) => `
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
        const i = +row.dataset.i; const ex = day.exercises[i];
        ex.name = $(".name", row).value.trim();
        if (ex.type === "cardio") ex.duration = +$(".small", row).value || 0;
        else { ex.sets = +$(".sets", row).value || 0; ex.reps = $(".reps", row).value.trim(); }
      });
    };
    const rerender = () => { $("#rows", back).innerHTML = renderRows(); bind(); };
    const bind = () => {
      back.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
        collect(); day.exercises.splice(+b.dataset.del, 1); rerender();
      }));
    };
    bind();
    back.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
      collect();
      day.exercises.push(b.dataset.add === "cardio"
        ? { name: "Cardio", type: "cardio", duration: 15 }
        : { name: "Novo exercício", sets: 3, reps: "10–12", type: "strength" });
      rerender();
    }));
    $("[data-save]", back).addEventListener("click", async () => {
      collect(); await db.put("plan", S.plan); close(); render(); toast("Dia atualizado");
    });
  });
}

function addDay() {
  const body = `
    <input id="nName" class="inp full" placeholder="Nome (ex: Peito + Tríceps)"/>
    <input id="nDow" class="inp full" placeholder="Sigla (ex: SEG)" maxlength="4"/>
    <select id="nColor" class="inp full">
      <option value="blue">Azul</option><option value="orange">Laranja</option>
      <option value="red">Vermelho</option><option value="green">Verde</option><option value="gray">Cinza</option>
    </select>
    <button class="btn-primary full" data-save>Criar dia</button>`;
  modal("Novo dia de treino", body, (back, close) => {
    $("[data-save]", back).addEventListener("click", async () => {
      const name = $("#nName", back).value.trim(); if (!name) return toast("Dê um nome");
      activePlan().days.push({
        id: db.uid(), dow: ($("#nDow", back).value.trim() || "—").toUpperCase(),
        color: $("#nColor", back).value, name, sub: "", exercises: [],
      });
      await db.put("plan", S.plan); close(); render();
    });
  });
}

// =====================================================================
// REGISTRAR TREINO (sessão de cargas)
// =====================================================================
async function startSession(day) {
  // pré-carrega últimas cargas desse exercício (referência de progressão)
  const prev = await lastWeightsFor(day);
  const strength = day.exercises.filter((x) => x.type !== "cardio");
  const rowsHTML = strength.map((x, xi) => {
    const sets = Array.from({ length: x.sets || 1 });
    const ref = prev[x.name];
    return `<div class="log-ex">
      <div class="log-ex-head"><b>${esc(x.name)}</b><span class="muted">${x.sets}×${esc(x.reps)}${ref ? ` · última: ${ref}` : ""}</span></div>
      <div class="log-sets">
        ${sets.map((_, si) => `<div class="set-in">
          <span>${si + 1}</span>
          <input class="inp w" data-x="${xi}" data-s="${si}" data-k="w" inputmode="decimal" placeholder="kg"/>
          <input class="inp rr" data-x="${xi}" data-s="${si}" data-k="r" inputmode="numeric" placeholder="reps"/>
        </div>`).join("")}
      </div>
    </div>`;
  }).join("");
  const body = `<div class="log-wrap">${rowsHTML}
    <textarea id="snote" class="inp full" placeholder="Notas (opcional)"></textarea>
    <button class="btn-primary full" data-save>Salvar treino</button></div>`;

  modal(`${day.dow} · ${day.name}`, body, (back, close) => {
    $("[data-save]", back).addEventListener("click", async () => {
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
      if (!entries.length) return toast("Preencha ao menos uma série");
      await db.put("sessions", {
        id: db.uid(), date: todayStr(), phase: S.plan.phase,
        dayId: day.id, dayName: day.name, entries, note: $("#snote", back).value.trim(),
      });
      close(); toast("Treino salvo 💪"); if (S.route === "hoje" || S.route === "treino") render();
    });
  });
}

// última carga registrada por exercício (string resumo "kg×reps")
async function lastWeightsFor(day) {
  const all = (await db.getAll("sessions")).filter((s) => s.dayId === day.id).sort((a, b) => b.date.localeCompare(a.date));
  const map = {};
  for (const s of all) {
    for (const e of s.entries) {
      if (map[e.name]) continue;
      const best = e.sets.reduce((m, st) => (st.weight > (m?.weight ?? -1) ? st : m), null);
      if (best) map[e.name] = `${r1(best.weight)}kg×${best.reps}`;
    }
  }
  return map;
}

// =====================================================================
// VIEW: COMIDA (registro de refeições do dia)
// =====================================================================
VIEWS.comida = () => {
  const html = `
    <header class="topbar"><div><h1>Comida</h1><p class="sub">Registro de hoje</p></div>
      <button class="btn-primary sm" data-act="add">+ Adicionar</button></header>
    <section class="pad" id="foodArea"><div class="loading">…</div></section>`;
  return {
    html,
    async mount(root) { await renderFoodArea(root);
      root.querySelector('[data-act="add"]').addEventListener("click", () => addFoodFlow()); },
  };
};

async function renderFoodArea(root) {
  const iso = todayStr();
  const log = (await db.getByIndex("foodlog", "date", iso));
  const g = S.profile;
  const total = log.reduce((a, e) => addMacros(a, e), emptyMacros());
  const byMeal = {};
  for (const e of log) (byMeal[e.meal] ||= []).push(e);

  const groups = MEAL_TYPES.filter((m) => byMeal[m.id]?.length).map((m) => {
    const items = byMeal[m.id];
    const mt = items.reduce((a, e) => addMacros(a, e), emptyMacros());
    return `<div class="section-label">${m.label} · ${r0(mt.p)}g prot · ${r0(mt.kcal)} kcal</div>
      <div class="card meal-card">
        ${items.map((e) => `<div class="food-row">
          <div><div class="fr-name">${esc(e.foodName)}</div>
            <div class="fr-sub">${r1(e.qty)}${e.per === "unid" ? " un" : " g"} · P ${r0(e.p)} C ${r0(e.c)} G ${r0(e.f)}</div></div>
          <div class="fr-right"><span class="kcal">${r0(e.kcal)}</span><button class="del" data-del="${e.id}">✕</button></div>
        </div>`).join("")}
      </div>`;
  }).join("");

  $("#foodArea", root).innerHTML = `
    ${macroCardHTML(total, g)}
    ${groups || `<div class="empty">Nada registrado hoje. Toque em <b>+ Adicionar</b>.</div>`}`;
  root.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    await db.del("foodlog", b.dataset.del); await renderFoodArea(root);
    if (S.route === "hoje") {}
  }));
}

// ---- fluxo adicionar alimento ----
function addFoodFlow() {
  const mealOpts = MEAL_TYPES.map((m) => `<option value="${m.id}">${m.label}</option>`).join("");
  const defaultMeal = guessMeal();
  const body = `
    <select id="meal" class="inp full">${mealOpts}</select>
    <input id="q" class="inp full" placeholder="Buscar alimento (ex: frango, ovo, arroz)" autocomplete="off"/>
    <div id="results" class="results"></div>
    <button class="btn-ghost full" data-newfood>+ Criar alimento novo</button>`;
  modal("Adicionar refeição", body, (back, close) => {
    $("#meal", back).value = defaultMeal;
    const resultsEl = $("#results", back);
    const draw = (term) => {
      const t = term.trim().toLowerCase();
      const list = (t ? S.foods.filter((f) => f.name.toLowerCase().includes(t)) : S.foods).slice(0, 40);
      resultsEl.innerHTML = list.map((f) => `<button class="res" data-id="${f.id}">
        <span class="res-name">${esc(f.name)}</span>
        <span class="res-macro">${f.p}P · ${f.kcal}kcal /${f.per === "unid" ? "un" : "100g"}</span></button>`).join("")
        || `<div class="empty sm">Nada encontrado.</div>`;
      resultsEl.querySelectorAll(".res").forEach((b) => b.addEventListener("click", () =>
        pickQty(S.foods.find((f) => f.id === b.dataset.id), $("#meal", back).value, close)));
    };
    draw("");
    $("#q", back).addEventListener("input", (e) => draw(e.target.value));
    $("[data-newfood]", back).addEventListener("click", () => { close(); newFood(); });
  });
}

function guessMeal() {
  const h = new Date().getHours();
  if (h < 10) return "cafe"; if (h < 14) return "almoco"; if (h < 17) return "pre"; if (h < 21) return "jantar"; return "lanche";
}

function pickQty(food, meal, closePrev) {
  const unit = food.per === "unid";
  const def = unit ? 1 : 100;
  const body = `
    <div class="qty-head"><b>${esc(food.name)}</b><span class="muted">${food.kcal} kcal · ${food.p}g prot / ${unit ? "unidade" : "100 g"}</span></div>
    <div class="qty-row">
      <input id="qty" class="inp" value="${def}" inputmode="decimal"/>
      <span class="u">${unit ? "unidade(s)" : "gramas"}</span>
    </div>
    <div id="preview" class="qty-prev"></div>
    <button class="btn-primary full" data-add>Adicionar</button>`;
  modal(esc(food.name), body, (back, close) => {
    const prev = $("#preview", back);
    const upd = () => { const m = macrosFor(food, parseFloat($("#qty", back).value) || 0);
      prev.innerHTML = `<b>${r0(m.kcal)}</b> kcal · P ${r0(m.p)} · C ${r0(m.c)} · G ${r0(m.f)}`; };
    upd(); $("#qty", back).addEventListener("input", upd);
    $("[data-add]", back).addEventListener("click", async () => {
      const qty = parseFloat($("#qty", back).value) || 0; if (qty <= 0) return toast("Quantidade inválida");
      const m = macrosFor(food, qty);
      await db.put("foodlog", { id: db.uid(), date: todayStr(), meal, foodId: food.id,
        foodName: food.name, per: food.per, qty, ...m });
      close(); closePrev && closePrev(); toast("Adicionado"); render();
    });
  });
}

function newFood() {
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
      const name = $("#fn", back).value.trim(); if (!name) return toast("Dê um nome");
      const food = { id: db.uid(), custom: true, group: "Custom", name, per: $("#fper", back).value,
        kcal: +$("#fk", back).value || 0, p: +$("#fp", back).value || 0, c: +$("#fc", back).value || 0, f: +$("#ff", back).value || 0 };
      if (food.per === "unid") food.unitGrams = 0;
      await db.put("foods", food); await loadState(); close(); toast("Alimento criado"); addFoodFlow();
    });
  });
}

// =====================================================================
// VIEW: EVOLUÇÃO (peso corporal + cargas + insights)
// =====================================================================
VIEWS.evolucao = () => {
  const html = `
    <header class="topbar"><div><h1>Evolução</h1><p class="sub">Seu progresso ao longo do tempo</p></div></header>
    <section class="pad" id="evo"><div class="loading">…</div></section>`;
  return { html, async mount() { await renderEvo(); } };
};

let evoSel = null; // exercício selecionado no gráfico de progressão

async function renderEvo() {
  const g = S.profile;
  // --- insights semanais ---
  const days = lastNDays(7);
  const protByDay = [];
  for (const iso of days) {
    const log = await db.getByIndex("foodlog", "date", iso);
    const p = log.reduce((a, e) => a + e.p, 0);
    protByDay.push({ label: dowShort(iso), y: p, on: p >= g.p * 0.9 });
  }
  const hit = protByDay.filter((d) => d.on).length;
  const avgKcal = await avgKcalLast(7);

  // --- peso corporal ---
  const body = (await db.getAll("bodylog")).sort((a, b) => a.date.localeCompare(b.date));
  const bodySeries = body.map((b) => ({ y: b.weightKg, label: prettyDate(b.date) }));
  const bDelta = body.length >= 2 ? r1(body[body.length - 1].weightKg - body[0].weightKg) : null;

  // --- progressão de carga por exercício ---
  const sessions = (await db.getAll("sessions")).sort((a, b) => a.date.localeCompare(b.date));
  const exNames = [...new Set(sessions.flatMap((s) => s.entries.map((e) => e.name)))];
  const sel = (evoSel && exNames.includes(evoSel)) ? evoSel : (exNames[0] || "");
  const strSeries = strengthSeries(sessions, sel);

  const root = $("#evo");
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
      ${lineChart(bodySeries, { color: "#5ab4ff" })}
      <button class="btn-ghost full" data-act="addBody">+ Registrar peso de hoje</button>
    </div>

    <div class="section-label">Progressão de carga</div>
    <div class="card">
      ${exNames.length ? `<select id="exSel" class="inp full">
        ${exNames.map((n) => `<option ${n === sel ? "selected" : ""}>${esc(n)}</option>`).join("")}
      </select>${lineChart(strSeries, { color: "#c8f55a" })}
      <div class="muted center">maior carga registrada por treino (kg)</div>`
      : `<div class="empty">Registre treinos pra ver a evolução das cargas.</div>`}
    </div>`;

  root.querySelector('[data-act="addBody"]')?.addEventListener("click", () => addBodyFlow());
  root.querySelector("#exSel")?.addEventListener("change", (e) => {
    evoSel = e.target.value; renderEvo();
  });
}

function strengthSeries(sessions, name) {
  const out = [];
  for (const s of sessions) {
    const e = s.entries.find((x) => x.name === name);
    if (!e) continue;
    const best = e.sets.reduce((m, st) => Math.max(m, st.weight || 0), 0);
    if (best > 0) out.push({ y: best, label: prettyDate(s.date) });
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
    <div class="qty-row"><input id="bw" class="inp" inputmode="decimal" value="${S.profile.weightKg}"/><span class="u">kg</span></div>
    <p class="muted">Registrando para hoje (${prettyDate(iso)}).</p>
    <button class="btn-primary full" data-save>Salvar peso</button>`;
  modal("Peso corporal", body, (back, close) => {
    $("[data-save]", back).addEventListener("click", async () => {
      const w = parseFloat($("#bw", back).value); if (!w) return toast("Peso inválido");
      await db.put("bodylog", { date: iso, weightKg: w });
      // mantém o peso do perfil sincronizado (afeta metas)
      S.profile.weightKg = w; const gg = calcGoals(S.profile);
      S.profile = { ...S.profile, ...gg }; await db.put("profile", S.profile);
      close(); toast("Peso registrado"); render();
    });
  });
}

// =====================================================================
// VIEW: PERFIL (metas, perfil, backup)
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
      <div class="section-label danger-label">Zona de perigo</div>
      <div class="card">
        <button class="btn-danger full" data-act="reset">Apagar tudo e recomeçar</button>
      </div>
      <p class="muted center" style="margin:18px 0 4px">Plano Eric · PWA offline</p>
    </section>`;

  return {
    html,
    mount(root) {
      const drawGoals = () => {
        const man = $("#pman", root).checked;
        const g = man ? S.profile : calcGoals(readProfile(root, true));
        $("#goalsBox", root).innerHTML = `<div class="grid2 goals">
          <label>Kcal<input id="gk" class="inp" ${man ? "" : "disabled"} value="${g.kcal}"/></label>
          <label>Proteína<input id="gp" class="inp" ${man ? "" : "disabled"} value="${g.p}"/></label>
          <label>Carbo<input id="gc" class="inp" ${man ? "" : "disabled"} value="${g.c}"/></label>
          <label>Gordura<input id="gf" class="inp" ${man ? "" : "disabled"} value="${g.f}"/></label>
        </div>`;
        drawCalc();
      };
      const drawCalc = () => {
        const pr = readProfile(root, true);
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
        let prof = readProfile(root, false);
        if (man) { prof.kcal = +$("#gk", root).value; prof.p = +$("#gp", root).value; prof.c = +$("#gc", root).value; prof.f = +$("#gf", root).value; }
        else { Object.assign(prof, calcGoals(prof)); }
        S.profile = prof; await db.put("profile", prof); toast("Perfil salvo"); render();
      });

      $('[data-act="export"]', root).addEventListener("click", async () => {
        const data = await db.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `plano-eric-backup-${todayStr()}.json`; a.click();
        URL.revokeObjectURL(a.href); toast("Backup exportado");
      });
      $('[data-act="import"]', root).addEventListener("click", () => $("#fileIn", root).click());
      $("#fileIn", root).addEventListener("change", async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try { const data = JSON.parse(await file.text());
          if (data._app !== "plano-eric") return toast("Arquivo inválido");
          await db.importAll(data); await loadState(); toast("Backup restaurado"); render();
        } catch { toast("Erro ao ler arquivo"); }
      });
      $('[data-act="reset"]', root).addEventListener("click", () => {
        modal("Apagar tudo?", `<p>Isso apaga treinos, refeições, pesos e volta ao padrão. Não dá pra desfazer.</p>
          <button class="btn-danger full" data-yes>Sim, apagar tudo</button>`, (back, close) => {
          $("[data-yes]", back).addEventListener("click", async () => {
            for (const s of ["profile", "plan", "sessions", "foods", "foodlog", "bodylog"]) await db.clearStore(s);
            await db.ensureSeed(); await loadState(); close(); S.route = "hoje"; render(); toast("Tudo recomeçado");
          });
        });
      });
    },
  };
};

function readProfile(root, asNumbersOnly) {
  const base = asNumbersOnly ? { ...S.profile } : { ...S.profile };
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
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}
boot();

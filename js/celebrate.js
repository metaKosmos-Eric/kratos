// =====================================================================
// celebrate.js — motor de celebrações do Kratos.
// Ω sempre em SVG inline (nunca via fonte), brasas com cap global,
// haptics centralizados e count-up de números.
// =====================================================================

export const OMEGA_PATH = "M12 3a7.5 7.5 0 0 0-4.2 13.7c.4.3.7.8.7 1.3v1H4v2h7v-3.2a1 1 0 0 0-.6-.9 5.5 5.5 0 1 1 3.2 0 1 1 0 0 0-.6.9V21h7v-2h-4.5v-1c0-.5.3-1 .7-1.3A7.5 7.5 0 0 0 12 3z";

export const OMEGA_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="${OMEGA_PATH}"/></svg>`;

// ramo de louro: haste em arco + folhas (elipses estilizadas via path)
const LAUREL_SVG = `<svg viewBox="0 0 74 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M60 8 C30 40 22 75 26 112 C28 128 36 140 50 146
    M50 22 C40 26 34 24 30 16 M50 22 C52 13 48 7 40 4
    M38 44 C29 48 23 45 20 37 M38 44 C41 35 38 29 30 26
    M30 68 C21 71 15 68 13 60 M30 68 C33 59 31 52 23 50
    M27 92 C18 94 12 90 11 82 M27 92 C31 84 29 77 21 76
    M30 116 C21 117 15 112 15 104 M30 116 C34 108 33 101 25 100
    M40 136 C31 138 25 134 24 126 M40 136 C43 128 41 121 33 119"/>
</svg>`;

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------
// Haptics centralizados (no-op onde não existe, ex: iOS Safari)
// ---------------------------------------------------------------------
export function haptic(kind) {
  if (reduced()) return;
  const map = {
    tick: 10,
    ok: 30,
    seal: [30, 40, 60],
    rest: [200, 100, 200],
    epic: [40, 60, 40, 60, 120],
  };
  try { navigator.vibrate && navigator.vibrate(map[kind] || 15); } catch { /* noop */ }
}

// ---------------------------------------------------------------------
// Brasas — motor único, cap global de 40 partículas
// ---------------------------------------------------------------------
export function sparks(x, y, n = 12, riseVh = 55) {
  if (reduced()) return;
  const alive = document.querySelectorAll(".spark").length;
  const count = Math.min(n, Math.max(0, 40 - alive));
  for (let i = 0; i < count; i++) {
    const s = document.createElement("i");
    s.className = "spark";
    const size = 3 + ((i * 7) % 3);
    s.style.width = s.style.height = size + "px";
    s.style.left = (x + (((i * 37) % 60) - 30)) + "px";
    s.style.top = (y + (((i * 23) % 24) - 12)) + "px";
    s.style.setProperty("--dx", (((i * 53) % 80) - 40) + "px");
    s.style.animationDuration = (0.7 + ((i * 29) % 13) / 10) + "s";
    if (riseVh !== 55) s.style.setProperty("--rise", "-" + riseVh + "vh");
    s.addEventListener("animationend", () => s.remove(), { once: true });
    document.body.appendChild(s);
  }
}

function shake() {
  if (reduced()) return;
  document.body.classList.add("shake");
  // animationend das brasas borbulha pro body; só reage ao próprio bodyShake
  const onEnd = (e) => {
    if (e.target !== document.body || e.animationName !== "bodyShake") return;
    document.body.classList.remove("shake");
    document.body.removeEventListener("animationend", onEnd);
  };
  document.body.addEventListener("animationend", onEnd);
}

function overlay(cls, html, ms, tappable) {
  const el = document.createElement("div");
  el.className = `celebrate ${cls}` + (tappable ? " tappable" : "");
  el.innerHTML = html;
  document.body.appendChild(el);
  let gone = false;
  const out = () => {
    if (gone) return; gone = true;
    el.classList.add("fading");
    setTimeout(() => el.remove(), 280);
  };
  if (tappable) el.addEventListener("click", out);
  setTimeout(out, ms);
  return el;
}

// ---------------------------------------------------------------------
// SELO DE GUERRA — treino salvo (sem PR)
// ---------------------------------------------------------------------
export function celebrateSeal() {
  if (reduced()) return; // versão sóbria: o toast cuida
  overlay("selo", `
    <div class="cel-center">
      <div class="seal-ring">${OMEGA_SVG}</div>
      <div class="cel-title">Treino selado</div>
    </div>`, 1400, false);
  setTimeout(() => {
    shake(); haptic("seal");
    sparks(innerWidth / 2, innerHeight / 2, 14);
  }, 270);
}

// ---------------------------------------------------------------------
// GLÓRIA — novo recorde pessoal
// prs = [{ name, prev, now }] (maior carga anterior e nova)
// ---------------------------------------------------------------------
export function celebrateGloria(prs) {
  const top = prs.reduce((m, p) => (p.now > m.now ? p : m), prs[0]);
  const others = prs.filter((p) => p !== top).map((p) => p.name);
  if (reduced()) return; // sóbria: toast + número estático via caller
  const el = overlay("gloria", `
    <div class="cel-center">
      <span class="laurel l">${LAUREL_SVG}</span>
      <span class="laurel r">${LAUREL_SVG}</span>
      <div class="gl-title">Novo recorde</div>
      <div class="gl-ex">${escapeHtml(top.name)}</div>
      <div class="gl-num"><span data-n>${fmt(top.prev)}</span><i> kg</i></div>
      ${others.length ? `<div class="gl-more">+ recorde em: ${others.map(escapeHtml).join(", ")}</div>` : ""}
    </div>`, 2200, true);
  const numEl = el.querySelector("[data-n]");
  countUp(numEl, top.prev, top.now, 600, fmt);
  setTimeout(() => { shake(); haptic("epic"); }, 150);
  setTimeout(() => sparks(innerWidth / 2, innerHeight * 0.72, 24), 350);
}

// ---------------------------------------------------------------------
// ASCENSÃO — subiu de nível / patente (RPG)
// ---------------------------------------------------------------------
export function celebrateAscension({ rankName, level, avatarSVG, isRankUp }) {
  haptic("epic");
  if (reduced()) return;
  const el = overlay("gloria", `
    <div class="cel-center asc">
      <div class="gl-title">${isRankUp ? "Ascensão" : "Subiu de nível"}</div>
      <div class="asc-avatar${isRankUp ? " up" : ""}">${avatarSVG || ""}</div>
      <div class="asc-rank">${escapeHtml(rankName)}</div>
      <div class="asc-lvl">Nível ${level}</div>
    </div>`, isRankUp ? 2800 : 2000, true);
  setTimeout(() => { shake(); }, 150);
  setTimeout(() => sparks(innerWidth / 2, innerHeight * 0.62, isRankUp ? 28 : 14), 320);
  return el;
}

// ---------------------------------------------------------------------
// FERA ABATIDA — chefe semanal derrotado
// ---------------------------------------------------------------------
export function celebrateBoss(name) {
  haptic("epic");
  if (reduced()) return;
  overlay("gloria", `
    <div class="cel-center">
      <div class="gl-title">Fera abatida</div>
      <div class="boss-skull">☠</div>
      <div class="asc-rank">${escapeHtml(name)}</div>
      <div class="asc-lvl">Chefe da semana derrotado</div>
    </div>`, 2400, true);
  setTimeout(() => { shake(); }, 150);
  setTimeout(() => sparks(innerWidth / 2, innerHeight * 0.62, 22), 320);
}

// ---------------------------------------------------------------------
// TRIBUTO PAGO — meta de proteína batida (contida, inline)
// barEl: elemento .mb da proteína se visível (pode ser null)
// ---------------------------------------------------------------------
export function celebrateTributo(barEl) {
  haptic("ok");
  if (barEl && !reduced()) {
    const r = barEl.getBoundingClientRect();
    sparks(r.left + r.width * 0.7, r.top, 6, 12);
  }
}

// ---------------------------------------------------------------------
// count-up com easeOutCubic
// ---------------------------------------------------------------------
export function countUp(el, from, to, ms = 700, format = (n) => Math.round(n)) {
  if (!el) return;
  if (reduced() || from === to) { el.textContent = format(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const v = from + (to - from) * (1 - Math.pow(1 - k, 3));
    el.textContent = format(v);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function fmt(n) { return Math.round(n * 10) / 10; }
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

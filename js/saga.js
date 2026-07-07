// =====================================================================
// saga.js — camada de RPG do Kratos.
// Tudo é DERIVADO dos dados reais (sessions/foodlog/bodylog) — retroativo
// e sempre consistente. O único estado persistido é o "já visto" (pra saber
// quando celebrar level-up e conquistas novas).
// =====================================================================

// --- patentes (8 tiers de avatar) ---
export const RANKS = [
  { name: "Escravo de Esparta", minLevel: 1,  tier: 0 },
  { name: "Soldado",            minLevel: 3,  tier: 1 },
  { name: "Hoplita",            minLevel: 6,  tier: 2 },
  { name: "Capitão",            minLevel: 10, tier: 3 },
  { name: "Campeão de Esparta", minLevel: 15, tier: 4 },
  { name: "Semideus",           minLevel: 22, tier: 5 },
  { name: "Fantasma de Esparta",minLevel: 30, tier: 6 },
  { name: "Deus da Guerra",     minLevel: 40, tier: 7 },
];

// custo de XP pra ir do nível L pro L+1
function stepCost(L) { return 100 + (L - 1) * 50; }
// XP total acumulado necessário pra ALCANÇAR o nível L (L=1 => 0)
function xpToReach(L) { let x = 0; for (let i = 1; i < L; i++) x += stepCost(i); return x; }
function levelFromXp(xp) { let L = 1; while (xp >= xpToReach(L + 1)) L++; return L; }
function rankForLevel(level) {
  let r = RANKS[0];
  for (const rk of RANKS) if (level >= rk.minLevel) r = rk;
  return r;
}

const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
function localISO(d) { const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return t.toISOString().slice(0, 10); }
function weekKey(iso) {
  const d = new Date(iso + "T12:00"); const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day); return localISO(d);
}

// semanas consecutivas com >= 3 treinos (semana em curso não quebra)
function streakWeeks(sessions) {
  const per = {};
  for (const s of sessions) (per[weekKey(s.date)] ||= new Set()).add(s.date);
  const thisWk = weekKey(localISO(new Date()));
  const back = (wk) => { const d = new Date(wk + "T12:00"); d.setDate(d.getDate() - 7); return localISO(d); };
  let streak = 0, cursor = thisWk;
  if ((per[thisWk]?.size || 0) >= 3) { streak++; cursor = back(thisWk); } else cursor = back(thisWk);
  while ((per[cursor]?.size || 0) >= 3) { streak++; cursor = back(cursor); }
  return streak;
}

// =====================================================================
// MISSÕES DIÁRIAS — 3 por dia, escolhidas deterministicamente pela data.
// O "done" é derivado dos dados do dia; a XP é bônus por completar.
// =====================================================================
export const MISSION_POOL = [
  { id: "m_treino", label: "Selar 1 treino", xp: 40, check: (c) => c.sessions >= 1 },
  { id: "m_prot", label: "Bater a meta de proteína", xp: 30, check: (c) => c.protein >= c.goal },
  { id: "m_pr", label: "Quebrar um recorde", xp: 60, check: (c) => c.prs >= 1 },
  { id: "m_pesar", label: "Registrar o peso", xp: 15, check: (c) => c.weighed },
  { id: "m_refeicoes", label: "Registrar 3 refeições", xp: 20, check: (c) => c.meals >= 3 },
  { id: "m_volume", label: "Levantar 2500 kg de volume", xp: 40, check: (c) => c.volume >= 2500 },
];

function hashStr(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
function seededShuffle(arr, seed) {
  const a = arr.slice(); let s = seed || 1;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function missionsForDate(iso) { return seededShuffle(MISSION_POOL, hashStr(iso)).slice(0, 3); }

// =====================================================================
// CHEFES SEMANAIS — 1 fera por semana; dano vem do que você fez na semana.
// =====================================================================
export const BOSS_POOL = [
  { name: "Minotauro", hp: 200 }, { name: "Medusa", hp: 180 }, { name: "Hidra de Lerna", hp: 250 },
  { name: "Cérbero", hp: 220 }, { name: "Ciclope", hp: 200 }, { name: "Quimera", hp: 235 },
  { name: "Górgona", hp: 190 }, { name: "Basilisco", hp: 210 },
];
export function bossForWeek(wk) { return BOSS_POOL[hashStr(wk) % BOSS_POOL.length]; }
// dano da semana: treino=25, dia na meta=15, recorde=30, +vol/150
function weekDamage(w) {
  return w.sessions * 25 + w.proteinDays * 15 + w.prs * 30 + Math.floor(w.volume / 150);
}

// =====================================================================
// CONQUISTAS — cada uma tem um teste sobre as estatísticas calculadas
// =====================================================================
export const ACHIEVEMENTS = [
  { id: "primeiro_sangue", name: "Primeiro Sangue", desc: "Sele seu primeiro treino", test: (s) => s.sessions >= 1 },
  { id: "primeiro_tributo", name: "Primeiro Tributo", desc: "Bata a meta de proteína em 1 dia", test: (s) => s.proteinDays >= 1 },
  { id: "recorde_guerra", name: "Recorde de Guerra", desc: "Quebre 1 recorde de carga", test: (s) => s.totalPRs >= 1 },
  { id: "cacador", name: "Caçador de Feras", desc: "Abata 1 chefe semanal", test: (s) => s.bossesDefeated >= 1 },
  { id: "veterano", name: "Veterano de Guerra", desc: "Sele 10 treinos", test: (s) => s.sessions >= 10 },
  { id: "faminto", name: "Faminto por Poder", desc: "7 dias na meta de proteína", test: (s) => s.proteinDays >= 7 },
  { id: "inquebravel", name: "Inquebrável", desc: "4 semanas seguidas de fúria", test: (s) => s.streak >= 4 },
  { id: "carrasco", name: "Carrasco", desc: "Abata 5 chefes semanais", test: (s) => s.bossesDefeated >= 5 },
  { id: "montanha", name: "A Montanha", desc: "20.000 kg de volume total", test: (s) => s.totalVolume >= 20000 },
  { id: "disciplina", name: "Disciplina de Ferro", desc: "30 dias de treino registrados", test: (s) => s.activeDays >= 30 },
  { id: "cronica", name: "Crônica do Corpo", desc: "10 pesagens registradas", test: (s) => s.weighIns >= 10 },
  { id: "semideus", name: "Sangue de Deus", desc: "Alcance a patente Semideus", test: (s) => s.level >= 22 },
];

// =====================================================================
// CÁLCULO PRINCIPAL
// =====================================================================
export function computeSaga(sessions, foodlog, bodylog, profile) {
  const goal = profile?.p || 1;
  const today = new Date();
  const todayISO = localISO(today);
  const thisWk = weekKey(todayISO);

  // agrega tudo por DIA
  const dayAgg = {};
  const day = (d) => (dayAgg[d] ||= { volume: 0, prs: 0, sessions: 0, meals: 0, protein: 0, weighed: false });
  let xp = 0, totalVolume = 0, totalPRs = 0;
  const activeDays = new Set();
  for (const s of sessions) {
    const vol = s.volume ?? s.entries.reduce((a, e) => a + e.sets.reduce((v, st) => v + (st.weight || 0) * (st.reps || 0), 0), 0);
    const prs = s.prExercises?.length || 0;
    totalVolume += vol; totalPRs += prs;
    xp += 40 + Math.floor(vol / 40) + prs * 60;
    activeDays.add(s.date);
    const a = day(s.date); a.volume += vol; a.prs += prs; a.sessions += 1;
  }
  for (const e of foodlog) { const a = day(e.date); a.protein += e.p; a.meals += 1; }
  for (const b of bodylog) day(b.date).weighed = true;

  // proteína por dia + aderência 30d
  let proteinDays = 0, hit30 = 0, logged30 = 0;
  const since30 = localISO(new Date(today.getTime() - 30 * 864e5));
  for (const [d, a] of Object.entries(dayAgg)) {
    if (a.meals > 0) { if (d >= since30) { logged30++; if (a.protein >= goal) hit30++; } }
    if (a.protein >= goal && a.meals > 0) proteinDays++;
  }
  xp += bodylog.length * 8;

  // XP bônus de MISSÕES completadas (derivado, retroativo)
  const ctxOf = (a) => ({ sessions: a.sessions, protein: a.protein, prs: a.prs, weighed: a.weighed, meals: a.meals, volume: a.volume, goal });
  let missionXp = 0;
  for (const [d, a] of Object.entries(dayAgg)) {
    for (const m of missionsForDate(d)) if (m.check(ctxOf(a))) missionXp += m.xp;
  }
  xp += missionXp;

  // CHEFES por semana
  const weekAgg = {};
  for (const [d, a] of Object.entries(dayAgg)) {
    const w = weekAgg[weekKey(d)] ||= { sessions: 0, proteinDays: 0, prs: 0, volume: 0 };
    w.sessions += a.sessions; w.prs += a.prs; w.volume += a.volume;
    if (a.protein >= goal && a.meals > 0) w.proteinDays += 1;
  }
  let bossesDefeated = 0;
  for (const [wk, w] of Object.entries(weekAgg)) {
    if (weekDamage(w) >= bossForWeek(wk).hp) { bossesDefeated++; xp += 120; }
  }
  // chefe da semana atual (pra UI)
  const cwBoss = bossForWeek(thisWk);
  const cwAgg = weekAgg[thisWk] || { sessions: 0, proteinDays: 0, prs: 0, volume: 0 };
  const cwDmg = weekDamage(cwAgg);
  const boss = {
    name: cwBoss.name, hp: cwBoss.hp, dmg: Math.min(cwDmg, cwBoss.hp),
    remaining: Math.max(0, cwBoss.hp - cwDmg), defeated: cwDmg >= cwBoss.hp,
  };

  // missões de HOJE (pra UI)
  const tctx = ctxOf(dayAgg[todayISO] || { volume: 0, prs: 0, sessions: 0, meals: 0, protein: 0, weighed: false });
  const missions = missionsForDate(todayISO).map((m) => ({ id: m.id, label: m.label, xp: m.xp, done: m.check(tctx) }));

  const level = levelFromXp(xp);
  const rank = rankForLevel(level);
  const rankIndex = RANKS.indexOf(rank);
  const nextRank = RANKS[rankIndex + 1] || null;
  const base = xpToReach(level), next = xpToReach(level + 1);

  // atributos 0-100 (derivados do que o Eric realmente fez)
  const streak = streakWeeks(sessions);
  const sessionsLast14 = [...activeDays].filter((d) => d >= localISO(new Date(today.getTime() - 14 * 864e5))).length;
  const firstDate = [...activeDays, ...bodylog.map((b) => b.date)].sort()[0];
  const weeksSinceStart = firstDate ? Math.floor((today - new Date(firstDate + "T12:00")) / (7 * 864e5)) : 0;

  const attrs = {
    forca: clamp(Math.round(totalVolume / 400 + totalPRs * 4)),
    furia: clamp(Math.round(streak * 14 + sessionsLast14 * 7)),
    vigor: clamp(logged30 ? Math.round((hit30 / logged30) * 100) : 0),
    resiliencia: clamp(Math.round(activeDays.size * 2.5 + weeksSinceStart * 6)),
  };

  const stats = {
    xp, level, sessions: sessions.length, totalVolume: Math.round(totalVolume),
    totalPRs, proteinDays, activeDays: activeDays.size, weighIns: bodylog.length, streak,
    bossesDefeated,
  };
  const achievements = ACHIEVEMENTS.map((a) => ({ ...a, unlocked: a.test(stats) }));

  return {
    xp, level, rank, rankIndex, nextRank,
    xpIntoLevel: xp - base, xpForLevel: next - base,
    attrs, stats, achievements, missions, boss,
    poder: attrs.forca + attrs.furia + attrs.vigor + attrs.resiliencia, // 0-400
  };
}

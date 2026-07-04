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
// CONQUISTAS — cada uma tem um teste sobre as estatísticas calculadas
// =====================================================================
export const ACHIEVEMENTS = [
  { id: "primeiro_sangue", name: "Primeiro Sangue", desc: "Sele seu primeiro treino", test: (s) => s.sessions >= 1 },
  { id: "primeiro_tributo", name: "Primeiro Tributo", desc: "Bata a meta de proteína em 1 dia", test: (s) => s.proteinDays >= 1 },
  { id: "recorde_guerra", name: "Recorde de Guerra", desc: "Quebre 1 recorde de carga", test: (s) => s.totalPRs >= 1 },
  { id: "veterano", name: "Veterano de Guerra", desc: "Sele 10 treinos", test: (s) => s.sessions >= 10 },
  { id: "faminto", name: "Faminto por Poder", desc: "7 dias na meta de proteína", test: (s) => s.proteinDays >= 7 },
  { id: "inquebravel", name: "Inquebrável", desc: "4 semanas seguidas de fúria", test: (s) => s.streak >= 4 },
  { id: "montanha", name: "A Montanha", desc: "20.000 kg de volume total", test: (s) => s.totalVolume >= 20000 },
  { id: "disciplina", name: "Disciplina de Ferro", desc: "30 dias de treino registrados", test: (s) => s.activeDays >= 30 },
  { id: "cronica", name: "Crônica do Corpo", desc: "10 pesagens registradas", test: (s) => s.weighIns >= 10 },
  { id: "semideus", name: "Sangue de Deus", desc: "Alcance a patente Semideus", test: (s) => s.level >= 22 },
];

// =====================================================================
// CÁLCULO PRINCIPAL
// =====================================================================
export function computeSaga(sessions, foodlog, bodylog, profile) {
  let xp = 0, totalVolume = 0, totalPRs = 0;
  const activeDays = new Set();
  for (const s of sessions) {
    const vol = s.volume ?? s.entries.reduce((a, e) => a + e.sets.reduce((v, st) => v + (st.weight || 0) * (st.reps || 0), 0), 0);
    const prs = s.prExercises?.length || 0;
    totalVolume += vol; totalPRs += prs;
    xp += 40 + Math.floor(vol / 40) + prs * 60;
    activeDays.add(s.date);
  }

  // proteína por dia (usa a meta atual como referência)
  const goal = profile?.p || 1;
  const pByDate = {};
  for (const e of foodlog) pByDate[e.date] = (pByDate[e.date] || 0) + e.p;
  let proteinDays = 0;
  const today = new Date();
  const since30 = localISO(new Date(today.getTime() - 30 * 864e5));
  let hit30 = 0, logged30 = 0;
  for (const [d, p] of Object.entries(pByDate)) {
    if (p >= goal) { proteinDays++; xp += 25; }
    if (d >= since30) { logged30++; if (p >= goal) hit30++; }
  }

  xp += bodylog.length * 8;

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
  };
  const achievements = ACHIEVEMENTS.map((a) => ({ ...a, unlocked: a.test(stats) }));

  return {
    xp, level, rank, rankIndex, nextRank,
    xpIntoLevel: xp - base, xpForLevel: next - base,
    attrs, stats, achievements,
    poder: attrs.forca + attrs.furia + attrs.vigor + attrs.resiliencia, // 0-400
  };
}

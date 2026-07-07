// =====================================================================
// db.js — Camada de dados sobre IndexedDB (100% local, offline).
// Stores:
//   profile  (key 'me')           -> perfil + metas de macro
//   plan     (key 'current')      -> plano de treino editável (fase + dias)
//   sessions (key id, idx date)   -> treinos registrados (cargas)
//   foods    (key id, idx name)   -> catálogo de alimentos
//   foodlog  (key id, idx date)   -> refeições registradas
//   bodylog  (key date)           -> peso corporal por dia
//   saga     (key 'state')        -> RPG: nível/conquistas já celebrados
// =====================================================================

import { SEED_FOODS, SEED_PLANS } from "./data.js";

const DB_NAME = "plano-eric";
const DB_VERSION = 2;
let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains("profile")) db.createObjectStore("profile", { keyPath: "id" });
      if (!db.objectStoreNames.contains("plan")) db.createObjectStore("plan", { keyPath: "id" });
      if (!db.objectStoreNames.contains("sessions")) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("date", "date");
      }
      if (!db.objectStoreNames.contains("foods")) {
        const f = db.createObjectStore("foods", { keyPath: "id" });
        f.createIndex("name", "name");
      }
      if (!db.objectStoreNames.contains("foodlog")) {
        const l = db.createObjectStore("foodlog", { keyPath: "id" });
        l.createIndex("date", "date");
      }
      if (!db.objectStoreNames.contains("bodylog")) db.createObjectStore("bodylog", { keyPath: "date" });
      if (!db.objectStoreNames.contains("saga")) db.createObjectStore("saga", { keyPath: "id" });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = "readonly") {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}
function done(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

export async function get(store, key) { return done((await tx(store)).get(key)); }
export async function getAll(store) { return done((await tx(store)).getAll()); }
export async function put(store, value) { return done((await tx(store, "readwrite")).put(value)); }
export async function del(store, key) { return done((await tx(store, "readwrite")).delete(key)); }
export async function clearStore(store) { return done((await tx(store, "readwrite")).clear()); }

export async function getByIndex(store, index, value) {
  const os = await tx(store);
  return done(os.index(index).getAll(value));
}

// gera id curto único o suficiente para uso pessoal
export function uid() {
  return "x" + performance.now().toString(36).replace(".", "") + Math.floor(performance.timeOrigin % 100000).toString(36);
}

// ---------------------------------------------------------------------
// Seed inicial (1ª abertura): metas calculadas, plano e alimentos.
// ---------------------------------------------------------------------
export function calcGoals(profile) {
  const { weightKg, heightCm, age, sex, activity, goal, manual, kcal, p, c, f } = profile;
  if (manual) return { kcal, p, c, f };
  // Mifflin-St Jeor
  const s = sex === "f" ? -161 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s;
  const tdee = bmr * (activity || 1.6);
  const surplus = goal === "bulk" ? 350 : goal === "cut" ? -400 : 0;
  const kcalT = Math.round((tdee + surplus) / 10) * 10;
  const pT = Math.round(weightKg * 2.0);            // 2 g/kg
  const fT = Math.round(weightKg * 0.9);            // ~0.9 g/kg
  const cT = Math.max(0, Math.round((kcalT - pT * 4 - fT * 9) / 4));
  return { kcal: kcalT, p: pT, c: cT, f: fT };
}

export async function ensureSeed() {
  await openDB();
  // Perfil
  let profile = await get("profile", "me");
  if (!profile) {
    profile = {
      id: "me", name: "Eric",
      weightKg: 62, heightCm: 175, age: 25, sex: "m",
      activity: 1.6, goal: "bulk", manual: false,
    };
    const g = calcGoals(profile);
    profile = { ...profile, ...g };
    await put("profile", profile);
  }
  // Plano
  const plan = await get("plan", "current");
  if (!plan) {
    await put("plan", { id: "current", phase: "A", plans: structuredClone(SEED_PLANS) });
  }
  // Alimentos
  const foods = await getAll("foods");
  if (!foods.length) {
    for (const food of SEED_FOODS) {
      await put("foods", { id: uid(), custom: false, ...food });
    }
  }
}

// ---------------------------------------------------------------------
// Backup / restauração (export-import JSON)
// ---------------------------------------------------------------------
export async function exportAll() {
  return {
    _app: "plano-eric", _version: DB_VERSION, _exportedAt: new Date().toISOString(),
    profile: await getAll("profile"),
    plan: await getAll("plan"),
    sessions: await getAll("sessions"),
    foods: await getAll("foods"),
    foodlog: await getAll("foodlog"),
    bodylog: await getAll("bodylog"),
    saga: await getAll("saga"),
  };
}

export async function importAll(data) {
  const stores = ["profile", "plan", "sessions", "foods", "foodlog", "bodylog", "saga"];
  for (const s of stores) {
    if (!Array.isArray(data[s])) continue;
    await clearStore(s);
    for (const row of data[s]) await put(s, row);
  }
}

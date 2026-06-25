// =====================================================================
// data.js — Dados-semente (seed): base de alimentos BR + plano de treino
// Tudo é copiado para o IndexedDB no primeiro uso e fica EDITÁVEL.
// Valores de alimentos: aproximados da TACO/TBCA, por 100 g salvo indicação.
// =====================================================================

// ---------------------------------------------------------------------
// ALIMENTOS
// per: "100g"  -> macros são por 100 g; quantidade registrada em gramas
// per: "unid"  -> macros são por 1 unidade; unitGrams = peso médio da unidade
// macros = { kcal, p (proteína g), c (carbo g), f (gordura g) }
// ---------------------------------------------------------------------
export const SEED_FOODS = [
  // --- Proteínas principais ---
  { name: "Frango grelhado (peito)", group: "Proteína", per: "100g", kcal: 165, p: 31, c: 0, f: 3.6 },
  { name: "Frango cru (peito)",       group: "Proteína", per: "100g", kcal: 113, p: 21.5, c: 0, f: 2.5 },
  { name: "Ovo de galinha",           group: "Proteína", per: "unid", unitGrams: 50, kcal: 72, p: 6.3, c: 0.4, f: 4.8 },
  { name: "Clara de ovo",             group: "Proteína", per: "unid", unitGrams: 33, kcal: 17, p: 3.6, c: 0.2, f: 0.1 },
  { name: "Carne moída patinho (cozida)", group: "Proteína", per: "100g", kcal: 219, p: 27, c: 0, f: 12 },
  { name: "Carne bovina (acém cozido)",   group: "Proteína", per: "100g", kcal: 215, p: 26, c: 0, f: 12 },
  { name: "Tilápia grelhada",         group: "Proteína", per: "100g", kcal: 128, p: 26, c: 0, f: 2.7 },
  { name: "Atum em água (lata)",      group: "Proteína", per: "100g", kcal: 116, p: 26, c: 0, f: 1 },
  { name: "Sardinha (lata)",          group: "Proteína", per: "100g", kcal: 208, p: 24, c: 0, f: 12 },
  { name: "Patinho moído cru",        group: "Proteína", per: "100g", kcal: 137, p: 21.3, c: 0, f: 5.4 },
  { name: "Coxa de frango (cozida)",  group: "Proteína", per: "100g", kcal: 215, p: 26, c: 0, f: 12 },

  // --- Laticínios / suplementos ---
  { name: "Whey protein (dose)",      group: "Suplemento", per: "unid", unitGrams: 30, kcal: 120, p: 24, c: 3, f: 1.5 },
  { name: "Creatina (3 g)",           group: "Suplemento", per: "unid", unitGrams: 3, kcal: 0, p: 0, c: 0, f: 0 },
  { name: "Iogurte natural integral", group: "Laticínio", per: "100g", kcal: 51, p: 4, c: 4.7, f: 1.5 },
  { name: "Iogurte desnatado",        group: "Laticínio", per: "100g", kcal: 41, p: 4.4, c: 5.8, f: 0.1 },
  { name: "Leite integral",           group: "Laticínio", per: "100g", kcal: 61, p: 3.2, c: 4.6, f: 3.3 },
  { name: "Leite desnatado",          group: "Laticínio", per: "100g", kcal: 35, p: 3.4, c: 5, f: 0.1 },
  { name: "Queijo minas frescal",     group: "Laticínio", per: "100g", kcal: 264, p: 17, c: 3, f: 20 },
  { name: "Requeijão",                group: "Laticínio", per: "100g", kcal: 257, p: 9, c: 4, f: 23 },
  { name: "Cottage",                  group: "Laticínio", per: "100g", kcal: 98, p: 11, c: 3.4, f: 4.3 },

  // --- Carboidratos ---
  { name: "Arroz branco cozido",      group: "Carboidrato", per: "100g", kcal: 128, p: 2.5, c: 28, f: 0.2 },
  { name: "Arroz integral cozido",    group: "Carboidrato", per: "100g", kcal: 124, p: 2.6, c: 26, f: 1 },
  { name: "Feijão carioca cozido",    group: "Carboidrato", per: "100g", kcal: 76, p: 4.8, c: 13.6, f: 0.5 },
  { name: "Feijão preto cozido",      group: "Carboidrato", per: "100g", kcal: 77, p: 4.5, c: 14, f: 0.5 },
  { name: "Batata doce cozida",       group: "Carboidrato", per: "100g", kcal: 77, p: 0.6, c: 18, f: 0.1 },
  { name: "Batata inglesa cozida",    group: "Carboidrato", per: "100g", kcal: 52, p: 1.2, c: 11.9, f: 0.1 },
  { name: "Mandioca cozida",          group: "Carboidrato", per: "100g", kcal: 125, p: 0.6, c: 30, f: 0.3 },
  { name: "Macarrão cozido",          group: "Carboidrato", per: "100g", kcal: 157, p: 5.8, c: 30, f: 0.9 },
  { name: "Pão integral (fatia)",     group: "Carboidrato", per: "unid", unitGrams: 25, kcal: 65, p: 2.5, c: 12, f: 1 },
  { name: "Pão francês (unid)",       group: "Carboidrato", per: "unid", unitGrams: 50, kcal: 150, p: 4, c: 30, f: 1.5 },
  { name: "Tapioca (goma)",           group: "Carboidrato", per: "100g", kcal: 240, p: 0, c: 60, f: 0 },
  { name: "Aveia em flocos",          group: "Carboidrato", per: "100g", kcal: 394, p: 13.9, c: 67, f: 8.5 },
  { name: "Cuscuz (milho cozido)",    group: "Carboidrato", per: "100g", kcal: 113, p: 2.2, c: 25, f: 0.7 },
  { name: "Granola",                  group: "Carboidrato", per: "100g", kcal: 471, p: 10, c: 64, f: 18 },

  // --- Frutas ---
  { name: "Banana",                   group: "Fruta", per: "unid", unitGrams: 100, kcal: 89, p: 1.1, c: 23, f: 0.3 },
  { name: "Maçã",                     group: "Fruta", per: "unid", unitGrams: 130, kcal: 68, p: 0.3, c: 18, f: 0.2 },
  { name: "Mamão (fatia)",            group: "Fruta", per: "100g", kcal: 40, p: 0.5, c: 10, f: 0.1 },
  { name: "Laranja",                  group: "Fruta", per: "unid", unitGrams: 180, kcal: 85, p: 1.7, c: 21, f: 0.2 },
  { name: "Morango",                  group: "Fruta", per: "100g", kcal: 32, p: 0.7, c: 7.7, f: 0.3 },
  { name: "Abacate",                  group: "Fruta", per: "100g", kcal: 96, p: 1.2, c: 6, f: 8.4 },
  { name: "Uva",                      group: "Fruta", per: "100g", kcal: 69, p: 0.7, c: 18, f: 0.2 },

  // --- Gorduras / oleaginosas ---
  { name: "Azeite de oliva",          group: "Gordura", per: "100g", kcal: 884, p: 0, c: 0, f: 100 },
  { name: "Pasta de amendoim",        group: "Gordura", per: "100g", kcal: 588, p: 25, c: 20, f: 50 },
  { name: "Amendoim",                 group: "Gordura", per: "100g", kcal: 567, p: 26, c: 16, f: 49 },
  { name: "Castanha de caju",         group: "Gordura", per: "100g", kcal: 553, p: 18, c: 30, f: 44 },
  { name: "Castanha do Pará",         group: "Gordura", per: "100g", kcal: 656, p: 14, c: 12, f: 66 },

  // --- Vegetais ---
  { name: "Brócolis cozido",          group: "Vegetal", per: "100g", kcal: 35, p: 2.4, c: 7, f: 0.4 },
  { name: "Tomate",                   group: "Vegetal", per: "100g", kcal: 18, p: 0.9, c: 3.9, f: 0.2 },
  { name: "Alface",                   group: "Vegetal", per: "100g", kcal: 15, p: 1.4, c: 2.9, f: 0.2 },
  { name: "Cenoura crua",             group: "Vegetal", per: "100g", kcal: 41, p: 0.9, c: 10, f: 0.2 },
];

// ---------------------------------------------------------------------
// TREINO — Plano do HTML, em duas fases. Cada dia tem exercícios.
// type: "strength" (registra peso×reps) | "cardio" (registra duração)
// ---------------------------------------------------------------------
const ex = (name, sets, reps) => ({ name, sets, reps, type: "strength" });
const cardio = (name, min) => ({ name, type: "cardio", duration: min });

export const SEED_PLANS = {
  A: {
    label: "Fase A · Semana 1–4 (base)",
    tip: "Volume moderado, foco em reaprender os movimentos. Descanso 60–90s entre séries.",
    days: [
      { id: "seg", dow: "SEG", color: "blue",   name: "Peito + Tríceps", sub: "Empurrar + isolamento",
        exercises: [
          ex("Supino reto (barra/haltere)", 3, "10–12"),
          ex("Supino inclinado (haltere)", 3, "10–12"),
          ex("Crucifixo (máquina/haltere)", 3, "12–15"),
          ex("Tríceps pulley/corda", 3, "12–15"),
          ex("Tríceps testa (haltere)", 2, "12"),
          cardio("Esteira leve", 15),
        ] },
      { id: "ter", dow: "TER", color: "orange", name: "Costas + Bíceps", sub: "Puxada + remada + isolamento",
        exercises: [
          ex("Puxada frontal na polia", 3, "10–12"),
          ex("Remada curvada (barra)", 3, "10–12"),
          ex("Remada unilateral (haltere)", 3, "10 cada"),
          ex("Rosca direta (barra)", 3, "10–12"),
          ex("Rosca martelo", 2, "12"),
          cardio("Bike leve", 15),
        ] },
      { id: "qua", dow: "QUA", color: "red",    name: "Pernas (completo)", sub: "Quad + posterior + panturrilha",
        exercises: [
          ex("Agachamento livre / hack squat", 4, "10–12"),
          ex("Leg press", 3, "12–15"),
          ex("Cadeira extensora", 3, "12–15"),
          ex("Mesa flexora", 3, "12–15"),
          ex("Panturrilha no leg press", 4, "15–20"),
        ] },
      { id: "qui", dow: "QUI", color: "blue",   name: "Ombros + Abdômen", sub: "Press + lateral + core",
        exercises: [
          ex("Desenvolvimento haltere sentado", 3, "10–12"),
          ex("Elevação lateral", 4, "12–15"),
          ex("Elevação frontal (haltere)", 3, "12"),
          ex("Encolhimento (trapézio)", 3, "15"),
          ex("Abdominal supra (crunch)", 3, "20"),
          ex("Prancha", 3, "30–45s"),
          cardio("Esteira moderada", 20),
        ] },
      { id: "sex", dow: "SEX", color: "orange", name: "Braços", sub: "Bíceps + tríceps isolados",
        exercises: [
          ex("Rosca concentrada", 3, "12"),
          ex("Rosca scott (máquina)", 3, "10–12"),
          ex("Rosca inversa", 2, "12"),
          ex("Tríceps francês (haltere)", 3, "12"),
          ex("Mergulho (paralelas/banco)", 3, "12–15"),
          ex("Kickback (tríceps haltere)", 2, "15"),
        ] },
    ],
  },
  B: {
    label: "Fase B · Semana 5–8 (intensidade)",
    tip: "Aumenta 1–2 séries por exercício e reduz o descanso pra 45–60s. Sobe o peso progressivamente.",
    days: [
      { id: "seg", dow: "SEG", color: "blue",   name: "Peito + Tríceps", sub: "Adiciona drop-set no último",
        exercises: [
          ex("Supino reto", 4, "8–10"),
          ex("Supino inclinado", 4, "8–10"),
          ex("Crossover / crucifixo", 3, "12 + drop"),
          ex("Tríceps pulley", 4, "12"),
          ex("Tríceps testa", 3, "10"),
          cardio("Esteira", 15),
        ] },
      { id: "ter", dow: "TER", color: "orange", name: "Costas + Bíceps", sub: "Superset bíceps no fim",
        exercises: [
          ex("Puxada frontal", 4, "8–10"),
          ex("Remada curvada", 4, "8–10"),
          ex("Remada unilateral", 3, "10 cada"),
          ex("Rosca direta + martelo (superset)", 3, "10+10"),
          ex("Rosca concentrada", 2, "12"),
          cardio("Bike", 15),
        ] },
      { id: "qua", dow: "QUA", color: "red",    name: "Pernas (volume máx.)", sub: "Adiciona afundo / stiff",
        exercises: [
          ex("Agachamento / hack squat", 4, "8–10"),
          ex("Leg press", 4, "12"),
          ex("Afundo com haltere", 3, "12 cada"),
          ex("Cadeira extensora", 3, "15"),
          ex("Mesa flexora + stiff", 3, "12 cada"),
          ex("Panturrilha", 4, "20"),
        ] },
      { id: "qui", dow: "QUI", color: "blue",   name: "Ombros + Abdômen", sub: "Adiciona voador inverso",
        exercises: [
          ex("Desenvolvimento", 4, "8–10"),
          ex("Elevação lateral", 4, "12 + drop"),
          ex("Elevação frontal", 3, "12"),
          ex("Voador inverso (post.)", 3, "12–15"),
          ex("Abdominal supra + infra", 3, "20 cada"),
          ex("Prancha lateral", 3, "30s cada"),
          cardio("Esteira", 20),
        ] },
      { id: "sex", dow: "SEX", color: "orange", name: "Braços (supersets)", sub: "Bíceps e tríceps em superset",
        exercises: [
          ex("Rosca direta + tríceps pulley (superset)", 4, "10+10"),
          ex("Rosca scott + tríceps testa (superset)", 3, "10+10"),
          ex("Rosca martelo + kickback (superset)", 3, "12+12"),
          ex("Rosca inversa", 2, "15"),
        ] },
    ],
  },
};

export const MEAL_TYPES = [
  { id: "cafe",    label: "Café da manhã", badge: "badge-orange" },
  { id: "almoco",  label: "Almoço",        badge: "badge-blue" },
  { id: "pre",     label: "Pré-treino",    badge: "badge-green" },
  { id: "pos",     label: "Pós-treino",    badge: "badge-green" },
  { id: "jantar",  label: "Jantar",        badge: "badge-blue" },
  { id: "lanche",  label: "Outro / lanche",badge: "badge-gray" },
];

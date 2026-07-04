// =====================================================================
// spartan.js — avatar guerreiro em PIXEL ART (SVG autoral, sem copyright).
// Um guerreiro espartano de frente que ganha armadura/arma/capa/aura
// conforme a patente (tier 0..7). Grade 16×22, célula 8px.
// =====================================================================

const CELL = 8, W = 16, H = 22;

// paleta
const C = {
  skin: "#C69A6D", skinSh: "#A2794F", scar: "#B32017",
  beard: "#2A231F", eye: "#0B0A08",
  cloth: "#5A4632", clothSh: "#43331F",
  bronze: "#A9762F", bronzeLit: "#C9A45C", steel: "#6E6A63",
  gold: "#C9A45C", goldLit: "#E8C97A",
  cape: "#7A1712", capeSh: "#5E100B",
  ash: "#B9B2A6", // pele do "Fantasma"
};

function px(x, y, w, h, c) {
  return `<rect x="${x * CELL}" y="${y * CELL}" width="${w * CELL}" height="${h * CELL}" fill="${c}"/>`;
}

// desenha o avatar do tier (0..7). Retorna string SVG completa.
export function spartanSVG(tier = 0, opts = {}) {
  const t = Math.max(0, Math.min(7, tier));
  const skin = t >= 6 ? C.ash : C.skin;
  const skinSh = t >= 6 ? "#948D82" : C.skinSh;
  const metal = t >= 5 ? C.goldLit : t >= 3 ? C.bronzeLit : C.bronze;
  const metalSh = t >= 5 ? C.gold : t >= 3 ? C.bronze : "#7C551F";
  const L = [];

  // ---- AURA (tier >= 5): glow radial atrás de tudo ----
  let auraDef = "";
  if (t >= 5) {
    const peak = t >= 7 ? 0.6 : 0.38;
    auraDef = `<radialGradient id="aura" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#E8C97A" stop-opacity="${peak}"/>
      <stop offset="45%" stop-color="#E8C97A" stop-opacity="${peak * 0.4}"/>
      <stop offset="100%" stop-color="#E8C97A" stop-opacity="0"/>
    </radialGradient>`;
    L.push(`<circle cx="${W * CELL / 2}" cy="${10 * CELL}" r="${12 * CELL}" fill="url(#aura)"/>`);
  }

  // ---- CAPA (tier >= 3): atrás do corpo ----
  if (t >= 3) {
    L.push(px(3, 8, 10, 9, C.capeSh));
    L.push(px(4, 8, 8, 8, C.cape));
  }

  // ---- ARMA (mão direita, x ~13-14) ----
  if (t >= 1 && t <= 2) { // espada curta / lança
    L.push(px(13, 5, 1, 9, C.steel));           // haste
    L.push(px(12, 4, 3, 1, metal));             // ponta
  } else if (t >= 3) {                           // machado
    L.push(px(13, 4, 1, 11, "#4A3524"));         // cabo
    L.push(px(11, 4, 3, 3, metal));              // lâmina
    L.push(px(11, 4, 1, 3, metalSh));
    L.push(px(14, 5, 1, 2, metal));
  }
  // escudo (mão esquerda) tier 2..4
  if (t >= 2 && t <= 4) {
    L.push(px(1, 9, 3, 4, metalSh));
    L.push(px(1, 10, 3, 2, metal));
    L.push(px(2, 10, 1, 1, C.goldLit));
  }

  // ---- PERNAS ----
  L.push(px(6, 16, 2, 5, skin));
  L.push(px(9, 16, 2, 5, skin));
  L.push(px(6, 21, 2, 1, C.clothSh)); // sandálias
  L.push(px(9, 21, 2, 1, C.clothSh));
  if (t >= 4) { L.push(px(6, 16, 2, 2, metalSh)); L.push(px(9, 16, 2, 2, metalSh)); } // grevas

  // ---- TANGA / CLOTH ----
  L.push(px(5, 14, 7, 2, C.cloth));
  L.push(px(5, 15, 7, 1, C.clothSh));
  if (t >= 3) L.push(px(7, 14, 3, 2, metal)); // fivela central

  // ---- TORSO ----
  L.push(px(5, 8, 7, 6, skin));       // peito base (pele)
  L.push(px(5, 8, 1, 6, skinSh));     // sombra lateral
  if (t >= 3) {                        // peitoral de armadura
    L.push(px(5, 8, 7, 5, metalSh));
    L.push(px(5, 8, 7, 4, metal));
    L.push(px(8, 9, 1, 3, metalSh));   // linha central
    if (t >= 5) { L.push(px(6, 9, 1, 1, C.goldLit)); L.push(px(10, 9, 1, 1, C.goldLit)); }
  } else if (t >= 1) {                  // tira de couro
    L.push(px(6, 8, 1, 6, C.clothSh));
    L.push(px(9, 9, 3, 1, C.cloth));
  }
  if (t <= 2) { // abdômen definido (sem armadura)
    L.push(px(7, 11, 1, 3, skinSh));
    L.push(px(9, 11, 1, 3, skinSh));
  }

  // ---- BRAÇOS ----
  L.push(px(3, 8, 2, 5, skin)); L.push(px(3, 8, 1, 5, skinSh));
  L.push(px(11, 8, 2, 5, skin)); L.push(px(12, 8, 1, 5, skinSh));
  L.push(px(3, 13, 2, 1, skin)); L.push(px(11, 13, 2, 1, skin)); // punhos
  if (t >= 4) { L.push(px(3, 8, 2, 2, metalSh)); L.push(px(11, 8, 2, 2, metalSh)); } // ombreiras
  if (t >= 2) { L.push(px(3, 12, 2, 1, metal)); L.push(px(11, 12, 2, 1, metal)); }   // braceletes

  // ---- PESCOÇO ----
  L.push(px(7, 7, 2, 1, skin));

  // ---- CABEÇA ----
  L.push(px(5, 2, 6, 6, skin));
  L.push(px(5, 2, 1, 6, skinSh));
  // barba
  L.push(px(5, 6, 6, 2, C.beard));
  L.push(px(6, 7, 4, 1, C.beard));
  L.push(px(7, 7, 2, 1, skin)); // boca
  // olhos
  L.push(px(6, 4, 1, 1, C.eye));
  L.push(px(9, 4, 1, 1, C.eye));
  // cicatriz vermelha (marca do guerreiro) — olho esquerdo
  L.push(px(6, 2, 1, 3, C.scar));
  L.push(px(5, 3, 1, 1, C.scar));

  // ---- CABELO / ELMO ----
  if (t >= 2) {
    // elmo coríntio com crista
    L.push(px(5, 1, 6, 2, metalSh));
    L.push(px(5, 1, 6, 1, metal));
    L.push(px(5, 2, 1, 3, metal));   // protetor lateral
    L.push(px(10, 2, 1, 3, metal));
    L.push(px(7, 3, 2, 2, skin));    // abertura do rosto
    L.push(px(6, 4, 1, 1, C.eye)); L.push(px(9, 4, 1, 1, C.eye));
    // crista (vermelha, dourada no topo)
    const crest = t >= 5 ? C.goldLit : C.scar;
    L.push(px(7, -1, 2, 2, crest));
    L.push(px(6, 0, 4, 1, crest));
  } else {
    // cabelo curto/moicano
    L.push(px(5, 1, 6, 1, C.beard));
    L.push(px(7, 0, 2, 1, C.beard));
  }

  // ---- coroa/deus (tier 7) ----
  if (t >= 7) {
    L.push(px(5, -1, 6, 1, C.goldLit));
    L.push(px(6, -2, 1, 1, C.goldLit));
    L.push(px(9, -2, 1, 1, C.goldLit));
    L.push(px(7, -2, 2, 1, C.goldLit));
  }

  return `<svg viewBox="-8 -24 ${W * CELL + 16} ${H * CELL + 32}" xmlns="http://www.w3.org/2000/svg" class="spartan" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet"><defs>${auraDef}</defs>${L.join("")}</svg>`;
}

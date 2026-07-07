// =====================================================================
// charts.js — gráficos SVG mínimos, sem dependência externa (offline).
// Paleta "Cinzas e Sangue": o corpo é cinza, a força é sangue, a meta é ouro.
// =====================================================================

const C = {
  blood: "#C3271F", ash: "#A6A099", muted: "#8B857C",
  grid: "rgba(231,226,217,0.06)", text: "#E7E2D9",
  gold: "#C9A45C", goldLit: "#E8C97A",
};

// série: [{ x, y, label, pr? }] ordenada; pr=true marca o ponto com ouro
export function lineChart(series, opts = {}) {
  const w = opts.w || 560, h = opts.h || 180, pad = 28;
  if (!series.length) return emptyChart(w, h, opts.emptyMsg);
  const ys = series.map((d) => d.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const pmin = min - (max - min) * 0.1, pmax = max + (max - min) * 0.1;
  const n = series.length;
  const px = (i) => pad + (n === 1 ? (w - 2 * pad) / 2 : (i / (n - 1)) * (w - 2 * pad));
  const py = (y) => h - pad - ((y - pmin) / (pmax - pmin)) * (h - 2 * pad);

  const pts = series.map((d, i) => `${px(i)},${py(d.y)}`).join(" ");
  const area = `${pad},${h - pad} ${pts} ${px(n - 1)},${h - pad}`;
  const color = opts.color || C.blood;

  const dots = series.map((d, i) => d.pr
    ? `<circle cx="${px(i)}" cy="${py(d.y)}" r="4" fill="${C.goldLit}" stroke="${C.gold}" stroke-width="1"/>`
    : `<circle cx="${px(i)}" cy="${py(d.y)}" r="2.5" fill="${color}"/>`).join("");

  const yLabels = `
    <text x="2" y="${py(pmax) + 4}" fill="${C.muted}" font-size="10">${fmt(pmax)}</text>
    <text x="2" y="${py(pmin) + 4}" fill="${C.muted}" font-size="10">${fmt(pmin)}</text>`;
  const xLabels = `
    <text x="${px(0)}" y="${h - 8}" fill="${C.muted}" font-size="10" text-anchor="start">${series[0].label || ""}</text>
    <text x="${px(n - 1)}" y="${h - 8}" fill="${C.muted}" font-size="10" text-anchor="end">${series[n - 1].label || ""}</text>`;

  const gid = "g" + Math.abs(hash(color));
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${area}" fill="url(#${gid})"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${yLabels}${xLabels}
  </svg>`;
}

// barras: [{ label, y, on? }]  on=true acende em sangue
export function barChart(series, opts = {}) {
  const w = opts.w || 560, h = opts.h || 150, pad = 24;
  if (!series.length) return emptyChart(w, h, opts.emptyMsg);
  const max = Math.max(...series.map((d) => d.y), opts.goal || 0, 1);
  const n = series.length;
  const bw = (w - 2 * pad) / n * 0.6;
  const gap = (w - 2 * pad) / n;
  const bars = series.map((d, i) => {
    const x = pad + i * gap + (gap - bw) / 2;
    const bh = (d.y / max) * (h - 2 * pad);
    const y = h - pad - bh;
    const color = d.on ? C.blood : "rgba(179,32,23,0.26)";
    return `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(bh, 1)}" rx="2" fill="${color}"/>
      <text x="${x + bw / 2}" y="${h - 8}" fill="${C.muted}" font-size="10" text-anchor="middle">${d.label}</text>`;
  }).join("");
  let goalLine = "";
  if (opts.goal) {
    const gy = h - pad - (opts.goal / max) * (h - 2 * pad);
    goalLine = `<line x1="${pad}" y1="${gy}" x2="${w - pad}" y2="${gy}" stroke="${C.gold}" stroke-width="1" stroke-dasharray="4 4"/>
      <text x="${w - pad}" y="${gy - 4}" fill="${C.gold}" font-size="10" text-anchor="end">meta ${opts.goal}</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="xMidYMid meet">${bars}${goalLine}</svg>`;
}

function emptyChart(w, h, msg) {
  return `<svg viewBox="0 0 ${w} ${h}" class="chart"><text x="${w / 2}" y="${h / 2}" fill="${C.muted}" font-size="12" text-anchor="middle">${msg || "Sem dados ainda."}</text></svg>`;
}

function fmt(n) { return Math.round(n * 10) / 10; }
function hash(s) { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) | 0; return x; }

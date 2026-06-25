// =====================================================================
// charts.js — gráficos SVG mínimos, sem dependência externa (offline).
// =====================================================================

const C = {
  accent: "#c8f55a", muted: "#888", grid: "rgba(255,255,255,0.08)",
  text: "#f0f0f0", blue: "#5ab4ff",
};

// série: [{ x: Date|string, y: number }] já ordenada por data
export function lineChart(series, opts = {}) {
  const w = opts.w || 560, h = opts.h || 180, pad = 28;
  if (!series.length) return emptyChart(w, h);
  const ys = series.map((d) => d.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const pmin = min - (max - min) * 0.1, pmax = max + (max - min) * 0.1;
  const n = series.length;
  const px = (i) => pad + (n === 1 ? (w - 2 * pad) / 2 : (i / (n - 1)) * (w - 2 * pad));
  const py = (y) => h - pad - ((y - pmin) / (pmax - pmin)) * (h - 2 * pad);

  const pts = series.map((d, i) => `${px(i)},${py(d.y)}`).join(" ");
  const area = `${pad},${h - pad} ${pts} ${px(n - 1)},${h - pad}`;
  const color = opts.color || C.accent;

  const dots = series.map((d, i) =>
    `<circle cx="${px(i)}" cy="${py(d.y)}" r="3" fill="${color}"/>`).join("");

  // rótulos de eixo Y (min/max)
  const yLabels = `
    <text x="2" y="${py(pmax) + 4}" fill="${C.muted}" font-size="10">${fmt(pmax)}</text>
    <text x="2" y="${py(pmin) + 4}" fill="${C.muted}" font-size="10">${fmt(pmin)}</text>`;
  // rótulos X (primeiro / último)
  const xLabels = `
    <text x="${px(0)}" y="${h - 8}" fill="${C.muted}" font-size="10" text-anchor="start">${series[0].label || ""}</text>
    <text x="${px(n - 1)}" y="${h - 8}" fill="${C.muted}" font-size="10" text-anchor="end">${series[n - 1].label || ""}</text>`;

  return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${area}" fill="url(#g)"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${yLabels}${xLabels}
  </svg>`;
}

// barras: [{ label, y, on? }]  on=true destaca em accent
export function barChart(series, opts = {}) {
  const w = opts.w || 560, h = opts.h || 150, pad = 24;
  if (!series.length) return emptyChart(w, h);
  const max = Math.max(...series.map((d) => d.y), opts.goal || 0, 1);
  const n = series.length;
  const bw = (w - 2 * pad) / n * 0.6;
  const gap = (w - 2 * pad) / n;
  const bars = series.map((d, i) => {
    const x = pad + i * gap + (gap - bw) / 2;
    const bh = (d.y / max) * (h - 2 * pad);
    const y = h - pad - bh;
    const color = d.on ? C.accent : "rgba(200,245,90,0.35)";
    return `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(bh, 1)}" rx="3" fill="${color}"/>
      <text x="${x + bw / 2}" y="${h - 8}" fill="${C.muted}" font-size="10" text-anchor="middle">${d.label}</text>`;
  }).join("");
  let goalLine = "";
  if (opts.goal) {
    const gy = h - pad - (opts.goal / max) * (h - 2 * pad);
    goalLine = `<line x1="${pad}" y1="${gy}" x2="${w - pad}" y2="${gy}" stroke="${C.blue}" stroke-width="1" stroke-dasharray="4 4"/>
      <text x="${w - pad}" y="${gy - 4}" fill="${C.blue}" font-size="10" text-anchor="end">meta ${opts.goal}</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="xMidYMid meet">${bars}${goalLine}</svg>`;
}

function emptyChart(w, h) {
  return `<svg viewBox="0 0 ${w} ${h}" class="chart"><text x="${w / 2}" y="${h / 2}" fill="${C.muted}" font-size="12" text-anchor="middle">Sem dados ainda — registre pra ver o gráfico.</text></svg>`;
}

function fmt(n) { return Math.round(n * 10) / 10; }

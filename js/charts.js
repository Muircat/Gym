/*
 * charts.js — tiny dependency-free SVG line charts.
 * Colours come from CSS variables, so charts follow light/dark mode.
 */
(function (root) {
  'use strict';

  const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

  function dayNum(iso) {
    return Date.parse(iso + 'T00:00:00Z') / 86400000;
  }

  function niceLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  /**
   * series: [{ name, cls, points: [{ x: 'YYYY-MM-DD', y: number }], dots?: bool, line?: bool }]
   * opts: { unit: 'kg', decimals: 1 }
   */
  function line(series, opts = {}) {
    const W = Math.max(260, Math.round(opts.width || 640));
    const H = Math.max(180, Math.min(260, Math.round(W * 0.45)));
    const unit = opts.unit || '';
    const dp = opts.decimals == null ? 1 : opts.decimals;
    const all = series.flatMap((s) => s.points);
    if (all.length === 0) return '<p class="muted empty-chart">No data yet.</p>';

    const xs = all.map((p) => dayNum(p.x));
    const ys = all.map((p) => p.y);
    let x0 = Math.min(...xs);
    let x1 = Math.max(...xs);
    if (x0 === x1) { x0 -= 1; x1 += 1; }
    let y0 = Math.min(...ys);
    let y1 = Math.max(...ys);
    const span = y1 - y0 || Math.max(1, Math.abs(y1) * 0.05);
    y0 -= span * 0.15;
    y1 += span * 0.15;

    const sx = (v) => PAD.left + ((v - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
    const sy = (v) => H - PAD.bottom - ((v - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom);

    const ticks = [0, 0.5, 1].map((t) => y0 + (y1 - y0) * t);
    const grid = ticks
      .map((v) => `<line class="grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${sy(v)}" y2="${sy(v)}"/>
        <text class="axis" x="${PAD.left - 6}" y="${sy(v) + 4}" text-anchor="end">${v.toFixed(dp)}</text>`)
      .join('');

    const firstDate = all.reduce((a, p) => (p.x < a ? p.x : a), all[0].x);
    const lastDate = all.reduce((a, p) => (p.x > a ? p.x : a), all[0].x);
    const xLabels = `
      <text class="axis" x="${PAD.left}" y="${H - 8}" text-anchor="start">${niceLabel(firstDate)}</text>
      ${lastDate !== firstDate ? `<text class="axis" x="${W - PAD.right}" y="${H - 8}" text-anchor="end">${niceLabel(lastDate)}</text>` : ''}`;

    const paths = series
      .map((s) => {
        const pts = s.points.slice().sort((a, b) => a.x.localeCompare(b.x));
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(dayNum(p.x)).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
        const path = s.line === false || pts.length < 2 ? '' : `<path class="series ${s.cls}" d="${d}"/>`;
        const dots = s.dots === false ? '' : pts
          .map((p) => `<circle class="dot ${s.cls}" cx="${sx(dayNum(p.x))}" cy="${sy(p.y)}" r="3.5"><title>${niceLabel(p.x)}: ${p.y.toFixed(dp)} ${unit}</title></circle>`)
          .join('');
        return path + dots;
      })
      .join('');

    const legend = series.length > 1
      ? `<div class="legend">${series.map((s) => `<span><i class="sw ${s.cls}"></i>${s.name}</span>`).join('')}</div>`
      : '';

    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${series.map((s) => s.name).join(', ')}">${grid}${xLabels}${paths}</svg>${legend}`;
  }

  const Charts = { line };
  if (typeof module !== 'undefined' && module.exports) module.exports = Charts;
  else root.Charts = Charts;
})(typeof window !== 'undefined' ? window : globalThis);

// Shared look for the p5 explainer: a light technical drawing. Thin ink lines, crosshair markers,
// small mono readouts, and the paper's three accent colours. Everything is drawn in screen space
// through a camera that maps diagram units (du) to pixels, so strokes and text stay crisp at any zoom.

export const INK = [27, 31, 39];
export const MUTED = [107, 116, 132];
export const FAINT = [214, 219, 227];
export const HUMAN = [74, 58, 167];      // human data
export const POLICY = [42, 120, 214];    // learned policy / ours
export const CORRECTION = [235, 104, 52]; // operator correction
export const SANS = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Arial, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
/** 0 before `start`, 1 after `start + span`, smooth in between. */
export const ramp = (x, start, span = 0.6) => smooth((x - start) / span);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Maps diagram units to screen pixels: a uniform scale plus an offset. */
export class Camera {
  constructor() { this.scale = 1; this.ox = 0; this.oy = 0; }

  /** Fit the world rect [x0, y0, x1, y1] into a w × h viewport with padding; `top` keeps clear of overlays. */
  static fit([x0, y0, x1, y1], w, h, pad = 28, top = 60) {
    const cam = new Camera();
    cam.w = w; cam.h = h;
    cam.scale = Math.min((w - 2 * pad) / (x1 - x0), (h - pad - top) / (y1 - y0));
    cam.ox = w / 2 - cam.scale * (x0 + x1) / 2;
    cam.oy = (top + h - pad) / 2 - cam.scale * (y0 + y1) / 2;
    return cam;
  }

  /** Blend two cameras; scale blends geometrically so zooms feel even. */
  static mix(a, b, t) {
    const cam = new Camera();
    cam.scale = Math.exp(lerp(Math.log(a.scale), Math.log(b.scale), t));
    // Keep the blended view centred on the blended world centre.
    const ca = [(a.w / 2 - a.ox) / a.scale, (a.h / 2 - a.oy) / a.scale];
    const cb = [(b.w / 2 - b.ox) / b.scale, (b.h / 2 - b.oy) / b.scale];
    const cx = lerp(ca[0], cb[0], t); const cy = lerp(ca[1], cb[1], t);
    cam.w = a.w; cam.h = a.h;
    cam.ox = a.w / 2 - cam.scale * cx;
    cam.oy = a.h / 2 - cam.scale * cy;
    return cam;
  }

  x(u) { return this.ox + this.scale * u; }
  y(v) { return this.oy + this.scale * v; }
}

export function rgba(c, a = 1) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

/** Text in screen space. `opts`: size, color, alpha, align ('left'|'center'|'right'), mono, weight, baseline. */
export function label(p, str, x, y, opts = {}) {
  const { size = 12, color = INK, alpha = 1, align = 'center', mono = false, weight = 400, baseline = 'middle' } = opts;
  if (alpha <= 0.01) return;
  const ctx = p.drawingContext;
  ctx.font = `${weight} ${size}px ${mono ? MONO : SANS}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(str, x, y);
}

/** Two-line annotation: bold title, muted detail. */
export function caption(p, title, detail, x, y, opts = {}) {
  const { alpha = 1, color = INK, align = 'center', size = 13 } = opts;
  label(p, title, x, y, { size, color, alpha, align, weight: 600 });
  if (detail) label(p, detail, x, y + size + 4, { size: size - 2, color: MUTED, alpha, align });
}

export function line(p, x1, y1, x2, y2, color = INK, alpha = 1, weight = 1, dash = null) {
  if (alpha <= 0.01) return;
  const ctx = p.drawingContext;
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = weight;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

export function arrow(p, x1, y1, x2, y2, color = INK, alpha = 1, weight = 1.2) {
  if (alpha <= 0.01) return;
  line(p, x1, y1, x2, y2, color, alpha, weight);
  const a = Math.atan2(y2 - y1, x2 - x1); const s = 7;
  const ctx = p.drawingContext;
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4));
  ctx.lineTo(x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
}

/** A crosshair ring marking a tracked point. */
export function marker(p, x, y, r, color, alpha = 1) {
  if (alpha <= 0.01) return;
  const ctx = p.drawingContext;
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, Math.PI * 2); ctx.fill();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath(); ctx.moveTo(x + dx * r * 1.25, y + dy * r * 1.25); ctx.lineTo(x + dx * r * 1.8, y + dy * r * 1.8); ctx.stroke();
  }
  ctx.restore();
}

/** Corner brackets around a rect: the explainer's "figure frame". */
export function brackets(p, x, y, w, h, len = 12, color = MUTED, alpha = 0.7) {
  const ctx = p.drawingContext;
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = 1;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + sx * len, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * len); ctx.stroke();
  }
  ctx.restore();
}

export function rect(p, x, y, w, h, { fill = null, stroke = null, alpha = 1, radius = 3, weight = 1 } = {}) {
  if (alpha <= 0.01) return;
  const ctx = p.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  if (fill) { ctx.fillStyle = rgba(fill, alpha * (fill[3] ?? 1)); ctx.fill(); }
  if (stroke) { ctx.strokeStyle = rgba(stroke, alpha); ctx.lineWidth = weight; ctx.stroke(); }
  ctx.restore();
}

/** Quadratic bezier helper for streams: returns [x, y] at u. */
export function bezier2(a, c, b, u) {
  const v = 1 - u;
  return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]];
}

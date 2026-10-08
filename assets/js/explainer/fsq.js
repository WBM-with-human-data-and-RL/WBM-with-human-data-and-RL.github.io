// SONIC's FSQ action space, drawn from the real codes of the demonstration in part 1.
// Every one of the 64 latent dimensions is a scalar snapped to a 1/16 lattice, so over time each
// dimension traces a staircase; at any instant the code is 64 signed values on that lattice.
import { FAINT, INK, MUTED, POLICY, label, line, rgba } from './draw.js';

/** Code row (50 Hz) for time t, looping over the 8 s window shared with the G1 render. */
export function rowAt(fsq, t) {
  const d = fsq.rows / fsq.hz;
  return Math.floor((((t % d) + d) % d) * fsq.hz) % fsq.rows;
}

const fmt = (k, step) => `${k > 0 ? '+' : k < 0 ? '−' : ' '}${Math.abs(k * step).toFixed(3)}`;

/** Per-dimension level range over the whole window (lattice units), padded by one level. */
function range(fsq, dim) {
  let lo = Infinity; let hi = -Infinity;
  for (const row of fsq.codes) { lo = Math.min(lo, row[dim]); hi = Math.max(hi, row[dim]); }
  return [lo - 1, hi + 1];
}

/**
 * Staircase for one dimension over rows [r0, r0 + n), in the box (x, y, w, h).
 * `style(i)` returns [color, alpha, dash] for step i, so a chunk can mark its executed half.
 */
export function staircase(p, cam, fsq, dim, r0, n, box, style, alpha) {
  const [lo, hi] = range(fsq, dim);
  const { x, y, w, h } = box;
  const lv = (k) => y + h - ((k - lo) / (hi - lo)) * h;
  for (let k = lo + 1; k < hi; k += 1) line(p, cam.x(x), cam.y(lv(k)), cam.x(x + w), cam.y(lv(k)), FAINT, alpha * 0.8, 1);
  const ctx = p.drawingContext;
  const col = w / n;
  let start = 0;
  // Draw runs of equal style as single paths: flat treads joined by vertical risers.
  while (start < n) {
    const [color, a, dash] = style(start);
    let end = start;
    while (end + 1 < n && style(end + 1)[0] === color && style(end + 1)[2] === dash) end += 1;
    ctx.save();
    ctx.strokeStyle = rgba(color, a * alpha); ctx.lineWidth = 1.6; ctx.lineJoin = 'miter';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = start; i <= end + 1 && i <= n; i += 1) {
      const k = fsq.codes[(r0 + Math.min(i, n - 1)) % fsq.rows][dim];
      const px = cam.x(x + i * col); const py = cam.y(lv(k));
      if (i === start) ctx.moveTo(px, py);
      else {
        const prev = fsq.codes[(r0 + i - 1) % fsq.rows][dim];
        ctx.lineTo(px, cam.y(lv(prev)));
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke(); ctx.restore();
    start = end + 1;
  }
  return lv;
}

/**
 * Part-1 instrument: the full 64-D code at this instant as a signed spectrum on the lattice, and
 * 3 s of history for the most active dimensions as staircases, each with its live value.
 */
export function drawFsqPanel(p, cam, fsq, time, alpha, { x, y, w }) {
  if (alpha <= 0.01) return;
  const now = rowAt(fsq, time);
  const code = fsq.codes[now];
  const { step } = fsq;

  // Spectrum: 64 signed bars around zero.
  const sh = 46; const zero = y + sh;
  const unit = sh / 14; // 14 lattice steps (0.875) to the edge
  for (const v of [-8, -4, 4, 8]) {
    line(p, cam.x(x), cam.y(zero - v * unit), cam.x(x + w), cam.y(zero - v * unit), FAINT, alpha, 1, [2, 3]);
  }
  label(p, '+0.5', cam.x(x - 4), cam.y(zero - 8 * unit), { size: 9, mono: true, color: MUTED, align: 'right', alpha });
  label(p, '−0.5', cam.x(x - 4), cam.y(zero + 8 * unit), { size: 9, mono: true, color: MUTED, align: 'right', alpha });
  line(p, cam.x(x), cam.y(zero), cam.x(x + w), cam.y(zero), INK, alpha * 0.5, 1);
  const bw = w / fsq.dims;
  const ctx = p.drawingContext;
  for (let d = 0; d < fsq.dims; d += 1) {
    const tracked = fsq.tracks.includes(d);
    ctx.fillStyle = rgba(tracked ? POLICY : MUTED, alpha * (tracked ? 1 : 0.55));
    const v = code[d];
    const top = cam.y(zero - Math.max(v, 0) * unit);
    ctx.fillRect(cam.x(x + d * bw) + 0.5, top, Math.max(1, bw * cam.scale - 1.2), Math.max(1, Math.abs(v) * unit * cam.scale));
  }
  label(p, 'all 64 dimensions · now', cam.x(x + w), cam.y(y - 10), { size: 9.5, mono: true, color: MUTED, align: 'right', alpha });
  label(p, `t = ${(now / fsq.hz).toFixed(2)} s`, cam.x(x), cam.y(y - 10), { size: 9.5, mono: true, color: MUTED, align: 'left', alpha });

  // Tracks: 3 s of history per active dimension; the newest value sits at the right edge.
  const history = 3 * fsq.hz;
  const th = 34; const tg = 10; const t0 = zero + sh + 34;
  label(p, 'last 3 s · 6 most active dims', cam.x(x), cam.y(t0 - 12), { size: 9.5, mono: true, color: MUTED, align: 'left', alpha });
  fsq.tracks.forEach((dim, i) => {
    const box = { x, y: t0 + i * (th + tg), w: w - 52, h: th };
    const r0 = (now - history + 1 + fsq.rows) % fsq.rows;
    const lv = staircase(p, cam, fsq, dim, r0, history, box, () => [POLICY, 1, null], alpha);
    const k = code[dim];
    ctx.fillStyle = rgba(POLICY, alpha);
    ctx.beginPath(); ctx.arc(cam.x(box.x + box.w), cam.y(lv(k)), 3, 0, Math.PI * 2); ctx.fill();
    label(p, `d${dim}`, cam.x(x - 4), cam.y(box.y + th / 2), { size: 9.5, mono: true, color: MUTED, align: 'right', alpha });
    label(p, fmt(k, step), cam.x(box.x + box.w + 8), cam.y(lv(k)), { size: 10, mono: true, color: POLICY, align: 'left', alpha });
  });
}

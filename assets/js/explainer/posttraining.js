// Part 3 of the explainer: the human-in-the-loop offline-RL loop, the shrinking takeovers, and
// the results it buys (before/after success bars, from the manuscript's numbers in data.js).
import { BEFORE_AFTER, pct } from '../data.js';
import { CORRECTION, FAINT, HUMAN, INK, MUTED, POLICY, caption, label, line, ramp, rect, rgba, smooth } from './draw.js';

export const SHOT = [2065, 85, 3310, 600];
const LOOP = { x: 2330, y: 250, r: 112 };
const LAP_S = 2.4;
const ROUNDS = 4;
const HOLD_S = 2.0;
const NODES = [['Roll out', POLICY], ['Take over', CORRECTION], ['Fit critic (IQL)', INK], ['Post-train (AWR)', HUMAN]];
// Illustrative share of each episode under human control, per round (paper Fig. 7: about 10% early,
// under 2% after the third round).
const TAKEOVER = [[0.36, 0.47], [0.42, 0.48], [0.49, 0.51], [0.27, 0.285]];
const TIMELINE = { x: 2225, y: 480, w: 230, h: 9, gap: 24 };
const BARS = { x: 2720, base: 505, spacing: 97, height: 3.0, w: 25 };
const SHORT = ['Push door', 'Pull door', 'Toy bread', 'Empty can', '300 g cube', 'Box carry'];

export class Posttraining {
  /** @param {{ sprites: HTMLImageElement, meta: object }} robot unused here; kept for parity */
  constructor(robot) { this.robot = robot; this.loopStart = null; }

  draw(p, cam, { progress, time, still, since }) {
    const alpha = ramp(progress, 1.45, 0.5);
    if (alpha <= 0.01) { this.loopStart = null; return; }
    if (this.loopStart === null) this.loopStart = time;
    const local = still ? Infinity : time - this.loopStart;
    const cycle = ROUNDS * LAP_S + HOLD_S;
    const laps = Number.isFinite(local) ? Math.min((local % cycle) / LAP_S, ROUNDS) : ROUNDS;
    this.drawLoop(p, cam, laps, alpha);
    this.drawTimelines(p, cam, laps, alpha);
    // Bars grow once the part is reached, so the outcome lands after the loop starts.
    const grow = still ? 1 : progress > 1.8 ? ramp(since, 1.0, 1.2) : 0;
    this.drawBars(p, cam, grow, alpha);
  }

  drawLoop(p, cam, laps, alpha) {
    const { x, y, r } = LOOP;
    const ctx = p.drawingContext;
    const cx = cam.x(x); const cy = cam.y(y); const rr = r * cam.scale;
    ctx.save();
    ctx.strokeStyle = rgba(FAINT, alpha); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    const done = laps >= ROUNDS;
    const frac = done ? 1 : laps % 1;
    ctx.strokeStyle = rgba(INK, 0.8 * alpha); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    ctx.restore();
    const active = done ? -1 : Math.floor(frac * 4 + 0.5) % 4;
    NODES.forEach(([name, color], i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 2;
      const nx = cx + rr * Math.cos(a); const ny = cy + rr * Math.sin(a);
      ctx.save();
      ctx.fillStyle = rgba(i === active ? color : [255, 255, 255], alpha);
      ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(nx, ny, (i === active ? 8 : 6), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      const out = 16;
      label(p, name, nx + out * Math.cos(a) * (i % 2 ? 1 : 0), ny + (i % 2 ? 0 : 22 * Math.sin(a)),
        { size: 12, weight: 600, color, alpha, align: i === 1 ? 'left' : i === 3 ? 'right' : 'center' });
    });
    const round = done ? ROUNDS : Math.floor(laps) + 1;
    // Robot data accumulates each round and is always trained together with the human data.
    caption(p, done ? '4 rounds × 5 min' : `Round ${round} of 4`,
      done ? '= 20 min robot data' : `${5 * round} min robot data`, cx, cy - 12, { alpha, size: 14 });
    label(p, '+ human data', cx, cy + 22, { size: 11, color: MUTED, alpha: done ? 0 : alpha });
  }

  drawTimelines(p, cam, laps, alpha) {
    const { x, y, w, h, gap } = TIMELINE;
    label(p, 'HUMAN TAKEOVER PER ROUND · illustrative', cam.x(x), cam.y(y - 22), { size: 10, mono: true, color: MUTED, align: 'left', alpha });
    TAKEOVER.forEach(([a, b], i) => {
      const shown = (laps >= ROUNDS || i < Math.floor(laps) + 1 ? 1 : 0.15) * alpha;
      const yy = y + i * gap;
      label(p, `R${i + 1}`, cam.x(x - 10), cam.y(yy + h / 2), { size: 10, mono: true, color: MUTED, align: 'right', alpha: shown });
      rect(p, cam.x(x), cam.y(yy), w * cam.scale, h * cam.scale, { fill: POLICY, alpha: shown * 0.85, radius: 2 });
      rect(p, cam.x(x + a * w), cam.y(yy - 2), Math.max(2, (b - a) * w * cam.scale), (h + 4) * cam.scale, { fill: CORRECTION, alpha: shown, radius: 1 });
      const share = b - a;
      label(p, `${share < 0.02 ? '<2' : Math.round(share * 100)}%`, cam.x(x + w + 10), cam.y(yy + h / 2),
        { size: 10.5, mono: true, color: CORRECTION, align: 'left', alpha: shown });
    });
  }

  drawBars(p, cam, grow, alpha) {
    const { x, base, spacing, height, w } = BARS;
    caption(p, 'Success at unseen sites (%)', null, cam.x(x + spacing * 2.6), cam.y(base - 100 * height - 52), { alpha });
    const legendY = cam.y(base - 100 * height - 30);
    [['pretraining only', CORRECTION, 0.85], ['+ 20 min post-training', POLICY, 2.95]].forEach(([text, color, k]) => {
      const lx = cam.x(x + spacing * k);
      rect(p, lx, legendY - 4, 8, 8, { fill: color, alpha, radius: 1 });
      label(p, text, lx + 13, legendY, { size: 11, color: MUTED, align: 'left', alpha });
    });
    line(p, cam.x(x - 30), cam.y(base), cam.x(x + spacing * 5.6), cam.y(base), INK, 0.5 * alpha, 1);
    for (const v of [50, 100]) {
      line(p, cam.x(x - 30), cam.y(base - v * height), cam.x(x + spacing * 5.6), cam.y(base - v * height), FAINT, alpha, 1, [3, 4]);
      label(p, `${v}`, cam.x(x - 36), cam.y(base - v * height), { size: 10, mono: true, color: MUTED, align: 'right', alpha });
    }
    BEFORE_AFTER.unseen.forEach((row, i) => {
      const k = Math.max(0, Math.min(1, grow * 1.5 - i * 0.08));
      const cx = x + i * spacing;
      [[row.before, CORRECTION, -w / 2 - 2, 1], [row.after, POLICY, w / 2 + 2, smooth((k - 0.35) / 0.65)]].forEach(([s, color, dx, g]) => {
        const v = pct(s);
        const hh = v * height * k * g;
        rect(p, cam.x(cx + dx - w / 2), cam.y(base - hh), w * cam.scale, Math.max(1, hh * cam.scale), { fill: color, alpha, radius: 2 });
        label(p, `${v}`, cam.x(cx + dx), cam.y(base - hh - 9), { size: 10.5, mono: true, color, alpha: alpha * (g > 0.98 ? 1 : 0) });
      });
      label(p, SHORT[i], cam.x(cx), cam.y(base + 16), { size: 11, color: MUTED, alpha });
    });
  }
}

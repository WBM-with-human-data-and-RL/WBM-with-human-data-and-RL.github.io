// Intro backdrop (p5.js): a fine dot grid that leans toward the cursor, faint three-point
// trajectories drifting through the margins (head + two grippers, as in the human data), and a
// viewfinder around the supplementary video with a timecode and a progress scale synced to playback.
import { HUMAN, INK, MUTED, POLICY, label, line, rgba } from './explainer/draw.js';

const GRID = 26;
const TRACKS = 18;
const TRACE = 90;

function timecode(seconds) {
  if (!Number.isFinite(seconds)) return '--:--.-';
  const m = Math.floor(seconds / 60); const s = seconds - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

/**
 * @param {HTMLElement} host section the canvas fills
 * @param {HTMLVideoElement} video the teaser, framed by the viewfinder
 */
export function mountHero(host, video) {
  if (!window.p5) return null;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return new window.p5((p) => {
    let tracks = [];
    const mouse = { x: -999, y: -999 };

    const seedTracks = () => {
      tracks = Array.from({ length: TRACKS }, (_, i) => ({
        y: p.random(0.08, 0.92), speed: p.random(0.25, 0.6), phase: p.random(1000),
        side: i % 2 ? 1 : -1, color: i % 3 === 0 ? POLICY : HUMAN,
      }));
    };

    p.setup = () => {
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      const c = p.createCanvas(host.clientWidth, host.clientHeight);
      c.parent(host);
      c.elt.setAttribute('aria-hidden', 'true');
      seedTracks();
      if (still) p.noLoop();
    };
    p.windowResized = () => { p.resizeCanvas(host.clientWidth, host.clientHeight); p.redraw(); };
    host.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    host.addEventListener('pointerleave', () => { mouse.x = -999; mouse.y = -999; });

    p.draw = () => {
      p.clear();
      const ctx = p.drawingContext;
      const t = p.millis() / 1000;
      const v = video.getBoundingClientRect(); const h = host.getBoundingClientRect();
      const box = { x: v.left - h.left, y: v.top - h.top, w: v.width, h: v.height };

      // Dot grid; dots near the cursor grow and darken slightly.
      for (let x = GRID / 2; x < p.width; x += GRID) {
        for (let y = GRID / 2; y < p.height; y += GRID) {
          const d = Math.hypot(x - mouse.x, y - mouse.y);
          const k = Math.max(0, 1 - d / 160);
          ctx.fillStyle = rgba(k > 0 ? HUMAN : MUTED, 0.16 + 0.4 * k);
          const s = 1.1 + 1.4 * k;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }

      // Three-point trajectories in the margins, kept away from the title and video.
      const margin = Math.max(40, box.x - 24);
      for (const tr of tracks) {
        const pts = [];
        for (let k = 0; k < TRACE; k += 1) {
          const u = k / (TRACE - 1);
          const x = tr.side < 0 ? u * margin : p.width - u * margin;
          const n = p.noise(tr.phase + u * 1.6, t * 0.08 * tr.speed);
          pts.push([x, tr.y * p.height + (n - 0.5) * 120]);
        }
        for (const off of [-9, 0, 9]) { // head and two grippers move as one
          ctx.strokeStyle = rgba(tr.color, off ? 0.1 : 0.18); ctx.lineWidth = 1;
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y + off) : ctx.moveTo(x, y + off)));
          ctx.stroke();
        }
        const head = pts[Math.floor(((t * tr.speed * 0.15 + tr.phase) % 1) * (TRACE - 1))];
        ctx.fillStyle = rgba(tr.color, 0.55);
        for (const off of [-9, 0, 9]) { ctx.beginPath(); ctx.arc(head[0], head[1] + off, 1.8, 0, Math.PI * 2); ctx.fill(); }
      }

      // Viewfinder: corner brackets, a progress scale and a timecode under the video.
      const L = 18; ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = 1.2;
      for (const [cx, cy, sx, sy] of [[box.x, box.y, 1, 1], [box.x + box.w, box.y, -1, 1], [box.x, box.y + box.h, 1, -1], [box.x + box.w, box.y + box.h, -1, -1]]) {
        ctx.beginPath(); ctx.moveTo(cx - sx * 10 + sx * L, cy - sy * 10); ctx.lineTo(cx - sx * 10, cy - sy * 10); ctx.lineTo(cx - sx * 10, cy - sy * 10 + sy * L); ctx.stroke();
      }
      const y = box.y + box.h + 22;
      const frac = video.duration ? video.currentTime / video.duration : 0;
      line(p, box.x, y, box.x + box.w, y, MUTED, 0.35, 1);
      for (let k = 0; k <= 60; k += 1) {
        const x = box.x + (box.w * k) / 60;
        line(p, x, y - (k % 10 ? 2 : 5), x, y, MUTED, 0.45, 1);
      }
      line(p, box.x, y, box.x + box.w * frac, y, POLICY, 0.9, 2);
      label(p, `SUPPLEMENTARY VIDEO  ·  ${timecode(video.currentTime)} / ${timecode(video.duration)}`, box.x, y + 16,
        { size: 10.5, mono: true, color: MUTED, align: 'left' });
    };

    // Pause the backdrop when the intro is off screen.
    if (still) video.addEventListener('timeupdate', () => p.redraw()); // keep the timecode current
    else new IntersectionObserver(([entry]) => (entry.isIntersecting ? p.loop() : p.noLoop())).observe(host);
  });
}

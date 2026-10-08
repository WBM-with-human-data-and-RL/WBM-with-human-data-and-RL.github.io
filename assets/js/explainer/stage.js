// The pipeline explainer: one p5.js sketch that scroll-steps through data preparation, pretraining
// and post-training. Drawn as a light technical figure on a world-anchored dot grid.
import { Camera, FAINT, MUTED, brackets, label, smooth } from './draw.js';
import { Pipeline, SHOTS } from './pipeline.js';
import { Posttraining, SHOT as POST_SHOT } from './posttraining.js';

const PART_SHOTS = [SHOTS.data, SHOTS.pretrain, POST_SHOT];
const PART_TITLES = ['FIG. 2a · DATA PREPARATION', 'FIG. 2b · PRETRAINING', 'FIG. 2c · POST-TRAINING'];
const BACKGROUND = [250, 250, 251];
const GRID_DU = 24;
const STILL_TIME = 2.1;

/** An image atlas (.webp) and its layout (.json), both required. */
async function loadAtlas(base) {
  const meta = await fetch(`${base}.json`).then((r) => { if (!r.ok) throw new Error(`${base}.json: HTTP ${r.status}`); return r.json(); });
  const image = new Image();
  image.src = `${base}.webp`;
  await image.decode();
  return { image, meta };
}

function drawDotGrid(p, cam) {
  const step = GRID_DU * cam.scale;
  if (step < 6) return;
  const ctx = p.drawingContext;
  const u0 = Math.floor(-cam.ox / cam.scale / GRID_DU) * GRID_DU;
  const v0 = Math.floor(-cam.oy / cam.scale / GRID_DU) * GRID_DU;
  ctx.fillStyle = `rgba(${FAINT.join(',')},0.9)`;
  ctx.beginPath();
  for (let x = cam.x(u0); x < p.width; x += step) {
    for (let y = cam.y(v0); y < p.height; y += step) ctx.rect(x - 0.6, y - 0.6, 1.2, 1.2);
  }
  ctx.fill();
}

/**
 * @param {{ container: HTMLElement, steps: HTMLElement[], onStep?: (i: number) => void }} options
 * @returns {Promise<{ replay: () => void }>}
 */
export async function mountExplainer({ container, steps, onStep = () => {} }) {
  if (!window.p5) throw new Error('p5.js did not load');
  const [robot, cams, fsq] = await Promise.all([
    loadAtlas('assets/data/g1_sprites'), loadAtlas('assets/data/cams'),
    fetch('assets/data/fsq.json').then((r) => { if (!r.ok) throw new Error(`fsq.json: HTTP ${r.status}`); return r.json(); }),
  ]);
  const pipeline = new Pipeline({ sprites: robot.image, meta: robot.meta }, { atlas: cams.image, meta: cams.meta }, fsq);
  const post = new Posttraining({ sprites: robot.image, meta: robot.meta });
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = 0; let progress = 0; let time = STILL_TIME;
  let partStart = time; // each part plays its own short animation from when it is reached

  const sketch = (p) => {
    p.setup = () => {
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      p.createCanvas(container.clientWidth, container.clientHeight).parent(container);
      if (still) p.noLoop();
    };
    p.windowResized = () => { p.resizeCanvas(container.clientWidth, container.clientHeight); p.redraw(); };
    p.draw = () => {
      const dt = still ? 0 : Math.min(p.deltaTime / 1000, 0.05);
      time += dt;
      progress = still ? target : progress + (target - progress) * (1 - Math.exp(-dt * 2.6));
      if (Math.abs(target - progress) < 1e-3) progress = target;
      const since = still ? Infinity : time - partStart;
      window.__explainerSince = since; // read by automated visual checks

      const i = Math.min(Math.floor(progress), 2); const j = Math.min(i + 1, 2);
      let cam = Camera.mix(Camera.fit(PART_SHOTS[i], p.width, p.height), Camera.fit(PART_SHOTS[j], p.width, p.height), smooth(progress - i));
      const close = pipeline.closeUp(progress, since);
      if (close > 0) cam = Camera.mix(cam, Camera.fit(SHOTS.closeUp, p.width, p.height), close);
      const codes = pipeline.codesShot(progress, since);
      if (codes > 0) cam = Camera.mix(cam, Camera.fit(SHOTS.codes, p.width, p.height), codes);

      p.background(...BACKGROUND);
      drawDotGrid(p, cam);
      const state = { progress, time, still, since };
      pipeline.draw(p, cam, state);
      post.draw(p, cam, state);

      brackets(p, 10, 10, p.width - 20, p.height - 20, 14);
      label(p, PART_TITLES[Math.round(progress)], 22, p.height - 22, { size: 10, mono: true, color: MUTED, align: 'left' });
      label(p, `t = ${time.toFixed(1)} s`, p.width - 22, p.height - 22, { size: 10, mono: true, color: MUTED, align: 'right' });
    };
  };
  const instance = new window.p5(sketch);

  const setTarget = (k) => {
    if (k === target) return;
    target = k; partStart = time; onStep(k);
    if (still) instance.redraw();
  };
  const narrow = window.matchMedia('(max-width: 900px)').matches;
  const stepObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) setTarget(Number(entry.target.dataset.step));
  }, { rootMargin: narrow ? '-58% 0px -30% 0px' : '-45% 0px -45% 0px' });
  steps.forEach((step) => stepObserver.observe(step));
  onStep(0);

  // Only animate while the figure is on screen.
  if (!still) {
    new IntersectionObserver(([entry]) => (entry.isIntersecting && !document.hidden ? instance.loop() : instance.noLoop()))
      .observe(container);
  }
  return { replay: () => { partStart = time; instance.redraw(); } };
}

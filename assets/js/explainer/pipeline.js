// Parts 1 and 2 of the explainer, drawn with p5 in diagram units (du).
// 1 · Data preparation: six sources → only 3 tracked points → the real G1 is completed from them → FSQ codes.
// 2 · Pretraining (ACT): real paired head + wrist frames and proprioception are tokenized, a transformer
//     predicts a 2 s chunk of FSQ codes, and frozen SONIC executes the first 1 s before the policy replans.
import {
  FAINT, HUMAN, INK, MONO, MUTED, POLICY,
  arrow, bezier2, caption, clamp01, label, lerp, line, marker, ramp, rect, rgba, smooth,
} from './draw.js';
import { drawFsqPanel, rowAt, staircase } from './fsq.js';

const SOURCES = [
  ['In-house UMI', 'head + wrist cams · full body'],
  ['Lightwheel EgoPro', 'head + wrist cams · partial body'],
  ['Lightwheel EgoStandard', 'head cam · partial body'],
  ['GenRobot', 'wrist cams · no body pose'],
  ['XDOF XMI', 'head + wrist cams · no body pose'],
  ['XDOF Ego', 'head cam · no body pose'],
];
const ROBOT = { cx: 520, ground: 478, k: 1.1 }; // du per sprite pixel
const FSQ_PANEL = { x: 820, y: 150, w: 330 };
const ACT = { cams: 1110, camW: 150, camH: 117, tokens: 1300, net: 1395, netW: 150, chunk: 1600, chunkW: 330, top: 120 };
const CHUNK = 100;      // ACT predicts 100 steps (2 s at 50 Hz)...
const EXECUTE = 50;     // ...and SONIC executes the first 50 (1 s) before the policy replans
const TRAIL = 40;
// Data preparation as a timed sequence (seconds after the part is reached).
export const BEAT = { inputLabel: 0.6, pushIn: 2.2, reveal: 3.4, revealSpan: 2.6, pullBack: 7.4, codes: 8.0 };
export const SHOTS = { data: [10, 95, 1200, 545], codes: [300, 70, 1230, 545], closeUp: [290, 95, 710, 505], pretrain: [1095, 60, 1960, 520] };

export class Pipeline {
  /**
   * @param {{ sprites: HTMLImageElement, meta: object }} robot  @param {{ atlas: HTMLImageElement, meta: object }} cams
   * @param {object} fsq real 50 Hz FSQ codes for the same 8 s window as the robot render
   */
  constructor(robot, cams, fsq) {
    this.robot = robot;
    this.cams = cams;
    this.fsq = fsq;
    this.trails = [[], [], []];
    this.tokenCanvas = document.createElement('canvas');
    this.tokenCanvas.width = 6; this.tokenCanvas.height = 5;
  }

  /** Close-up weight for the stage camera during the completion beat. */
  closeUp(p, since) {
    if (p > 0.5) return 0;
    return smooth((since - BEAT.pushIn) / 1.0) * (1 - smooth((since - BEAT.pullBack) / 1.2));
  }

  /** Weight of the final framing on the robot and its FSQ code. */
  codesShot(p, since) {
    if (p > 0.5) return 0;
    return smooth((since - BEAT.pullBack) / 1.4);
  }

  frame(time) {
    const { frames, fps } = this.robot.meta;
    const d = frames / fps;
    return Math.floor((((time % d) + d) % d) * fps) % frames;
  }

  /** Sprite pixel → diagram units, anchored at the robot's ground point. */
  toDu(px, py) {
    const [gx, gy] = this.robot.meta.ground_px;
    return [ROBOT.cx + (px - gx) * ROBOT.k, ROBOT.ground + (py - gy) * ROBOT.k];
  }

  draw(p, cam, { progress, time, still, since }) {
    const s = still || progress > 0.5 ? Infinity : since;
    const leave = 1 - ramp(progress, 0.55, 0.4);
    const reveal = clamp01((s - BEAT.reveal) / BEAT.revealSpan);
    const close = this.closeUp(progress, s);
    if (leave > 0.01) {
      const f = this.frame(time);
      const tracked = this.robot.meta.tracked_px[f].map(([x, y]) => this.toDu(x, y));
      this.drawSources(p, cam, time, tracked, (1 - 0.8 * Math.max(ramp(progress, 0.3, 0.3), close)) * leave);
      this.drawRobot(p, cam, f, reveal, leave);
      this.drawTracked(p, cam, tracked, leave * (1 - 0.5 * smooth(reveal)), ramp(s, BEAT.inputLabel, 0.5) * (1 - ramp(reveal, 0.3, 0.3)) * leave);
      caption(p, 'Output · 29-DoF whole-body motion on the G1', 'completed by the motion prior (Kimodo)',
        cam.x(ROBOT.cx), cam.y(ROBOT.ground + 26), { alpha: ramp(reveal, 0.6, 0.4) * leave, color: POLICY });
      this.drawScaleBar(p, cam, close * leave);
      this.drawCodes(p, cam, time, ramp(s, BEAT.codes, 0.8) * leave);
    }
    const actAlpha = ramp(progress, 0.5, 0.4) * (1 - ramp(progress, 1.45, 0.4));
    if (actAlpha > 0.01) this.drawAct(p, cam, time, actAlpha);
  }

  drawSources(p, cam, time, targets, alpha) {
    if (alpha <= 0.01) return;
    const ctx = p.drawingContext;
    label(p, 'HUMAN DATA · 6 SOURCES · 5 FORMATS', cam.x(28), cam.y(112), { size: 10, mono: true, color: MUTED, align: 'left', alpha });
    SOURCES.forEach(([name, detail], i) => {
      const y = 150 + i * 54;
      rect(p, cam.x(28), cam.y(y - 20), 236 * cam.scale, 40 * cam.scale, { stroke: FAINT, fill: [255, 255, 255], alpha, radius: 4 });
      rect(p, cam.x(38), cam.y(y - 4), 8 * cam.scale, 8 * cam.scale, { fill: HUMAN, alpha, radius: 1 });
      label(p, name, cam.x(54), cam.y(y - 6), { size: 12.5, weight: 600, align: 'left', alpha });
      label(p, detail, cam.x(54), cam.y(y + 9), { size: 10.5, color: MUTED, align: 'left', alpha });
      // Every source streams into the same three points: head and both grippers.
      targets.forEach(([tx, ty], j) => {
        const a = [cam.x(268), cam.y(y)];
        const b = [cam.x(tx), cam.y(ty)];
        const c = [lerp(a[0], b[0], 0.55), lerp(a[1], b[1], 0.55) - 30 * cam.scale + j * 12 * cam.scale];
        ctx.save();
        ctx.strokeStyle = rgba(HUMAN, 0.16 * alpha); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(...a); ctx.quadraticCurveTo(...c, ...b); ctx.stroke();
        ctx.fillStyle = rgba(HUMAN, 0.85 * alpha);
        for (let k = 0; k < 2; k += 1) {
          const u = (time * 0.28 + k / 2 + i * 0.13 + j * 0.07) % 1;
          const [px, py] = bezier2(a, c, b, u);
          ctx.beginPath(); ctx.arc(px, py, 1.8 * Math.sin(Math.PI * u) + 0.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });
    });
  }

  /** The real G1 render, revealed top-down by the completion scan. */
  drawRobot(p, cam, f, reveal, alpha) {
    if (alpha <= 0.01 || reveal <= 0) return;
    const { frame_w: w, frame_h: h, cols } = this.robot.meta;
    const [x0, y0] = this.toDu(0, 0);
    const dx = cam.x(x0); const dy = cam.y(y0);
    const dw = w * ROBOT.k * cam.scale; const dh = h * ROBOT.k * cam.scale;
    const top = this.robot.meta.tracked_px[f][0][1] - 22; // just above the head camera
    const bottom = this.robot.meta.ground_px[1] + 4;
    const scanPx = reveal >= 1 ? h : lerp(top, bottom, smooth(reveal));
    const ctx = p.drawingContext;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.rect(dx, dy, dw, dh * (scanPx / h)); ctx.clip();
    ctx.drawImage(this.robot.sprites, (f % cols) * w, Math.floor(f / cols) * h, w, h, dx, dy, dw, dh);
    ctx.restore();
    if (reveal > 0 && reveal < 1) {
      const yy = dy + dh * (scanPx / h);
      const xa = cam.x(ROBOT.cx - 150); const xb = cam.x(ROBOT.cx + 150);
      line(p, xa, yy, xb, yy, HUMAN, 0.9 * alpha, 1.2);
      for (let x = xa; x <= xb; x += 10 * cam.scale) line(p, x, yy - 3, x, yy + 3, HUMAN, 0.5 * alpha, 1);
      const z = (this.robot.meta.ground_px[1] - scanPx) * this.robot.meta.metres_per_px;
      label(p, `completing · z = ${Math.max(0, z).toFixed(2)} m`, xb + 8, yy, { size: 10.5, mono: true, color: HUMAN, align: 'left', alpha });
    }
  }

  drawTracked(p, cam, tracked, alpha, labelAlpha) {
    const names = ['HEAD', 'L GRIPPER', 'R GRIPPER'];
    const ctx = p.drawingContext;
    tracked.forEach(([u, v], i) => {
      const trail = this.trails[i];
      trail.push([u, v]);
      if (trail.length > TRAIL) trail.shift();
      ctx.save();
      ctx.strokeStyle = rgba(HUMAN, 0.45 * alpha); ctx.lineWidth = 1.2;
      ctx.beginPath();
      trail.forEach(([tu, tv], k) => (k ? ctx.lineTo(cam.x(tu), cam.y(tv)) : ctx.moveTo(cam.x(tu), cam.y(tv))));
      ctx.stroke(); ctx.restore();
      marker(p, cam.x(u), cam.y(v), 6, HUMAN, alpha);
      const side = i === 2 ? -1 : 1; // keep the two gripper labels apart
      label(p, names[i], cam.x(u) + side * 14, cam.y(v) + (i ? 14 : 0), { size: 10, mono: true, color: HUMAN, align: side > 0 ? 'left' : 'right', alpha: labelAlpha });
    });
    caption(p, 'Input · 3 tracked points', 'head + two grippers, from a GenRobot demonstration',
      cam.x(ROBOT.cx), cam.y(400), { alpha: labelAlpha, color: HUMAN });
  }

  drawScaleBar(p, cam, alpha) {
    if (alpha <= 0.01) return;
    const x0 = cam.x(ROBOT.cx - 150); const y = cam.y(ROBOT.ground + 10);
    const len = (0.5 / this.robot.meta.metres_per_px) * ROBOT.k * cam.scale;
    line(p, x0, y, x0 + len, y, INK, 0.6 * alpha, 1);
    line(p, x0, y - 4, x0, y + 4, INK, 0.6 * alpha, 1);
    line(p, x0 + len, y - 4, x0 + len, y + 4, INK, 0.6 * alpha, 1);
    label(p, '0.5 m', x0 + len / 2, y - 9, { size: 10, mono: true, color: MUTED, alpha });
  }

  drawCodes(p, cam, time, alpha) {
    if (alpha <= 0.01) return;
    const { x, y, w } = FSQ_PANEL;
    caption(p, '64-D FSQ code · SONIC\'s latent action space', 'real codes of this motion · every value on a 1/16 lattice',
      cam.x(x + w / 2), cam.y(y - 62), { alpha });
    drawFsqPanel(p, cam, this.fsq, time, alpha, FSQ_PANEL);
    arrow(p, cam.x(ROBOT.cx + 110), cam.y(250), cam.x(x - 48), cam.y(196), INK, alpha);
    label(p, 'SONIC encoder', cam.x((ROBOT.cx + 110 + x - 48) / 2), cam.y(208), { size: 10.5, mono: true, color: MUTED, alpha });
  }

  /** One camera cell from the atlas: source s, view v (0 head, 1 left wrist, 2 right wrist), frame k. */
  camCell(s, v, k) {
    const { cell_w: w, cell_h: h, frames } = this.cams.meta;
    return [v * w, (s * frames + k) * h, w, h];
  }

  drawAct(p, cam, time, alpha) {
    const ctx = p.drawingContext;
    const { meta, atlas } = this.cams;
    const cycle = meta.frames / meta.fps; // 4 s per source
    const s = Math.floor(time / cycle) % meta.sources.length;
    const k = Math.floor((time % cycle) * meta.fps) % meta.frames;
    const { cams: cx, camW, camH, tokens: tx, net: nx, netW, chunk: ox, chunkW, top } = ACT;
    const gap = 16;
    const views = ['head cam', 'left wrist cam', 'right wrist cam'];

    label(p, `${meta.sources[s].label.toUpperCase()} · "${meta.sources[s].task}"`, cam.x(cx), cam.y(top - 12),
      { size: 10, mono: true, color: MUTED, align: 'left', alpha });
    const tokenRows = [];
    views.forEach((name, v) => {
      const y = top + v * (camH + gap);
      const [sx, sy, sw, sh] = this.camCell(s, v, k);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.roundRect(cam.x(cx), cam.y(y), camW * cam.scale, camH * cam.scale, 3); ctx.clip();
      ctx.drawImage(atlas, sx, sy, sw, sh, cam.x(cx), cam.y(y), camW * cam.scale, camH * cam.scale);
      if (v === 0) { // the human head view is masked and noised: the robot's head camera sees a different view
        ctx.fillStyle = 'rgba(250,250,251,0.55)';
        ctx.fillRect(cam.x(cx), cam.y(y), camW * cam.scale, camH * cam.scale);
        for (let i = 0; i < 26; i += 1) {
          const bx = ((i * 73 + Math.floor(time * 3) * 31) % 10) / 10; const by = ((i * 41 + Math.floor(time * 3) * 17) % 8) / 8;
          ctx.fillStyle = `rgba(214,219,227,${0.55 + 0.4 * ((i * 7) % 3) / 2})`;
          ctx.fillRect(cam.x(cx + bx * camW), cam.y(y + by * camH), camW * 0.1 * cam.scale, camH * 0.125 * cam.scale);
        }
      }
      ctx.restore();
      rect(p, cam.x(cx), cam.y(y), camW * cam.scale, camH * cam.scale, { stroke: v ? POLICY : MUTED, alpha, radius: 3 });
      const tag = v ? name : 'head cam · masked + noised';
      ctx.font = `400 9.5px ${MONO}`;
      const tagW = ctx.measureText(tag).width + 8;
      rect(p, cam.x(cx) + 4, cam.y(y + camH) - 18, tagW, 14, { fill: [255, 255, 255, 0.9], alpha, radius: 2 });
      label(p, tag, cam.x(cx) + 8, cam.y(y + camH) - 11, { size: 9.5, mono: true, color: v ? POLICY : INK, align: 'left', alpha });

      // Tokenize: the same frame, pooled to a 6 × 5 patch grid (one square per token).
      const tc = this.tokenCanvas.getContext('2d');
      tc.drawImage(atlas, sx, sy, sw, sh, 0, 0, 6, 5);
      const tw = 60; const th = 50;
      const ty = y + (camH - th) / 2;
      ctx.save();
      ctx.globalAlpha = alpha * (v ? 1 : 0.35);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.tokenCanvas, cam.x(tx), cam.y(ty), tw * cam.scale, th * cam.scale);
      ctx.restore();
      for (let gx = 0; gx <= 6; gx += 1) line(p, cam.x(tx + gx * 10), cam.y(ty), cam.x(tx + gx * 10), cam.y(ty + th), [255, 255, 255], alpha, 1);
      for (let gy = 0; gy <= 5; gy += 1) line(p, cam.x(tx), cam.y(ty + gy * 10), cam.x(tx + tw), cam.y(ty + gy * 10), [255, 255, 255], alpha, 1);
      arrow(p, cam.x(cx + camW + 4), cam.y(y + camH / 2), cam.x(tx - 6), cam.y(y + camH / 2), MUTED, alpha * 0.8, 1);
      tokenRows.push([tx + tw, y + camH / 2]);
    });
    label(p, 'image tokens', cam.x(tx + 30), cam.y(top + 2 * (camH + gap) + camH / 2 + 38), { size: 9.5, mono: true, color: MUTED, alpha });

    // Proprioception token.
    const py = top + 3 * (camH + gap) + 4;
    rect(p, cam.x(tx), cam.y(py), 60 * cam.scale, 14 * cam.scale, { fill: [...HUMAN, 0.12], stroke: HUMAN, alpha, radius: 2 });
    label(p, 'wrist pose · velocity · distance', cam.x(tx - 8), cam.y(py + 7), { size: 9.5, mono: true, color: HUMAN, align: 'right', alpha });
    tokenRows.push([tx + 60, py + 7]);

    // Transformer: tokens attend to each other; action queries read out the chunk.
    const ny0 = top + 20; const ny1 = py + 14;
    rect(p, cam.x(nx), cam.y(ny0), netW * cam.scale, (ny1 - ny0) * cam.scale, { fill: [...POLICY, 0.05], stroke: POLICY, alpha, radius: 6 });
    const step = (ny1 - ny0 - 60) / 7;
    const nodes = Array.from({ length: 8 }, (_, i) => [nx + 28, ny0 + 30 + i * step]);
    const outs = Array.from({ length: 8 }, (_, i) => [nx + netW - 28, ny0 + 30 + i * step]);
    tokenRows.forEach(([x, y]) => nodes.forEach(([ax, ay]) => line(p, cam.x(x + 4), cam.y(y), cam.x(ax), cam.y(ay), POLICY, alpha * 0.07, 1)));
    nodes.forEach(([ax, ay], i) => outs.forEach(([bx, by], j) => {
      const w = 0.5 + 0.5 * Math.sin(time * 1.3 + i * 0.9 + j * 1.7); // attention weights shift over time
      line(p, cam.x(ax), cam.y(ay), cam.x(bx), cam.y(by), POLICY, alpha * 0.06 * (1 + 3 * w * w), 1);
    }));
    for (const [x, y] of [...nodes, ...outs]) rect(p, cam.x(x - 4), cam.y(y - 4), 8 * cam.scale, 8 * cam.scale, { fill: [255, 255, 255], stroke: POLICY, alpha, radius: 2 });
    caption(p, 'ACT transformer', 'CVAE encoder–decoder', cam.x(nx + netW / 2), cam.y(ny0 - 30), { alpha, color: POLICY });
    label(p, 'tokens', cam.x(nx + 28), cam.y(ny1 - 10), { size: 9.5, mono: true, color: MUTED, alpha });
    label(p, 'queries', cam.x(nx + netW - 28), cam.y(ny1 - 10), { size: 9.5, mono: true, color: MUTED, alpha });

    this.drawChunk(p, cam, time, alpha, ox, chunkW, top + 70, outs, nx);
  }

  /** The predicted action chunk: 100 steps × FSQ code, of which SONIC executes the first 50. */
  drawChunk(p, cam, time, alpha, ox, chunkW, oy, outs, nx) {
    const colW = chunkW / CHUNK;
    const tracks = this.fsq.tracks;
    const rowH = 22;
    const h = tracks.length * rowH;
    // One replan per second: the executed half is consumed, then a fresh chunk is predicted.
    const replan = Math.floor(time);
    const played = time - replan;
    outs.forEach(([bx, by]) => line(p, cam.x(bx + 4), cam.y(by), cam.x(ox - 6), cam.y(oy + h / 2), POLICY, alpha * 0.12, 1));
    const r0 = rowAt(this.fsq, replan);
    const style = (i) => (i < EXECUTE ? [POLICY, 1, null] : [MUTED, 0.7, [3, 3]]);
    tracks.forEach((dim, i) => staircase(p, cam, this.fsq, dim, r0, CHUNK, { x: ox, y: oy + i * rowH + 3, w: chunkW, h: rowH - 6 }, style, alpha));
    const ctx = p.drawingContext;
    rect(p, cam.x(ox - 2), cam.y(oy - 2), (chunkW + 4) * cam.scale, (h + 4) * cam.scale, { stroke: FAINT, alpha, radius: 2 });
    const px = cam.x(ox + played * EXECUTE * colW); // playhead over the executed half
    line(p, px, cam.y(oy - 10), px, cam.y(oy + h + 6), INK, alpha, 1.4);
    const ay = oy + h + 16;
    line(p, cam.x(ox), cam.y(ay), cam.x(ox + chunkW), cam.y(ay), MUTED, alpha * 0.6, 1);
    [[0, '0'], [EXECUTE, '1 s'], [CHUNK, '2 s']].forEach(([c, t]) => {
      line(p, cam.x(ox + c * colW), cam.y(ay - 3), cam.x(ox + c * colW), cam.y(ay + 3), MUTED, alpha, 1);
      label(p, t, cam.x(ox + c * colW), cam.y(ay + 12), { size: 9.5, mono: true, color: MUTED, alpha });
    });
    caption(p, 'Action chunk · 100 steps of 64-D FSQ codes', `${tracks.length} of 64 dims · codes from the part-1 motion`, cam.x(ox + chunkW / 2), cam.y(oy - 40), { alpha });
    const by = oy + h + 46;
    line(p, cam.x(ox), cam.y(by), cam.x(ox + EXECUTE * colW), cam.y(by), POLICY, alpha, 1.4);
    line(p, cam.x(ox + EXECUTE * colW + 4), cam.y(by), cam.x(ox + chunkW), cam.y(by), MUTED, alpha * 0.5, 1, [3, 3]);
    label(p, 'executed by frozen SONIC at 50 Hz', cam.x(ox), cam.y(by + 13), { size: 9.5, mono: true, color: POLICY, align: 'left', alpha });
    label(p, 'discarded at replan', cam.x(ox + chunkW), cam.y(by + 27), { size: 9.5, mono: true, color: MUTED, align: 'right', alpha });
    // After 1 s the policy observes again and predicts a fresh chunk.
    const ny = by + 120;
    ctx.save();
    ctx.strokeStyle = rgba(MUTED, alpha * 0.7); ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cam.x(ox + EXECUTE * colW), cam.y(by + 26));
    ctx.quadraticCurveTo(cam.x(ox + EXECUTE * colW), cam.y(ny), cam.x(nx + 158), cam.y(ny));
    ctx.stroke(); ctx.restore();
    arrow(p, cam.x(nx + 170), cam.y(ny), cam.x(nx + 156), cam.y(ny), MUTED, alpha * 0.7, 1);
    label(p, 'replan every 1 s from a new observation', cam.x(nx + 176), cam.y(ny + 14), { size: 9.5, mono: true, color: MUTED, align: 'left', alpha });
    label(p, 'pretrained on human data only · no robot data', cam.x(ox + chunkW / 2), cam.y(oy - 70), { size: 10, mono: true, color: MUTED, alpha });
  }
}

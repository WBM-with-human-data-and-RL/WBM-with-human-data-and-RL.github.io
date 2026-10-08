# Research project website

Anonymous project page for *Data-Efficient Humanoid Loco-Manipulation Learning via Heterogeneous Human Data Pretraining and Iterative Offline RL*. Static HTML, CSS and ES modules; no build step, trackers, external fonts or third-party requests.

## Layout

| Path | Contents |
| --- | --- |
| `index.html` | Title and teaser video, abstract, pipeline animation, results, rollouts |
| `assets/css/site.css` | All styling (light theme, responsive) |
| `assets/js/main.js` | Entry point; wires the modules below |
| `assets/js/hero.js` | p5.js intro backdrop: dot grid, three-point trajectories in the margins, viewfinder and timecode around the video |
| `assets/js/explainer/` | p5.js pipeline figure in three parts, stepped by scrolling: `stage.js` (sketch, camera, steps), `pipeline.js` (data preparation with the G1 render, ACT pretraining with real camera frames), `posttraining.js` (offline-RL loop, takeover timelines, before/after success bars), `fsq.js` (real FSQ codes: 64-D spectrum and per-dimension staircases), `draw.js` (shared drawing style) |
| `assets/js/charts.js` | Results table with inline bars and tooltips |
| `assets/js/data.js` | Every reported number, copied from the manuscript |
| `assets/js/media.js` | Teaser autoplay/unmute, rollout gallery and lightbox |
| `serve.py` | Local preview server (adds the Range support browsers need to seek videos) |
| `assets/vendor/p5/` | p5.js 1.11.13 (LGPL-2.1), vendored so the page makes no CDN requests |
| `assets/data/g1_sprites.{webp,json}` | MuJoCo render of the G1 + YAM grippers + Jetson backpack (120 transparent frames) playing the motion-completion output for a GenRobot medicine-shelf demonstration, plus per-frame image positions of the head and grippers. Built by `icra-paper/scripts/build_g1_sprites.py`; motion provenance in `icra-paper/figures/g1_web_motion/provenance.json` |
| `assets/data/fsq.json` | Real 50 Hz SONIC FSQ codes (64-D, 1/16 lattice) for the same 8 s window as the G1 render. Built by `icra-paper/scripts/build_fsq_web.py` from the episode's `low_latency_fsq_50hz.npz` |
| `assets/data/cams.{webp,json}` | Real time-aligned head + left/right wrist clips (in-house UMI, XDOF XMI, Lightwheel EgoPro) for the ACT diagram. Built by `icra-paper/scripts/build_camera_atlas.py` |
| `assets/videos/` | Supplementary video, rollout clips (H.264, muted, faststart) and posters |

## Edit

- Numbers: change `assets/js/data.js`; the charts and table follow. The headline stats and abstract live in `index.html`.
- Rollout clips: add the MP4 and a JPG poster with the same name to `assets/videos/`, then add an entry to `DEMOS` in `assets/js/media.js`.
- Animation steps: the text lives in `index.html` (`.step` articles); the framing of each part is `SHOTS` in `assets/js/explainer/pipeline.js` and `SHOT` in `posttraining.js`.
- Videos must be H.264 MP4 (HEVC `.mov` does not play in Chrome or Firefox). Keep any people out of frame or blurred.

## Preview

Run `python3 serve.py`, then open http://localhost:8000. It is a static server with HTTP Range support; Python's built-in `http.server` lacks it, so videos cannot be scrubbed there. Opening `index.html` directly from disk will not load the ES modules.

## Deploy

In GitHub Pages settings, select **Deploy from a branch**, **main**, and **/ (root)**.

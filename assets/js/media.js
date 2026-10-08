// Teaser player and rollout gallery.

const VIDEO_DIR = 'assets/videos';

export const DEMOS = [
  { id: 'push_door', title: 'Push door', speed: 2 },
  { id: 'pull_door', title: 'Pull door', speed: 2 },
  { id: 'kneel_pickup', title: 'Kneel and pick up', speed: 2 },
  { id: 'box_carry', title: 'Whole-body box carrying', speed: 1 },
  { title: 'Any-object pickup', speed: 1,
    clips: [
      { id: 'pick_can', title: 'Empty can' },
      { id: 'pick_bread', title: 'Toy bread' },
      { id: 'pick_cube', title: '300 g cube' },
    ] },
  { id: 'back_to_back_doors', title: 'Open door, 14 trials back to back', speed: 5, wide: true },
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function playSafely(video) {
  const attempt = video.play();
  if (attempt) attempt.catch(() => { /* autoplay refused; the poster and controls remain */ });
}

/** Play muted videos only while they are on screen. */
function autoplayInView(videos, threshold = 0.35) {
  if (reducedMotion()) return;
  const observer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) playSafely(target); else target.pause();
    }
  }, { threshold });
  videos.forEach((v) => observer.observe(v));
}

export function setupTeaser(video, unmuteButton) {
  if (!video) return;
  const sync = () => {
    const muted = video.muted || video.volume === 0;
    unmuteButton.hidden = !muted;
  };
  unmuteButton.addEventListener('click', () => {
    video.muted = false;
    if (video.volume === 0) video.volume = 1;
    if (video.paused) playSafely(video);
  });
  video.addEventListener('volumechange', sync);
  sync();
  autoplayInView([video], 0.1);
}

function clipButton({ id, title }, speed, onOpen, label = '') {
  const button = document.createElement('button');
  button.className = 'demo-media';
  button.type = 'button';
  button.setAttribute('aria-label', `Enlarge: ${title}`);
  button.innerHTML = `
    <video muted loop playsinline preload="none" poster="${VIDEO_DIR}/${id}.jpg">
      <source src="${VIDEO_DIR}/${id}.mp4" type="video/mp4">
    </video>
    <span class="speed-badge">${speed}×</span>`;
  if (label) {
    const tag = document.createElement('span');
    tag.className = 'trio-label';
    tag.textContent = label;
    button.append(tag);
  }
  button.addEventListener('click', onOpen);
  return button;
}

/** A demo is one clip, or several clips of one policy shown side by side. */
function demoCard(demo, openLightbox) {
  const card = document.createElement('figure');
  card.className = demo.clips ? 'demo demo--trio' : demo.wide ? 'demo demo--wide' : 'demo';
  if (demo.clips) {
    const row = document.createElement('div');
    row.className = 'trio';
    row.append(...demo.clips.map((clip) => clipButton(clip, demo.speed,
      () => openLightbox({ ...demo, id: clip.id, title: `${demo.title}: ${clip.title}` }), clip.title)));
    card.append(row);
  } else {
    card.append(clipButton(demo, demo.speed, () => openLightbox(demo)));
  }
  const caption = document.createElement('figcaption');
  caption.append(Object.assign(document.createElement('strong'), { textContent: demo.title }));
  card.append(caption);
  return card;
}

function setupLightbox(dialog) {
  const video = dialog.querySelector('video');
  const title = dialog.querySelector('[data-title]');
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { video.pause(); video.removeAttribute('src'); video.load(); });
  return (demo) => {
    title.textContent = `${demo.title} · ${demo.speed}× speed`;
    video.poster = `${VIDEO_DIR}/${demo.id}.jpg`;
    video.src = `${VIDEO_DIR}/${demo.id}.mp4`;
    dialog.showModal();
    playSafely(video);
  };
}

export function setupDemos(grid, dialog) {
  const openLightbox = setupLightbox(dialog);
  const cards = DEMOS.map((demo) => demoCard(demo, openLightbox));
  grid.append(...cards);
  autoplayInView(cards.flatMap((c) => [...c.querySelectorAll('video')]));
}

import { installTooltip, renderAblationTable } from './charts.js';
import { setupDemos, setupTeaser } from './media.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

setupTeaser($('#teaser-video'), $('#unmute'));
setupDemos($('#demo-grid'), $('#lightbox'));
installTooltip();
renderAblationTable($('#ablation-table'));

// The pipeline animation: text steps drive the scene; tabs on the stage jump between the three parts.
const steps = $$('.step');
let stage = null;
const dots = steps.map((step, i) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = step.querySelector('.step-kicker').textContent;
  // Clicking the part already on screen replays its animation; otherwise scroll to it.
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-current') === 'step') stage?.replay();
    else step.scrollIntoView({ block: 'center' });
  });
  const li = document.createElement('li');
  li.append(button);
  $('#stage-dots').append(li);
  return button;
});
const markStep = (index) => {
  steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
  dots.forEach((dot, i) => (i === index ? dot.setAttribute('aria-current', 'step') : dot.removeAttribute('aria-current')));
};

// p5.js (a classic deferred script) has run before this module. The figure and intro are
// decoration over complete text, so neither may break the rest of the page.
import('./explainer/stage.js')
  .then(({ mountExplainer }) => mountExplainer({ container: $('#stage-canvas'), steps, onStep: markStep }))
  .then((mounted) => { stage = mounted; })
  .catch((error) => {
    document.documentElement.classList.add('no-figure');
    console.warn('Pipeline animation failed to load.', error);
  });
import('./hero.js')
  .then(({ mountHero }) => mountHero($('.intro'), $('#teaser-video')))
  .catch((error) => console.warn('Intro backdrop failed to load.', error));

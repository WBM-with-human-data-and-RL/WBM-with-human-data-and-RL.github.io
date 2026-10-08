// Results chart and table, rendered from data.js with hover tooltips.
import { ABLATIONS, ABLATION_TASKS, pct } from './data.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'style') Object.entries(value).forEach(([prop, v]) => node.style.setProperty(prop, v));
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

/** One floating tooltip for every element carrying data-tip, mouse and keyboard alike. */
export function installTooltip(root = document) {
  const tip = el('div', { class: 'viz-tip', role: 'status', 'aria-live': 'polite' });
  document.body.append(tip);
  const show = (target, x, y) => {
    tip.textContent = target.dataset.tip;
    tip.classList.add('is-visible');
    const { width, height } = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, x - width / 2), window.innerWidth - width - 8);
    tip.style.transform = `translate(${left}px, ${Math.max(8, y - height - 14)}px)`;
  };
  const hide = () => tip.classList.remove('is-visible');
  root.addEventListener('pointerover', (e) => {
    const target = e.target.closest('[data-tip]');
    if (target) show(target, e.clientX, e.clientY);
  });
  root.addEventListener('pointermove', (e) => {
    const target = e.target.closest('[data-tip]');
    if (target) show(target, e.clientX, e.clientY); else hide();
  });
  root.addEventListener('pointerout', (e) => { if (!e.relatedTarget?.closest?.('[data-tip]')) hide(); });
  root.addEventListener('focusin', (e) => {
    const target = e.target.closest('[data-tip]');
    if (!target) return;
    const r = target.getBoundingClientRect();
    show(target, r.left + r.width / 2, r.top);
  });
  root.addEventListener('focusout', hide);
}

/** Table III with an inline bar in every cell; our row is the only colored one. */
export function renderAblationTable(table) {
  const head = el('thead', {}, [el('tr', {}, [
    el('th', { scope: 'col', text: 'Condition' }),
    el('th', { scope: 'col', class: 'num', text: 'Robot time' }),
    el('th', { scope: 'col', class: 'num', text: 'Learned critic' }),
    ...ABLATION_TASKS.map((t) => el('th', { scope: 'col', text: t.name })),
  ])]);
  const body = el('tbody', {}, ABLATIONS.map((row) => el('tr', { class: row.ours ? 'is-ours' : '' }, [
    el('th', { scope: 'row' }, [row.label, el('small', { text: row.humanData })]),
    el('td', { class: 'num', text: `${row.robotMin} min` }),
    el('td', { class: 'num', text: row.critic ? 'yes' : 'no' }),
    ...row.successes.map((s, i) => {
      const { name, trials } = ABLATION_TASKS[i];
      const p = pct(s, trials);
      return el('td', { class: 'cell-bar', tabindex: '0', 'data-tip': `${row.label} · ${name}: ${s}/${trials} (${p}%)` }, [
        el('span', { class: 'cell-value', text: `${s}/${trials}` }),
        el('span', { class: 'cell-track', 'aria-hidden': 'true' }, [el('span', { style: { width: `${p}%` } })]),
      ]);
    }),
  ])));
  table.append(head, body);
}

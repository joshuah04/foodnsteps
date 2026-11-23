// Results screen: eating style, opening move, most used action, comparisons
import { mode, styleById, type Analysis } from './analysis';
import type { Meal, Session } from './types';

function actionLabel(meal: Meal, id: string | null): string {
  const act = meal.actions.find(x => x.id === id);
  return act ? act.label : (id ?? '');
}

function fmtTime(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function pct(n: number, d: number): string {
  return d ? Math.round(100 * n / d) + '%' : '0%';
}

function card(k: string, v: string, s?: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'card';
  const kk = document.createElement('p');
  kk.className = 'k';
  kk.textContent = k;
  const vv = document.createElement('p');
  vv.className = 'v';
  vv.textContent = v;
  d.append(kk, vv);
  if (s) {
    const ss = document.createElement('p');
    ss.className = 's';
    ss.textContent = s;
    d.appendChild(ss);
  }
  return d;
}

export function show(
  session: Session,
  analysis: Analysis,
  history: Session[],
  meal: Meal,
  onRestart: () => void
): void {
  const view = document.getElementById('results-view') as HTMLElement;
  view.innerHTML = '';
  view.hidden = false;
  const plays = history.length;

  const styleCard = document.createElement('section');
  styleCard.className = 'style-card';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Your eating style';
  const h = document.createElement('h2');
  h.textContent = analysis.style.name;
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = analysis.style.desc;
  styleCard.append(eyebrow, h, p);
  if (analysis.tags.length > 1) {
    const tags = document.createElement('div');
    tags.className = 'tags';
    analysis.tags.forEach(t => {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = t;
      tags.appendChild(b);
    });
    styleCard.appendChild(tags);
  }
  view.appendChild(styleCard);

  // your numbers next to everyone's numbers
  const openings = history.map(s => s.steps[0]?.actionId).filter((x): x is string => Boolean(x));
  const myOpen = session.steps[0].actionId;
  const sameOpen = openings.filter(x => x === myOpen).length;
  const topOpen = mode(openings);
  const allActions: string[] = [];
  history.forEach(s => s.steps.forEach(st => allActions.push(st.actionId)));
  const topAction = mode(allActions);
  const topStyle = mode(history.map(s => s.styleId).filter((x): x is string => Boolean(x)));
  const sameStyle = history.filter(s => s.styleId === analysis.style.id).length;

  const cards = document.createElement('div');
  cards.className = 'cards';
  cards.append(
    card('You opened with', actionLabel(meal, myOpen),
      pct(sameOpen, plays) + ' of plays opened the same way'),
    card('Your most used action', actionLabel(meal, analysis.mostUsed.value),
      'Used ' + analysis.mostUsed.count + ' time' + (analysis.mostUsed.count === 1 ? '' : 's')),
    card('Most common opening', actionLabel(meal, topOpen.value),
      pct(topOpen.count, plays) + ' of ' + plays + ' play' + (plays === 1 ? '' : 's')),
    card('Most used action overall', actionLabel(meal, topAction.value),
      topAction.count + ' of ' + allActions.length + ' steps'),
    card('Most common style', styleById(topStyle.value).name,
      pct(sameStyle, plays) + ' of plays share your style'),
    card('Your meal', session.steps.length + ' steps in ' + fmtTime(session.durationMs),
      session.completed ? 'Finished the whole bowl' : pct(Math.round(analysis.leftShare * 100), 100) + ' of the bowl left')
  );
  view.appendChild(cards);

  const tlTitle = document.createElement('h3');
  tlTitle.textContent = 'Your steps';
  view.appendChild(tlTitle);
  const tl = document.createElement('div');
  tl.className = 'timeline';
  session.steps.forEach(st => {
    const ing = meal.ingredients.find(i => i.id === st.target);
    const chip = document.createElement('span');
    chip.className = 'chip';
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(st.n);
    n.style.background = ing ? ing.color : '#b03a2e';
    if (ing && (ing.id === 'nori' || ing.id === 'pepper')) n.style.color = '#ffffff';
    if (!ing) n.style.color = '#ffffff';
    const label = document.createElement('span');
    label.textContent = st.label;
    chip.append(n, label);
    tl.appendChild(chip);
  });
  view.appendChild(tl);

  const note = document.createElement('p');
  note.className = 'note muted';
  note.textContent = 'For now, comparisons use the plays saved in this browser (' + plays +
    ' so far). Comparing with other players comes with the server in the next milestone.';
  view.appendChild(note);

  const btns = document.createElement('div');
  btns.className = 'buttons';
  const again = document.createElement('button');
  again.className = 'primary';
  again.textContent = 'Eat another bowl';
  again.addEventListener('click', () => onRestart());
  btns.appendChild(again);
  view.appendChild(btns);
}

// Results screen: eating style, opening move, most used action, comparisons
window.Results = (function () {
  'use strict';

  // checked in order, the first match becomes the main eating style
  const STYLES = [
    { id: 'spice', name: 'Spice Lover', desc: 'You seasoned the bowl three or more times.',
      test: a => a.seasonCount >= 3 },
    { id: 'broth_first', name: 'Broth Taster', desc: 'You tasted the broth before anything else.',
      test: a => a.first && a.first.target === 'broth' },
    { id: 'noodle', name: 'Noodle Rusher', desc: 'At least half of your bites went to the noodles.',
      test: a => a.eatCount >= 4 && a.noodleCount / a.eatCount >= 0.5 },
    { id: 'best_last', name: 'Saves the Best for Last', desc: 'The chashu pork was the last thing you finished.',
      test: a => a.finishOrder.length >= 3 && a.finishOrder[a.finishOrder.length - 1] === 'chashu' },
    { id: 'mixer', name: 'Master Mixer', desc: 'You stirred and mixed the bowl more than once.',
      test: a => a.prepCount >= 2 },
    { id: 'drainer', name: 'Bowl Drainer', desc: 'You drank every drop of broth.',
      test: a => a.finalAmounts.broth === 0 },
    { id: 'light', name: 'Light Eater', desc: 'You finished with half the bowl or more still left.',
      test: a => a.leftShare >= 0.5 },
    { id: 'balanced', name: 'Balanced Eater', desc: 'You worked your way around the whole bowl evenly.',
      test: () => true }
  ];

  function styleById(id) {
    return STYLES.find(s => s.id === id) || STYLES[STYLES.length - 1];
  }

  function mode(values) {
    const counts = new Map();
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    let best = null;
    let bestN = 0;
    counts.forEach((n, v) => { if (n > bestN) { best = v; bestN = n; } });
    return { value: best, count: bestN };
  }

  function analyze(session, meal) {
    const steps = session.steps;
    const food = meal.ingredients.filter(i => i.kind === 'food');
    const startTotal = food.reduce((s, i) => s + i.start, 0);
    const leftTotal = food.reduce((s, i) => s + session.finalAmounts[i.id], 0);

    // order in which each food first reached zero
    const finishOrder = [];
    steps.forEach(st => {
      food.forEach(i => {
        if (st.after[i.id] === 0 && !finishOrder.includes(i.id)) finishOrder.push(i.id);
      });
    });

    const a = {
      first: steps[0] || null,
      eatCount: steps.filter(s => s.category === 'eat' || s.category === 'sip').length,
      noodleCount: steps.filter(s => s.removed && s.removed.noodles).length,
      seasonCount: steps.filter(s => s.category === 'season').length,
      prepCount: steps.filter(s => s.category === 'prep' && s.actionId !== 'cool_noodles').length,
      finishOrder,
      finalAmounts: session.finalAmounts,
      leftShare: startTotal ? leftTotal / startTotal : 0
    };

    const matches = STYLES.filter(s => s.test(a));
    const style = matches[0];
    const tags = matches.filter(s => s.id !== 'balanced').map(s => s.name);
    const mostUsed = mode(steps.map(s => s.actionId));
    return { style, tags, mostUsed, finishOrder, leftShare: a.leftShare };
  }

  function actionLabel(meal, id) {
    const act = meal.actions.find(x => x.id === id);
    return act ? act.label : id;
  }

  function fmtTime(ms) {
    const total = Math.round(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function pct(n, d) {
    return d ? Math.round(100 * n / d) + '%' : '0%';
  }

  function card(k, v, s) {
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

  function show(session, analysis, history, meal) {
    const view = document.getElementById('results-view');
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
    const openings = history.map(s => s.steps[0] && s.steps[0].actionId).filter(Boolean);
    const myOpen = session.steps[0].actionId;
    const sameOpen = openings.filter(x => x === myOpen).length;
    const topOpen = mode(openings);
    const allActions = [];
    history.forEach(s => s.steps.forEach(st => allActions.push(st.actionId)));
    const topAction = mode(allActions);
    const topStyle = mode(history.map(s => s.styleId).filter(Boolean));
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
      n.textContent = st.n;
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
    again.addEventListener('click', () => window.Game.restart());
    btns.appendChild(again);
    view.appendChild(btns);
  }

  return { analyze, show, STYLES };
})();

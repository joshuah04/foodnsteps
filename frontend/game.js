// Game screen: draws the bowl, handles the action menu, animations and step log
window.Game = (function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const meal = window.MEALS.ramen;
  const CENTER = { x: 360, y: 300 };
  const BROTH_MAX_R = 200;
  const BROTH_MIN_R = 70;

  const scene = document.getElementById('scene');
  const stage = document.getElementById('stage');
  const menu = document.getElementById('menu');
  const finishBtn = document.getElementById('finish-btn');
  const restartBtn = document.getElementById('restart-btn');

  let state = null;
  let busy = false;
  let selectedId = null;
  let pieceEls = {};
  let groupEls = {};
  let brothEl = null;

  const ingById = id => meal.ingredients.find(i => i.id === id);
  const foodIngredients = () => meal.ingredients.filter(i => i.kind === 'food');

  function newState() {
    const amounts = {};
    meal.ingredients.forEach(i => { amounts[i.id] = i.start; });
    return {
      amounts,
      steps: [],
      startedAt: Date.now(),
      stirred: false,
      stirCount: 0,
      onionMixed: false,
      spice: { salt: 0, pepper: 0, chili: 0 }
    };
  }

  // ---------- rules ----------

  function actionStatus(action) {
    const a = state.amounts;
    for (const key of Object.keys(action.consume)) {
      if (a[key] <= 0) return { ok: false, reason: 'No ' + ingById(key).name.toLowerCase() + ' left' };
    }
    const req = action.requires || {};
    for (const [key, v] of Object.entries(req.min || {})) {
      if (a[key] < v) return { ok: false, reason: action.requiresText || 'Not available' };
    }
    for (const [key, v] of Object.entries(req.max || {})) {
      if (a[key] > v) return { ok: false, reason: action.requiresText || 'Not available' };
    }
    return { ok: true, reason: '' };
  }

  function planAction(action) {
    const removed = {};
    let note = '';
    for (const [key, need] of Object.entries(action.consume)) {
      const take = Math.min(need, state.amounts[key]);
      if (take > 0) removed[key] = take;
    }
    // a stirred bowl means broth carries some toppings with it
    if (state.stirred && action.target === 'broth') {
      let best = null;
      meal.mixedToppings.forEach(id => {
        if (state.amounts[id] > 0 && (!best || state.amounts[id] > state.amounts[best])) best = id;
      });
      if (best) {
        removed[best] = (removed[best] || 0) + 1;
        note = 'picked up some ' + ingById(best).name.toLowerCase();
      }
    }
    return { removed, note };
  }

  function commit(action, plan) {
    for (const [key, n] of Object.entries(plan.removed)) state.amounts[key] -= n;
    if (action.effect === 'stir') { state.stirred = true; state.stirCount += 1; }
    if (action.effect === 'spice') state.spice[action.target] += 1;
    if (action.effect === 'mixOnion') state.onionMixed = true;

    state.steps.push({
      n: state.steps.length + 1,
      actionId: action.id,
      label: action.label,
      target: action.target,
      category: action.category,
      t: Date.now() - state.startedAt,
      removed: plan.removed,
      note: plan.note,
      after: Object.assign({}, state.amounts)
    });
  }

  function foodLeft() {
    return foodIngredients().reduce((sum, i) => sum + state.amounts[i.id], 0);
  }

  // ---------- drawing helpers ----------

  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  // small seeded random so spice specks stay in the same place between renders
  function seeded(seed) {
    let s = seed;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function brothColor() {
    let r = 233, g = 211, b = 168;
    const chili = Math.min(state.spice.chili * 0.14, 0.6);
    r += (214 - r) * chili; g += (95 - g) * chili; b += (55 - b) * chili;
    const dark = Math.min(state.spice.pepper * 0.05, 0.2);
    r *= 1 - dark; g *= 1 - dark; b *= 1 - dark;
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  function brothRadius(amount) {
    const start = ingById('broth').start;
    if (amount <= 0) return 0;
    return BROTH_MIN_R + (BROTH_MAX_R - BROTH_MIN_R) * (amount / start);
  }

  function drawPiece(ing, p, i, parent) {
    const g = el('g', { class: 'piece', 'data-piece': i }, parent);
    const c = ing.color;
    switch (ing.shape) {
      case 'noodle':
        el('path', {
          d: 'M ' + (p.x - 60) + ' ' + p.y + ' q 10 -9 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0',
          fill: 'none', stroke: c, 'stroke-width': 6, 'stroke-linecap': 'round'
        }, g);
        break;
      case 'slice':
        el('circle', { cx: p.x, cy: p.y, r: 30, fill: c, stroke: '#b86b6b', 'stroke-width': 3 }, g);
        el('circle', { cx: p.x, cy: p.y, r: 13, fill: 'none', stroke: '#c98282', 'stroke-width': 3 }, g);
        break;
      case 'egg':
        el('ellipse', { cx: p.x, cy: p.y, rx: 24, ry: 30, fill: c, stroke: '#ddd2bf', 'stroke-width': 2 }, g);
        el('circle', { cx: p.x, cy: p.y + 2, r: 12, fill: '#f2994a' }, g);
        break;
      case 'ring':
        el('circle', { cx: p.x, cy: p.y, r: 8, fill: '#e8f8e0', stroke: c, 'stroke-width': 5 }, g);
        break;
      case 'stick':
        el('rect', {
          x: p.x - 6, y: p.y - 20, width: 12, height: 40, rx: 3, fill: c, stroke: '#9c7440', 'stroke-width': 2,
          transform: 'rotate(20 ' + p.x + ' ' + p.y + ')'
        }, g);
        break;
      case 'sheet':
        el('rect', {
          x: p.x - 22, y: p.y - 38, width: 44, height: 76, rx: 4, fill: c, stroke: '#13291b', 'stroke-width': 2,
          transform: 'rotate(-8 ' + p.x + ' ' + p.y + ')'
        }, g);
        break;
      case 'cube':
        el('rect', { x: p.x - 8, y: p.y - 8, width: 16, height: 16, rx: 3, fill: c, stroke: '#d4ad2c', 'stroke-width': 2 }, g);
        break;
    }
    return g;
  }

  function drawShaker(ing, parent) {
    const p = ing.pieces[0];
    el('rect', { x: p.x - 18, y: p.y - 54, width: 36, height: 14, rx: 4, fill: '#b5aca3' }, parent);
    el('rect', { x: p.x - 26, y: p.y - 42, width: 52, height: 88, rx: 12, fill: ing.color, stroke: '#9a9087', 'stroke-width': 2 }, parent);
    const dotFill = ing.id === 'salt' ? '#b9b0a7' : '#f6f1ea';
    const els = [];
    for (let i = 0; i < ing.start; i++) {
      const g = el('g', { class: 'piece', 'data-piece': i }, parent);
      el('circle', { cx: p.x, cy: p.y - 22 + i * 22, r: 7, fill: dotFill }, g);
      if (i >= state.amounts[ing.id]) g.setAttribute('visibility', 'hidden');
      els.push(g);
    }
    return els;
  }

  function addHitArea(group, pad) {
    let box;
    try { box = group.getBBox(); } catch (err) { return; }
    if (!box || box.width === 0) return;
    const hit = el('rect', {
      x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2,
      fill: 'transparent'
    });
    group.insertBefore(hit, group.firstChild);
  }

  function drawBrothDetails(parent, r) {
    if (r <= 0) return;
    const rand = seeded(7);
    for (let i = 0; i < state.spice.pepper * 8; i++) {
      const ang = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * (r - 8);
      el('circle', { cx: CENTER.x + Math.cos(ang) * d, cy: CENTER.y + Math.sin(ang) * d, r: 1.8, fill: '#3a2a20' }, parent);
    }
    const rand2 = seeded(31);
    for (let i = 0; i < state.spice.chili * 4; i++) {
      const ang = rand2() * Math.PI * 2;
      const d = Math.sqrt(rand2()) * (r - 12);
      el('circle', {
        cx: CENTER.x + Math.cos(ang) * d, cy: CENTER.y + Math.sin(ang) * d,
        r: 5 + rand2() * 6, fill: '#e0552f', opacity: 0.55
      }, parent);
    }
    if (state.stirred) {
      const s = Math.min(r - 10, 150);
      el('path', {
        d: 'M ' + (CENTER.x + s) + ' ' + CENTER.y +
          ' A ' + s + ' ' + s + ' 0 1 1 ' + CENTER.x + ' ' + (CENTER.y - s) +
          ' A ' + (s * 0.6) + ' ' + (s * 0.6) + ' 0 1 1 ' + (CENTER.x + s * 0.3) + ' ' + CENTER.y,
        fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 3, 'stroke-linecap': 'round'
      }, parent);
    }
  }

  // ---------- render ----------

  function render() {
    scene.innerHTML = '';
    pieceEls = {};
    groupEls = {};

    el('rect', { x: 0, y: 0, width: 800, height: 600, fill: '#fdfaf5' }, scene);
    el('ellipse', { cx: CENTER.x, cy: 545, rx: 200, ry: 22, fill: 'rgba(0,0,0,0.08)' }, scene);

    const bowl = el('g', { 'data-ing': 'bowl' }, scene);
    el('circle', { cx: CENTER.x, cy: CENTER.y, r: 232, fill: '#b03a2e', stroke: '#7d241b', 'stroke-width': 6 }, bowl);
    el('circle', { cx: CENTER.x, cy: CENTER.y, r: 220, fill: 'none', stroke: '#e07a62', 'stroke-width': 3, 'stroke-dasharray': '6 10' }, bowl);
    el('circle', { cx: CENTER.x, cy: CENTER.y, r: 207, fill: '#4a3426' }, bowl);
    groupEls.bowl = bowl;

    const spin = el('g', { id: 'spin' }, scene);
    spin.style.transformBox = 'view-box';
    spin.style.transformOrigin = CENTER.x + 'px ' + CENTER.y + 'px';
    groupEls.spin = spin;

    const brothGroup = el('g', { 'data-ing': 'broth' }, spin);
    const r = brothRadius(state.amounts.broth);
    brothEl = el('circle', { cx: CENTER.x, cy: CENTER.y, r: Math.max(r, 0.01), fill: brothColor() }, brothGroup);
    brothEl.style.transformBox = 'view-box';
    brothEl.style.transformOrigin = CENTER.x + 'px ' + CENTER.y + 'px';
    if (r <= 0) brothEl.setAttribute('visibility', 'hidden');
    drawBrothDetails(brothGroup, r);
    groupEls.broth = brothGroup;

    const sides = el('g', { id: 'sides' }, scene);

    meal.ingredients.forEach(ing => {
      if (ing.shape === 'broth') return;
      const parent = ing.kind === 'side' ? sides : spin;
      const g = el('g', { 'data-ing': ing.id }, parent);
      groupEls[ing.id] = g;
      if (ing.shape === 'shaker') {
        pieceEls[ing.id] = drawShaker(ing, g);
      } else {
        pieceEls[ing.id] = ing.pieces.map((p, i) => {
          const piece = drawPiece(ing, p, i, g);
          if (i >= state.amounts[ing.id]) piece.setAttribute('visibility', 'hidden');
          return piece;
        });
      }
      addHitArea(g, 6);
    });

    const labels = el('g', { id: 'labels' }, scene);
    meal.ingredients.forEach(ing => {
      const amt = state.amounts[ing.id];
      const text = ing.kind === 'side' ? ing.name + ' (' + amt + ')' : ing.name + ' ' + amt;
      const t = el('text', {
        x: ing.label.x, y: ing.label.y, 'text-anchor': 'middle',
        class: 'label' + (amt <= 0 ? ' empty' : ''), 'data-ing': ing.id
      }, labels);
      t.textContent = text;
    });
    const bowlLabel = el('text', { x: CENTER.x, y: 585, 'text-anchor': 'middle', class: 'label', 'data-ing': 'bowl' }, labels);
    bowlLabel.textContent = state.stirred ? 'Bowl (stirred)' : 'Bowl (click rim to stir)';

    el('g', { id: 'fx' }, scene);

    if (selectedId && groupEls[selectedId]) groupEls[selectedId].classList.add('selected');
    renderPanel();
  }

  function renderPanel() {
    document.getElementById('meal-name').textContent = meal.name;
    document.getElementById('meal-desc').textContent = meal.description;

    const status = document.getElementById('bowl-status');
    status.innerHTML = '';
    const badges = [];
    if (state.stirred) badges.push('Stirred x' + state.stirCount);
    if (state.onionMixed) badges.push('Onion mixed in');
    if (state.spice.salt) badges.push('Salt ' + state.spice.salt);
    if (state.spice.pepper) badges.push('Pepper ' + state.spice.pepper);
    if (state.spice.chili) badges.push('Chili ' + state.spice.chili);
    if (foodLeft() === 0) badges.push('Bowl empty');
    if (!badges.length) badges.push('Fresh bowl');
    badges.forEach(b => {
      const s = document.createElement('span');
      s.className = 'badge';
      s.textContent = b;
      status.appendChild(s);
    });

    const list = document.getElementById('amounts');
    list.innerHTML = '';
    meal.ingredients.forEach(ing => {
      const amt = state.amounts[ing.id];
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', ing.name + ', ' + amt + ' of ' + ing.start + ' left');
      const name = document.createElement('span');
      name.textContent = ing.name;
      const count = document.createElement('span');
      count.className = 'muted';
      count.textContent = amt + ' / ' + ing.start;
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('span');
      fill.style.width = (100 * amt / ing.start) + '%';
      fill.style.background = ing.color;
      if (ing.id === 'salt' || ing.id === 'egg') fill.style.boxShadow = 'inset 0 0 0 1px #c9bfb4';
      bar.appendChild(fill);
      btn.append(name, count, bar);
      btn.addEventListener('click', ev => { ev.stopPropagation(); openMenu(ing.id, null); });
      li.appendChild(btn);
      list.appendChild(li);
    });

    const steps = document.getElementById('steps');
    steps.innerHTML = '';
    state.steps.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s.label;
      if (s.note) {
        const n = document.createElement('span');
        n.className = 'muted';
        n.textContent = ' (' + s.note + ')';
        li.appendChild(n);
      }
      steps.appendChild(li);
    });
    steps.scrollTop = steps.scrollHeight;
    document.getElementById('step-count').textContent = state.steps.length ? '(' + state.steps.length + ')' : '';

    finishBtn.disabled = state.steps.length === 0;
    finishBtn.classList.toggle('pulse', foodLeft() === 0);
  }

  // ---------- action menu ----------

  function svgToStage(x, y) {
    const rect = scene.getBoundingClientRect();
    const scale = rect.width / 800;
    return { x: x * scale, y: y * scale };
  }

  function openMenu(ingId, ev) {
    if (busy) return;
    const actions = meal.actions.filter(a => a.target === ingId);
    if (!actions.length) return;

    selectedId = ingId;
    Object.values(groupEls).forEach(g => g.classList.remove('selected'));
    if (groupEls[ingId]) groupEls[ingId].classList.add('selected');

    const ing = ingById(ingId);
    menu.innerHTML = '';
    const title = document.createElement('h4');
    title.textContent = ing ? ing.name + ' (' + state.amounts[ingId] + ' left)' : 'Bowl';
    menu.appendChild(title);

    actions.forEach(action => {
      const st = actionStatus(action);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = action.label;
      btn.disabled = !st.ok;
      if (!st.ok) {
        const why = document.createElement('span');
        why.className = 'why';
        why.textContent = st.reason;
        btn.appendChild(why);
      }
      btn.addEventListener('click', e => { e.stopPropagation(); runAction(action); });
      menu.appendChild(btn);
    });

    menu.hidden = false;
    const stageRect = stage.getBoundingClientRect();
    let x, y;
    if (ev) {
      x = ev.clientX - stageRect.left + 10;
      y = ev.clientY - stageRect.top + 10;
    } else {
      const anchor = ing ? ing.label : { x: CENTER.x, y: 560 };
      const p = svgToStage(anchor.x, anchor.y);
      x = p.x + 10;
      y = p.y + 10;
      stage.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    x = Math.max(8, Math.min(x, stageRect.width - w - 8));
    y = Math.max(8, Math.min(y, stageRect.height - h - 8));
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    const first = menu.querySelector('button:not(:disabled)');
    if (first) first.focus({ preventScroll: true });
  }

  function closeMenu() {
    menu.hidden = true;
    selectedId = null;
    Object.values(groupEls).forEach(g => g.classList.remove('selected'));
  }

  // ---------- animations ----------

  function floatText(text, x, y) {
    const fx = scene.querySelector('#fx');
    const t = el('text', { x, y, 'text-anchor': 'middle', class: 'label fx-item' }, fx);
    t.textContent = text;
    t.animate(
      [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-40px)', opacity: 0 }],
      { duration: 900, easing: 'ease-out', fill: 'forwards' }
    );
  }

  function removalPieces(plan) {
    const out = [];
    for (const [id, n] of Object.entries(plan.removed)) {
      const els = pieceEls[id] || [];
      const amt = state.amounts[id];
      for (let i = amt - 1; i >= amt - n && i >= 0; i--) {
        if (els[i]) out.push({ id, el: els[i] });
      }
    }
    return out;
  }

  function pieceCenter(pieceEl) {
    try {
      const b = pieceEl.getBBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    } catch (err) {
      return { x: CENTER.x, y: CENTER.y };
    }
  }

  function animateAction(action, plan) {
    const pieces = removalPieces(plan);
    let duration = 650;

    pieces.forEach(({ id, el: pieceEl }) => {
      if (id === 'broth') return;
      if (ingById(id).kind === 'side') {
        pieceEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
        return;
      }
      const c = pieceCenter(pieceEl);
      const up = -(c.y + 60);
      if (action.anim === 'dip') {
        const dx = (CENTER.x - c.x) * 0.6;
        const dy = (CENTER.y - c.y) * 0.6;
        pieceEl.animate([
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(0.9)', opacity: 1, offset: 0.45 },
          { transform: 'translate(' + dx + 'px, ' + up + 'px) scale(0.3)', opacity: 0 }
        ], { duration: 800, easing: 'ease-in-out', fill: 'forwards' });
        duration = 820;
      } else {
        pieceEl.animate([
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          { transform: 'translate(0px, -14px) scale(1.1)', opacity: 1, offset: 0.25 },
          { transform: 'translate(0px, ' + up + 'px) scale(0.3)', opacity: 0 }
        ], { duration: 650, easing: 'ease-in', fill: 'forwards' });
      }
    });

    // broth shrinks toward its new size
    if (plan.removed.broth) {
      const oldR = brothRadius(state.amounts.broth);
      const newR = brothRadius(state.amounts.broth - plan.removed.broth);
      const k = oldR > 0 ? Math.max(newR / oldR, 0.01) : 1;
      brothEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + k + ')' }],
        { duration: 650, easing: 'ease-in-out', fill: 'forwards' });
    }

    const fx = scene.querySelector('#fx');

    if (action.anim === 'sip') {
      const spoon = el('g', { class: 'fx-item' }, fx);
      el('rect', { x: CENTER.x + 14, y: CENTER.y - 6, width: 120, height: 12, rx: 6, fill: '#efe9e1', stroke: '#9a9087', 'stroke-width': 2 }, spoon);
      el('ellipse', { cx: CENTER.x, cy: CENTER.y, rx: 30, ry: 20, fill: '#efe9e1', stroke: '#9a9087', 'stroke-width': 2 }, spoon);
      el('ellipse', { cx: CENTER.x, cy: CENTER.y, rx: 20, ry: 12, fill: brothColor() }, spoon);
      spoon.animate([
        { transform: 'translate(160px, 40px)', opacity: 0 },
        { transform: 'translate(40px, 30px)', opacity: 1, offset: 0.35 },
        { transform: 'translate(40px, 30px)', opacity: 1, offset: 0.55 },
        { transform: 'translate(40px, -340px)', opacity: 0.2 }
      ], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
      duration = 900;
    }

    if (action.anim === 'drink') {
      groupEls.spin.animate([
        { transform: 'rotate(0deg) translateY(0px)' },
        { transform: 'rotate(-10deg) translateY(-30px)', offset: 0.5 },
        { transform: 'rotate(0deg) translateY(0px)' }
      ], { duration: 900, easing: 'ease-in-out' });
      groupEls.bowl.animate([
        { transform: 'translateY(0px)' }, { transform: 'translateY(-30px)', offset: 0.5 }, { transform: 'translateY(0px)' }
      ], { duration: 900, easing: 'ease-in-out' });
      duration = 900;
    }

    if (action.anim === 'lift') {
      groupEls.noodles.animate([
        { transform: 'translateY(0px)' }, { transform: 'translateY(-50px)', offset: 0.4 },
        { transform: 'translateY(-50px)', offset: 0.7 }, { transform: 'translateY(0px)' }
      ], { duration: 1000, easing: 'ease-in-out' });
      for (let i = 0; i < 3; i++) {
        const x = CENTER.x - 30 + i * 30;
        const steam = el('path', {
          d: 'M ' + x + ' 240 q -10 -15 0 -30 t 0 -30', fill: 'none',
          stroke: '#b9b0a7', 'stroke-width': 4, 'stroke-linecap': 'round', class: 'fx-item'
        }, fx);
        steam.animate([
          { transform: 'translateY(0px)', opacity: 0 },
          { transform: 'translateY(-20px)', opacity: 0.9, offset: 0.4 },
          { transform: 'translateY(-60px)', opacity: 0 }
        ], { duration: 1000, delay: i * 120, fill: 'forwards' });
      }
      duration = 1050;
    }

    if (action.anim === 'mix') {
      (pieceEls.onion || []).forEach((p, i) => {
        if (i >= state.amounts.onion) return;
        const c = pieceCenter(p);
        const dx = (CENTER.x - c.x) * 0.5;
        const dy = (CENTER.y - c.y) * 0.5;
        p.animate([
          { transform: 'translate(0px, 0px) rotate(0deg)' },
          { transform: 'translate(' + dx + 'px, ' + dy + 'px) rotate(180deg)', offset: 0.5 },
          { transform: 'translate(0px, 0px) rotate(360deg)' }
        ], { duration: 900, easing: 'ease-in-out' });
      });
      duration = 900;
    }

    if (action.anim === 'stir') {
      groupEls.spin.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
        { duration: 1000, easing: 'ease-in-out' });
      const chop = el('g', { class: 'fx-item' }, fx);
      el('rect', { x: CENTER.x - 4, y: CENTER.y - 190, width: 8, height: 170, rx: 4, fill: '#8b5a2b' }, chop);
      el('rect', { x: CENTER.x + 10, y: CENTER.y - 190, width: 8, height: 170, rx: 4, fill: '#8b5a2b' }, chop);
      chop.style.transformBox = 'view-box';
      chop.style.transformOrigin = CENTER.x + 'px ' + CENTER.y + 'px';
      chop.animate([
        { transform: 'rotate(0deg)', opacity: 0 }, { transform: 'rotate(60deg)', opacity: 1, offset: 0.15 },
        { transform: 'rotate(330deg)', opacity: 1, offset: 0.85 }, { transform: 'rotate(360deg)', opacity: 0 }
      ], { duration: 1000, easing: 'ease-in-out', fill: 'forwards' });
      duration = 1000;
    }

    if (action.anim === 'season') {
      const ing = ingById(action.target);
      const from = ing.pieces[0];
      const rand = seeded(state.steps.length + 3);
      const dotColor = ing.id === 'salt' ? '#ffffff' : ing.color;
      for (let i = 0; i < 14; i++) {
        const tx = CENTER.x + (rand() - 0.5) * 220 - from.x;
        const ty = CENTER.y + (rand() - 0.5) * 220 - (from.y - 50);
        const dot = el('circle', {
          cx: from.x, cy: from.y - 50, r: ing.id === 'chili' ? 5 : 3,
          fill: dotColor, stroke: '#7a6e66', 'stroke-width': 0.8, class: 'fx-item'
        }, fx);
        dot.animate([
          { transform: 'translate(0px, 0px)', opacity: 1 },
          { transform: 'translate(' + tx + 'px, ' + ty + 'px)', opacity: 0.2 }
        ], { duration: 700, delay: i * 25, easing: 'ease-in', fill: 'forwards' });
      }
      groupEls[ing.id].animate([
        { transform: 'rotate(0deg)' }, { transform: 'rotate(-35deg)', offset: 0.3 },
        { transform: 'rotate(-35deg)', offset: 0.7 }, { transform: 'rotate(0deg)' }
      ], { duration: 900, easing: 'ease-in-out' });
      groupEls[ing.id].style.transformBox = 'fill-box';
      groupEls[ing.id].style.transformOrigin = 'center';
      duration = 1000;
    }

    const ing = ingById(action.target);
    const anchor = ing ? ing.label : { x: CENTER.x, y: 560 };
    floatText(action.label, anchor.x, anchor.y - 20);

    return new Promise(resolve => setTimeout(resolve, duration));
  }

  function runAction(action) {
    if (busy) return;
    if (!actionStatus(action).ok) return;
    closeMenu();
    const plan = planAction(action);
    busy = true;
    animateAction(action, plan).then(() => {
      commit(action, plan);
      busy = false;
      render();
    });
  }

  // ---------- finish and restart ----------

  function finish() {
    if (busy || state.steps.length === 0) return;
    closeMenu();
    const finishedAt = Date.now();
    const session = {
      id: 's' + finishedAt.toString(36) + Math.random().toString(36).slice(2, 7),
      mealId: meal.id,
      startedAt: new Date(state.startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      durationMs: finishedAt - state.startedAt,
      completed: foodLeft() === 0,
      steps: state.steps,
      finalAmounts: Object.assign({}, state.amounts),
      spice: Object.assign({}, state.spice),
      stirCount: state.stirCount
    };
    const analysis = window.Results.analyze(session, meal);
    session.styleId = analysis.style.id;
    const history = window.Store.save(session).filter(s => s.mealId === meal.id);
    document.getElementById('game-view').hidden = true;
    window.Results.show(session, analysis, history, meal);
    window.scrollTo(0, 0);
  }

  function restart() {
    state = newState();
    busy = false;
    closeMenu();
    document.getElementById('results-view').hidden = true;
    document.getElementById('game-view').hidden = false;
    render();
  }

  // ---------- events ----------

  scene.addEventListener('click', ev => {
    const target = ev.target.closest('[data-ing]');
    ev.stopPropagation();
    if (!target) { closeMenu(); return; }
    openMenu(target.getAttribute('data-ing'), ev);
  });
  menu.addEventListener('click', ev => ev.stopPropagation());
  document.addEventListener('click', () => { if (!menu.hidden) closeMenu(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', closeMenu);
  finishBtn.addEventListener('click', finish);
  restartBtn.addEventListener('click', restart);

  restart();

  return { restart };
})();

// Game screen: draws the meal, handles the meal picker, action menu, animations and step log
import { actionsFor, actionStatus, brightness, buildSession, commit, foodLeft, ingById as findIngredient, newState, planAction } from './rules';
import { analyze } from './analysis';
import { getResults, saveSession } from './api';
import * as Results from './results';
import type { Action, GameState, Ingredient, Meal, Plan, Point } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTER: Point = { x: 360, y: 300 };
const BROTH_MAX_R = 200;
const BROTH_MIN_R = 70;
// background of the tray scene, also used to cut bite marks out of the burger
const TRAY_COLOR = '#e9dccb';
const PLATE_COLOR = '#ffffff';

type Attrs = Record<string, string | number>;

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error('Missing element #' + id);
  return node as T;
}

// builds an SVG element, sets its attributes and attaches it to a parent
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.appendChild(node);
  return node;
}

// small seeded random so spice specks stay in the same place between renders
function seeded(seed: number): () => number {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export interface Game {
  restart: () => void;
  setMeal: (id: string) => void;
}

export function createGame(meals: Meal[], startId?: string): Game {
  const scene = byId<HTMLElement>('scene') as unknown as SVGSVGElement;
  const stage = byId<HTMLDivElement>('stage');
  const menu = byId<HTMLDivElement>('menu');
  const finishBtn = byId<HTMLButtonElement>('finish-btn');
  const restartBtn = byId<HTMLButtonElement>('restart-btn');
  const picker = byId<HTMLDivElement>('meal-picker');

  let meal: Meal = meals.find(m => m.id === startId) ?? meals[0];
  let state: GameState = newState(meal);
  let busy = false;
  let selectedId: string | null = null;
  let pieceEls: Record<string, SVGGElement[]> = {};
  let groupEls: Record<string, SVGGElement> = {};
  let brothEl: SVGCircleElement | null = null;

  const ingById = (id: string): Ingredient | undefined => findIngredient(meal, id);

  function mustIng(id: string): Ingredient {
    const ing = ingById(id);
    if (!ing) throw new Error('Unknown ingredient ' + id);
    return ing;
  }

  // ---------- drawing helpers ----------

  function brothColor(): string {
    let r = 233, g = 211, b = 168;
    const chili = Math.min(state.spice.chili * 0.14, 0.6);
    r += (214 - r) * chili; g += (95 - g) * chili; b += (55 - b) * chili;
    const dark = Math.min(state.spice.pepper * 0.05, 0.2);
    r *= 1 - dark; g *= 1 - dark; b *= 1 - dark;
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  function brothRadius(amount: number): number {
    const start = mustIng('broth').start;
    if (amount <= 0) return 0;
    return BROTH_MIN_R + (BROTH_MAX_R - BROTH_MIN_R) * (amount / start);
  }

  function drawPiece(ing: Ingredient, p: Point, i: number, parent: Element): SVGGElement {
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
      default:
        break;
    }
    return g;
  }

  function drawShaker(ing: Ingredient, parent: Element): SVGGElement[] {
    const p = ing.pieces[0];
    el('rect', { x: p.x - 18, y: p.y - 54, width: 36, height: 14, rx: 4, fill: '#b5aca3' }, parent);
    el('rect', { x: p.x - 26, y: p.y - 42, width: 52, height: 88, rx: 12, fill: ing.color, stroke: '#9a9087', 'stroke-width': 2 }, parent);
    const dotFill = ing.id === 'salt' ? '#b9b0a7' : '#f6f1ea';
    const els: SVGGElement[] = [];
    for (let i = 0; i < ing.start; i++) {
      const g = el('g', { class: 'piece', 'data-piece': i }, parent);
      el('circle', { cx: p.x, cy: p.y - 22 + i * 22, r: 7, fill: dotFill }, g);
      if (i >= state.amounts[ing.id]) g.setAttribute('visibility', 'hidden');
      els.push(g);
    }
    return els;
  }

  function addHitArea(group: SVGGElement, pad: number): void {
    let box: DOMRect;
    try { box = group.getBBox(); } catch { return; }
    if (!box || box.width === 0) return;
    const hit = el('rect', {
      x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2,
      fill: 'transparent'
    });
    group.insertBefore(hit, group.firstChild);
  }

  function drawBrothDetails(parent: Element, r: number): void {
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

  function render(): void {
    scene.innerHTML = '';
    pieceEls = {};
    groupEls = {};
    brothEl = null;
    scene.setAttribute('aria-label', meal.name);

    if (meal.scene === 'tray') renderTray();
    else renderBowl();

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
    if (meal.scene === 'bowl') {
      const bowlLabel = el('text', { x: CENTER.x, y: 585, 'text-anchor': 'middle', class: 'label', 'data-ing': 'bowl' }, labels);
      bowlLabel.textContent = state.stirred ? 'Bowl (stirred)' : 'Bowl (click rim to stir)';
    }

    el('g', { id: 'fx' }, scene);

    if (selectedId && groupEls[selectedId]) groupEls[selectedId].classList.add('selected');
    renderPanel();
  }

  function renderBowl(): void {
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
    const broth = el('circle', { cx: CENTER.x, cy: CENTER.y, r: Math.max(r, 0.01), fill: brothColor() }, brothGroup);
    broth.style.transformBox = 'view-box';
    broth.style.transformOrigin = CENTER.x + 'px ' + CENTER.y + 'px';
    if (r <= 0) broth.setAttribute('visibility', 'hidden');
    brothEl = broth;
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
  }

  // ---------- tray scene: burger, fries, condiment, drink ----------

  function renderTray(): void {
    el('rect', { x: 0, y: 0, width: 800, height: 600, fill: '#fdfaf5' }, scene);
    el('rect', { x: 30, y: 60, width: 740, height: 520, rx: 28, fill: TRAY_COLOR, stroke: '#cdbba5', 'stroke-width': 4 }, scene);
    el('rect', { x: 48, y: 78, width: 704, height: 484, rx: 20, fill: 'none', stroke: '#d8c7b2', 'stroke-width': 2, 'stroke-dasharray': '6 10' }, scene);

    meal.ingredients.forEach(ing => {
      const g = el('g', { 'data-ing': ing.id }, scene);
      groupEls[ing.id] = g;
      switch (ing.shape) {
        case 'burger': pieceEls[ing.id] = drawBurger(ing, g); break;
        case 'fries': pieceEls[ing.id] = drawFries(ing, g); break;
        case 'drink': pieceEls[ing.id] = drawDrink(ing, g); break;
        case 'cup': pieceEls[ing.id] = drawCondiment(ing, g); break;
        case 'pickle': pieceEls[ing.id] = drawPickleDish(ing, g); break;
        default:
          pieceEls[ing.id] = ing.pieces.map((p, i) => {
            const piece = drawPiece(ing, p, i, g);
            if (i >= state.amounts[ing.id]) piece.setAttribute('visibility', 'hidden');
            return piece;
          });
      }
      addHitArea(g, 6);
    });
  }

  // pickles the player has put on the burger so far
  function picklesAdded(): number {
    const p = ingById('pickles');
    return p ? p.start - state.amounts.pickles : 0;
  }

  function drawBurger(ing: Ingredient, parent: SVGGElement): SVGGElement[] {
    const c = ing.pieces[0];
    const width = 220;
    const left = c.x - width / 2;
    const layers = [...(ing.layers ?? [])];
    // added pickles sit just under the top bun
    const extra = picklesAdded();
    if (extra > 0 && layers.length >= 2) {
      layers.splice(layers.length - 1, 0, { name: 'Pickles x' + extra, color: '#7aa53a', height: 8 + extra * 2 });
    }
    const total = layers.reduce((sum, l) => sum + l.height, 0);
    let y = c.y + total / 2;

    el('ellipse', { cx: c.x, cy: c.y + 18, rx: 175, ry: 165, fill: PLATE_COLOR, stroke: '#d6cec4', 'stroke-width': 3 }, parent);
    el('ellipse', { cx: c.x, cy: c.y + 18, rx: 150, ry: 140, fill: 'none', stroke: '#eee8e0', 'stroke-width': 2 }, parent);

    // bites are cut from the right side with a mask, leaving round bite marks
    const leftShare = state.amounts[ing.id] / ing.start;
    const mask = el('mask', { id: 'bite-mask' }, parent);
    const keep = left + width * leftShare + (leftShare > 0 && leftShare < 1 ? 6 : 0);
    el('rect', { x: left - 20, y: y - total - 20, width: Math.max(keep - left + 20, 0), height: total + 40, fill: '#ffffff' }, mask);
    if (leftShare > 0 && leftShare < 1) {
      const span = total / 3;
      for (let i = 0; i < 3; i++) {
        el('circle', { cx: keep + 4, cy: y - total + span * (i + 0.5), r: span * 0.62, fill: '#000000' }, mask);
      }
    }
    const stack = el('g', { class: 'piece', mask: 'url(#bite-mask)' }, parent);
    el('ellipse', { cx: c.x, cy: y + 4, rx: width / 2 + 6, ry: 10, fill: 'rgba(0,0,0,0.10)' }, stack);

    const labelGroup = el('g', {}, parent);
    layers.forEach((layer, i) => {
      const top = y - layer.height;
      const isTop = i === layers.length - 1;
      const isBottom = i === 0;
      if (isTop) {
        el('path', {
          d: 'M ' + left + ' ' + y + ' L ' + left + ' ' + (top + 30) +
            ' Q ' + left + ' ' + top + ' ' + c.x + ' ' + top +
            ' Q ' + (left + width) + ' ' + top + ' ' + (left + width) + ' ' + (top + 30) +
            ' L ' + (left + width) + ' ' + y + ' Z',
          fill: layer.color, stroke: '#a8743a', 'stroke-width': 2
        }, stack);
        // sesame seeds
        [[-60, 16], [-25, 10], [15, 12], [55, 18], [-40, 30], [35, 30]].forEach(([dx, dy]) => {
          el('ellipse', { cx: c.x + dx, cy: top + dy, rx: 5, ry: 3, fill: '#fbf0d9' }, stack);
        });
      } else if (isBottom) {
        el('rect', { x: left, y: top, width, height: layer.height, rx: 12, fill: layer.color, stroke: '#a8743a', 'stroke-width': 2 }, stack);
      } else if (layer.name === 'Cheese') {
        // cheese hangs over the patty in a few drips
        el('path', {
          d: 'M ' + (left - 6) + ' ' + top + ' L ' + (left + width + 6) + ' ' + top +
            ' L ' + (left + width + 6) + ' ' + y + ' L ' + (c.x + 50) + ' ' + y + ' L ' + (c.x + 38) + ' ' + (y + 14) +
            ' L ' + (c.x + 26) + ' ' + y + ' L ' + (c.x - 40) + ' ' + y + ' L ' + (c.x - 52) + ' ' + (y + 16) +
            ' L ' + (c.x - 64) + ' ' + y + ' L ' + (left - 6) + ' ' + y + ' Z',
          fill: layer.color, stroke: '#d9a62a', 'stroke-width': 1.5
        }, stack);
      } else if (layer.name === 'Lettuce') {
        let d = 'M ' + (left - 10) + ' ' + y + ' L ' + (left - 10) + ' ' + (top + 4);
        for (let x = left - 10; x < left + width + 10; x += 20) d += ' q 5 -8 10 0 t 10 0';
        d += ' L ' + (left + width + 10) + ' ' + y + ' Z';
        el('path', { d, fill: layer.color, stroke: '#4f9a35', 'stroke-width': 1.5 }, stack);
      } else if (layer.name === 'Onions') {
        el('rect', { x: left + 4, y: top, width: width - 8, height: layer.height, rx: 5, fill: 'none' }, stack);
        for (let x = left + 16; x < left + width - 8; x += 26) {
          el('ellipse', { cx: x, cy: top + layer.height / 2, rx: 12, ry: layer.height / 2, fill: layer.color, stroke: '#b78fc0', 'stroke-width': 2 }, stack);
        }
      } else if (layer.name.startsWith('Pickles')) {
        for (let x = left + 22; x < left + width - 10; x += 34) {
          el('ellipse', { cx: x, cy: top + layer.height / 2, rx: 15, ry: layer.height / 2, fill: layer.color, stroke: '#557a24', 'stroke-width': 2 }, stack);
        }
      } else {
        const inset = layer.name === 'Sauce' ? 2 : layer.name === 'Patty' ? -4 : 0;
        el('rect', {
          x: left - inset, y: top, width: width + inset * 2, height: layer.height, rx: layer.height / 2,
          fill: layer.color, stroke: brightness(layer.color) > 200 ? '#cfc2a0' : 'rgba(0,0,0,0.25)', 'stroke-width': 1.5
        }, stack);
      }
      const t = el('text', { x: left - 14, y: top + layer.height / 2 + 4, 'text-anchor': 'end', class: 'layer-label' }, labelGroup);
      t.textContent = layer.name;
      y = top;
    });
    return [];
  }

  function drawFries(ing: Ingredient, parent: SVGGElement): SVGGElement[] {
    const xs = ing.pieces.map(p => p.x);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    // back of the carton, then the fries, then the front so the fries look tucked in
    el('path', { d: 'M ' + (cx - 62) + ' 200 L ' + (cx + 62) + ' 200 L ' + (cx + 50) + ' 320 L ' + (cx - 50) + ' 320 Z', fill: '#a8231a' }, parent);
    const els = ing.pieces.map((p, i) => {
      const g = el('g', { class: 'piece', 'data-piece': i }, parent);
      const tilt = ((i * 37) % 17) - 8;
      el('rect', {
        x: p.x - 6, y: p.y - 34, width: 12, height: 90, rx: 3, fill: ing.color, stroke: '#cf9a12', 'stroke-width': 2,
        transform: 'rotate(' + tilt + ' ' + p.x + ' ' + (p.y + 20) + ')'
      }, g);
      if (i >= state.amounts[ing.id]) g.setAttribute('visibility', 'hidden');
      return g;
    });
    el('path', {
      d: 'M ' + (cx - 66) + ' 228 Q ' + cx + ' 250 ' + (cx + 66) + ' 228 L ' + (cx + 52) + ' 326 L ' + (cx - 52) + ' 326 Z',
      fill: '#d63a2f', stroke: '#9e2219', 'stroke-width': 3
    }, parent);
    el('circle', { cx, cy: 285, r: 16, fill: '#f7c948' }, parent);
    return els;
  }

  function drawDrink(ing: Ingredient, parent: SVGGElement): SVGGElement[] {
    const c = ing.pieces[0];
    const top = c.y - 90;
    const bottom = c.y + 90;
    const halfTop = 44;
    const halfBottom = 34;
    const share = state.amounts[ing.id] / ing.start;
    const fillTop = bottom - (bottom - top - 16) * share;
    const halfAt = (y: number): number => halfBottom + (halfTop - halfBottom) * ((bottom - y) / (bottom - top));
    // straw first so the cup covers its lower half
    el('rect', { x: c.x + 6, y: top - 60, width: 10, height: 150, rx: 4, fill: '#f2f2f2', stroke: '#c0392b', 'stroke-width': 2, transform: 'rotate(12 ' + c.x + ' ' + top + ')' }, parent);
    el('path', {
      d: 'M ' + (c.x - halfTop) + ' ' + top + ' L ' + (c.x + halfTop) + ' ' + top +
        ' L ' + (c.x + halfBottom) + ' ' + bottom + ' L ' + (c.x - halfBottom) + ' ' + bottom + ' Z',
      fill: 'rgba(255,255,255,0.75)', stroke: '#9fb3c8', 'stroke-width': 3
    }, parent);
    if (share > 0) {
      el('path', {
        d: 'M ' + (c.x - halfAt(fillTop) + 3) + ' ' + fillTop + ' L ' + (c.x + halfAt(fillTop) - 3) + ' ' + fillTop +
          ' L ' + (c.x + halfBottom - 3) + ' ' + (bottom - 3) + ' L ' + (c.x - halfBottom + 3) + ' ' + (bottom - 3) + ' Z',
        fill: ing.color
      }, parent);
      // a few bubbles
      [[-12, 30], [10, 55], [-4, 80]].forEach(([dx, dy]) => {
        if (fillTop + dy < bottom - 8) el('circle', { cx: c.x + dx, cy: fillTop + dy, r: 3, fill: 'rgba(255,255,255,0.35)' }, parent);
      });
    }
    el('rect', { x: c.x - halfTop - 4, y: top - 8, width: halfTop * 2 + 8, height: 10, rx: 4, fill: '#dfe7ef', stroke: '#9fb3c8', 'stroke-width': 2 }, parent);
    return [];
  }

  function drawCondiment(ing: Ingredient, parent: SVGGElement): SVGGElement[] {
    const c = ing.pieces[0];
    el('ellipse', { cx: c.x, cy: c.y + 6, rx: 46, ry: 40, fill: '#fafafa', stroke: '#bfb6ac', 'stroke-width': 3 }, parent);
    const share = state.amounts[ing.id] / ing.start;
    if (share > 0) {
      el('ellipse', { cx: c.x, cy: c.y + 6, rx: 12 + 26 * share, ry: 10 + 22 * share, fill: ing.color }, parent);
    }
    return [];
  }

  function drawPickleDish(ing: Ingredient, parent: SVGGElement): SVGGElement[] {
    const xs = ing.pieces.map(p => p.x);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = ing.pieces[0].y - 2;
    el('ellipse', { cx, cy, rx: 66, ry: 30, fill: '#fafafa', stroke: '#bfb6ac', 'stroke-width': 3 }, parent);
    return ing.pieces.map((p, i) => {
      const g = el('g', { class: 'piece', 'data-piece': i }, parent);
      el('ellipse', { cx: p.x, cy: p.y, rx: 15, ry: 10, fill: ing.color, stroke: '#557a24', 'stroke-width': 2 }, g);
      el('ellipse', { cx: p.x, cy: p.y, rx: 8, ry: 5, fill: '#a6c96a' }, g);
      if (i >= state.amounts[ing.id]) g.setAttribute('visibility', 'hidden');
      return g;
    });
  }

  function renderPanel(): void {
    byId('meal-name').textContent = meal.name;
    byId('meal-desc').textContent = meal.description;
    byId('hint').textContent = meal.hint;

    const status = byId('bowl-status');
    status.innerHTML = '';
    const badges: string[] = [];
    if (state.stirred) badges.push('Stirred x' + state.stirCount);
    if (state.onionMixed) badges.push('Onion mixed in');
    if (state.spice.salt) badges.push('Salt ' + state.spice.salt);
    if (state.spice.pepper) badges.push('Pepper ' + state.spice.pepper);
    if (state.spice.chili) badges.push('Chili ' + state.spice.chili);
    if (meal.scene === 'tray') {
      meal.ingredients.forEach(ing => {
        const used = ing.start - state.amounts[ing.id];
        if (ing.kind === 'side' && used > 0) badges.push(ing.name + ' used ' + used);
      });
    }
    const vessel = meal.vessel.charAt(0).toUpperCase() + meal.vessel.slice(1);
    if (foodLeft(meal, state) === 0) badges.push(vessel + ' empty');
    if (!badges.length) badges.push('Fresh ' + meal.vessel);
    badges.forEach(b => {
      const s = document.createElement('span');
      s.className = 'badge';
      s.textContent = b;
      status.appendChild(s);
    });

    const list = byId('amounts');
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
      if (brightness(ing.color) > 235) fill.style.boxShadow = 'inset 0 0 0 1px #c9bfb4';
      bar.appendChild(fill);
      btn.append(name, count, bar);
      btn.addEventListener('click', ev => { ev.stopPropagation(); openMenu(ing.id, null); });
      li.appendChild(btn);
      list.appendChild(li);
    });

    const steps = byId('steps');
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
    byId('step-count').textContent = state.steps.length ? '(' + state.steps.length + ')' : '';

    finishBtn.disabled = state.steps.length === 0;
    finishBtn.classList.toggle('pulse', foodLeft(meal, state) === 0);
  }

  // ---------- action menu ----------

  function svgToStage(x: number, y: number): Point {
    const rect = scene.getBoundingClientRect();
    const scale = rect.width / 800;
    return { x: x * scale, y: y * scale };
  }

  function openMenu(ingId: string, ev: MouseEvent | null): void {
    if (busy) return;
    const actions = actionsFor(meal, ingId);
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
      const st = actionStatus(meal, state, action);
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
    let x: number;
    let y: number;
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
    const first = menu.querySelector<HTMLButtonElement>('button:not(:disabled)');
    if (first) first.focus({ preventScroll: true });
  }

  function closeMenu(): void {
    menu.hidden = true;
    selectedId = null;
    Object.values(groupEls).forEach(g => g.classList.remove('selected'));
  }

  // ---------- animations ----------

  function fxLayer(): SVGGElement {
    return scene.querySelector('#fx') as SVGGElement;
  }

  function floatText(text: string, x: number, y: number): void {
    const t = el('text', { x, y, 'text-anchor': 'middle', class: 'label fx-item' }, fxLayer());
    t.textContent = text;
    t.animate(
      [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-40px)', opacity: 0 }],
      { duration: 900, easing: 'ease-out', fill: 'forwards' }
    );
  }

  function removalPieces(plan: Plan): { id: string; el: SVGGElement }[] {
    const out: { id: string; el: SVGGElement }[] = [];
    for (const [id, n] of Object.entries(plan.removed)) {
      const els = pieceEls[id] ?? [];
      const amt = state.amounts[id];
      for (let i = amt - 1; i >= amt - n && i >= 0; i--) {
        if (els[i]) out.push({ id, el: els[i] });
      }
    }
    return out;
  }

  function pieceCenter(pieceEl: SVGGraphicsElement): Point {
    try {
      const b = pieceEl.getBBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    } catch {
      return { x: CENTER.x, y: CENTER.y };
    }
  }

  function dipPoint(action: Action): Point {
    for (const id of Object.keys(action.consume)) {
      const ing = ingById(id);
      if (ing && ing.kind === 'side' && ing.pieces.length) return ing.pieces[0];
    }
    return CENTER;
  }

  function animateAction(action: Action, plan: Plan): Promise<void> {
    const pieces = removalPieces(plan);
    let duration = 650;

    pieces.forEach(({ id, el: pieceEl }) => {
      if (id === 'broth') return;
      if (action.anim === 'topping' && mustIng(id).kind === 'side') {
        // the topping flies from its dish onto the target food
        const c = pieceCenter(pieceEl);
        const to = mustIng(action.target).pieces[0];
        pieceEl.animate([
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          { transform: 'translate(' + (to.x - c.x) * 0.5 + 'px, ' + ((to.y - c.y) * 0.5 - 80) + 'px) scale(1.2)', opacity: 1, offset: 0.5 },
          { transform: 'translate(' + (to.x - c.x) + 'px, ' + (to.y - c.y - 40) + 'px) scale(1)', opacity: 0.2 }
        ], { duration: 800, easing: 'ease-in-out', fill: 'forwards' });
        duration = 820;
        return;
      }
      if (mustIng(id).kind === 'side') {
        pieceEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
        return;
      }
      const c = pieceCenter(pieceEl);
      const up = -(c.y + 60);
      if (action.anim === 'dip') {
        // dip into a condiment when the action uses one, otherwise into the broth
        const into = dipPoint(action);
        const dx = (into.x - c.x) * (into === CENTER ? 0.6 : 1);
        const dy = (into.y - c.y) * (into === CENTER ? 0.6 : 0.8);
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
    if (plan.removed.broth && brothEl) {
      const oldR = brothRadius(state.amounts.broth);
      const newR = brothRadius(state.amounts.broth - plan.removed.broth);
      const k = oldR > 0 ? Math.max(newR / oldR, 0.01) : 1;
      brothEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + k + ')' }],
        { duration: 650, easing: 'ease-in-out', fill: 'forwards' });
    }

    const fx = fxLayer();

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
      (pieceEls.onion ?? []).forEach((p, i) => {
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
      const ing = mustIng(action.target);
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

    if (action.anim === 'bite') {
      const g = groupEls[action.target];
      g.style.transformBox = 'fill-box';
      g.style.transformOrigin = 'center';
      g.animate([
        { transform: 'translateY(0px) scale(1)' }, { transform: 'translateY(-16px) scale(1.04)', offset: 0.4 },
        { transform: 'translateY(0px) scale(0.98)', offset: 0.7 }, { transform: 'translateY(0px) scale(1)' }
      ], { duration: 700, easing: 'ease-in-out' });
      const c = mustIng(action.target).pieces[0];
      const rand = seeded(state.steps.length + 11);
      for (let i = 0; i < 6; i++) {
        const crumb = el('circle', { cx: c.x + 90 - rand() * 40, cy: c.y - 20 + rand() * 40, r: 3 + rand() * 3, fill: '#d9a05b', class: 'fx-item' }, fx);
        crumb.animate([
          { transform: 'translate(0px, 0px)', opacity: 1 },
          { transform: 'translate(' + (rand() * 60 - 10) + 'px, ' + (60 + rand() * 50) + 'px)', opacity: 0 }
        ], { duration: 700, delay: 150 + i * 30, easing: 'ease-in', fill: 'forwards' });
      }
      duration = 750;
    }

    if (action.anim === 'gulp') {
      const g = groupEls[action.target];
      g.style.transformBox = 'fill-box';
      g.style.transformOrigin = 'center bottom';
      g.animate([
        { transform: 'translateY(0px) rotate(0deg)' }, { transform: 'translateY(-50px) rotate(-14deg)', offset: 0.45 },
        { transform: 'translateY(-50px) rotate(-14deg)', offset: 0.65 }, { transform: 'translateY(0px) rotate(0deg)' }
      ], { duration: 900, easing: 'ease-in-out' });
      duration = 900;
    }

    const target = ingById(action.target);
    const anchor = target ? target.label : { x: CENTER.x, y: 560 };
    floatText(action.label, anchor.x, anchor.y - 20);

    return new Promise(resolve => setTimeout(resolve, duration));
  }

  function runAction(action: Action): void {
    if (busy) return;
    if (!actionStatus(meal, state, action).ok) return;
    closeMenu();
    const plan = planAction(meal, state, action);
    busy = true;
    void animateAction(action, plan).then(() => {
      commit(state, action, plan);
      busy = false;
      render();
    });
  }

  // ---------- finish and restart ----------

  function finish(): void {
    if (busy || state.steps.length === 0) return;
    closeMenu();
    const session = buildSession(meal, state);
    const analysis = analyze(session, meal);
    session.styleId = analysis.style.id;
    busy = true;
    finishBtn.disabled = true;
    // the results screen still opens if the server cannot be reached, just without comparisons
    void saveSession(session)
      .then(getResults)
      .catch(() => null)
      .then(stats => {
        busy = false;
        byId('game-view').hidden = true;
        Results.show(session, analysis, stats, meal, restart);
        window.scrollTo(0, 0);
      });
  }

  function renderPicker(): void {
    picker.innerHTML = '';
    meals.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = m.short;
      btn.setAttribute('aria-pressed', String(m.id === meal.id));
      btn.title = m.name;
      btn.addEventListener('click', ev => { ev.stopPropagation(); setMeal(m.id); });
      picker.appendChild(btn);
    });
  }

  // switching meals starts a fresh play of the new meal and keeps it in the url so links can be shared
  function setMeal(id: string): void {
    if (busy) return;
    const next = meals.find(m => m.id === id);
    if (!next) return;
    meal = next;
    const url = new URL(window.location.href);
    url.searchParams.set('meal', meal.id);
    window.history.replaceState(null, '', url);
    restart();
  }

  function restart(): void {
    state = newState(meal);
    busy = false;
    closeMenu();
    byId('results-view').hidden = true;
    byId('game-view').hidden = false;
    renderPicker();
    render();
  }

  // ---------- events ----------

  scene.addEventListener('click', ev => {
    const target = (ev.target as Element).closest('[data-ing]');
    ev.stopPropagation();
    if (!target) { closeMenu(); return; }
    openMenu(target.getAttribute('data-ing') as string, ev);
  });
  menu.addEventListener('click', ev => ev.stopPropagation());
  document.addEventListener('click', () => { if (!menu.hidden) closeMenu(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', closeMenu);
  finishBtn.addEventListener('click', finish);
  restartBtn.addEventListener('click', restart);

  restart();

  return { restart, setMeal };
}

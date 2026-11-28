// Meal definition for a sushi platter with pickled radish, wasabi, soy sauce and miso soup
// Every number here can be tuned without touching the game code
import type { Action, Ingredient, Meal, Point, Shape } from '../types';

// how many times each sushi type can be ordered again after it runs out
export const MAX_REFILLS = 3;

interface SushiKind {
  id: string;
  name: string;
  // short name used in action labels, for example "Eat salmon"
  short: string;
  shape: Shape;
  color: string;
  accent: string;
  banded?: boolean;
  label: Point;
  pieces: Point[];
}

// three pieces in a row, starting at x and spaced like the nigiri on a real platter
function row(x: number, y: number, n = 3, gap = 50): Point[] {
  return Array.from({ length: n }, (_, i) => ({ x: x + i * gap, y }));
}

export const SUSHI: SushiKind[] = [
  { id: 'salmon', name: 'Salmon nigiri', short: 'salmon', shape: 'nigiri', color: '#f58a4b', accent: '#ffd2b5', label: { x: 140, y: 205 }, pieces: row(90, 140) },
  { id: 'whitefish', name: 'White fish nigiri', short: 'white fish', shape: 'nigiri', color: '#f3eee4', accent: '#ddd3c2', label: { x: 315, y: 205 }, pieces: row(265, 140) },
  { id: 'shrimp', name: 'Shrimp nigiri', short: 'shrimp', shape: 'nigiri', color: '#f7a072', accent: '#ffffff', label: { x: 490, y: 205 }, pieces: row(440, 140) },
  { id: 'squid', name: 'Squid nigiri', short: 'squid', shape: 'nigiri', color: '#e4eef6', accent: '#c9d8e6', label: { x: 140, y: 355 }, pieces: row(90, 290) },
  { id: 'tuna', name: 'Tuna nigiri', short: 'tuna', shape: 'nigiri', color: '#d9455f', accent: '#ef8a9b', label: { x: 315, y: 355 }, pieces: row(265, 290) },
  { id: 'eel', name: 'Eel nigiri', short: 'eel', shape: 'nigiri', color: '#8a4a1f', accent: '#c98a4b', banded: true, label: { x: 490, y: 355 }, pieces: row(440, 290) },
  {
    id: 'maki', name: 'Salmon maki', short: 'maki', shape: 'maki', color: '#f58a4b', accent: '#ffffff', label: { x: 120, y: 525 },
    pieces: [{ x: 95, y: 425 }, { x: 145, y: 425 }, { x: 95, y: 475 }, { x: 145, y: 475 }]
  },
  { id: 'eelroll', name: 'Eel roll', short: 'eel roll', shape: 'roll', color: '#7a3f17', accent: '#f4e7c8', label: { x: 380, y: 525 }, pieces: row(255, 455, 6, 50) }
];

const sushiIngredients: Ingredient[] = SUSHI.map(k => ({
  id: k.id, name: k.name, kind: 'food', start: k.pieces.length, color: k.color, accent: k.accent,
  banded: k.banded, shape: k.shape, label: k.label, pieces: k.pieces
}));

// every sushi type gets the same three actions: eat, dip in soy sauce, and order more once it runs out
const sushiActions: Action[] = SUSHI.flatMap((k): Action[] => [
  { id: 'eat_' + k.id, label: 'Eat ' + k.short, target: k.id, category: 'eat', consume: { [k.id]: 1 }, anim: 'eat' },
  { id: 'dip_' + k.id, label: 'Dip ' + k.short + ' in soy sauce', target: k.id, category: 'eat', consume: { [k.id]: 1, soy: 1 }, anim: 'dip' },
  {
    id: 'more_' + k.id, label: 'Request more ' + k.short, target: k.id, category: 'order', consume: {}, anim: 'serve', effect: 'refill',
    requires: { max: { [k.id]: 0 } }, requiresText: 'Finish the ' + k.short + ' first',
    limit: MAX_REFILLS, limitText: 'The kitchen is out of ' + k.short
  }
]);

export const sushi: Meal = {
  id: 'sushi',
  name: 'Sushi Platter',
  short: 'Sushi',
  description: 'Nigiri, maki and an eel roll with pickled radish, wasabi, soy sauce and miso soup. Run out of a favorite? Request more.',
  scene: 'board',
  vessel: 'platter',
  hint: 'Click a sushi, the soy sauce, the wasabi, the pickled radish or the miso soup to choose what to do.',
  againLabel: 'Order another platter',

  // kind "food" counts toward finishing the platter, kind "side" does not
  ingredients: [
    ...sushiIngredients,
    {
      id: 'miso', name: 'Miso soup', kind: 'food', start: 5, color: '#c98b3c',
      shape: 'soup', label: { x: 700, y: 210 }, pieces: [{ x: 700, y: 130 }]
    },
    {
      id: 'soy', name: 'Soy sauce', kind: 'side', start: 8, color: '#2b1a12',
      shape: 'cup', label: { x: 700, y: 350 }, pieces: [{ x: 700, y: 290 }]
    },
    {
      id: 'wasabi', name: 'Wasabi', kind: 'side', start: 3, color: '#8cc63f',
      shape: 'mound', label: { x: 640, y: 450 }, pieces: [{ x: 614, y: 414 }, { x: 646, y: 406 }, { x: 668, y: 420 }]
    },
    {
      id: 'radish', name: 'Pickled radish', kind: 'side', start: 4, color: '#f6d55c',
      shape: 'radish', label: { x: 730, y: 545 },
      pieces: [{ x: 706, y: 482 }, { x: 734, y: 476 }, { x: 760, y: 486 }, { x: 732, y: 504 }]
    }
  ],

  actions: [
    ...sushiActions,
    { id: 'sip_miso', label: 'Sip miso soup', target: 'miso', category: 'sip', consume: { miso: 1 }, anim: 'gulp' },
    {
      id: 'mix_wasabi', label: 'Mix wasabi into soy sauce', target: 'soy', category: 'season', consume: { wasabi: 1 }, anim: 'topping',
      requires: { min: { soy: 1 } }, requiresText: 'No soy sauce left to mix into'
    },
    { id: 'eat_radish', label: 'Eat pickled radish', target: 'radish', category: 'eat', consume: { radish: 1 }, anim: 'eat' }
  ],

  // nothing on the platter gets stirred
  mixedToppings: []
};

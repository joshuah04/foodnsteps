// Meal definition for a burger with fries, a condiment and a drink
// Every number here can be tuned without touching the game code
import type { Meal } from '../types';

export const burger: Meal = {
  id: 'burger',
  name: 'Burger, Fries and a Drink',
  short: 'Burger',
  description: 'A stacked cheeseburger with a side of fries, ketchup for dipping and a cold drink.',
  scene: 'tray',
  vessel: 'tray',
  hint: 'Click the burger, the fries, the ketchup, the pickles or the drink to choose what to do.',
  againLabel: 'Order another meal',

  // kind "food" counts toward finishing the tray, kind "side" does not
  ingredients: [
    {
      id: 'burger', name: 'Burger', kind: 'food', start: 8, color: '#d9a05b',
      shape: 'burger', label: { x: 290, y: 128 }, pieces: [{ x: 290, y: 312 }],
      // drawn from the bottom of the stack to the top
      layers: [
        { name: 'Bun', color: '#d9a05b', height: 26 },
        { name: 'Patty', color: '#6b3f22', height: 30 },
        { name: 'Cheese', color: '#f7c948', height: 10 },
        { name: 'Tomato', color: '#e0473a', height: 12 },
        { name: 'Lettuce', color: '#7cc15a', height: 12 },
        { name: 'Sauce', color: '#f2e3b3', height: 8 },
        { name: 'Onions', color: '#e8d4ec', height: 10 },
        { name: 'Bun', color: '#d9a05b', height: 50 }
      ]
    },
    {
      id: 'fries', name: 'Fries', kind: 'food', start: 10, color: '#f4c430',
      shape: 'fries', label: { x: 545, y: 350 },
      pieces: [
        { x: 507, y: 196 }, { x: 523, y: 186 }, { x: 539, y: 192 }, { x: 555, y: 182 }, { x: 571, y: 194 },
        { x: 583, y: 200 }, { x: 515, y: 206 }, { x: 531, y: 202 }, { x: 547, y: 200 }, { x: 563, y: 206 }
      ]
    },
    {
      id: 'drink', name: 'Drink', kind: 'food', start: 6, color: '#5a2e1a',
      shape: 'drink', label: { x: 695, y: 440 }, pieces: [{ x: 695, y: 320 }]
    },
    {
      id: 'ketchup', name: 'Ketchup', kind: 'side', start: 5, color: '#d0312d',
      shape: 'cup', label: { x: 545, y: 510 }, pieces: [{ x: 545, y: 445 }]
    },
    {
      id: 'pickles', name: 'Pickles', kind: 'side', start: 3, color: '#7aa53a',
      shape: 'pickle', label: { x: 120, y: 560 },
      pieces: [{ x: 96, y: 516 }, { x: 120, y: 508 }, { x: 144, y: 516 }]
    }
  ],

  // category is used for stats: eat, sip, season, prep
  // consume lists how many portions each ingredient loses
  actions: [
    { id: 'take_bite', label: 'Take a bite', target: 'burger', category: 'eat', consume: { burger: 1 }, anim: 'bite' },
    {
      id: 'add_pickles', label: 'Add pickles', target: 'burger', category: 'prep', consume: { pickles: 1 }, anim: 'topping',
      requires: { min: { burger: 1 } }, requiresText: 'No burger left to add pickles to'
    },

    { id: 'eat_fries', label: 'Eat fries', target: 'fries', category: 'eat', consume: { fries: 1 }, anim: 'eat' },
    { id: 'dip_fries', label: 'Dip fries in ketchup', target: 'fries', category: 'eat', consume: { fries: 1, ketchup: 1 }, anim: 'dip' },

    { id: 'drink_it', label: 'Drink it', target: 'drink', category: 'sip', consume: { drink: 1 }, anim: 'gulp' }
  ],

  // only the ramen bowl can be stirred, so nothing gets mixed here
  mixedToppings: []
};

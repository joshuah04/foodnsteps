// Meal definition for tonkotsu ramen
// Every number here can be tuned without touching the game code
window.MEALS = window.MEALS || {};

window.MEALS.ramen = {
  id: 'ramen',
  name: 'Tonkotsu Ramen',
  description: 'A rich pork bone broth with noodles, chashu pork, egg and toppings.',

  // kind "food" counts toward finishing the bowl, kind "side" does not
  ingredients: [
    {
      id: 'broth', name: 'Broth', kind: 'food', start: 10, color: '#e9d3a8',
      shape: 'broth', label: { x: 360, y: 124 }, pieces: []
    },
    {
      id: 'noodles', name: 'Noodles', kind: 'food', start: 10, color: '#f2c94c',
      shape: 'noodle', label: { x: 360, y: 378 },
      pieces: [
        { x: 362, y: 262 }, { x: 352, y: 271 }, { x: 368, y: 280 }, { x: 356, y: 289 },
        { x: 364, y: 298 }, { x: 350, y: 307 }, { x: 366, y: 316 }, { x: 354, y: 325 },
        { x: 362, y: 334 }, { x: 358, y: 343 }
      ]
    },
    {
      id: 'chashu', name: 'Chashu pork', kind: 'food', start: 3, color: '#e8a0a0',
      shape: 'slice', label: { x: 262, y: 140 },
      pieces: [{ x: 252, y: 200 }, { x: 306, y: 178 }, { x: 240, y: 256 }]
    },
    {
      id: 'egg', name: 'Egg', kind: 'food', start: 2, color: '#fdfaf2',
      shape: 'egg', label: { x: 478, y: 158 },
      pieces: [{ x: 452, y: 200 }, { x: 498, y: 238 }]
    },
    {
      id: 'onion', name: 'Green onion', kind: 'food', start: 5, color: '#6fcf6f',
      shape: 'ring', label: { x: 290, y: 482 },
      pieces: [{ x: 272, y: 418 }, { x: 292, y: 436 }, { x: 312, y: 420 }, { x: 282, y: 452 }, { x: 306, y: 454 }]
    },
    {
      id: 'bamboo', name: 'Bamboo shoots', kind: 'food', start: 4, color: '#c79a5b',
      shape: 'stick', label: { x: 452, y: 482 },
      pieces: [{ x: 424, y: 420 }, { x: 444, y: 430 }, { x: 464, y: 420 }, { x: 484, y: 432 }]
    },
    {
      id: 'nori', name: 'Nori', kind: 'food', start: 2, color: '#24452f',
      shape: 'sheet', label: { x: 186, y: 434 },
      pieces: [{ x: 186, y: 322 }, { x: 204, y: 372 }]
    },
    {
      id: 'corn', name: 'Corn', kind: 'food', start: 4, color: '#ffd84d',
      shape: 'cube', label: { x: 516, y: 380 },
      pieces: [{ x: 500, y: 300 }, { x: 524, y: 314 }, { x: 502, y: 336 }, { x: 528, y: 346 }]
    },
    {
      id: 'salt', name: 'Salt', kind: 'side', start: 3, color: '#f4f4f4',
      shape: 'shaker', label: { x: 690, y: 230 }, pieces: [{ x: 690, y: 170 }]
    },
    {
      id: 'pepper', name: 'Pepper flakes', kind: 'side', start: 3, color: '#4a4a4a',
      shape: 'shaker', label: { x: 690, y: 360 }, pieces: [{ x: 690, y: 300 }]
    },
    {
      id: 'chili', name: 'Chili oil', kind: 'side', start: 3, color: '#d6452f',
      shape: 'shaker', label: { x: 690, y: 490 }, pieces: [{ x: 690, y: 430 }]
    }
  ],

  // category is used for stats: eat, sip, season, prep
  // consume lists how many portions each ingredient loses
  // requires.min and requires.max gate an action on other amounts
  actions: [
    { id: 'eat_noodles', label: 'Eat noodles', target: 'noodles', category: 'eat', consume: { noodles: 1 }, anim: 'eat' },
    { id: 'slurp_noodles', label: 'Slurp noodles', target: 'noodles', category: 'eat', consume: { noodles: 2 }, anim: 'eat' },
    { id: 'cool_noodles', label: 'Lift and cool', target: 'noodles', category: 'prep', consume: {}, anim: 'lift' },

    { id: 'sip_broth', label: 'Sip broth', target: 'broth', category: 'sip', consume: { broth: 1 }, anim: 'sip' },
    {
      id: 'drink_bowl', label: 'Drink from the bowl', target: 'broth', category: 'sip', consume: { broth: 3 }, anim: 'drink',
      requires: { max: { noodles: 3 } }, requiresText: 'Eat most of the noodles first'
    },

    { id: 'eat_chashu', label: 'Eat a slice', target: 'chashu', category: 'eat', consume: { chashu: 1 }, anim: 'eat' },
    {
      id: 'dip_chashu', label: 'Dip in broth, then eat', target: 'chashu', category: 'eat', consume: { chashu: 1 }, anim: 'dip',
      requires: { min: { broth: 1 } }, requiresText: 'No broth left to dip in'
    },

    { id: 'eat_egg', label: 'Eat half an egg', target: 'egg', category: 'eat', consume: { egg: 1 }, anim: 'eat' },

    { id: 'eat_onion', label: 'Eat green onion', target: 'onion', category: 'eat', consume: { onion: 1 }, anim: 'eat' },
    {
      id: 'mix_onion', label: 'Mix into broth', target: 'onion', category: 'prep', consume: {}, anim: 'mix', effect: 'mixOnion',
      requires: { min: { broth: 1, onion: 1 } }, requiresText: 'Needs broth and green onion'
    },

    { id: 'eat_bamboo', label: 'Eat bamboo shoot', target: 'bamboo', category: 'eat', consume: { bamboo: 1 }, anim: 'eat' },

    { id: 'eat_nori', label: 'Eat nori', target: 'nori', category: 'eat', consume: { nori: 1 }, anim: 'eat' },
    {
      id: 'soak_nori', label: 'Soak in broth, then eat', target: 'nori', category: 'eat', consume: { nori: 1 }, anim: 'dip',
      requires: { min: { broth: 1 } }, requiresText: 'No broth left to soak in'
    },
    { id: 'wrap_nori', label: 'Wrap noodles, then eat', target: 'nori', category: 'eat', consume: { nori: 1, noodles: 1 }, anim: 'eat' },

    { id: 'eat_corn', label: 'Eat corn', target: 'corn', category: 'eat', consume: { corn: 1 }, anim: 'eat' },

    { id: 'add_salt', label: 'Add salt', target: 'salt', category: 'season', consume: { salt: 1 }, anim: 'season', effect: 'spice' },
    { id: 'add_pepper', label: 'Add pepper flakes', target: 'pepper', category: 'season', consume: { pepper: 1 }, anim: 'season', effect: 'spice' },
    { id: 'add_chili', label: 'Add chili oil', target: 'chili', category: 'season', consume: { chili: 1 }, anim: 'season', effect: 'spice' },

    {
      id: 'stir_bowl', label: 'Stir the bowl', target: 'bowl', category: 'prep', consume: {}, anim: 'stir', effect: 'stir',
      requires: { min: { broth: 1 } }, requiresText: 'Nothing left to stir'
    }
  ],

  // once the bowl is stirred, each sip of broth also picks up one of these
  mixedToppings: ['onion', 'corn']
};

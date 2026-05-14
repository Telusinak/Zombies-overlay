import { Totenreich } from './bo7/Totenreich.js';
import { ParadoxJunction } from './bo7/ParadoxJunction.js';
import { AstraMalorum } from './bo7/AstraMalorum.js';
import { AshesOfTheDamned } from './bo7/AshesOfTheDamned.js';
import { bo7Relics } from './bo7/relics.js';

export const games = [
  {
    id: 'bo7',
    name: 'Black Ops 7',
    maps: [
      Totenreich,
      ParadoxJunction,
      AstraMalorum,
      AshesOfTheDamned
    ],
    relics: bo7Relics
  }
];
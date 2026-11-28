// Entry point: loads styles and starts the game with the meal named in the url, or ramen
import './style.css';
import { createGame } from './game';
import { MEALS } from './meals';

createGame(MEALS, new URLSearchParams(window.location.search).get('meal') ?? undefined);

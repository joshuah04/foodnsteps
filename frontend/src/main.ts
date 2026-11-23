// Entry point: loads styles and starts the ramen game
import './style.css';
import { createGame } from './game';
import { ramen } from './meals/ramen';

createGame(ramen);

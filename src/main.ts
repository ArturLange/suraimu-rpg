import './style.css';
import { Game } from './game';
import { UIManager } from './ui/UIManager';

const game = new Game();
const ui = new UIManager(game);

ui.init();
game.start();

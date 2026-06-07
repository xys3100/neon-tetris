import { Game } from './game.js';

// Instantiate and load game systems
window.onload = () => {
  const tetrisGame = new Game();
  
  // Ensure the page doesn't scroll when tapping mobile controls
  document.body.addEventListener('touchmove', (e) => {
    if (e.target.closest('.mobile-controls') || e.target.closest('.game-board-wrapper')) {
      e.preventDefault();
    }
  }, { passive: false });
};

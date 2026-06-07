// --- CONFIG & CONSTANTS ---
export const COLS = 10;
export const ROWS = 20;
export const BLOCK_SIZE = 30; // Grid cell size in pixels on main canvas

// Tetrimino types, matrices and their associated color ID (1-indexed)
export const TETRIMINOS = {
  I: { matrix: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], colorId: 1 },
  O: { matrix: [[2,2],[2,2]], colorId: 2 },
  T: { matrix: [[0,3,0],[3,3,3],[0,0,0]], colorId: 3 },
  S: { matrix: [[0,4,4],[4,4,0],[0,0,0]], colorId: 4 },
  Z: { matrix: [[5,5,0],[0,5,5],[0,0,0]], colorId: 5 },
  J: { matrix: [[6,0,0],[6,6,6],[0,0,0]], colorId: 6 },
  L: { matrix: [[0,0,7],[7,7,7],[0,0,0]], colorId: 7 }
};

// Premium Neon Palettes
export const COLORS = {
  1: { name: 'I', main: '#00f2fe', shadow: 'rgba(0, 242, 254, 0.4)', fill: '#00d2de' },
  2: { name: 'O', main: '#ffe600', shadow: 'rgba(255, 230, 0, 0.4)', fill: '#ebd200' },
  3: { name: 'T', main: '#b224ef', shadow: 'rgba(178, 36, 239, 0.4)', fill: '#9c1fd0' },
  4: { name: 'S', main: '#00ff87', shadow: 'rgba(0, 255, 135, 0.4)', fill: '#00e575' },
  5: { name: 'Z', main: '#ff007f', shadow: 'rgba(255, 0, 127, 0.4)', fill: '#e50072' },
  6: { name: 'J', main: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.4)', fill: '#2563eb' },
  7: { name: 'L', main: '#f97316', shadow: 'rgba(249, 115, 22, 0.4)', fill: '#ea580c' }
};

// Super Rotation System (SRS) Kick Data
// transition key is "startRotation->endRotation"
export const KICK_DATA_NORMAL = {
  '0->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1->0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1->2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3->2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3->0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
};

export const KICK_DATA_I = {
  '0->1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1->0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1->2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2->1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2->3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3->2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3->0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0->3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
};

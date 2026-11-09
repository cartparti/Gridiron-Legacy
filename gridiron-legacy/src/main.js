// Entry point.
import { app } from './ui/app.js';
import { unlockAudio } from './audio/sfx.js';

// Mobile browsers only allow audio after a user gesture.
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// Surface unexpected errors instead of failing silently.
window.addEventListener('error', (e) => console.error('Gridiron Legacy error:', e.error ?? e.message));

// Load the pixel font first so canvas-drawn field text uses it (max 1.5s wait).
const fontsReady = Promise.race([
  Promise.all([document.fonts?.load('700 16px Silkscreen'), document.fonts?.load('16px Inter')]).catch(() => null),
  new Promise((r) => setTimeout(r, 1500)),
]);
fontsReady.then(() => {
  app.init();
  window.gridironApp = app; // handy for debugging in the console
});

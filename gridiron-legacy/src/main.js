// Entry point.
import { app } from './ui/app.js';
import { unlockAudio } from './audio/sfx.js';

// Mobile browsers only allow audio after a user gesture.
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// Surface unexpected errors instead of failing silently.
window.addEventListener('error', (e) => console.error('Gridiron Legacy error:', e.error ?? e.message));

app.init();
window.gridironApp = app; // handy for debugging in the console

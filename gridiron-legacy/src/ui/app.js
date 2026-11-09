// App controller: owns the current game state, routes to screens, autosaves.
import { clear } from './dom.js';
import { closeAllModals, toast } from './components.js';
import * as storage from '../core/storage.js';
import { setSoundEnabled } from '../audio/sfx.js';
import { getTeam } from '../sim/league.js';
import { titleScreen } from './screens/title.js';
import { slotsScreen } from './screens/slots.js';
import { createScreen } from './screens/create.js';
import { settingsScreen } from './screens/settings.js';
import { hubScreen } from './screens/hub.js';
import { gamedayScreen } from './screens/gameday.js';
import { postgameScreen, reviewScreen } from './screens/results.js';
import { campScreen, recruitingScreen, declareScreen, draftScreen, contractScreen } from './screens/offseason.js';
import { legacyScreen } from './screens/legacy.js';
import { worldScreen } from './screens/world.js';
import { stopBackdrop } from '../scenes/director.js';

export const app = {
  state: null,
  slot: null,
  settings: storage.loadSettings(),
  screen: 'title',
  hubTab: 'week',
  ui: {},

  init() {
    this.applySettings();
    this.render();
  },

  applySettings() {
    const s = this.settings;
    const root = document.documentElement;
    if (s.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', s.theme);
    document.body.classList.toggle('reduce-motion', !!s.reducedMotion);
    setSoundEnabled(!!s.sound);
  },

  saveSettings() {
    storage.saveSettings(this.settings);
    this.applySettings();
  },

  /** Persist the current career to its slot. */
  save() {
    if (!this.state || this.slot === null) return;
    const ok = storage.saveGame(this.slot, this.state);
    if (!ok && !this.ui.warnedStorage) {
      this.ui.warnedStorage = true;
      toast('Saving is not available in this browser. Progress lasts until you close the tab.');
    }
  },

  startCareer(state, slot) {
    this.state = state;
    this.slot = slot;
    this.hubTab = 'week';
    this.ui = {};
    this.settings.lastSlot = slot;
    this.saveSettings();
    this.save();
    this.render();
  },

  loadSlot(slot) {
    const st = storage.loadGame(slot);
    if (!st) {
      toast('That save could not be loaded.');
      return;
    }
    this.startCareer(st, slot);
  },

  quitToTitle() {
    this.save();
    this.state = null;
    this.slot = null;
    this.screen = 'title';
    this.render();
  },

  go(screen) {
    this.screen = screen;
    this.render();
  },

  /** Save and redraw after the simulation changed something. */
  commit() {
    this.save();
    this.render();
  },

  setTeamColors() {
    const root = document.documentElement.style;
    const t = this.state?.league ? getTeam(this.state.league, this.state.career.teamId) : null;
    if (t) {
      root.setProperty('--team', t.colors[0]);
      root.setProperty('--team2', t.colors[1]);
      const v = parseInt(t.colors[0].slice(1), 16);
      const lum = (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
      root.setProperty('--team-ink', lum > 0.6 ? '#111111' : '#ffffff');
    } else {
      root.setProperty('--team', '#2f6f4f');
      root.setProperty('--team2', '#f4c430');
    }
  },

  render() {
    const root = document.getElementById('app');
    const scrollY = window.scrollY;
    this.ui.cleanupWorld?.(); // leaving or redrawing a walkable place
    this.ui.cleanupWorld = null;
    closeAllModals();
    clear(root);
    root.className = '';
    this.setTeamColors();
    let view;
    if (this.screen === 'settings') view = settingsScreen(this);
    else if (!this.state) {
      if (this.screen === 'slots') view = slotsScreen(this);
      else if (this.screen === 'create') view = createScreen(this);
      else view = titleScreen(this);
    } else {
      if (this.screen !== 'settings') stopBackdrop();
      if (this.ui.world && this.state.phase !== 'plan') this.ui.world = null;
      switch (this.state.phase) {
        case 'event': view = hubScreen(this); break;
        case 'plan': view = this.ui.world ? worldScreen(this) : hubScreen(this); break;
        case 'game': view = gamedayScreen(this); break;
        case 'postgame': view = postgameScreen(this); break;
        case 'review': view = reviewScreen(this); break;
        case 'offseason_event':
        case 'camp': view = campScreen(this); break;
        case 'recruiting': view = recruitingScreen(this); break;
        case 'declare': view = declareScreen(this); break;
        case 'draft': view = draftScreen(this); break;
        case 'contract': view = contractScreen(this); break;
        case 'retired': view = legacyScreen(this); break;
        default: view = hubScreen(this);
      }
    }
    // Only animate when the screen actually changes, not on every redraw.
    const key = `${this.screen}|${this.state?.phase ?? ''}|${this.hubTab}`;
    if (key === this.ui.lastViewKey) root.classList.add('no-anim');
    else window.scrollTo(0, 0);
    this.ui.lastViewKey = key;
    if (view) root.append(view);
    if (root.classList.contains('no-anim')) window.scrollTo(0, scrollY);
  },
};

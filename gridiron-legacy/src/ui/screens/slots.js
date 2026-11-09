import { h } from '../dom.js';
import { listSlots, deleteSave, exportSave, importSave } from '../../core/storage.js';
import { confirmDialog, toast, openModal } from '../components.js';
import { STAGES } from '../../data/config.js';
import { sfx } from '../../audio/sfx.js';

const stageLabel = (s) => (s === 'retired' ? 'Retired' : STAGES[s]?.label ?? s);

export function slotsScreen(app) {
  const creating = !!app.ui.newCareer;
  const slots = listSlots();
  const card = (s) => {
    const m = s.meta;
    return h('div.card.slot-card',
      h('div.ovr-badge', { style: { background: 'var(--team)', color: '#fff' } }, s.empty ? '—' : m.ovr, h('small', s.empty ? '' : 'OVR')),
      h('div.meta',
        h('h3', s.empty ? `Slot ${s.slot + 1} · Empty` : m.name),
        s.empty ? h('p.small.muted', 'Start a new career here.')
          : h('p.small.muted', `${m.position} · Age ${m.age} · ${stageLabel(m.stage)} · ${m.year}`),
        s.empty ? null : h('p.tiny.muted', `Saved ${new Date(m.savedAt).toLocaleString()}`)),
      h('div.col', { style: { gap: '6px' } },
        creating
          ? h('button.btn.small.primary', { onclick: async () => {
            if (!s.empty && !(await confirmDialog('Overwrite save?', `${m.name}'s career will be deleted.`, 'Overwrite'))) return;
            sfx.select();
            app.ui.createSlot = s.slot;
            app.go('create');
          } }, s.empty ? 'New' : 'Overwrite')
          : (s.empty ? null : h('button.btn.small.primary', { onclick: () => { sfx.select(); app.loadSlot(s.slot); } }, 'Load')),
        s.empty ? null : h('button.btn.small.ghost', { onclick: () => exportSlot(s) }, 'Export'),
        s.empty ? h('button.btn.small.ghost', { onclick: () => importSlot(app, s.slot) }, 'Import')
          : h('button.btn.small.danger', { onclick: async () => {
            if (await confirmDialog('Delete save?', `This permanently deletes ${m.name}'s career.`, 'Delete')) { deleteSave(s.slot); app.render(); }
          } }, 'Delete')));
  };
  return h('div.screen',
    h('div.row.between', h('h1', creating ? 'Choose a Slot' : 'Load Career'), h('button.btn.small.ghost', { onclick: () => app.go('title') }, 'Back')),
    slots.map(card));
}

function exportSlot(s) {
  const text = exportSave(s.slot);
  if (!text) return toast('Nothing to export.');
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gridiron-legacy-${s.meta.name.replace(/\W+/g, '-').toLowerCase()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch {
    toast('Export failed in this browser.');
  }
}

function importSlot(app, slot) {
  const input = h('input', { type: 'file', accept: 'application/json,.json' });
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    const text = await f.text();
    if (importSave(slot, text)) { toast('Save imported.'); app.render(); } else toast('That file is not a Gridiron Legacy save.');
  });
  input.click();
}

export { openModal };

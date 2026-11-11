import { h } from '../dom.js';
import { listSlots, deleteSave, exportSave, importSave, exportCode, importCode } from '../../core/storage.js';
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
        s.empty ? null : h('button.btn.small.ghost', { onclick: () => backupModal(s.slot, s.meta.name) }, 'Back up'),
        s.empty ? h('button.btn.small.ghost', { onclick: () => restoreModal(app, s.slot) }, 'Restore')
          : h('button.btn.small.danger', { onclick: async () => {
            if (await confirmDialog('Delete save?', `This permanently deletes ${m.name}'s career.`, 'Delete')) { deleteSave(s.slot); app.render(); }
          } }, 'Delete')));
  };
  return h('div.screen',
    h('div.row.between', h('h1', creating ? 'Choose a Slot' : 'Load Career'), h('button.btn.small.ghost', { onclick: () => app.go('title') }, 'Back')),
    slots.map(card));
}

/** Back up a career: a code to copy somewhere safe (notes, a text to yourself) or a file. */
export async function backupModal(slot, name = 'career') {
  const code = await exportCode(slot);
  if (!code) return toast('Nothing to back up yet.');
  const box = h('textarea.backup-code', { readonly: true, rows: 4 }, code);
  const m = openModal(h('div.col', { style: { gap: '10px' } },
    h('h2', 'Back up your career'),
    h('p.small.muted', 'Saves live only on this device. Copy this code somewhere safe (your notes app, or text it to yourself). Paste it into Restore on any phone to get your career back.'),
    box,
    h('button.btn.primary.block', { onclick: async () => {
      try { await navigator.clipboard.writeText(code); toast('Backup code copied!'); } catch { box.select(); document.execCommand?.('copy'); toast('Code selected: copy it.'); }
    } }, 'Copy backup code'),
    navigator.share ? h('button.btn.block', { onclick: () => { navigator.share({ title: `Gridiron Legacy backup: ${name}`, text: code }).catch(() => {}); } }, 'Share / save it') : null,
    h('button.btn.ghost.block', { onclick: () => exportSlot({ slot, meta: { name } }) }, 'Download as a file'),
    h('button.btn.ghost.block', { onclick: () => m.close() }, 'Done')), { dismissable: true });
  return m;
}

function restoreModal(app, slot) {
  const box = h('textarea.backup-code', { rows: 4, placeholder: 'Paste your backup code here' });
  const m = openModal(h('div.col', { style: { gap: '10px' } },
    h('h2', 'Restore a career'),
    h('p.small.muted', 'Paste a backup code, or pick a backup file.'),
    box,
    h('button.btn.primary.block', { onclick: async () => {
      if (await importCode(slot, box.value)) { toast('Career restored!'); m.close(); app.render(); } else toast('That code did not work. Check you copied all of it.');
    } }, 'Restore from code'),
    h('button.btn.block', { onclick: () => { m.close(); importSlot(app, slot); } }, 'Pick a file instead'),
    h('button.btn.ghost.block', { onclick: () => m.close() }, 'Cancel')), { dismissable: true });
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

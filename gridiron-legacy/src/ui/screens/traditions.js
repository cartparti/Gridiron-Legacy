// v0.61 screens: ratings reveal, homecoming, senior night, fan mail, pregame ritual, championship rings, contract
// incentives, pets, the card collection (trading cards, game balls, rings) and their review/postgame cards.
import { h } from '../dom.js';
import { sfx } from '../../audio/sfx.js';
import { fmtMoney } from '../../core/util.js';
import { toast, openModal } from '../components.js';
import { awardLabel } from '../../sim/awards.js';
import { getTeam } from '../../sim/league.js';
import { teamKits } from '../../data/kits.js';
import { teamCulture } from '../../data/culture.js';
import { portraitImg } from '../../scenes/portrait.js';
import { seniorNightCutscene } from '../../scenes/cutscenes.js';
import {
  HOMECOMING_PLANS, isHomecomingWeek, chooseHomecoming, ESCORTS, isSeniorNight, chooseEscort, escortLabel,
  REACTIONS, revealRating, reactToRating, RING_STONES, RING_BANDS, RING_ENGRAVINGS, designRing, ringColors,
} from '../../sim/seasonal.js';
import { RARITY, cardValue } from '../../sim/collectibles.js';
import { answerMail } from '../../sim/mailbag.js';
import { PET_KINDS, PET_NAMES, adoptPet, playWithPet, canPlayWithPet } from '../../sim/pets.js';
import { jerseySales, bucketList, HANDSHAKES, handshakeDue, doHandshake, PARTIES, isBirthdayWeek, throwParty } from '../../sim/moments.js';
import { RITUALS, LUCKY_AT, chooseRitual, isLucky, incentiveProgress, coachStyle } from '../../sim/staff.js';

const STAGE_SHORT = { hs: 'HS', college: 'College', pro: 'Pro' };

// ---------------------------------------------------------------- ratings reveal

export function ratingRevealCard(app) {
  const st = app.state;
  const r = st.ratingReveal;
  if (!r || r.year !== st.career.year || (r.reaction && st.league.week > 0)) return null;
  const diff = r.prev != null ? r.rating - r.prev : null;
  const tier = r.rating >= 90 ? 'elite' : r.rating >= 80 ? 'good' : 'base';
  return h('div.card.rr-card',
    h('div.card-title', h('h3', `🎮 ${r.title} ratings are out`), r.reaction ? h('span.chip.pix', 'DONE') : null),
    r.revealed
      ? h(`div.rr-face.${tier}`, h('div.rr-num', r.rating), h('div.rr-sub', h('b', `${st.player.first[0]}. ${st.player.last}`), h('span', `${st.player.position} · OVR`)),
        diff != null ? h(`div.rr-diff.${diff >= 0 ? 'good' : 'bad'}`, `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} from last year`) : h('div.rr-diff', 'Your first rating!'))
      : h('button.rr-face.back', { onclick: () => { sfx.whoosh?.(); revealRating(st); app.commit(); } }, h('div.rr-q', '?'), h('div.tiny', 'Tap to reveal your rating')),
    r.revealed && !r.reaction ? h('div.row', { style: { gap: '8px', flexWrap: 'wrap', marginTop: '8px' } }, REACTIONS.map((x) =>
      h('button.btn.small', { title: x.desc, onclick: () => { sfx.click(); const res = reactToRating(st, x.id); if (res?.text) toast(res.text); app.commit(); } }, x.label))) : null,
    r.reaction === 'fuel' ? h('p.tiny.muted', 'Chip on your shoulder: a little extra focus in every game this season.') : null);
}

// ---------------------------------------------------------------- homecoming

export function homecomingCard(app) {
  const st = app.state, p = st.player;
  if (!isHomecomingWeek(st)) return null;
  const hc = st.homecoming;
  return h('div.card.hc-card',
    h('div.card-title', h('h3', '🎉 Homecoming week'), hc.king ? h('span.chip.gold.pix', '👑 KING') : null),
    h('p.small', hc.king ? `The school voted: you are this year's Homecoming King! The crown is waiting at halftime.` : 'Parade on Thursday, the big game on Friday, the dance on Saturday. The whole town comes home.'),
    hc.plan ? h('p.small.muted', `Plan: ${HOMECOMING_PLANS.find((x) => x.id === hc.plan)?.label.replace('{partner}', p.partnerName ?? '')}`)
      : h('div.col', { style: { gap: '6px', marginTop: '6px' } }, HOMECOMING_PLANS.filter((x) => x.needs !== 'partner' || p.partnerName).map((x) =>
        h('button.btn.block', { onclick: () => { sfx.click(); const r = chooseHomecoming(st, x.id); if (r) toast(r.text); app.commit(); } }, x.label.replace('{partner}', p.partnerName ?? '')))),
    h('p.tiny.muted', 'Win the homecoming game for extra fame.'));
}

// ---------------------------------------------------------------- senior night

export function seniorNightCard(app) {
  const st = app.state, p = st.player;
  if (!isSeniorNight(st)) return null;
  const sn = st.seniorNight;
  const farewell = sn.kind === 'farewell';
  const title = farewell ? '🏟️ Your last home game' : '🌹 Senior Night';
  const play = () => {
    const team = getTeam(st.league, st.career.teamId);
    seniorNightCutscene({ colors: team.colors, uniform: teamKits(team).home, look: p.look, number: p.number, teamName: team.name, stage: st.career.stage,
      culture: teamCulture(team, st.career.stage), escort: sn.escort, partnerLook: p.partnerLook,
      title: farewell ? 'One last time' : 'Senior Night', sub: `${p.first} ${p.last} · walked out by ${escortLabel(st, sn.escort)}` });
  };
  return h('div.card.sn-card',
    h('div.card-title', h('h3', title), h('span.tiny.muted', 'This week')),
    h('p.small', farewell ? 'The home crowd gets one more chance to say goodbye. They are already making signs.' : `Your last regular-season home game at this level. Before kickoff, every senior walks onto the field with the people who got them here.`),
    sn.escort
      ? h('div.row.between', { style: { marginTop: '6px' } }, h('span.small', `Walking out with ${escortLabel(st, sn.escort)}`), app.settings.reducedMotion ? null : h('button.btn.small', { onclick: play }, '▶ Watch the walk'))
      : h('div', h('p.tiny.muted', 'Who walks you out?'), h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, ESCORTS.filter((e) => e.needs !== 'partner' || p.partnerName).map((e) =>
        h('button.btn.small', { onclick: () => { sfx.click(); if (chooseEscort(st, e.id)) { app.commit(); if (!app.settings.reducedMotion) setTimeout(play, 80); } } }, escortLabel(st, e.id))))),
    h('p.tiny.muted', 'Emotions run high: you play this game with a little extra.'));
}

/** Gameday header chips. */
export function traditionChips(st, g) {
  const out = [];
  if (g.homecoming) out.push(h('span.chip.gold', '🎉 Homecoming'));
  if (g.seniorNight) out.push(h('span.chip.gold', g.seniorNight === 'farewell' ? '🏟️ Last home game' : '🌹 Senior Night'));
  if (isLucky(st)) out.push(h('span.chip.good', `🍀 Lucky streak ×${st.ritual.streak}`));
  return out.length ? h('div.row', { style: { gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '8px' } }, out) : null;
}

// ---------------------------------------------------------------- fan mail

export function mailCard(app) {
  const st = app.state;
  const m = st.week?.mail;
  if (!m) return null;
  return h('div.card.mail-card',
    h('div.card-title', h('h3', '✉️ Fan mail'), m.answered != null ? h('span.chip.good.pix', 'ANSWERED') : h('span.chip.pix', 'NEW')),
    h('blockquote.mail-letter', m.text),
    m.answered != null ? h('p.small.muted', m.result)
      : h('div.col', { style: { gap: '6px' } }, m.replies.map((r, i) => h('button.btn.block', { onclick: () => { sfx.click(); const res = answerMail(st, i); if (res?.text) toast(res.text); app.commit(); } }, r.label))));
}

// ---------------------------------------------------------------- pregame ritual

export function ritualCard(app) {
  const st = app.state;
  if (st.player.position === 'MS' && !st.ritual) return null;
  const r = st.ritual;
  const cur = RITUALS.find((x) => x.id === r?.id);
  const lucky = isLucky(st);
  const open = app.ui.ritualOpen || !r;
  return h('div.card.ritual-card',
    h('div.card-title', h('h3', `${cur?.emoji ?? '🔮'} Game-day ritual`), r ? h(`span.chip.pix${lucky ? '.good' : ''}`, lucky ? `🍀 LUCKY ×${r.streak}` : `${r.streak} W STREAK`) : null),
    cur && !open ? h('div.row.between', h('div', h('b.small', cur.label), h('div.tiny.muted', lucky ? 'It is working. Do NOT change anything.' : `Win ${LUCKY_AT - r.streak} more in a row with it and you will feel lucky.`)),
      h('button.btn.small.ghost', { onclick: () => { app.ui.ritualOpen = true; app.render(); } }, 'Change')) : null,
    open ? h('div', h('p.tiny.muted', `Pick one and stick with it. ${LUCKY_AT} wins in a row and you play a little better. Changing it resets the streak.`),
      h('div.ritual-grid', RITUALS.map((x) => h(`button.ritual${r?.id === x.id ? '.on' : ''}`, { onclick: () => { sfx.click(); chooseRitual(st, x.id); app.ui.ritualOpen = false; app.commit(); } },
        h('span.rt-e', x.emoji), h('b.tiny', x.label), h('span.tiny.muted', x.desc))))) : null,
    r?.best >= LUCKY_AT ? h('p.tiny.muted', `Best streak: ${r.best}`) : null);
}

// ---------------------------------------------------------------- rings

export function ringSVG(ring, size = 64) {
  const c = ringColors(ring);
  const team = ring.colors?.[0] ?? '#333';
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.innerHTML = `<defs><radialGradient id="g${ring.year}${ring.stage}" cx="40%" cy="35%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${c.stone}"/><stop offset="1" stop-color="${c.stone}" stop-opacity=".75"/></radialGradient></defs>
    <ellipse cx="32" cy="44" rx="20" ry="12" fill="none" stroke="${c.band}" stroke-width="6"/>
    <rect x="14" y="12" width="36" height="30" rx="9" fill="${c.band}" stroke="#0004"/>
    <rect x="18" y="16" width="28" height="22" rx="6" fill="${team}"/>
    <circle cx="32" cy="27" r="8.5" fill="url(#g${ring.year}${ring.stage})" stroke="#fff8" stroke-width="1"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i / 8 * Math.PI * 2; return `<circle cx="${32 + Math.cos(a) * 12.5}" cy="${27 + Math.sin(a) * 9.5}" r="1.6" fill="#f4f8ff"/>`; }).join('')}`;
  return svg;
}

export function ringDesigner(app) {
  const st = app.state;
  const pending = st.pendingRings?.[0];
  if (!pending) return null;
  const pick = (app.ui.ring ??= { stone: 'diamond', band: 'gold', engraving: 'number' });
  const preview = { ...pending, ...pick };
  const opt = (list, key, lab = (x) => x.label) => h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, list.map((x) => {
    const id = x.id ?? x;
    return h(`button.subtab${pick[key] === id ? '.on' : ''}`, { onclick: () => { pick[key] = id; app.render(); } }, lab(x));
  }));
  const engLabel = (e) => (e === 'number' ? `#${st.player.number ?? 1}` : e === 'hometown' ? (st.player.hometown ?? 'Hometown') : e);
  return h('div.card.ring-card',
    h('div.card-title', h('h3', '💍 Design your ring'), h('span.tiny.muted', `${pending.year} ${pending.title}`)),
    h('div.row', { style: { gap: '14px', alignItems: 'center' } }, h('div.ring-prev', ringSVG(preview, 96)),
      h('div.grow', h('b', pending.team), h('div.tiny.muted', `Engraved inside: "${engLabel(pick.engraving)}"`))),
    h('div.tiny.muted.pix', { style: { marginTop: '8px' } }, 'STONE'), opt(RING_STONES, 'stone'),
    h('div.tiny.muted.pix', { style: { marginTop: '8px' } }, 'BAND'), opt(RING_BANDS, 'band'),
    h('div.tiny.muted.pix', { style: { marginTop: '8px' } }, 'ENGRAVING'), opt(RING_ENGRAVINGS, 'engraving', engLabel),
    h('button.btn.primary.block', { style: { marginTop: '10px' }, onclick: () => { const r = designRing(st, pick); if (r) { sfx.levelUp?.(); toast(`Your ${r.year} ring is ready.`); app.ui.ring = null; } app.commit(); } }, 'Make it'));
}

// ---------------------------------------------------------------- incentives

export function incentiveCard(app) {
  const pr = incentiveProgress(app.state);
  if (!pr) return null;
  return h('div.card.inc-card',
    h('div.card-title', h('h3', '💰 Contract incentive'), pr.hit ? h('span.chip.good.pix', 'EARNED') : h('span.tiny.muted', `${fmtMoney(pr.bonus)} bonus`)),
    h('p.small', `${pr.target.toLocaleString('en-US')} ${pr.noun} this season pays ${fmtMoney(pr.bonus)}.`),
    h('div.statbar', h('span', `${pr.now.toLocaleString('en-US')}`), h('div.track', h('div.fill', { style: { width: `${pr.pct * 100}%`, background: pr.hit ? 'var(--good)' : undefined } })), h('span.val', pr.target.toLocaleString('en-US'))));
}

export function coachStyleChip(app) {
  const s = coachStyle(app.state);
  return s ? h('div.tiny.muted', `Coach ${app.state.player.coachName}: ${s.label}. ${s.desc}`) : null;
}

// ---------------------------------------------------------------- pets

export function petCard(app) {
  const st = app.state, p = st.player;
  const pet = p.pet;
  if (!pet) {
    const sel = (app.ui.petPick ??= { kind: 'mutt', name: '' });
    const k = PET_KINDS.find((x) => x.id === sel.kind);
    const input = h('input', { type: 'text', style: { flex: '1', minHeight: '40px', padding: '8px 10px' }, value: sel.name, maxlength: 16, placeholder: `Name (e.g. ${PET_NAMES[(p.first?.length ?? 3) % PET_NAMES.length]})`, oninput: (e) => { sel.name = e.target.value; } });
    return h('div.card.pet-card',
      h('div.card-title', h('h3', '🐾 Adopt a pet'), h('span.tiny.muted', 'A best friend who never reads the reviews')),
      h('div.pet-grid', PET_KINDS.map((x) => h(`button.pet-opt${sel.kind === x.id ? '.on' : ''}`, { onclick: () => { sel.kind = x.id; app.render(); } }, h('span.pe', x.emoji), h('b.tiny', x.label), h('span.tiny.muted', fmtMoney(x.fee))))),
      h('p.tiny.muted', k.desc),
      h('div.row', { style: { gap: '8px', marginTop: '6px' } }, input,
        h('button.btn.small.primary', { disabled: p.money < k.fee, onclick: () => { const r = adoptPet(st, sel.kind, sel.name); if (r?.text) toast(r.text); if (r?.ok) { sfx.levelUp?.(); app.ui.petPick = null; } app.commit(); } }, 'Adopt')));
  }
  const k = PET_KINDS.find((x) => x.id === pet.kind) ?? PET_KINDS[0];
  return h('div.card.pet-card',
    h('div.card-title', h('h3', `${k.emoji} ${pet.name}`), h('span.tiny.muted', `${k.label} · since ${pet.year}`)),
    h('div.statbar', h('span', 'Bond'), h('div.track', h('div.fill', { style: { width: `${pet.bond}%` } })), h('span.val', Math.round(pet.bond))),
    pet.tricks ? h('p.tiny.muted', `Knows ${pet.tricks} trick${pet.tricks > 1 ? 's' : ''}.`) : null,
    h('button.btn.small', { style: { marginTop: '6px' }, disabled: !canPlayWithPet(st), onclick: () => { const r = playWithPet(st); if (r) toast(r.text); app.commit(); } }, canPlayWithPet(st) ? `Play with ${pet.name} (free)` : `${pet.name} is napping. Next week!`),
    h('p.tiny.muted', `${pet.name} lifts your mood every week. Food and vet bills come out of your bank.`));
}

// ---------------------------------------------------------------- collection

function tradingCard(st, c, onclick) {
  const team = { id: c.team, colors: c.colors ?? ['#333', '#999'] };
  return h(`button.tcard.r-${c.rarity}`, { onclick, style: `--c1:${team.colors[0]};--c2:${team.colors[1] ?? '#ccc'}` },
    h('div.tc-top', h('span.tc-yr', c.year), c.rookie ? h('span.tc-rc', 'RC') : null),
    h('div.tc-num', `#${c.number}`),
    h('div.tc-name', c.name),
    h('div.tc-team', `${c.team}`),
    h('div.tc-foot', h('span', `${c.pos} · ${STAGE_SHORT[c.stage] ?? ''}`), h('b', RARITY[c.rarity].label)));
}

function openCard(app, c) {
  const st = app.state, p = st.player;
  const team = st.league?.teams?.find((t) => `${t.city} ${t.name}` === c.team);
  const pic = team ? portraitImg({ uniform: teamKits(team).home, look: p.look, number: c.number, helmet: false }, 150, { full: true, big: true }) : null;
  const m = openModal(h('div.col', { style: { gap: '10px', alignItems: 'center' } },
    h(`div.tcard.big.r-${c.rarity}`, { style: `--c1:${c.colors?.[0] ?? '#333'};--c2:${c.colors?.[1] ?? '#ccc'}` },
      h('div.tc-top', h('span.tc-yr', c.year), c.rookie ? h('span.tc-rc', 'ROOKIE CARD') : null, c.serial ? h('span.tc-ser', `${c.serial}/${RARITY[c.rarity].print}`) : null),
      pic ? h('div.tc-pic', pic) : h('div.tc-num', `#${c.number}`),
      h('div.tc-name', c.name), h('div.tc-team', c.team),
      h('div.tc-foot', h('span', `${c.pos} · OVR ${c.ovr}`), h('b', RARITY[c.rarity].label))),
    h('div.bigstat', c.stats.map(([l, v]) => h('div', h('b', typeof v === 'number' ? v.toLocaleString('en-US') : v), h('span', l))), h('div', h('b', c.record), h('span', 'Record'))),
    c.award ? h('div.small', '🏆 ', awardLabel(c.award, c.pos)) : null,
    h('div.small.muted', `Season rating ${c.perf} · Collectors pay about ${fmtMoney(cardValue(st, c))} for one today`),
    h('button.btn.block', { onclick: () => m.close() }, 'Close')), { dismissable: true });
}

export function collectionPage(app) {
  const st = app.state, p = st.player;
  const cards = (p.cards ?? []).slice().reverse();
  const balls = (p.gameBalls ?? []).slice().reverse();
  const rings = p.rings ?? [];
  const value = cards.reduce((a, c) => a + cardValue(st, c), 0);
  return h('div.col', { style: { gap: '14px' } },
    ringDesigner(app),
    h('div.card',
      h('div.card-title', h('h3', `Trading cards (${cards.length})`), cards.length ? h('span.tiny.muted', `Set value ~${fmtMoney(value)}`) : null),
      cards.length ? h('div.tcard-grid', cards.map((c) => tradingCard(st, c, () => openCard(app, c))))
        : h('p.small.muted', 'Every season prints a card. Big seasons print rare ones: Silver, Gold, Legendary.')),
    h('div.card',
      h('div.card-title', h('h3', `Championship rings (${rings.length})`)),
      rings.length ? h('div.ring-shelf', rings.map((r) => h('div.ring-item', ringSVG(r, 72), h('b.tiny', `${r.year} ${r.title}`), h('span.tiny.muted', `"${r.engraving}"`))))
        : h('p.small.muted', 'Win a title and you get to design the ring.')),
    h('div.card',
      h('div.card-title', h('h3', `Game balls (${balls.length})`)),
      balls.length ? h('div.list', balls.map((b) => h('div.li', h('span', '🏈'), h('div.grow', h('b.small', b.label), h('div.tiny.muted', `${b.year}${b.opp ? ` · vs ${b.opp}` : ''}`)))))
        : h('p.small.muted', 'Milestones earn the game ball: your first touchdown, big seasons, 100 games, huge playoff nights.')));
}

// ---------------------------------------------------------------- postgame + review

export function postgameExtras(app) {
  const g = app.state.lastGame;
  const out = [];
  const tr = g.traditions;
  if (tr?.seniorNight) out.push(h('div.card.sn-card', h('h3', tr.seniorNight.kind === 'farewell' ? '🏟️ Goodbye, home crowd' : '🌹 Senior Night'), h('p.small', tr.seniorNight.kind === 'farewell' ? (tr.seniorNight.won ? 'A win to remember. You took one last lap around the field while the home crowd chanted your name.' : 'Not the ending you wanted, but nobody left. The whole stadium stayed to cheer you off the field one last time.') : (tr.seniorNight.won ? 'A win to remember. The seniors took one last lap around the field with the fans chanting their names.' : 'Not the ending you wanted, but the crowd stayed and cheered every senior off the field.'))));
  if (tr?.homecoming) out.push(h('div.card.hc-card', h('h3', '🎉 Homecoming'), h('p.small', tr.homecoming.won ? `Homecoming win! ${tr.homecoming.king ? 'And the King got his crown at midfield. ' : ''}The dance is going to be loud.` : `A homecoming loss stings.${tr.homecoming.king ? ' At least the crown fits.' : ''}`)));
  if (g.gameBalls?.length) out.push(h('div.card.unlock-card', h('h3', '🏈 Game ball'), g.gameBalls.map((b) => h('div.small', h('b', b.label))), h('p.tiny.muted', 'It goes on the shelf: Career, then Collection.')));
  if (g.ritual?.broke) out.push(h('div.card.flat', h('p.small', `The lucky streak is over. Your ${g.ritual.label.toLowerCase()} let you down.`)));
  else if (g.ritual?.lucky && g.ritual.streak === LUCKY_AT) out.push(h('div.card.flat.unlock-card', h('p.small', `🍀 ${LUCKY_AT} wins in a row with your ${g.ritual.label.toLowerCase()}. You feel lucky.`)));
  return out;
}

export function reviewExtras(app) {
  const r = app.state.review;
  const out = [];
  if (r.card) {
    const c = r.card;
    out.push(h('div.card', h('div.card-title', h('h3', 'New trading card'), h(`span.chip.pix.r-${c.rarity}`, RARITY[c.rarity].label.toUpperCase())),
      h('div.row', { style: { gap: '12px', alignItems: 'center' } }, tradingCard(app.state, c, () => openCard(app, c)),
        h('div.grow.small', c.rookie ? h('div', h('b', 'Your rookie card!'), ' Collectors love these.') : null, h('div.muted', `Worth about ${fmtMoney(cardValue(app.state, c))} today. Tap to see it.`)))));
  }
  if (r.incentive) out.push(h('div.card', h('h3', '💰 Contract incentive'), h('p.small', r.incentive.hit ? `You hit it: ${r.incentive.now.toLocaleString('en-US')} ${r.incentive.noun}. ${fmtMoney(r.incentive.bonus)} bonus paid.` : `Missed: ${r.incentive.now.toLocaleString('en-US')} of ${r.incentive.target.toLocaleString('en-US')} ${r.incentive.noun}. No bonus this year.`)));
  if (r.coachChange) out.push(h('div.card', { style: { borderColor: 'var(--warn)' } }, h('h3', '📋 Coaching change'), h('p.small', `Coach ${r.coachChange.old} ${r.coachChange.why}. The new head coach is ${r.coachChange.coach}: ${r.coachChange.style.label}.`), h('p.tiny.muted', `${r.coachChange.style.desc} You start fresh with the new staff.`)));
  if (app.state.pendingRings?.length && r.champion) out.push(ringDesigner(app));
  return out;
}

// ---------------------------------------------------------------- v0.62: fantasy, jersey sales, bucket list, handshake, birthday

export function fantasyCard(g) {
  const f = g.fantasy;
  if (!f) return null;
  const hot = f.rank <= 5;
  return h('div.card.flat', h('div.row.between', h('div', h('b', `📊 ${f.pts} fantasy points`), h('div.tiny.muted', hot ? 'Fantasy managers everywhere are thanking you.' : f.rank > 25 ? 'A few fantasy managers are benching you next week.' : 'A solid week for anyone who started you.')),
    h(`span.chip.pix${hot ? '.good' : ''}`, `#${f.rank} THIS WEEK`)));
}

export function jerseyCard(app) {
  const js = jerseySales(app.state);
  if (!js) return null;
  return h('div.card', h('div.card-title', h('h3', '👕 Jersey sales'), h(`span.chip.pix${js.rank <= 10 ? '.gold' : ''}`, `#${js.rank} IN THE LEAGUE`)),
    h('p.small', `About ${js.units.toLocaleString('en-US')} of your jerseys sold this week.${js.moved > 0 ? ` Up ${js.moved} spot${js.moved > 1 ? 's' : ''}.` : js.moved < 0 ? ` Down ${-js.moved}.` : ''}`),
    h('p.tiny.muted', 'Fame, winning, Player of the Week awards and rings sell jerseys. Number 1 is on your bucket list.'));
}

export function bucketCard(app) {
  const b = bucketList(app.state);
  return h('div.card', h('div.card-title', h('h3', '📝 Bucket list'), h('span.chip.pix', `${b.done}/${b.total}`)),
    h('div.list', b.list.map((x) => h('div.li', h('span', x.done ? '✅' : '⬜'), h(`span.small${x.done ? '' : '.muted'}`, x.label)))));
}

export function handshakeCard(app) {
  const st = app.state;
  if (!handshakeDue(st)) return null;
  const rival = st.player.rivalName ?? 'your rival';
  return h('div.card.hc-card', h('h3', '🤝 Postgame at midfield'),
    h('p.small', `${rival} is walking over. ${st.lastGame.won ? 'He lost, and he knows it.' : 'He won, and he is smiling.'} What do you do?`),
    h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, HANDSHAKES.map((x) => h('button.btn.small', { onclick: () => { sfx.click(); const r = doHandshake(st, x.id); if (r) toast(r.text); app.commit(); } }, x.label))));
}

export function birthdayCard(app) {
  const st = app.state, p = st.player;
  if (!isBirthdayWeek(st)) return null;
  const b = st.birthday;
  return h('div.card.hc-card', h('div.card-title', h('h3', `🎂 Happy birthday!`), h('span.chip.pix', `TURNING ${b.age}`)),
    b.party ? h('p.small.muted', 'What a day. One more year older, one more year better.')
      : h('div', h('p.small', 'Your phone has been buzzing since midnight. How do you celebrate?'),
        h('div.col', { style: { gap: '6px' } }, PARTIES.filter((x) => x.needs !== 'partner' || p.partnerName).map((x) => h('button.btn.block', { onclick: () => { sfx.levelUp?.(); const r = throwParty(st, x.id); if (r) toast(r.text); app.commit(); } }, x.label.replace('{partner}', p.partnerName ?? ''))))));
}

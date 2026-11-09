// The phone: Huddle (social media), Messages, Bank, Calendar, News, Contacts.
import { h, clear } from '../dom.js';
import { changeChips } from '../components.js';
import { phoneState, followers, fmtCount, feed, postOptions, canPost, makePost, markRead, reply, replyOptions, contactName, replyToComment, commentReplyOptions } from '../../sim/phone.js';
import { people } from '../../sim/social.js';
import { getTeam } from '../../sim/league.js';
import { HOUSING, CARS, PERKS } from '../../data/lifestyle.js';
import { itemWeekly } from '../../sim/shop.js';
import { STAGES, DAYS } from '../../data/config.js';
import { ACTIVITY_BY_ID } from '../../sim/week.js';
import { fmtMoney } from '../../core/util.js';
import { portrait, personSheet } from './people.js';
import { icon } from '../icons.js';
import { sfx } from '../../audio/sfx.js';

const APPS = [
  ['huddle', 'Huddle', 'chat', '#ff3d7f'],
  ['messages', 'Messages', 'chat', '#3ddc84'],
  ['bank', 'Bank', 'dollar', '#4da3ff'],
  ['calendar', 'Calendar', 'calendar', '#ffb020'],
  ['news', 'News', 'news', '#a78bfa'],
  ['contacts', 'Contacts', 'users', '#8b98a8'],
];

export function phoneBadge(state) {
  return phoneState(state).unread;
}

export function openPhone(app, startApp = null) {
  const st = app.state;
  const back = h('div.phone-back');
  const screen = h('div.phone-screen');
  const device = h('div.phone', h('div.phone-notch'), screen);
  back.append(device);
  document.getElementById('overlay').append(back);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  sfx.select();
  const close = () => { back.remove(); app.render(); };

  const statusBar = () => h('div.phone-status', h('span', `Wk ${(st.league?.week ?? 0) + 1}`), h('span', '▂▄▆ ▮▮▮'));
  const header = (title, onBack) => h('div.phone-head', h('button.phone-back-btn', { onclick: onBack }, '‹'), h('b', title), h('span', { style: { width: '28px' } }));

  const home = () => {
    clear(screen);
    const unread = phoneState(st).unread;
    screen.append(statusBar(),
      h('div.phone-clock', `${st.career.year}`), h('div.phone-date', `${STAGES[st.career.stage]?.label ?? ''} · ${getTeam(st.league, st.career.teamId)?.name ?? ''}`),
      h('div.phone-apps', APPS.map(([id, label, ic, color]) => h('button.phone-app', { onclick: () => { sfx.click(); open(id); } },
        h('span.app-ic', { style: { background: color } }, icon(ic), id === 'messages' && unread ? h('span.app-badge', unread) : null), h('span', label)))),
      h('button.phone-home-bar', { onclick: close, 'aria-label': 'Close phone' }));
  };

  const open = (id) => ({ huddle, messages, bank, calendar, news, contacts })[id]();

  // comments on your posts, with reply buttons (trolls can be clapped back at)
  const commentList = (post, redraw) => h('div.post-comments', post.comments.map((c, ci) => h('div.comment',
    h('div.tiny', h('b', c.handle), ` ${c.text}`, c.troll ? h('span.troll-tag', ' TROLL') : null),
    c.replied ? (c.replied === 'ignored' ? h('div.tiny.muted', '(ignored)') : h('div.tiny.reply-me', `↳ You: ${c.replied}`))
      : h('div.row.wrap', { style: { gap: '4px', marginTop: '3px' } }, commentReplyOptions(c).map((label, i) => h('button.btn.tiny-btn', { onclick: () => {
        const r = replyToComment(st, post.id, ci, i);
        app.save();
        if (r?.text) toastLite(r.text);
        sfx.click();
        redraw();
      } }, label))))));
  const toastLite = (txt) => { const t = h('div.phone-toast', txt); screen.append(t); setTimeout(() => t.remove(), 2200); };

  // ---------------- Huddle (social)
  const huddle = () => {
    clear(screen);
    const p = st.player;
    const posts = phoneState(st).posts.length;
    const body = h('div.phone-body');
    screen.append(statusBar(), header('Huddle', home), body);
    body.append(h('div.huddle-profile',
      portrait(p.look ?? { shirt: '#3a86ff', pants: '#222', skin: 1, hair: 0, hairStyle: 0 }, 56),
      h('div.grow', h('b', `${p.first} ${p.last}`), h('div.tiny.muted', `@${p.first.toLowerCase()}${p.last.toLowerCase()}${p.number}`),
        h('div.row', { style: { gap: '14px', marginTop: '6px' } }, h('span.small', h('b', fmtCount(followers(p))), ' followers'), h('span.small', h('b', posts), ' posts')))),
    canPost(st) ? h('button.btn.primary.block.small', { onclick: compose }, '+ New post') : h('p.tiny.muted.center', 'You posted this week. Post again next week.'));
    for (const it of feed(st).slice(0, 30)) {
      body.append(h(`div.post${it.mine ? '.mine' : ''}${it.press ? '.press' : ''}`,
        h('div.post-head', h('b', it.name), h('span.tiny.muted', ` ${it.author} · ${it.year} wk ${it.week}`)),
        h('div.post-text', it.text),
        it.mine ? h('div.post-meta', `♥ ${fmtCount(it.likes)}  ·  ${it.comments.length} comments`) : null,
        it.mine ? commentList(phoneState(st).posts.find((x) => x.id === it.id) ?? it, huddle) : null));
    }
  };
  const compose = () => {
    clear(screen);
    const body = h('div.phone-body');
    screen.append(statusBar(), header('New post', huddle), body);
    body.append(h('p.small.muted', 'What do you want to post? One post per week.'),
      h('div.col', postOptions(st).map((o) => h('button.btn.block.choice', { onclick: () => {
        const r = makePost(st, o.id);
        if (!r) return;
        sfx.cash();
        app.save();
        clear(body);
        body.append(h('div.post.mine', h('div.post-text', r.post.text), h('div.post-meta', `♥ ${fmtCount(r.post.likes)}  ·  ${r.post.comments.length} comments`),
          commentList(r.post, huddle)),
        changeChips(r.changes), h('button.btn.primary.block', { onclick: huddle }, 'Back to feed'));
      } }, o.label))));
  };

  // ---------------- Messages
  const messages = () => {
    clear(screen);
    const ph = phoneState(st);
    const body = h('div.phone-body');
    screen.append(statusBar(), header('Messages', home), body);
    const keys = Object.keys(ph.threads).sort((a, b) => {
      const la = ph.threads[a][ph.threads[a].length - 1];
      const lb = ph.threads[b][ph.threads[b].length - 1];
      return (lb.year - la.year) || (lb.week - la.week);
    });
    if (!keys.length) body.append(h('p.small.muted.center', 'No messages yet. Play some games!'));
    const plist = people(st);
    for (const k of keys) {
      const t = ph.threads[k];
      const last = t[t.length - 1];
      const unread = t.some((m) => !m.read && m.from === 'them');
      const person = plist.find((x) => x.key === k);
      body.append(h('button.thread-row', { onclick: () => thread(k) },
        person?.look ? portrait(person.look, 40) : h('span.app-ic.small', icon('chat')),
        h('div.grow', h('div.row.between', h('b', contactName(st, k)), unread ? h('span.unread-dot') : null), h('div.tiny.muted.ellipsis', last.text))));
    }
  };
  let justReplied = null;
  let lastChanges = null;
  const thread = (key) => {
    markRead(st, key);
    app.save();
    clear(screen);
    const body = h('div.phone-body.thread');
    screen.append(statusBar(), header(contactName(st, key), messages), body);
    const msgs = phoneState(st).threads[key] ?? [];
    msgs.forEach((m, i) => {
      // their quick answer to your reply appears after a short "typing..." beat
      if (i === msgs.length - 1 && m.from === 'them' && justReplied === key) {
        const typing = h('div.bubble.them.typing', h('i'), h('i'), h('i'));
        body.append(typing);
        setTimeout(() => { typing.replaceWith(h('div.bubble.them', m.text)); body.scrollTop = body.scrollHeight; }, 900);
      } else body.append(h(`div.bubble.${m.from}`, m.text));
    });
    justReplied = null;
    if (lastChanges) { body.append(h('div.reply-effects', changeChips(lastChanges))); lastChanges = null; }
    const opts = replyOptions(st, key);
    if (opts.length) body.append(h('div.quick-replies.col', opts.map((label, i) => h('button.btn.small.block.reply-opt', { onclick: () => {
      const r = reply(st, key, i);
      app.save();
      if (r) { sfx.select(); lastChanges = r.changes?.length ? r.changes : null; justReplied = r.back ? key : null; }
      thread(key);
    } }, label))));
    setTimeout(() => { body.scrollTop = body.scrollHeight; }, 0);
  };

  // ---------------- Bank
  const bank = () => {
    clear(screen);
    const p = st.player;
    const body = h('div.phone-body');
    screen.append(statusBar(), header('Bank', home), body);
    const house = HOUSING.find((x) => x.id === p.housing);
    const car = CARS.find((x) => x.id === p.car);
    const iw = itemWeekly(p);
    const perks = p.perks.reduce((a, id) => a + (PERKS.find((x) => x.id === id)?.weekly ?? 0), 0);
    const salaryWk = p.contract ? Math.round(p.contract.salary / STAGES.pro.games) : 0;
    const sponsorWk = p.sponsors.reduce((a, s) => a + s.weekly, 0);
    const inv = Object.values(p.investments).reduce((a, b) => a + b, 0);
    const line = (label, v) => h('div.li', h('span.grow', label), h(`b.${v >= 0 ? 'good' : 'bad'}`, `${v >= 0 ? '+' : '-'}${fmtMoney(Math.abs(v))}`));
    body.append(
      h('div.bank-card', h('div.tiny', 'Checking'), h('div.bank-bal', fmtMoney(p.money)), h('div.tiny', `Investments ${fmtMoney(inv)}`)),
      h('div.section-label', 'Every week'),
      h('div.list',
        salaryWk ? line('Salary', salaryWk) : null,
        sponsorWk ? line(`Sponsors (${p.sponsors.length})`, sponsorWk) : null,
        st.career.stage === 'hs' ? line('Allowance', 20) : null,
        house.rent ? line(`Rent: ${house.label}`, -house.rent) : null,
        car.upkeep ? line(`Car: ${car.label}`, -car.upkeep) : null,
        perks ? line('Staff', -perks) : null,
        iw.cost ? line('Pets, toys & upkeep', -iw.cost) : null),
      p.contract ? h('p.tiny.muted', { style: { marginTop: '10px' } }, `Contract: ${fmtMoney(p.contract.salary)}/yr, ${p.contract.years} yr left`) : null);
  };

  // ---------------- Calendar
  const calendar = () => {
    clear(screen);
    const body = h('div.phone-body');
    screen.append(statusBar(), header('Calendar', home), body);
    const plan = st.week?.plan ?? [];
    body.append(h('div.section-label', 'This week'), h('div.list', DAYS.map((d, i) => {
      const e = plan[i];
      const label = !e ? 'Free' : typeof e === 'object' ? e.label : ACTIVITY_BY_ID[e]?.label ?? e;
      return h('div.li', h('b', { style: { width: '40px' } }, d), h('span.grow', label));
    }), h('div.li', h('b', { style: { width: '40px' } }, 'Sat'), h('span.grow', 'Game day 🏈'))));
    const league = st.league;
    if (league?.schedule?.length) {
      body.append(h('div.section-label', { style: { marginTop: '12px' } }, 'Schedule'));
      body.append(h('div.list', league.schedule.map((wk, i) => {
        const g = wk.find((x) => x.home === st.career.teamId || x.away === st.career.teamId);
        if (!g) return null;
        const homeG = g.home === st.career.teamId;
        const opp = getTeam(league, homeG ? g.away : g.home);
        const res = g.result ? (() => { const us = homeG ? g.result.home : g.result.away; const them = homeG ? g.result.away : g.result.home; return `${us > them ? 'W' : 'L'} ${us}-${them}`; })() : i === league.week ? 'Next' : '';
        return h('div.li', h('span.tiny.muted', { style: { width: '40px' } }, `Wk ${i + 1}`), h('span.grow', `${homeG ? 'vs' : '@'} ${opp.city}`), h('span.small', res));
      })));
    }
  };

  // ---------------- News
  const news = () => {
    clear(screen);
    const body = h('div.phone-body');
    screen.append(statusBar(), header('News', home), body);
    for (const n of (st.news ?? []).filter((x) => x.kind !== 'fan').slice(0, 30)) body.append(h('div.post', h('div.tiny.muted', `${n.outlet ?? n.kind} · ${n.year} wk ${n.week}`), h('div.post-text', n.text)));
  };

  // ---------------- Contacts
  const contacts = () => {
    clear(screen);
    const body = h('div.phone-body');
    screen.append(statusBar(), header('Contacts', home), body);
    for (const pp of people(st)) {
      body.append(h('button.thread-row', { onclick: () => { back.remove(); personSheet(app, pp.key, { onDone: () => app.render() }); } },
        portrait(pp.look, 40), h('div.grow', h('b', pp.name), h('div.tiny.muted', pp.title)), h('span.tiny.muted', Math.round(pp.value))));
    }
  };

  if (startApp) open(startApp); else home();
}

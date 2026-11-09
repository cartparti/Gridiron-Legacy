import { HS_EVENTS } from './hs.js';
import { COLLEGE_EVENTS } from './college.js';
import { PRO_EVENTS } from './pro.js';
import { ANY_EVENTS } from './any.js';

export const ALL_EVENTS = [...HS_EVENTS, ...COLLEGE_EVENTS, ...PRO_EVENTS, ...ANY_EVENTS];
export const EVENTS_BY_ID = Object.fromEntries(ALL_EVENTS.map((e) => [e.id, e]));

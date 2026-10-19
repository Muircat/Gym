/*
 * plan.js — the 12-week machine plan. Edit this file to change exercises.
 * increment = how much weight to add when you hit the top of the rep range (kg).
 */
(function (root) {
  'use strict';

  const PLAN = {
    A: [
      { id: 'leg-press', name: 'Leg press', sets: 3, range: '10-12', swap: 'Hack squat', increment: 5 },
      { id: 'chest-press', name: 'Chest press', sets: 3, range: '8-12', swap: 'Smith machine bench press', increment: 2.5 },
      { id: 'lat-pulldown', name: 'Lat pulldown', sets: 3, range: '8-12', swap: 'Assisted pull-up machine', increment: 2.5 },
      { id: 'shoulder-press', name: 'Shoulder press', sets: 2, range: '10-12', swap: 'Smith machine overhead press', increment: 2.5 },
      { id: 'seated-leg-curl', name: 'Seated leg curl', sets: 2, range: '10-12', swap: 'Lying leg curl', increment: 2.5 },
      { id: 'cable-curl', name: 'Cable bicep curl', sets: 2, range: '10-15', swap: 'Bicep curl machine', increment: 2.5 },
      { id: 'ab-crunch', name: 'Ab crunch machine', sets: 2, range: '12-15', swap: 'Cable crunch', increment: 2.5 },
    ],
    B: [
      { id: 'hack-squat', name: 'Hack squat', sets: 3, range: '8-12', swap: 'Leg press', increment: 5 },
      { id: 'seated-row', name: 'Seated cable row', sets: 3, range: '8-12', swap: 'Chest-supported row machine', increment: 2.5 },
      { id: 'incline-press', name: 'Incline chest press', sets: 3, range: '10-12', swap: 'Pec deck', increment: 2.5 },
      { id: 'lateral-raise', name: 'Lateral raise machine', sets: 3, range: '12-15', swap: 'Cable lateral raise', increment: 2.5 },
      { id: 'leg-extension', name: 'Leg extension', sets: 2, range: '12-15', swap: 'Leg press (feet low)', increment: 2.5 },
      { id: 'tricep-pushdown', name: 'Cable tricep pushdown', sets: 2, range: '10-15', swap: 'Tricep dip machine', increment: 2.5 },
      { id: 'calf-raise', name: 'Calf raise machine', sets: 2, range: '12-15', swap: 'Calf raises on the leg press', increment: 5 },
    ],
  };

  const PLAN_WEEKS = 12;
  const SESSIONS_PER_WEEK = 3;

  const exports = { PLAN, PLAN_WEEKS, SESSIONS_PER_WEEK };
  if (typeof module !== 'undefined' && module.exports) module.exports = exports;
  else Object.assign(root, exports);
})(typeof window !== 'undefined' ? window : globalThis);

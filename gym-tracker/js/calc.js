/*
 * calc.js — all the maths for Gym Tracker.
 * Pure functions only (no DOM), so they run in the browser and in Node tests.
 */
(function (root) {
  'use strict';

  const Calc = {};

  // ---------- small helpers ----------

  Calc.round = function (n, dp = 1) {
    const f = Math.pow(10, dp);
    return Math.round(n * f) / f;
  };

  /** Local date → "YYYY-MM-DD". */
  Calc.isoDate = function (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  /** Whole days from ISO date a to ISO date b (b − a). */
  Calc.daysBetween = function (a, b) {
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  };

  /** "8-12" → { min: 8, max: 12 }; "10" → { min: 10, max: 10 }. */
  Calc.parseRange = function (range) {
    const parts = String(range).split(/[-–]/).map((p) => parseInt(p, 10));
    const min = parts[0];
    const max = parts.length > 1 && !isNaN(parts[1]) ? parts[1] : min;
    return { min, max };
  };

  /** Round to the nearest machine increment, e.g. 23.1 → 22.5 with a 2.5 kg step. */
  Calc.roundToIncrement = function (x, inc = 2.5) {
    return Calc.round(Math.round(x / inc) * inc, 2);
  };

  // ---------- strength ----------

  /** Estimated one-rep max, Epley formula: w × (1 + reps / 30). */
  Calc.e1rmEpley = function (weight, reps) {
    if (!(weight > 0) || !(reps > 0)) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
  };

  /** Estimated one-rep max, Brzycki formula: w × 36 / (37 − reps). */
  Calc.e1rmBrzycki = function (weight, reps) {
    if (!(weight > 0) || !(reps > 0) || reps >= 37) return 0;
    if (reps === 1) return weight;
    return (weight * 36) / (37 - reps);
  };

  /** Weight you could lift for a given number of reps, from a 1RM (inverse Epley). */
  Calc.loadForReps = function (oneRm, reps) {
    if (!(oneRm > 0) || !(reps > 0)) return 0;
    if (reps === 1) return oneRm;
    return oneRm / (1 + reps / 30);
  };

  /** Best estimated 1RM across a list of { weight, reps } sets. */
  Calc.bestE1rm = function (sets) {
    return (sets || []).reduce((best, s) => Math.max(best, Calc.e1rmEpley(s.weight, s.reps)), 0);
  };

  /** Total volume (kg lifted) for a list of sets. */
  Calc.setsVolume = function (sets) {
    return (sets || []).reduce((sum, s) => sum + (s.weight > 0 && s.reps > 0 ? s.weight * s.reps : 0), 0);
  };

  /** Total volume for a whole logged session. */
  Calc.sessionVolume = function (session) {
    return (session.exercises || []).reduce((sum, ex) => sum + Calc.setsVolume(ex.sets), 0);
  };

  // ---------- sessions & progression ----------

  Calc.sortSessions = function (sessions) {
    return (sessions || []).slice().sort(
      (a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0)
    );
  };

  /** Which workout is next in the A/B rotation. */
  Calc.nextWorkout = function (sessions) {
    const sorted = Calc.sortSessions(sessions);
    if (!sorted.length) return 'A';
    return sorted[sorted.length - 1].workout === 'A' ? 'B' : 'A';
  };

  /**
   * Every logged session of one exercise, newest first.
   * Returns [{ date, sets: [{ weight, reps }] }] with empty sets removed.
   */
  Calc.exerciseHistory = function (sessions, exerciseId) {
    const out = [];
    Calc.sortSessions(sessions)
      .reverse()
      .forEach((s) => {
        const ex = (s.exercises || []).find((e) => e.id === exerciseId);
        if (!ex) return;
        const sets = (ex.sets || []).filter((x) => x.weight >= 0 && x.reps > 0);
        if (sets.length) out.push({ date: s.date, sets });
      });
    return out;
  };

  function topWeight(sets) {
    return Math.max.apply(null, sets.map((s) => s.weight));
  }

  /**
   * A stall = the last `window` sessions all used the same top weight and none of the
   * newer ones beat the oldest one's total reps at that weight.
   * Default window 4 = a baseline session plus three in a row with no progress.
   */
  Calc.isStalled = function (history, window = 4) {
    if (!history || history.length < window) return false;
    const recent = history.slice(0, window);
    const tops = recent.map((h) => topWeight(h.sets));
    if (!tops.every((t) => t === tops[0])) return false;
    const reps = recent.map((h, i) =>
      h.sets.filter((s) => s.weight === tops[i]).reduce((a, s) => a + s.reps, 0)
    );
    const baseline = reps[window - 1];
    return Math.max.apply(null, reps.slice(0, window - 1)) <= baseline;
  };

  /**
   * Double-progression suggestion for the next session.
   * ex: { sets, range: "8-12", increment }
   * history: output of exerciseHistory (newest first)
   * Returns { kind: 'first'|'increase'|'deload'|'repeat', weight, targetReps: [..], text }
   */
  Calc.suggestNext = function (ex, history) {
    const range = Calc.parseRange(ex.range);
    const inc = ex.increment || 2.5;
    const n = ex.sets;
    const fill = (v) => Array.from({ length: n }, () => v);

    if (!history || !history.length) {
      return {
        kind: 'first',
        weight: null,
        targetReps: fill(range.min),
        text: `First time: pick a weight you could do ${range.min} reps with and 3–4 still in the tank.`,
      };
    }

    const last = history[0].sets;
    const top = topWeight(last);
    const atTop = last.filter((s) => s.weight === top);
    const hitTop = atTop.length >= n && atTop.every((s) => s.reps >= range.max);

    if (hitTop) {
      const w = Calc.round(top + inc, 2);
      return {
        kind: 'increase',
        weight: w,
        targetReps: fill(range.min),
        text: `You hit ${range.max} reps on every set, so go up to ${w} kg and aim for ${range.min}+ reps.`,
      };
    }

    if (Calc.isStalled(history)) {
      let w = Calc.roundToIncrement(top * 0.9, inc);
      if (w >= top) w = Calc.round(Math.max(0, top - inc), 2);
      return {
        kind: 'deload',
        weight: w,
        targetReps: fill(range.max),
        text: `No progress for 3 sessions. Drop to ${w} kg (about −10%) and build back up.`,
      };
    }

    const targets = Array.from({ length: n }, (_, i) => {
      const prev = atTop[i] ? atTop[i].reps : atTop.length ? atTop[atTop.length - 1].reps : range.min;
      return Math.min(range.max, Math.max(range.min, prev + 1));
    });
    return {
      kind: 'repeat',
      weight: top,
      targetReps: targets,
      text: `Stay at ${top} kg and beat last time: aim for ${targets.join(' / ')}.`,
    };
  };

  /** Names of exercises in `session` that beat their best estimated 1RM from `previous` sessions. */
  Calc.findPRs = function (session, previous) {
    const prs = [];
    (session.exercises || []).forEach((ex) => {
      const now = Calc.bestE1rm(ex.sets);
      if (!now) return;
      const before = Calc.exerciseHistory(previous, ex.id).reduce((b, h) => Math.max(b, Calc.bestE1rm(h.sets)), 0);
      if (before > 0 && now > before) prs.push(ex.name);
    });
    return prs;
  };

  // ---------- body & nutrition ----------

  /** Basal metabolic rate, Mifflin–St Jeor. Returns kcal/day or null if data missing. */
  Calc.bmr = function ({ sex, weightKg, heightCm, age }) {
    if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null;
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return sex === 'female' ? base - 161 : base + 5;
  };

  Calc.ACTIVITY = {
    sedentary: { factor: 1.2, label: 'Mostly sitting, little exercise' },
    light: { factor: 1.375, label: 'Light: 1–3 workouts a week' },
    moderate: { factor: 1.55, label: 'Moderate: 3–5 workouts a week' },
    very: { factor: 1.725, label: 'Very active: 6–7 workouts a week' },
    extra: { factor: 1.9, label: 'Physical job plus training' },
  };

  /** Total daily energy expenditure. */
  Calc.tdee = function (bmr, activity) {
    if (!(bmr > 0)) return null;
    const a = Calc.ACTIVITY[activity] || Calc.ACTIVITY.moderate;
    return bmr * a.factor;
  };

  /** Calorie targets from TDEE. Recomp = maintenance down to 10% below it. */
  Calc.calorieTargets = function (tdee) {
    if (!(tdee > 0)) return null;
    return {
      maintenance: Math.round(tdee),
      recompLow: Math.round(tdee * 0.9),
      recompHigh: Math.round(tdee),
      cut: Math.round(tdee * 0.8),
      leanBulk: Math.round(tdee * 1.1),
    };
  };

  /** Daily protein range for building muscle: 1.6–2.2 g per kg. */
  Calc.proteinRange = function (weightKg) {
    if (!(weightKg > 0)) return null;
    return { min: Math.round(weightKg * 1.6), max: Math.round(weightKg * 2.2) };
  };

  Calc.bmi = function (weightKg, heightCm) {
    if (!(weightKg > 0) || !(heightCm > 0)) return null;
    const m = heightCm / 100;
    return weightKg / (m * m);
  };

  /**
   * 7-day rolling average of body weight.
   * entries: [{ date, weight }] → [{ date, weight, avg }] sorted oldest first.
   */
  Calc.rollingAverage = function (entries, days = 7) {
    const sorted = (entries || [])
      .filter((e) => e.weight > 0)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((e) => {
      const win = sorted.filter((x) => {
        const d = Calc.daysBetween(x.date, e.date);
        return d >= 0 && d < days;
      });
      const avg = win.reduce((a, x) => a + x.weight, 0) / win.length;
      return { date: e.date, weight: e.weight, avg };
    });
  };

  /** Rate of change of the rolling average in kg per week, or null if under a week of data. */
  Calc.weeklyRate = function (rolling) {
    if (!rolling || rolling.length < 2) return null;
    const last = rolling[rolling.length - 1];
    const prior = rolling.filter((r) => Calc.daysBetween(r.date, last.date) >= 7);
    if (!prior.length) return null;
    const p = prior[prior.length - 1];
    const days = Calc.daysBetween(p.date, last.date);
    return ((last.avg - p.avg) / days) * 7;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
  else root.Calc = Calc;
})(typeof window !== 'undefined' ? window : globalThis);

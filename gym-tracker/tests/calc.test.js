const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('../js/calc.js');
const { PLAN } = require('../js/plan.js');

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('parseRange', () => {
  assert.deepEqual(Calc.parseRange('8-12'), { min: 8, max: 12 });
  assert.deepEqual(Calc.parseRange('10'), { min: 10, max: 10 });
  assert.deepEqual(Calc.parseRange('12–15'), { min: 12, max: 15 });
});

test('roundToIncrement', () => {
  assert.equal(Calc.roundToIncrement(23.1, 2.5), 22.5);
  assert.equal(Calc.roundToIncrement(24, 2.5), 25);
  assert.equal(Calc.roundToIncrement(91, 5), 90);
});

test('one-rep max formulas', () => {
  near(Calc.e1rmEpley(100, 10), 133.33);
  near(Calc.e1rmBrzycki(100, 10), 133.33);
  assert.equal(Calc.e1rmEpley(80, 1), 80);
  assert.equal(Calc.e1rmEpley(0, 10), 0);
  near(Calc.loadForReps(Calc.e1rmEpley(50, 8), 8), 50);
});

test('volume', () => {
  const session = { exercises: [{ sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 8 }] }, { sets: [{ weight: 50, reps: 12 }] }] };
  assert.equal(Calc.sessionVolume(session), 20 * 18 + 600);
});

test('BMR, TDEE and targets (Mifflin–St Jeor)', () => {
  const bmr = Calc.bmr({ sex: 'male', weightKg: 70, heightCm: 175, age: 20 });
  near(bmr, 1698.75);
  near(Calc.bmr({ sex: 'female', weightKg: 70, heightCm: 175, age: 20 }), 1532.75);
  assert.equal(Calc.bmr({ sex: 'male', weightKg: 70, heightCm: null, age: 20 }), null);
  const tdee = Calc.tdee(bmr, 'moderate');
  near(tdee, 1698.75 * 1.55);
  const t = Calc.calorieTargets(tdee);
  assert.equal(t.maintenance, Math.round(tdee));
  assert.equal(t.recompLow, Math.round(tdee * 0.9));
});

test('protein and BMI', () => {
  assert.deepEqual(Calc.proteinRange(70.2), { min: 112, max: 154 });
  near(Calc.bmi(70, 175), 22.86);
});

test('nextWorkout alternates A/B', () => {
  assert.equal(Calc.nextWorkout([]), 'A');
  assert.equal(Calc.nextWorkout([{ date: '2026-10-20', workout: 'A' }]), 'B');
  assert.equal(
    Calc.nextWorkout([
      { date: '2026-10-22', workout: 'B', createdAt: 2 },
      { date: '2026-10-20', workout: 'A', createdAt: 1 },
    ]),
    'A'
  );
});

const chest = PLAN.A.find((e) => e.id === 'chest-press'); // 3 × 8-12, +2.5

function session(date, sets) {
  return { date, workout: 'A', exercises: [{ id: 'chest-press', name: 'Chest press', sets }] };
}
const s = (weight, ...reps) => reps.map((r) => ({ weight, reps: r }));

test('suggestNext: first time', () => {
  const sug = Calc.suggestNext(chest, []);
  assert.equal(sug.kind, 'first');
  assert.equal(sug.weight, null);
});

test('suggestNext: stays at weight and adds a rep', () => {
  const hist = Calc.exerciseHistory([session('2026-10-20', s(25, 12, 10, 9))], 'chest-press');
  const sug = Calc.suggestNext(chest, hist);
  assert.equal(sug.kind, 'repeat');
  assert.equal(sug.weight, 25);
  assert.deepEqual(sug.targetReps, [12, 11, 10]);
});

test('suggestNext: goes up after top of range on every set', () => {
  const hist = Calc.exerciseHistory([session('2026-10-20', s(25, 12, 12, 12))], 'chest-press');
  const sug = Calc.suggestNext(chest, hist);
  assert.equal(sug.kind, 'increase');
  assert.equal(sug.weight, 27.5);
  assert.deepEqual(sug.targetReps, [8, 8, 8]);
});

test('suggestNext: deloads after three sessions without progress', () => {
  const sessions = [
    session('2026-10-01', s(40, 10, 9, 8)),
    session('2026-10-03', s(40, 10, 9, 8)),
    session('2026-10-06', s(40, 9, 9, 8)),
    session('2026-10-08', s(40, 10, 8, 8)),
  ];
  const hist = Calc.exerciseHistory(sessions, 'chest-press');
  assert.equal(Calc.isStalled(hist), true);
  const sug = Calc.suggestNext(chest, hist);
  assert.equal(sug.kind, 'deload');
  assert.equal(sug.weight, 35);
});

test('isStalled: not stalled while reps are climbing', () => {
  const sessions = [
    session('2026-10-01', s(40, 9, 8, 8)),
    session('2026-10-03', s(40, 9, 9, 8)),
    session('2026-10-06', s(40, 10, 9, 8)),
    session('2026-10-08', s(40, 10, 9, 9)),
  ];
  assert.equal(Calc.isStalled(Calc.exerciseHistory(sessions, 'chest-press')), false);
});

test('findPRs', () => {
  const prev = [session('2026-10-01', s(25, 10, 10, 10))];
  const now = session('2026-10-03', s(25, 12, 10, 10));
  assert.deepEqual(Calc.findPRs(now, prev), ['Chest press']);
  assert.deepEqual(Calc.findPRs(session('2026-10-03', s(25, 9, 9, 9)), prev), []);
});

test('rolling average and weekly rate', () => {
  const entries = [];
  for (let i = 0; i < 15; i++) {
    const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
    entries.push({ date: d, weight: 70 - i * 0.05 }); // −0.35 kg per week
  }
  const rolling = Calc.rollingAverage(entries);
  assert.equal(rolling.length, 15);
  near(rolling[0].avg, 70);
  near(Calc.weeklyRate(rolling), -0.35);
  assert.equal(Calc.weeklyRate(rolling.slice(0, 3)), null);
});

test('plan has 7 exercises per workout with unique ids', () => {
  assert.equal(PLAN.A.length, 7);
  assert.equal(PLAN.B.length, 7);
  const ids = [...PLAN.A, ...PLAN.B].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

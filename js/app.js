/*
 * app.js — the user interface. Renders each tab and wires up events.
 */
(function () {
  'use strict';

  const { Calc, PLAN, PLAN_WEEKS, SESSIONS_PER_WEEK, Store, Charts } = window;

  let state = Store.load();
  Store.save(state);

  let tab = 'workout';
  let draft = null;
  let lastSaved = null;
  let progressExercise = PLAN.A[0].id;

  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');

  // ---------- helpers ----------

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => Calc.isoDate(new Date());
  const fmtDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const num = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  const kg = (n, dp = 1) => (n == null || isNaN(n) ? '–' : `${Calc.round(n, dp)} kg`);
  const int = (n) => (n == null || isNaN(n) ? '–' : Math.round(n).toLocaleString());
  // Charts are drawn at the card's real width so their labels stay readable on phones.
  const chartWidth = () => Math.max(260, ($app.clientWidth || 640) - 66);
  const allExercises = () => {
    const seen = new Map();
    [...PLAN.A, ...PLAN.B].forEach((e) => seen.set(e.id, e));
    return [...seen.values()];
  };

  let toastTimer;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.hidden = true; }, 3500);
  }

  function persist() {
    if (!Store.save(state)) toast("Couldn't save. Your browser may be blocking storage.");
  }

  // ---------- workout tab ----------

  function newDraft(workout, date) {
    const w = workout || Calc.nextWorkout(state.sessions);
    return {
      workout: w,
      date: date || today(),
      notes: '',
      exercises: PLAN[w].map((ex) => {
        const history = Calc.exerciseHistory(state.sessions, ex.id);
        const sug = Calc.suggestNext(ex, history);
        return {
          ...ex,
          sug,
          last: history[0] || null,
          entries: Array.from({ length: ex.sets }, () => ({ weight: sug.weight == null ? '' : sug.weight, reps: '' })),
        };
      }),
    };
  }

  function draftVolume() {
    return draft.exercises.reduce(
      (sum, ex) => sum + Calc.setsVolume(ex.entries.map((e) => ({ weight: num(e.weight), reps: num(e.reps) }))),
      0
    );
  }

  const BADGE = { first: 'New', increase: 'Go up', repeat: 'Same weight', deload: 'Deload' };

  function exerciseCard(ex, i) {
    const last = ex.last
      ? `<p class="muted small">Last time (${fmtDate(ex.last.date)}): ${ex.last.sets.map((s) => `${s.weight} kg × ${s.reps}`).join(', ')}</p>`
      : '';
    const rows = ex.entries
      .map((s, j) => `
        <div class="set-row">
          <span class="set-n">${j + 1}</span>
          <input type="number" inputmode="decimal" min="0" step="0.5" data-f="weight" data-j="${j}" value="${esc(s.weight)}" placeholder="kg" aria-label="Set ${j + 1} weight">
          <input type="number" inputmode="numeric" min="0" step="1" data-f="reps" data-j="${j}" value="${esc(s.reps)}" placeholder="${ex.sug.targetReps[j] || Calc.parseRange(ex.range).min}" aria-label="Set ${j + 1} reps">
        </div>`)
      .join('');
    return `
      <article class="card ex" data-ex="${i}">
        <header class="ex-head">
          <div>
            <h2>${i + 1}. ${esc(ex.name)}</h2>
            <p class="muted small">${ex.sets} × ${ex.range} reps · Swap: ${esc(ex.swap)}</p>
          </div>
          <span class="badge ${ex.sug.kind}">${BADGE[ex.sug.kind]}</span>
        </header>
        <p class="sug">${esc(ex.sug.text)}</p>
        ${last}
        <div class="sets">
          <div class="set-row head"><span>Set</span><span>Weight (kg)</span><span>Reps</span></div>
          ${rows}
        </div>
        <div class="ex-actions">
          <button class="ghost" data-act="add-set">+ Add set</button>
          ${ex.entries.length > 1 ? '<button class="ghost" data-act="remove-set">− Remove set</button>' : ''}
        </div>
      </article>`;
  }

  function renderWorkout() {
    if (!draft) draft = newDraft();
    const done = state.sessions.length;
    const week = Math.min(PLAN_WEEKS, Math.floor(done / SESSIONS_PER_WEEK) + 1);
    const savedCard = lastSaved
      ? `<section class="card saved">
           <h2>Saved: Workout ${lastSaved.workout}</h2>
           <p>${int(lastSaved.volume)} kg total volume${lastSaved.prs.length ? ` · New bests: ${esc(lastSaved.prs.join(', '))}` : ''}</p>
         </section>`
      : '';
    return `
      ${savedCard}
      <section class="card hero">
        <div>
          <p class="eyebrow">Week ${week} of ${PLAN_WEEKS} · Session ${done + 1}</p>
          <h1>Workout ${draft.workout}</h1>
        </div>
        <div class="hero-actions">
          <label class="field">Date <input type="date" id="w-date" value="${draft.date}"></label>
          <div class="seg" role="group" aria-label="Choose workout">
            <button data-act="switch" data-w="A" class="${draft.workout === 'A' ? 'on' : ''}">A</button>
            <button data-act="switch" data-w="B" class="${draft.workout === 'B' ? 'on' : ''}">B</button>
          </div>
        </div>
      </section>
      <p class="hint">Warm up for 5 minutes, then do one light set of the first exercise. Rest 90 s–2 min between sets and stop each set with 1–2 reps left.${week >= 9 ? ' <strong>Weeks 9–12:</strong> add a third set to the 2-set exercises if you\'re recovering well.' : ''}</p>
      ${draft.exercises.map(exerciseCard).join('')}
      <section class="card">
        <label class="field block">Notes
          <textarea id="w-notes" rows="2" placeholder="Seat settings, how it felt…">${esc(draft.notes)}</textarea>
        </label>
        <div class="row-end">
          <span id="w-volume" class="muted">Volume so far: ${int(draftVolume())} kg</span>
          <button class="primary" data-act="save-session">Save workout</button>
        </div>
      </section>`;
  }

  function saveSession() {
    const exercises = draft.exercises
      .map((ex) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.entries
          .map((e) => ({ weight: num(e.weight), reps: num(e.reps) }))
          .filter((s) => s.weight != null && s.weight >= 0 && s.reps != null && s.reps > 0),
      }))
      .filter((ex) => ex.sets.length);

    if (!exercises.length) {
      toast('Log at least one set (weight and reps) before saving.');
      return;
    }
    const session = {
      id: `s${Date.now()}`,
      createdAt: Date.now(),
      date: draft.date || today(),
      workout: draft.workout,
      exercises,
      notes: draft.notes.trim(),
    };
    const prs = Calc.findPRs(session, state.sessions);
    state.sessions = Calc.sortSessions([...state.sessions, session]);
    persist();
    lastSaved = { workout: session.workout, volume: Calc.sessionVolume(session), prs };
    draft = null;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- progress tab ----------

  function renderProgress() {
    const sessions = Calc.sortSessions(state.sessions).reverse();
    const ex = allExercises().find((e) => e.id === progressExercise) || allExercises()[0];
    const hist = Calc.exerciseHistory(state.sessions, ex.id);
    const pointsE1rm = hist.map((h) => ({ x: h.date, y: Calc.bestE1rm(h.sets) }));
    const pointsTop = hist.map((h) => ({ x: h.date, y: Math.max(...h.sets.map((s) => s.weight)) }));
    const best = hist.reduce((b, h) => Math.max(b, Calc.bestE1rm(h.sets)), 0);

    const weekAgo = Calc.isoDate(new Date(Date.now() - 6 * 86400000));
    const thisWeek = state.sessions.filter((s) => s.date >= weekAgo).length;
    const totalVol = state.sessions.reduce((a, s) => a + Calc.sessionVolume(s), 0);
    const pct = Math.min(100, Math.round((state.sessions.length / (PLAN_WEEKS * SESSIONS_PER_WEEK)) * 100));

    const options = allExercises()
      .map((e) => `<option value="${e.id}" ${e.id === ex.id ? 'selected' : ''}>${esc(e.name)}</option>`)
      .join('');

    const histRows = hist
      .slice(0, 12)
      .map((h) => `<tr><td>${fmtDate(h.date)}</td><td>${h.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')}</td><td class="num">${kg(Calc.bestE1rm(h.sets))}</td></tr>`)
      .join('');

    const list = sessions.length
      ? sessions
          .map((s) => `
            <details class="session">
              <summary>
                <span><strong>${fmtDate(s.date)}</strong> · Workout ${s.workout}</span>
                <span class="muted">${int(Calc.sessionVolume(s))} kg</span>
              </summary>
              <ul>${s.exercises.map((e) => `<li><span>${esc(e.name)}</span><span class="muted">${e.sets.map((x) => `${x.weight}×${x.reps}`).join(', ')}</span></li>`).join('')}</ul>
              ${s.notes ? `<p class="muted small">${esc(s.notes)}</p>` : ''}
              <button class="ghost danger" data-act="delete-session" data-id="${s.id}">Delete session</button>
            </details>`)
          .join('')
      : '<p class="muted">No workouts logged yet. Your first one will show up here.</p>';

    return `
      <section class="stats">
        <div class="stat"><span class="stat-v">${state.sessions.length}</span><span class="stat-l">Workouts logged</span></div>
        <div class="stat"><span class="stat-v">${thisWeek}<small>/${SESSIONS_PER_WEEK}</small></span><span class="stat-l">In the last 7 days</span></div>
        <div class="stat"><span class="stat-v">${int(totalVol)}<small> kg</small></span><span class="stat-l">Total volume</span></div>
        <div class="stat"><span class="stat-v">${pct}<small>%</small></span><span class="stat-l">Of the 12-week plan</span></div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Strength by exercise</h2>
          <select id="p-ex" aria-label="Exercise">${options}</select>
        </div>
        <p class="muted small">Estimated 1-rep max uses the Epley formula: weight × (1 + reps ÷ 30). It rises when you add weight or reps, so it's a fair single number for progress.</p>
        ${Charts.line([
          { name: 'Estimated 1RM', cls: 's1', points: pointsE1rm },
          { name: 'Top weight used', cls: 's2', points: pointsTop },
        ], { unit: 'kg', width: chartWidth() })}
        ${hist.length ? `<p><strong>Best estimated 1RM:</strong> ${kg(best)}</p>
          <div class="table-wrap"><table><thead><tr><th>Date</th><th>Sets (kg × reps)</th><th class="num">Est. 1RM</th></tr></thead><tbody>${histRows}</tbody></table></div>` : ''}
      </section>

      <section class="card">
        <h2>All workouts</h2>
        ${list}
      </section>`;
  }

  // ---------- body tab ----------

  function renderBody() {
    const rolling = Calc.rollingAverage(state.body);
    const rate = Calc.weeklyRate(rolling);
    const latest = rolling[rolling.length - 1];
    const first = rolling[0];
    const change = latest && first ? latest.avg - first.weight : null;

    let rateNote = 'Log at least a week of weigh-ins to see your trend.';
    if (rate != null) {
      if (rate < -0.5) rateNote = "Dropping fast. For a recomp, eat a bit more so you don't lose muscle.";
      else if (rate < -0.1) rateNote = 'Slowly losing. Right on track for a recomp.';
      else if (rate <= 0.15) rateNote = 'Holding steady. Normal for a recomp, so check your waist and photos.';
      else rateNote = "Gaining. Fine if you're building, but cut back a little if your waist is growing too.";
    }

    const rows = rolling
      .slice()
      .reverse()
      .map((r) => {
        const e = state.body.find((b) => b.date === r.date);
        return `<tr><td>${fmtDate(r.date)}</td><td class="num">${kg(r.weight)}</td><td class="num">${kg(r.avg, 2)}</td><td class="num">${e && e.waist ? `${e.waist} cm` : '–'}</td>
          <td><button class="ghost danger small" data-act="delete-body" data-date="${r.date}" aria-label="Delete">✕</button></td></tr>`;
      })
      .join('');

    const waistPts = state.body.filter((b) => b.waist > 0).map((b) => ({ x: b.date, y: b.waist }));

    return `
      <section class="card">
        <h2>Log a weigh-in</h2>
        <p class="muted small">Weigh yourself first thing in the morning, after the toilet and before eating. Daily numbers jump around, so the 7-day average is what counts.</p>
        <form id="body-form" class="form-row">
          <label class="field">Date <input type="date" name="date" value="${today()}" required></label>
          <label class="field">Weight (kg) <input type="number" name="weight" step="0.1" min="20" max="400" inputmode="decimal" required></label>
          <label class="field">Waist (cm, optional) <input type="number" name="waist" step="0.5" min="30" max="250" inputmode="decimal"></label>
          <button class="primary" type="submit">Save</button>
        </form>
      </section>

      <section class="stats">
        <div class="stat"><span class="stat-v">${latest ? Calc.round(latest.avg, 1) : '–'}<small> kg</small></span><span class="stat-l">7-day average</span></div>
        <div class="stat"><span class="stat-v">${rate == null ? '–' : (rate > 0 ? '+' : '') + Calc.round(rate, 2)}<small> kg/wk</small></span><span class="stat-l">Trend</span></div>
        <div class="stat"><span class="stat-v">${change == null ? '–' : (change > 0 ? '+' : '') + Calc.round(change, 1)}<small> kg</small></span><span class="stat-l">Since start</span></div>
      </section>
      <p class="hint">${rateNote}</p>

      <section class="card">
        <h2>Body weight</h2>
        ${Charts.line([
          { name: 'Daily weigh-in', cls: 's2', points: rolling.map((r) => ({ x: r.date, y: r.weight })), line: false },
          { name: '7-day average', cls: 's1', points: rolling.map((r) => ({ x: r.date, y: r.avg })), dots: false },
        ], { unit: 'kg', width: chartWidth() })}
      </section>

      ${waistPts.length > 1 ? `<section class="card"><h2>Waist</h2>${Charts.line([{ name: 'Waist', cls: 's1', points: waistPts }], { unit: 'cm', width: chartWidth() })}</section>` : ''}

      <section class="card">
        <h2>Weigh-ins</h2>
        ${rows ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Weight</th><th class="num">7-day avg</th><th class="num">Waist</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No weigh-ins yet.</p>'}
      </section>`;
  }

  // ---------- calculators tab ----------

  function renderCalc() {
    const p = state.profile;
    const actOpts = Object.entries(Calc.ACTIVITY)
      .map(([k, v]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${v.label}</option>`)
      .join('');
    return `
      <section class="card">
        <h2>Calories and protein</h2>
        <p class="muted small">Uses the Mifflin–St Jeor equation. Treat the result as a starting point and adjust after 2–3 weeks based on your 7-day average.</p>
        <form id="profile-form" class="grid-form">
          <label class="field">Sex
            <select name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select>
          </label>
          <label class="field">Age <input type="number" name="age" min="13" max="100" value="${p.age || ''}"></label>
          <label class="field">Height (cm) <input type="number" name="heightCm" min="100" max="250" step="0.5" value="${p.heightCm || ''}" placeholder="e.g. 178"></label>
          <label class="field">Weight (kg) <input type="number" name="weightKg" min="20" max="400" step="0.1" value="${p.weightKg || ''}"></label>
          <label class="field wide">Activity (including your 3 gym days)
            <select name="activity">${actOpts}</select>
          </label>
        </form>
        <div id="energy-out"></div>
      </section>

      <section class="card">
        <h2>One-rep max estimator</h2>
        <p class="muted small">Enter a set you've done to estimate your max and what you could lift for other rep counts. Useful for picking weights, not for testing a real max on machines.</p>
        <form id="orm-form" class="form-row">
          <label class="field">Weight (kg) <input type="number" name="w" min="0" step="0.5" inputmode="decimal" value="40"></label>
          <label class="field">Reps <input type="number" name="r" min="1" max="30" step="1" inputmode="numeric" value="10"></label>
        </form>
        <div id="orm-out"></div>
      </section>`;
  }

  function updateEnergy() {
    const out = document.getElementById('energy-out');
    if (!out) return;
    const p = state.profile;
    const bmr = Calc.bmr(p);
    const protein = Calc.proteinRange(p.weightKg);
    const bmi = Calc.bmi(p.weightKg, p.heightCm);
    if (!bmr) {
      out.innerHTML = `<p class="hint">Add your height to see calorie targets.${protein ? ` Protein: <strong>${protein.min}–${protein.max} g a day</strong>.` : ''}</p>`;
      return;
    }
    const tdee = Calc.tdee(bmr, p.activity);
    const t = Calc.calorieTargets(tdee);
    out.innerHTML = `
      <div class="stats compact">
        <div class="stat"><span class="stat-v">${int(t.recompLow)}–${int(t.recompHigh)}</span><span class="stat-l">Recomp calories / day</span></div>
        <div class="stat"><span class="stat-v">${protein.min}–${protein.max}<small> g</small></span><span class="stat-l">Protein / day</span></div>
        <div class="stat"><span class="stat-v">${int(t.maintenance)}</span><span class="stat-l">Maintenance (TDEE)</span></div>
      </div>
      <div class="table-wrap"><table>
        <tbody>
          <tr><td>Basal metabolic rate (at rest)</td><td class="num">${int(bmr)} kcal</td></tr>
          <tr><td>Maintenance with your activity</td><td class="num">${int(t.maintenance)} kcal</td></tr>
          <tr><td>Recomp: build muscle and lose fat slowly</td><td class="num">${int(t.recompLow)}–${int(t.recompHigh)} kcal</td></tr>
          <tr><td>Cut: lose fat faster (−20%)</td><td class="num">${int(t.cut)} kcal</td></tr>
          <tr><td>Lean bulk: gain faster (+10%)</td><td class="num">${int(t.leanBulk)} kcal</td></tr>
          <tr><td>Protein (1.6–2.2 g per kg)</td><td class="num">${protein.min}–${protein.max} g</td></tr>
          ${bmi ? `<tr><td>BMI (a rough guide only, it ignores muscle)</td><td class="num">${Calc.round(bmi, 1)}</td></tr>` : ''}
        </tbody>
      </table></div>`;
  }

  function updateOrm() {
    const out = document.getElementById('orm-out');
    const form = document.getElementById('orm-form');
    if (!out || !form) return;
    const w = num(form.w.value);
    const r = num(form.r.value);
    if (!(w > 0) || !(r > 0)) { out.innerHTML = ''; return; }
    const ep = Calc.e1rmEpley(w, r);
    const bz = Calc.e1rmBrzycki(w, r);
    const avg = bz ? (ep + bz) / 2 : ep;
    const reps = [1, 3, 5, 8, 10, 12, 15];
    out.innerHTML = `
      <div class="stats compact">
        <div class="stat"><span class="stat-v">${Calc.round(avg, 1)}<small> kg</small></span><span class="stat-l">Estimated 1RM (average)</span></div>
        <div class="stat"><span class="stat-v">${Calc.round(ep, 1)}<small> kg</small></span><span class="stat-l">Epley</span></div>
        <div class="stat"><span class="stat-v">${bz ? Calc.round(bz, 1) : '–'}<small> kg</small></span><span class="stat-l">Brzycki</span></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Reps</th><th class="num">Approx. weight</th><th class="num">% of 1RM</th></tr></thead>
        <tbody>${reps.map((n) => { const l = Calc.loadForReps(avg, n); return `<tr><td>${n}</td><td class="num">${kg(Calc.roundToIncrement(l, 2.5))}</td><td class="num">${Math.round((l / avg) * 100)}%</td></tr>`; }).join('')}</tbody>
      </table></div>`;
  }

  // ---------- settings tab ----------

  function renderSettings() {
    return `
      <section class="card">
        <h2>Backup</h2>
        <p class="muted small">Your data is stored only in this browser. Export a backup now and then, and import it to move to another device.</p>
        <div class="btn-row">
          <button class="primary" data-act="export">Export backup (.json)</button>
          <label class="button ghost">Import backup<input type="file" id="import-file" accept="application/json,.json" hidden></label>
        </div>
      </section>
      <section class="card">
        <h2>Your plan</h2>
        <p class="muted small">Alternate A and B, three days a week, for ${PLAN_WEEKS} weeks. To change exercises, edit <code>js/plan.js</code>.</p>
        <div class="plan-grid">
          ${['A', 'B'].map((w) => `<div><h3>Workout ${w}</h3><ol>${PLAN[w].map((e) => `<li>${esc(e.name)} <span class="muted">${e.sets} × ${e.range}</span></li>`).join('')}</ol></div>`).join('')}
        </div>
      </section>
      <section class="card">
        <h2>Reset</h2>
        <p class="muted small">Deletes all workouts, weigh-ins and profile data from this browser.</p>
        <button class="ghost danger" data-act="reset">Delete all data</button>
      </section>`;
  }

  // ---------- render & events ----------

  function render() {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'workout') $app.innerHTML = renderWorkout();
    else if (tab === 'progress') $app.innerHTML = renderProgress();
    else if (tab === 'body') $app.innerHTML = renderBody();
    else if (tab === 'calc') { $app.innerHTML = renderCalc(); updateEnergy(); updateOrm(); }
    else if (tab === 'settings') $app.innerHTML = renderSettings();
  }

  document.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    if (tab !== 'workout') lastSaved = null;
    render();
  });

  $app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const card = b.closest('[data-ex]');
    const ex = card ? draft.exercises[Number(card.dataset.ex)] : null;

    if (act === 'switch') {
      draft = newDraft(b.dataset.w, draft && draft.date);
      lastSaved = null;
      render();
    } else if (act === 'add-set' && ex) {
      const prev = ex.entries[ex.entries.length - 1];
      ex.entries.push({ weight: prev ? prev.weight : '', reps: '' });
      render();
    } else if (act === 'remove-set' && ex) {
      ex.entries.pop();
      render();
    } else if (act === 'save-session') {
      saveSession();
    } else if (act === 'delete-session') {
      if (!confirm('Delete this workout?')) return;
      state.sessions = state.sessions.filter((s) => s.id !== b.dataset.id);
      persist();
      draft = null;
      render();
    } else if (act === 'delete-body') {
      state.body = state.body.filter((x) => x.date !== b.dataset.date);
      persist();
      render();
    } else if (act === 'export') {
      Store.download(state);
    } else if (act === 'reset') {
      if (!confirm('Delete ALL your data? This cannot be undone.')) return;
      Store.clear();
      state = Store.load();
      persist();
      draft = null;
      toast('All data deleted.');
      render();
    }
  });

  $app.addEventListener('input', (e) => {
    const t = e.target;
    if (tab === 'workout' && draft) {
      if (t.id === 'w-date') draft.date = t.value;
      else if (t.id === 'w-notes') draft.notes = t.value;
      else if (t.dataset.f) {
        const card = t.closest('[data-ex]');
        const ex = draft.exercises[Number(card.dataset.ex)];
        ex.entries[Number(t.dataset.j)][t.dataset.f] = t.value;
        const vol = document.getElementById('w-volume');
        if (vol) vol.textContent = `Volume so far: ${int(draftVolume())} kg`;
      }
    } else if (tab === 'calc') {
      if (t.form && t.form.id === 'profile-form') {
        const v = t.name === 'sex' || t.name === 'activity' ? t.value : num(t.value);
        state.profile[t.name] = v;
        persist();
        updateEnergy();
      } else if (t.form && t.form.id === 'orm-form') {
        updateOrm();
      }
    }
  });

  $app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'p-ex') {
      progressExercise = t.value;
      render();
    } else if (t.id === 'import-file' && t.files && t.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!Store.isValid(data)) throw new Error('bad file');
          if (!confirm('Replace your current data with this backup?')) return;
          state = { ...Store.defaultState(), ...data };
          persist();
          draft = null;
          toast('Backup imported.');
          render();
        } catch (err) {
          toast("That file isn't a Gym Tracker backup.");
        }
      };
      reader.readAsText(t.files[0]);
    }
  });

  $app.addEventListener('submit', (e) => {
    if (e.target.id !== 'body-form') return;
    e.preventDefault();
    const f = e.target;
    const weight = num(f.weight.value);
    if (!(weight > 0)) return;
    const entry = { date: f.date.value || today(), weight, waist: num(f.waist.value) };
    state.body = state.body.filter((b) => b.date !== entry.date).concat(entry);
    const latestDate = state.body.reduce((a, b) => (b.date > a ? b.date : a), '');
    if (entry.date === latestDate) state.profile.weightKg = weight;
    persist();
    toast(`Saved ${weight} kg for ${fmtDate(entry.date)}.`);
    render();
  });

  // Redraw charts if the screen width changes a lot (e.g. phone rotated).
  let lastWidth = $app.clientWidth;
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if ((tab === 'progress' || tab === 'body') && Math.abs($app.clientWidth - lastWidth) > 40) render();
      lastWidth = $app.clientWidth;
    }, 200);
  });

  render();
})();

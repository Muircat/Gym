# Gym Tracker

A simple, private gym tracker built around a 12-week, 3-day machine plan. It tells you what weight to use next, tracks your strength and body weight over time, and works out your calories and protein.

No accounts, no server, no installs. It's plain HTML, CSS and JavaScript, and your data stays in your browser.

## Features

- **Workout logging:** the app picks the next workout (A/B rotation), pre-fills your weights, and you type in the reps for each set.
- **Progression suggestions** (double progression):
  - Hit the top of the rep range on every set → it tells you to add weight (+2.5 kg, or +5 kg on leg machines).
  - Otherwise → stay at the same weight and aim for one more rep per set.
  - No progress for 3 sessions in a row → it suggests dropping about 10% and building back up.
- **Progress:** a chart of estimated 1-rep max and top weight per exercise, personal-best alerts, a session history, total volume and how far you are through the plan.
- **Body:** daily weigh-ins with a 7-day rolling average, your trend in kg per week, and optional waist measurements.
- **Calculators:**
  - BMR and maintenance calories (Mifflin–St Jeor), with targets for recomp, cut and lean bulk
  - Daily protein range (1.6–2.2 g per kg)
  - BMI
  - One-rep max estimator (Epley and Brzycki) with a rep-max table
- **Backup:** export and import your data as JSON.
- Works on phones, with light and dark mode.

## Use it

### Option 1: open it locally

Download or clone the repo and open `index.html` in your browser. That's it.

### Option 2: put it online with GitHub Pages (recommended for using it on your phone)

1. Create a new repository on GitHub, e.g. `gym-tracker`.
2. Upload these files, or push them:

   ```bash
   git init
   git add .
   git commit -m "Gym tracker"
   git branch -M main
   git remote add origin https://github.com/<your-username>/gym-tracker.git
   git push -u origin main
   ```

3. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. The included workflow runs the tests and deploys. Your tracker will be at `https://<your-username>.github.io/gym-tracker/`.
5. On your phone, open that link and choose **Add to Home Screen**.

> Data is saved per browser and per device. Your phone and laptop won't share data automatically, so use **Settings → Export / Import** to move it.

## The maths

| What | Formula |
| --- | --- |
| Estimated 1RM (Epley) | weight × (1 + reps ÷ 30) |
| Estimated 1RM (Brzycki) | weight × 36 ÷ (37 − reps) |
| Weight for N reps | 1RM ÷ (1 + N ÷ 30) |
| BMR (Mifflin–St Jeor) | 10 × kg + 6.25 × cm − 5 × age + 5 (men) / − 161 (women) |
| Maintenance (TDEE) | BMR × activity factor (1.2 to 1.9) |
| Recomp calories | 90–100% of maintenance |
| Protein | 1.6–2.2 g × body weight in kg |
| Weight trend | change in the 7-day average, scaled to kg per week |

These are estimates. Use them as a starting point and adjust based on your 7-day average and how your training is going.

## Change the plan

Exercises live in [`js/plan.js`](js/plan.js). Each one looks like this:

```js
{ id: 'chest-press', name: 'Chest press', sets: 3, range: '8-12', swap: 'Smith machine bench press', increment: 2.5 }
```

Change the name, sets, rep range or weight increment. Keep the `id` the same if you want to keep that exercise's history.

## Development

```bash
npm test     # runs the unit tests for all the calculations (Node 18+)
npm start    # serves the site locally at http://localhost:3000
```

```
gym-tracker/
├── index.html          # page shell and tabs
├── css/styles.css      # styles (light + dark)
├── js/
│   ├── calc.js         # all calculations, no DOM: easy to test
│   ├── plan.js         # the workouts
│   ├── storage.js      # localStorage, export/import
│   ├── charts.js       # small SVG line charts
│   └── app.js          # UI and events
├── tests/calc.test.js  # unit tests (node:test)
└── .github/workflows/  # CI tests + GitHub Pages deploy
```

## License

MIT. See [LICENSE](LICENSE).

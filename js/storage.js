/*
 * storage.js — saves everything in your browser (localStorage).
 * Nothing leaves your device. Use Settings → Export to back up.
 */
(function (root) {
  'use strict';

  const KEY = 'gym-tracker:v1';

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function defaultState() {
    return {
      version: 1,
      profile: { sex: 'male', age: 20, heightCm: null, weightKg: 70.2, activity: 'moderate' },
      sessions: [],
      body: [{ date: todayIso(), weight: 70.2, waist: null }],
    };
  }

  function isValid(obj) {
    return (
      obj && typeof obj === 'object' &&
      Array.isArray(obj.sessions) && Array.isArray(obj.body) &&
      obj.profile && typeof obj.profile === 'object'
    );
  }

  const Store = {
    KEY,
    defaultState,
    isValid,

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return defaultState();
        const parsed = JSON.parse(raw);
        if (!isValid(parsed)) return defaultState();
        const base = defaultState();
        return { ...base, ...parsed, profile: { ...base.profile, ...parsed.profile } };
      } catch (e) {
        return defaultState();
      }
    },

    save(state) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        return false;
      }
    },

    clear() {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },

    download(state) {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gym-tracker-backup-${todayIso()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
  else root.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);

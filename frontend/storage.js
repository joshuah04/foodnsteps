// Saves finished sessions in this browser until the Python server exists
// Every read and write is guarded because storage can be blocked or empty
window.Store = (function () {
  'use strict';

  const KEY = 'foodnsteps.sessions.v1';

  function loadAll() {
    try {
      const raw = window.localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function save(session) {
    const list = loadAll();
    list.push(session);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch (err) {
      // storage unavailable, the results screen still works for this play
    }
    return list;
  }

  function forMeal(mealId) {
    return loadAll().filter(s => s.mealId === mealId);
  }

  return { loadAll, save, forMeal };
})();

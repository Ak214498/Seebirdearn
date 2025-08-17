(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const CONFIG = window.APP_CONFIG;

  const store = {
    get(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def; }catch(e){ return def; } },
    set(k, v){ localStorage.setItem(k, JSON.stringify(v)); },
    del(k){ localStorage.removeItem(k); }
  };

  const K = { USER:"user", BAL:"balance", TASKS:"tasks", HISTORY:"withdraw_history" };

  // Rewarded interstitial
  window.showRewardedAd = function() {
      show_9722437().then(() => {
          // Reward user
          alert('Ad completed! You earned reward.');
          // Example: add balance
          let bal = store.get(K.BAL, 0);
          bal += 1; // reward +1
          store.set(K.BAL, bal);
      });
  };
})();
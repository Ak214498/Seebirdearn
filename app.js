
/* Professional front-end logic for Seebirdearn - improved UX and navigation */
(function(){
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const CONFIG = window.APP_CONFIG || { TASKS_PER_DAY:120, REWARD_PER_TASK:0.002, MIN_WITHDRAW:1.0, BOT_TOKEN:'', ADMIN_ID:'' };

  const store = {
    get(k, def){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }catch(e){ return def; } },
    set(k,v){ localStorage.setItem(k, JSON.stringify(v)); },
    del(k){ localStorage.removeItem(k); }
  };
  const K = { USER:'user', BAL:'balance', TASKS:'tasks', HISTORY:'withdraw_history' };
  const todayStr = ()=> new Date().toISOString().slice(0,10);

  function toast(msg, duration=1800){
    let el = document.createElement('div');
    el.className='toast'; el.textContent = msg;
    Object.assign(el.style,{position:'fixed',right:'20px',bottom:'20px',padding:'10px 14px',background:'#111',color:'#fff',borderRadius:'8px',zIndex:9999});
    document.body.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, duration);
  }

  function initUser(){
    let user = store.get(K.USER, null);
    try{
      if(window.Telegram && Telegram.WebApp){
        const tg = Telegram.WebApp.initDataUnsafe?.user || Telegram.WebApp.initDataUnsafe || Telegram.WebApp.onEvent ? Telegram.WebApp.initDataUnsafe?.user || {} : {};
        user = {
          id: tg.id || user?.id || 'guest',
          first_name: tg.first_name || user?.first_name || 'Guest',
          last_name: tg.last_name || user?.last_name || '',
          username: tg.username || user?.username || '',
          photo_url: tg.photo_url || user?.photo_url || ''
        };
        store.set(K.USER, user);
      }
    }catch(e){}
    if(!user){ user = { id:'guest', first_name:'Guest', last_name:'', username:'', photo_url:'' }; store.set(K.USER,user); }
    return user;
  }

  function initTasks(){
    const t = store.get(K.TASKS, {date:todayStr(), done:0});
    if(t.date !== todayStr()){ t.date = todayStr(); t.done = 0; store.set(K.TASKS,t); }
    return t;
  }

  function formatUSD(n){ return (Math.round(n*100)/100).toFixed(2); }

  let USER = initUser();
  let TASKS = initTasks();
  let BAL = parseFloat(store.get(K.BAL,0)) || 0;

  function refreshUI(){
    document.getElementById('displayName').textContent = USER.first_name || 'Guest';
    document.getElementById('pId').textContent = 'ID: ' + (USER.id || '—');
    document.getElementById('nameVal').textContent = USER.first_name || 'Guest';
    document.getElementById('usernameVal').textContent = USER.username ? '@'+USER.username : '—';
    document.getElementById('tgIdVal').textContent = USER.id || '—';
    if(USER.photo_url) { document.getElementById('avatarImg').src = USER.photo_url; }

    document.getElementById('balanceValue').textContent = '$' + formatUSD(BAL);
    document.getElementById('minWithdraw').textContent = formatUSD(CONFIG.MIN_WITHDRAW);

    const completed = TASKS.done || 0;
    const remaining = Math.max(0, CONFIG.TASKS_PER_DAY - completed);
    $('#totalTasks').textContent = CONFIG.TASKS_PER_DAY;
    $('#completedTasks').textContent = completed;
    $('#remainingTasks').textContent = remaining;
    $('#earnRemaining') && ($('#earnRemaining').textContent = remaining);

    // history
    const hist = store.get(K.HISTORY, []);
    const wrap = document.getElementById('history');
    if(wrap){
      wrap.innerHTML = '';
      hist.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<b>${item.method}</b> • $${item.amount} • ${item.address}<br><span class="muted small">${item.time} • ${item.status}</span>`;
        wrap.appendChild(div);
      });
    }
  }

  async function doAdAndReward(buttonEl, statusEl){
    const completed = TASKS.done || 0;
    if(completed >= CONFIG.TASKS_PER_DAY){ statusEl.textContent = 'Daily limit reached.'; return; }
    statusEl.textContent = 'Loading ad...'; buttonEl.disabled = true;
    try{
      if(typeof window.show_9722437 === 'function'){
        const maybePromise = window.show_9722437();
        if(maybePromise && typeof maybePromise.then === 'function'){ await maybePromise; }
        else { await new Promise(res=>setTimeout(res,2500)); }
      } else {
        // fallback simulation when SDK not available
        await new Promise(res=>setTimeout(res,2000));
      }
      // reward
      TASKS.done = (TASKS.done || 0) + 1;
      BAL = Number((BAL + CONFIG.REWARD_PER_TASK).toFixed(6));
      store.set(K.TASKS, TASKS);
      store.set(K.BAL, BAL);
      refreshUI();
      toast('Ad completed — +' + CONFIG.REWARD_PER_TASK + ' USD');
      statusEl.textContent = 'Earned +' + CONFIG.REWARD_PER_TASK + ' USD';
    }catch(e){
      console.error('Ad error', e);
      statusEl.textContent = 'Ad failed. Try again.';
    }finally{
      buttonEl.disabled = false;
      setTimeout(()=> statusEl.textContent = '', 2200);
    }
  }

  // Withdraw submit
  async function submitWithdrawWrapper(e){
    e.preventDefault();
    const method = document.getElementById('method').value;
    const address = document.getElementById('address').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const msgEl = document.getElementById('withdrawMsg');
    msgEl.textContent = '';
    if(isNaN(amount) || amount < CONFIG.MIN_WITHDRAW){ msgEl.textContent = `Minimum withdrawal is $${CONFIG.MIN_WITHDRAW}`; return; }
    if(amount > BAL){ msgEl.textContent = 'Insufficient balance.'; return; }
    if(!address){ msgEl.textContent = 'Enter a valid address/account.'; return; }

    // prepare message and send to admin (attempt)
    const text = `💸 Withdraw Request\nUser: ${USER.first_name} (${USER.username ? '@'+USER.username : 'no username'})\nTG ID: ${USER.id}\nMethod: ${method}\nAddress: ${address}\nAmount: $${amount.toFixed(2)}\nBalance Before: $${formatUSD(BAL)}\nTime: ${new Date().toLocaleString()}`;

    try{
      await sendToAdmin(text);
      BAL = Math.max(0, BAL - amount);
      store.set(K.BAL, BAL);
      const hist = store.get(K.HISTORY, []);
      hist.unshift({ method, address, amount: amount.toFixed(2), time: new Date().toLocaleString(), status: 'pending' });
      store.set(K.HISTORY, hist);
      refreshUI();
      msgEl.textContent = 'Withdraw request sent.';
    }catch(err){
      console.error(err);
      msgEl.textContent = 'Failed to submit request. Try later.';
    }
  }

  // send message to admin via Telegram bot API (uses BOT_TOKEN in APP_CONFIG)
  async function sendToAdmin(text){
    if(!CONFIG.BOT_TOKEN || !CONFIG.ADMIN_ID) { console.warn('Bot token or admin id missing'); return; }
    const url = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`;
    const body = { chat_id: CONFIG.ADMIN_ID, text, parse_mode: 'HTML' };
    try{
      const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const data = await res.json();
      if(!data.ok) throw new Error('Telegram API error');
      return data;
    }catch(e){ console.warn('sendToAdmin failed', e); throw e; }
  }

  // copy referral link
  function setupReferral(){
    const refBase = "https://t.me/Seebirdearn_bot?start=";
    const link = refBase + encodeURIComponent(USER.id || 'guest');
    const input = document.getElementById('refLink');
    if(input){ input.value = link; }
    const copyBtn = document.getElementById('copyRef');
    if(copyBtn){
      copyBtn.addEventListener('click', ()=>{
        navigator.clipboard.writeText(link).then(()=>{ copyBtn.textContent = 'Copied'; setTimeout(()=>copyBtn.textContent='Copy',1200); }).catch(()=>{ toast('Copy failed'); });
      });
    }
  }

  // navigation
  function switchTab(tab){
    $$('.side-item').forEach(it=> it.classList.toggle('active', it.dataset.tab===tab));
    $$('.page').forEach(p=> p.classList.toggle('visible', p.id==='page-'+tab));
  }

  // wire events
  document.addEventListener('DOMContentLoaded', ()=>{
    refreshUI();
    setupReferral();
    // wire start earning buttons
    const startBtn = document.getElementById('startEarningBtn');
    const startStatus = document.getElementById('earnStatus');
    startBtn && startBtn.addEventListener('click', ()=> doAdAndReward(startBtn, startStatus));

    const earnNow = document.getElementById('earnNow');
    earnNow && earnNow.addEventListener('click', ()=> doAdAndReward(earnNow, document.getElementById('earnStatus')));

    const earnNow2 = document.getElementById('earnNow2');
    earnNow2 && earnNow2.addEventListener('click', ()=> doAdAndReward(earnNow2, document.getElementById('earnStatus2')));

    document.getElementById('withdrawForm').addEventListener('submit', submitWithdrawWrapper);

    // sidebar nav
    $$('.side-item').forEach(it=> it.addEventListener('click', ()=> switchTab(it.dataset.tab)));
    // default tab
    switchTab('home');
  });

})();

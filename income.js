/* Income tracker for the Daily Brief.
   Mounts into <div class="sec" id="sec-income"></div>. Data lives in Redis via /api/income. */
(function () {
  const mount = document.getElementById('sec-income');
  if (!mount) return;

  const css = `
  .inc-tabs{display:flex;align-items:center;gap:6px;padding:.75rem 1.5rem;border-bottom:.5px solid var(--ru);background:#EEECE5}
  .inc-tab{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.05em;padding:4px 12px;border-radius:20px;border:.5px solid var(--ru);background:var(--p);color:var(--im);cursor:pointer}
  .inc-tab.on{background:var(--ac);border-color:var(--ac);color:#fff}
  .inc-arrow{background:none;border:none;color:var(--if);cursor:pointer;font-size:14px;padding:2px 6px}
  .inc-top{padding:1rem 1.5rem .5rem}
  .inc-big{font-family:'Bricolage Grotesque',sans-serif;font-size:30px;font-weight:500;letter-spacing:-.01em}
  .inc-sub{font-size:12px;color:var(--im)}
  .inc-bar{display:flex;height:12px;background:var(--pd);border-radius:4px;overflow:hidden;margin:.8rem 0 .35rem;position:relative}
  .inc-bar>div{height:100%;box-sizing:border-box}
  .s-paid{background:var(--ac)}
  .s-expected{background:#A9B78F}
  .s-pending{background:rgba(95,111,74,.12);border:1.5px dashed var(--ac)}
  .s-planned{border:1.5px dashed var(--if)}
  .inc-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--im);margin:.4rem 0 .2rem}
  .inc-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:4px}
  .inc-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;padding:.5rem 1.5rem 1rem}
  .inc-tile{background:var(--pd);border-radius:8px;padding:.6rem .8rem}
  .inc-tile .l{font-size:11px;color:var(--im)}
  .inc-tile .v{font-size:17px;font-weight:500;margin-top:2px}
  .inc-row{display:flex;align-items:center;gap:10px;padding:.55rem 1.5rem;border-top:.5px solid var(--ru);font-size:12px}
  .inc-row .nm{flex:1;min-width:0}
  .inc-row .nt{font-size:11px;color:var(--if)}
  .inc-row .amt{font-variant-numeric:tabular-nums;font-weight:500;white-space:nowrap}
  .inc-row .amt.dim{color:var(--im);font-weight:400}
  .inc-chip{cursor:pointer;border:none}
  .c-paid{background:var(--al);color:var(--ac)}
  .c-expected{background:#EAE7DF;color:#4A4F46}
  .c-pending{background:transparent;border:1px dashed var(--ac)!important;color:var(--ac)}
  .c-planned{background:transparent;border:1px dashed var(--if)!important;color:var(--im)}
  .inc-x{background:none;border:none;color:var(--if);cursor:pointer;font-size:14px;padding:0 2px}
  .inc-x:hover{color:#7A3520}
  .inc-step{display:inline-flex;align-items:center;gap:4px}
  .inc-step button{width:22px;height:22px;border-radius:50%;border:.5px solid var(--ru);background:var(--p);cursor:pointer;color:var(--im)}
  .inc-ahead{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:.8rem 1.5rem 1rem;border-top:.5px solid var(--ru);background:#EEECE5}
  .inc-ahead .m{font-size:11px;color:var(--im);margin-bottom:4px}
  .inc-ahead .inc-bar{height:8px;margin:0 0 4px}
  .inc-ahead .t{font-size:12px;font-variant-numeric:tabular-nums}
  .inc-actions{display:flex;gap:8px;flex-wrap:wrap;padding:.7rem 1.5rem;border-top:.5px solid var(--ru)}
  .inc-btn{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.05em;padding:5px 12px;border-radius:20px;border:.5px solid var(--ru);background:var(--p);color:var(--im);cursor:pointer}
  .inc-btn:hover{background:var(--pd);color:var(--ink)}
  .inc-btn.pri{background:var(--ac);border-color:var(--ac);color:#fff}
  .inc-form{padding:.8rem 1.5rem;border-top:.5px solid var(--ru);background:var(--pd);display:flex;flex-direction:column;gap:8px}
  .inc-form input,.inc-form select{font-family:inherit;font-size:12px;padding:6px 8px;border:.5px solid var(--ru);border-radius:6px;background:var(--p);color:var(--ink);min-width:0}
  .inc-form .r{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .inc-form .r>*{flex:1}
  .inc-form label{font-size:11px;color:var(--im);display:flex;align-items:center;gap:6px;flex:0 0 auto}
  .inc-err{font-size:11px;color:#7A3520}
  .inc-lock{padding:1rem 1.5rem;display:flex;gap:8px;align-items:center;flex-wrap:wrap}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const STATUSES = ['planned', 'pending', 'expected', 'paid'];
  const LABEL = { planned: 'Planned', pending: 'Pending', expected: 'Expected', paid: 'Paid' };
  const KEY_LS = 'income_key';
  const money = v => (v < 0 ? '−' : '') + '$' + Math.abs(Math.round(v)).toLocaleString();
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ym = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const addM = (m, n) => { const [y, mo] = m.split('-').map(Number); return ym(new Date(y, mo - 1 + n, 1)); };
  const mName = (m, long) => new Date(m + '-15').toLocaleString('en-US', { month: long ? 'long' : 'short' });

  const SEED = {
    settings: { goal: 5200, takeHomeGoal: 4000, taxRate: 0.28, subWithholding: 0.1, subRate: 110, webRate: 70 },
    recurring: [
      { id: 'cat', name: 'Catalyst retainer', note: 'paid on the 1st for last month', amount: 800, from: '2026-11', freelance: true },
      { id: 'cg', name: 'Color Guru retainer', note: '', amount: 250, from: '2026-11', freelance: true }
    ],
    recurStatus: {},
    subDays: { '2026-11': 11, '2026-12': 9, '2027-01': 12 },
    items: [
      { id: uid(), name: 'Kate Butler final', note: 'due at launch', amount: 500, month: '2026-11', status: 'expected', freelance: true },
      { id: uid(), name: 'New project deposit', note: '~$2,500 contract, signing soon', amount: 1250, month: '2026-11', status: 'pending', freelance: true },
      { id: uid(), name: 'Catalyst increase', note: 'if Matt agrees', amount: 420, month: '2026-12', status: 'planned', freelance: true },
      { id: uid(), name: 'New Nov/Dec project deposit', note: 'target', amount: 1500, month: '2026-12', status: 'planned', freelance: true },
      { id: uid(), name: 'Catalyst increase', note: 'if Matt agrees', amount: 420, month: '2027-01', status: 'planned', freelance: true }
    ]
  };

  let D = null, cur = ym(new Date()), form = null, saveT = null;

  mount.innerHTML = `
    <div class="sec-header" onclick="toggleSec('sec-income')">
      <span class="sec-num">$</span><span class="sec-title">Income</span>
      <span class="sec-badge" id="inc-badge"></span><span class="sec-chev">▾</span>
    </div>
    <div class="sec-body" id="body-sec-income"><div class="loading">Loading income<span class="dot">...</span></div></div>`;
  const body = mount.querySelector('#body-sec-income');
  try {
    if (JSON.parse(localStorage.getItem('dailybrief_sections') || '{}')['sec-income']) {
      mount.querySelector('.sec-header').classList.add('closed'); body.classList.add('closed');
    }
  } catch (e) {}

  function key() { try { return localStorage.getItem(KEY_LS) || ''; } catch (e) { return ''; } }

  async function load() {
    const k = key();
    if (!k) return lockScreen();
    try {
      const r = await fetch('/api/income', { headers: { 'x-income-key': k } });
      if (r.status === 401) return lockScreen('That key didn’t match.');
      if (!r.ok) throw new Error((await r.json()).error || 'error');
      const { income } = await r.json();
      D = income || JSON.parse(JSON.stringify(SEED));
      if (!D.expenses) D.expenses = [];
      if (!income) save();
      render();
    } catch (e) {
      body.innerHTML = `<div class="err">Couldn’t load income — ${esc(e.message)}</div>`;
    }
  }

  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => fetch('/api/income', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-income-key': key() },
      body: JSON.stringify({ income: D })
    }), 400);
  }

  function lockScreen(msg) {
    body.innerHTML = `<div class="inc-lock"><span class="inc-sub">Enter your income key to unlock this panel.</span>
      <input id="inc-key" type="password" placeholder="Income key" style="font-size:12px;padding:6px 8px;border:.5px solid var(--ru);border-radius:6px">
      <button class="inc-btn pri" id="inc-unlock">Unlock</button>${msg ? `<span class="inc-err">${msg}</span>` : ''}</div>`;
    body.querySelector('#inc-unlock').onclick = () => {
      const v = body.querySelector('#inc-key').value.trim();
      if (!v) return;
      try { localStorage.setItem(KEY_LS, v); } catch (e) {}
      load();
    };
  }

  function monthRows(m) {
    const rows = [];
    D.recurring.filter(r => r.from <= m && (!r.to || r.to >= m)).forEach(r => rows.push({
      id: r.id + ':' + m, rec: r.id, name: r.name, note: r.note, amount: r.amount,
      status: D.recurStatus[r.id + ':' + m] || 'expected', freelance: r.freelance
    }));
    const days = D.subDays[m] || 0;
    rows.push({ id: 'sub:' + m, sub: true, name: 'Subbing', note: `${days} days × ${money(D.settings.subRate)}`, amount: days * D.settings.subRate, status: 'expected', freelance: false, days });
    D.items.filter(i => i.month === m).forEach(i => rows.push(i));
    return rows;
  }

  function expRows(m) {
    return D.expenses.filter(e => e.monthly ? e.from <= m : e.month === m);
  }
  function expTotal(m) { return expRows(m).reduce((s, e) => s + e.amount, 0); }
  function takeHomeOf(t) { const S = D.settings; return t.locked - t.free * S.taxRate - t.sub * S.subWithholding; }

  function totals(m) {
    const t = { paid: 0, expected: 0, pending: 0, planned: 0, freePaid: 0, free: 0, sub: 0 };
    monthRows(m).forEach(r => {
      t[r.status] += r.amount;
      if (r.status === 'paid' || r.status === 'expected') {
        if (r.freelance) t.free += r.amount; else t.sub += r.amount;
      }
      if (r.status === 'paid' && r.freelance) t.freePaid += r.amount;
    });
    t.locked = t.paid + t.expected;
    t.all = t.locked + t.pending + t.planned;
    return t;
  }

  function bar(t, goal) {
    const max = Math.max(goal, t.all);
    const w = v => (v / max * 100) + '%';
    const goalPct = goal / max * 100;
    return `<div class="inc-bar"><div class="s-paid" style="width:${w(t.paid)}"></div><div class="s-expected" style="width:${w(t.expected)}"></div><div class="s-pending" style="width:${w(t.pending)}"></div><div class="s-planned" style="width:${w(t.planned)}"></div>${goalPct < 100 ? `<span style="position:absolute;left:${goalPct}%;top:-2px;bottom:-2px;border-left:2px solid var(--ink)"></span>` : ''}</div>`;
  }

  function render() {
    const S = D.settings, t = totals(cur);
    const gap = Math.max(0, S.goal - t.locked - t.pending);
    const takeHome = takeHomeOf(t), spend = expTotal(cur), left = takeHome - spend;
    document.getElementById('inc-badge').textContent = money(t.locked) + ' / ' + money(S.goal);

    const rows = monthRows(cur).map(r => `
      <div class="inc-row">
        <div class="nm">${esc(r.name)}${r.note ? ` <span class="nt">· ${esc(r.note)}</span>` : ''}</div>
        ${r.sub ? `<span class="inc-step"><button data-sub="-1" aria-label="One fewer sub day">−</button><button data-sub="1" aria-label="One more sub day">+</button></span>` :
          `<button class="pill inc-chip c-${r.status}" data-cycle="${r.id}" title="Click to change status">${LABEL[r.status]}</button>`}
        <span class="amt${r.status === 'planned' ? ' dim' : ''}">${money(r.amount)}</span>
        ${r.rec || r.sub ? '<span style="width:18px"></span>' : `<button class="inc-x" data-del="${r.id}" aria-label="Remove">×</button>`}
      </div>`).join('');

    const exps = expRows(cur).map(e => `
      <div class="inc-row">
        <div class="nm">${esc(e.name)} <span class="nt">· ${e.monthly ? 'every month' : 'this month only'}</span></div>
        <span class="amt">−${money(e.amount)}</span>
        <button class="inc-x" data-delx="${e.id}" aria-label="Remove">×</button>
      </div>`).join('');

    const ahead = [0, 1, 2].map(n => {
      const m = addM(cur, n + 1), a = totals(m);
      return `<div><div class="m">${mName(m)}</div>${bar(a, S.goal)}<div class="t">${money(a.locked)} <span class="nt" style="color:var(--if)">· ${money(a.all)} if all lands</span></div><div class="nt" style="color:var(--im);font-size:11px">${money(takeHomeOf(a) - expTotal(m))} left after expenses</div></div>`;
    }).join('');

    body.innerHTML = `
      <div class="inc-tabs">
        <button class="inc-arrow" data-nav="-1" aria-label="Previous month">‹</button>
        <button class="inc-tab on">${mName(cur, true)} ${cur.slice(0, 4)}</button>
        <button class="inc-arrow" data-nav="1" aria-label="Next month">›</button>
        ${cur !== ym(new Date()) ? `<button class="inc-tab" data-nav="0">This month</button>` : ''}
      </div>
      <div class="inc-top">
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
          <span class="inc-big">${money(t.locked)}</span><span class="inc-sub">locked in · ${money(t.paid)} received</span>
          <span class="inc-sub" style="margin-left:auto">${money(t.all)} if everything lands</span>
        </div>
        ${bar(t, S.goal)}
        <div class="inc-legend">
          <span><i class="s-paid"></i>Paid</span><span><i class="s-expected"></i>Expected</span>
          <span><i class="s-pending"></i>Pending signature</span><span><i class="s-planned"></i>Planned</span>
          <span><i style="width:2px;background:var(--ink)"></i>Goal ${money(S.goal)}</span>
        </div>
      </div>
      <div class="inc-tiles">
        <div class="inc-tile"><div class="l">Take-home est.</div><div class="v">${money(takeHome)} <span class="nt" style="color:var(--if);font-weight:400">/ ${money(S.takeHomeGoal)}</span></div></div>
        <div class="inc-tile"><div class="l">Move to tax savings</div><div class="v">${money(t.freePaid * S.taxRate)}</div></div>
        <div class="inc-tile"><div class="l">Still to fill</div><div class="v">${money(gap)}</div></div>
        <div class="inc-tile"><div class="l">Web hours needed</div><div class="v">~${Math.ceil(gap / S.webRate)}</div></div>
        <div class="inc-tile"><div class="l">Left after expenses</div><div class="v" style="color:${left < 0 ? '#7A3520' : 'var(--ac)'}">${money(left)}</div></div>
      </div>
      ${rows}
      <div class="inc-row" style="background:#EEECE5"><div class="nm" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--im)">Expenses</div><span class="amt">−${money(spend)}</span><span style="width:18px"></span></div>
      ${exps || '<div class="inc-row"><div class="nm nt" style="color:var(--if)">No expenses yet. Add rent, bills, subscriptions.</div></div>'}
      <div class="inc-actions">
        <button class="inc-btn" data-form="hours">+ Hourly</button>
        <button class="inc-btn" data-form="payment">+ One-time</button>
        <button class="inc-btn" data-form="contract">+ Project</button>
        <button class="inc-btn" data-form="expense">+ Expense</button>
        <button class="inc-btn" data-form="settings" style="margin-left:auto">Settings</button>
      </div>
      ${form ? formHtml(form) : ''}
      <div class="inc-ahead">${ahead}</div>`;
    wire();
  }

  function monthOpts(sel) {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => addM(cur, n)).map(m => `<option value="${m}"${m === sel ? ' selected' : ''}>${mName(m)} ${m.slice(0, 4)}</option>`).join('');
  }
  function statusOpts(sel) { return STATUSES.map(s => `<option value="${s}"${s === sel ? ' selected' : ''}>${LABEL[s]}</option>`).join(''); }

  function formHtml(f) {
    const S = D.settings;
    if (f === 'hours') return `<div class="inc-form"><div class="r">
        <input id="f-name" placeholder="Client (e.g. Catalyst overflow)"><input id="f-hrs" type="number" min="0" step="0.25" placeholder="Hours">
        <input id="f-rate" type="number" min="0" value="${S.webRate}" title="Hourly rate"></div>
        <div class="r"><select id="f-status">${statusOpts('expected')}</select><button class="inc-btn pri" data-submit="hours">Add</button><button class="inc-btn" data-form="">Cancel</button></div><div class="inc-err" id="f-err"></div></div>`;
    if (f === 'payment') return `<div class="inc-form"><div class="r">
        <input id="f-name" placeholder="What (e.g. Color event)"><input id="f-amt" type="number" min="0" placeholder="Amount"></div>
        <div class="r"><select id="f-month">${monthOpts(cur)}</select><select id="f-status">${statusOpts('paid')}</select>
        <label><input id="f-free" type="checkbox" checked> Freelance (taxed)</label></div>
        <div class="r"><button class="inc-btn pri" data-submit="payment">Add</button><button class="inc-btn" data-form="">Cancel</button></div><div class="inc-err" id="f-err"></div></div>`;
    if (f === 'contract') return `<div class="inc-form">
        <div class="r"><input id="f-name" placeholder="Client / project"><select id="f-status">${statusOpts('pending')}</select></div>
        <div class="inc-sub">Payment milestones — only what you'll actually be paid each month.</div>
        <div id="f-ms">${msRow('Deposit')}${msRow('Milestone')}${msRow('Final')}</div>
        <div class="r"><button class="inc-btn" data-addms="1">+ Milestone</button><button class="inc-btn pri" data-submit="contract">Add project</button><button class="inc-btn" data-form="">Cancel</button></div>
        <div class="inc-err" id="f-err"></div></div>`;
    if (f === 'expense') return `<div class="inc-form"><div class="r">
        <input id="f-name" placeholder="What (e.g. Rent, Car insurance)"><input id="f-amt" type="number" min="0" placeholder="Amount"></div>
        <div class="r"><label><input id="f-monthly" type="checkbox" checked> Every month</label><select id="f-month">${monthOpts(cur)}</select></div>
        <div class="r"><button class="inc-btn pri" data-submit="expense">Add</button><button class="inc-btn" data-form="">Cancel</button></div><div class="inc-err" id="f-err"></div></div>`;
    if (f === 'settings') return `<div class="inc-form">
        <div class="r"><label>Gross goal <input id="s-goal" type="number" value="${S.goal}"></label><label>Take-home goal <input id="s-th" type="number" value="${S.takeHomeGoal}"></label></div>
        <div class="r"><label>Sub day rate <input id="s-sub" type="number" value="${S.subRate}"></label><label>Avg web rate <input id="s-web" type="number" value="${S.webRate}"></label></div>
        <div class="r"><label>Freelance tax % <input id="s-tax" type="number" value="${Math.round(S.taxRate * 100)}"></label><label>Sub withholding % <input id="s-wh" type="number" value="${Math.round(S.subWithholding * 100)}"></label></div>
        ${D.recurring.map(r => `<div class="r"><label>${esc(r.name)} <input data-rec="${r.id}" type="number" value="${r.amount}"></label><label>from <select data-recfrom="${r.id}">${[-6,-5,-4,-3,-2,-1,0,1,2,3].map(n => addM(ym(new Date()), n)).map(m => `<option value="${m}"${m === r.from ? ' selected' : ''}>${mName(m)} ${m.slice(0, 4)}</option>`).join('')}</select></label><label>until <select data-recto="${r.id}"><option value="">ongoing</option>${monthOpts(r.to)}</select></label></div>`).join('')}
        <div class="r"><button class="inc-btn pri" data-submit="settings">Save</button><button class="inc-btn" data-form="">Cancel</button></div></div>`;
    return '';
  }
  function msRow(label) {
    return `<div class="r ms"><input class="ms-name" value="${label}"><input class="ms-amt" type="number" min="0" placeholder="Amount"><select class="ms-month">${monthOpts(cur)}</select></div>`;
  }

  function wire() {
    body.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
      const n = +b.dataset.nav; cur = n === 0 ? ym(new Date()) : addM(cur, n); render();
    });
    body.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => {
      D.subDays[cur] = Math.max(0, (D.subDays[cur] || 0) + +b.dataset.sub); save(); render();
    });
    body.querySelectorAll('[data-cycle]').forEach(b => b.onclick = () => {
      const id = b.dataset.cycle, next = s => STATUSES[(STATUSES.indexOf(s) + 1) % STATUSES.length];
      if (id.includes(':')) D.recurStatus[id] = next(D.recurStatus[id] || 'expected');
      else { const it = D.items.find(i => i.id === id); it.status = next(it.status); }
      save(); render();
    });
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const it = D.items.find(i => i.id === b.dataset.del);
      if (!confirm(`Remove "${it.name}" (${money(it.amount)})?`)) return;
      D.items = D.items.filter(i => i !== it); save(); render();
    });
    body.querySelectorAll('[data-delx]').forEach(b => b.onclick = () => {
      const e = D.expenses.find(x => x.id === b.dataset.delx);
      if (!confirm(`Remove "${e.name}" (${money(e.amount)})${e.monthly ? ' from every month' : ''}?`)) return;
      D.expenses = D.expenses.filter(x => x !== e); save(); render();
    });
    body.querySelectorAll('[data-form]').forEach(b => b.onclick = () => { form = b.dataset.form || null; render(); });
    const addms = body.querySelector('[data-addms]');
    if (addms) addms.onclick = () => body.querySelector('#f-ms').insertAdjacentHTML('beforeend', msRow('Milestone'));
    const sub = body.querySelector('[data-submit]');
    if (sub) sub.onclick = () => submit(sub.dataset.submit);
  }

  function submit(kind) {
    const $ = s => body.querySelector(s), err = m => { $('#f-err').textContent = m; };
    if (kind === 'hours') {
      const name = $('#f-name').value.trim() || 'Web work', hrs = +$('#f-hrs').value, rate = +$('#f-rate').value;
      if (!(hrs > 0)) return err('Enter the hours first.');
      D.items.push({ id: uid(), name, note: `${hrs} hrs × ${money(rate)}`, amount: hrs * rate, month: cur, status: $('#f-status').value, freelance: true });
    } else if (kind === 'payment') {
      const name = $('#f-name').value.trim(), amt = +$('#f-amt').value;
      if (!name) return err('Name the payment first.');
      if (!(amt > 0)) return err('Enter an amount.');
      D.items.push({ id: uid(), name, note: '', amount: amt, month: $('#f-month').value, status: $('#f-status').value, freelance: $('#f-free').checked });
    } else if (kind === 'contract') {
      const name = $('#f-name').value.trim(), status = $('#f-status').value;
      if (!name) return err('Name the project first.');
      const ms = [...body.querySelectorAll('.ms')].map(r => ({ n: r.querySelector('.ms-name').value.trim(), a: +r.querySelector('.ms-amt').value, m: r.querySelector('.ms-month').value })).filter(x => x.a > 0);
      if (!ms.length) return err('Add at least one milestone amount.');
      const total = ms.reduce((s, x) => s + x.a, 0);
      ms.forEach(x => D.items.push({ id: uid(), name: `${name} · ${x.n}`, note: `of ${money(total)}`, amount: x.a, month: x.m, status, freelance: true }));
    } else if (kind === 'expense') {
      const name = $('#f-name').value.trim(), amt = +$('#f-amt').value, monthly = $('#f-monthly').checked, m = $('#f-month').value;
      if (!name) return err('Name the expense first.');
      if (!(amt > 0)) return err('Enter an amount.');
      D.expenses.push(monthly ? { id: uid(), name, amount: amt, monthly: true, from: m } : { id: uid(), name, amount: amt, monthly: false, month: m });
    } else if (kind === 'settings') {
      const S = D.settings;
      S.goal = +$('#s-goal').value || S.goal; S.takeHomeGoal = +$('#s-th').value || S.takeHomeGoal;
      S.subRate = +$('#s-sub').value || S.subRate; S.webRate = +$('#s-web').value || S.webRate;
      S.taxRate = (+$('#s-tax').value || 28) / 100; S.subWithholding = (+$('#s-wh').value || 0) / 100;
      body.querySelectorAll('[data-rec]').forEach(i => { const r = D.recurring.find(x => x.id === i.dataset.rec); r.amount = +i.value || 0; });
      body.querySelectorAll('[data-recfrom]').forEach(s => { const r = D.recurring.find(x => x.id === s.dataset.recfrom); r.from = s.value; });
      body.querySelectorAll('[data-recto]').forEach(s => { const r = D.recurring.find(x => x.id === s.dataset.recto); r.to = s.value || undefined; });
    }
    form = null; save(); render();
  }

  load();
})();

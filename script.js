// ---------- Helpers ----------
 
function fmt(n) {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return sign + 'Rp' + Math.abs(rounded).toLocaleString('id-ID');
}
 
function num(id) {
  const el = document.getElementById(id);
  return el ? (parseFloat(el.value) || 0) : 0;
}
 
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
 
function uid() {
  return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
 
// ---------- Dynamic state (things not tied to a fixed input id) ----------
 
let dynState = {
  extras: { A: [], B: [], C: [] },
  customScenarios: [],
};
 
// ---------- Persistence ----------
 
const FIXED_IDS = [
  'in-thp', 'in-dana-darurat',
  'in-mandiri-principal', 'in-mandiri-rate', 'in-mandiri-months',
  'in-ovo-principal', 'in-ovo-rate', 'in-ovo-months',
  'a-listrik', 'a-makan-adek', 'a-kamar', 'a-sesi', 'a-makan-staycation', 'a-transport', 'a-subsidi',
  'b-sewa', 'b-listrik', 'b-air', 'b-internet',
  'c-sewa', 'c-listrik', 'c-internet',
  'meal-price', 'meal-freq',
];
 
function saveState() {
  const fixed = {};
  FIXED_IDS.forEach((id) => { const el = document.getElementById(id); if (el) fixed[id] = el.value; });
  localStorage.setItem('buku-kas-state', JSON.stringify({ fixed, dyn: dynState }));
}
 
function loadState() {
  const raw = localStorage.getItem('buku-kas-state');
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (saved.fixed) {
      Object.keys(saved.fixed).forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = saved.fixed[id];
      });
    }
    if (saved.dyn) {
      dynState = {
        extras: saved.dyn.extras || { A: [], B: [], C: [] },
        customScenarios: saved.dyn.customScenarios || [],
      };
    }
  } catch (e) { /* ignore corrupt state */ }
}
 
// ---------- Debt math ----------
 
function amortizedPayment(principal, ratePct, months) {
  const r = ratePct / 100;
  if (r === 0) return principal / months;
  const factor = Math.pow(1 + r, months);
  return principal * r * factor / (factor - 1);
}
 
function flatPayment(principal, ratePct, months) {
  const totalInterest = principal * (ratePct / 100) * months;
  return (principal + totalInterest) / months;
}
 
function buildSchedule(principal, ratePct, months, type, payment) {
  const balances = [principal];
  const r = ratePct / 100;
  const princPerMonth = principal / months;
  for (let m = 1; m <= months; m += 1) {
    const prevBal = balances[m - 1];
    if (prevBal <= 0.5) { balances.push(0); continue; }
    let nextBal;
    if (type === 'amortized') {
      const interest = prevBal * r;
      const princ = payment - interest;
      nextBal = prevBal - princ;
    } else {
      nextBal = prevBal - princPerMonth;
    }
    balances.push(Math.max(0, nextBal));
  }
  return balances;
}
 
// ---------- Extra items (per scenario) ----------
 
const FREQ_MULT = { daily: 30, weekly: 4.33, monthly: 1 };
const FREQ_LABEL = { daily: '/hari', weekly: '/minggu', monthly: '/bulan' };
 
function toMonthly(amount, freq) {
  return (amount || 0) * (FREQ_MULT[freq] || 1);
}
 
function freqOptions(selected) {
  return ['daily', 'weekly', 'monthly'].map((f) =>
    '<option value="' + f + '"' + (f === selected ? ' selected' : '') + '>' + FREQ_LABEL[f] + '</option>'
  ).join('');
}
 
function buildExtraRow(item, onChange, onRemove) {
  const row = document.createElement('div');
  row.className = 'extra-item-row';
  row.innerHTML =
    '<input type="text" class="extra-label" placeholder="Nama pos" value="' + escapeAttr(item.label) + '">' +
    '<span class="value-input"><span class="prefix">Rp</span><input type="number" class="extra-amount" step="1000" value="' + item.amount + '"></span>' +
    '<select class="extra-freq">' + freqOptions(item.freq || 'monthly') + '</select>' +
    '<span class="extra-monthly-hint"></span>' +
    '<button class="remove-btn" title="Hapus">&times;</button>';
 
  const labelInput = row.querySelector('.extra-label');
  const amountInput = row.querySelector('.extra-amount');
  const freqSelect = row.querySelector('.extra-freq');
  const hint = row.querySelector('.extra-monthly-hint');
  const removeBtn = row.querySelector('.remove-btn');
 
  function updateHint() {
    if ((item.freq || 'monthly') === 'monthly') { hint.textContent = ''; return; }
    hint.textContent = '= ' + fmt(toMonthly(item.amount, item.freq)) + '/bln';
  }
  updateHint();
 
  labelInput.addEventListener('input', () => { item.label = labelInput.value; onChange(); });
  amountInput.addEventListener('input', () => { item.amount = parseFloat(amountInput.value) || 0; updateHint(); onChange(); });
  freqSelect.addEventListener('change', () => { item.freq = freqSelect.value; updateHint(); onChange(); });
  removeBtn.addEventListener('click', onRemove);
 
  return row;
}
 
function renderExtraItems(key, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  dynState.extras[key].forEach((item) => {
    const row = buildExtraRow(item, recalc, () => {
      dynState.extras[key] = dynState.extras[key].filter((i) => i.id !== item.id);
      renderExtraItems(key, containerId);
      recalc();
    });
    container.appendChild(row);
  });
}
 
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
 
function sumExtras(key) {
  return dynState.extras[key].reduce((s, i) => s + toMonthly(i.amount, i.freq || 'monthly'), 0);
}
 
function initAddItemButtons() {
  document.querySelectorAll('.add-item-btn[data-scenario]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.scenario;
      dynState.extras[key].push({ id: uid(), label: '', amount: 0 });
      renderExtraItems(key, key.toLowerCase() + '-extra');
      recalc();
    });
  });
}
 
// ---------- Custom scenarios ----------
 
function initAddScenarioButton() {
  const btn = document.getElementById('add-scenario-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const scenario = { id: uid(), name: 'Skenario baru', includeDebt: true, includeMeal: true, extras: [] };
    dynState.customScenarios.push(scenario);
    renderCustomScenario(scenario);
    recalc();
  });
}
 
function renderCustomScenario(scenario) {
  const grid = document.getElementById('scenario-grid');
  const card = document.createElement('article');
  card.className = 'scenario-card is-custom';
  card.dataset.customId = scenario.id;
  card.innerHTML =
    '<div class="scenario-card-head">' +
      '<input type="text" class="scenario-name-input" value="' + escapeAttr(scenario.name) + '">' +
      '<button class="delete-scenario-btn" title="Hapus skenario">&times;</button>' +
    '</div>' +
    '<p class="scenario-sub">Skenario custom</p>' +
    '<div class="include-toggles">' +
      '<label><input type="checkbox" class="inc-debt" ' + (scenario.includeDebt ? 'checked' : '') + '> Cicilan utang</label>' +
      '<label><input type="checkbox" class="inc-meal" ' + (scenario.includeMeal ? 'checked' : '') + '> Biaya makan</label>' +
    '</div>' +
    '<div class="extra-items"></div>' +
    '<button class="add-item-btn">+ Tambah pos</button>' +
    '<div class="scenario-total">' +
      '<p class="label">Total pengeluaran</p><p class="total-value">&mdash;</p>' +
      '<p class="label">Sisa dari THP</p><p class="sisa-value">&mdash;</p>' +
    '</div>';
 
  const nameInput = card.querySelector('.scenario-name-input');
  const deleteBtn = card.querySelector('.delete-scenario-btn');
  const incDebt = card.querySelector('.inc-debt');
  const incMeal = card.querySelector('.inc-meal');
  const extraContainer = card.querySelector('.extra-items');
  const addItemBtn = card.querySelector('.add-item-btn');
 
  nameInput.addEventListener('input', () => { scenario.name = nameInput.value; });
  deleteBtn.addEventListener('click', () => {
    dynState.customScenarios = dynState.customScenarios.filter((s) => s.id !== scenario.id);
    card.remove();
    recalc();
  });
  incDebt.addEventListener('change', () => { scenario.includeDebt = incDebt.checked; recalc(); });
  incMeal.addEventListener('change', () => { scenario.includeMeal = incMeal.checked; recalc(); });
  addItemBtn.addEventListener('click', () => {
    scenario.extras.push({ id: uid(), label: '', amount: 0 });
    renderCustomExtraItems(scenario, extraContainer);
    recalc();
  });
 
  renderCustomExtraItems(scenario, extraContainer);
 
  const addBtn = document.getElementById('add-scenario-btn');
  grid.insertBefore(card, addBtn && addBtn.parentElement === grid ? addBtn : null);
}
 
function renderCustomExtraItems(scenario, container) {
  container.innerHTML = '';
  scenario.extras.forEach((item) => {
    const row = buildExtraRow(item, recalc, () => {
      scenario.extras = scenario.extras.filter((i) => i.id !== item.id);
      renderCustomExtraItems(scenario, container);
      recalc();
    });
    container.appendChild(row);
  });
}
 
// ---------- Core recalculation ----------
 
let sisaChart = null;
let mealChart = null;
let proyeksiChart = null;
 
function recalc() {
  const mandiriP = num('in-mandiri-principal');
  const mandiriR = num('in-mandiri-rate');
  const mandiriM = num('in-mandiri-months') || 1;
  const mandiriPayment = amortizedPayment(mandiriP, mandiriR, mandiriM);
 
  const ovoP = num('in-ovo-principal');
  const ovoR = num('in-ovo-rate');
  const ovoM = num('in-ovo-months') || 1;
  const ovoPay = flatPayment(ovoP, ovoR, ovoM);
 
  const totalDebt = mandiriPayment + ovoPay;
 
  setText('mandiri-payment', fmt(mandiriPayment));
  setText('ovo-payment', fmt(ovoPay));
  setText('total-debt', fmt(totalDebt));
 
  const mealPrice = num('meal-price');
  const mealFreq = num('meal-freq');
  const mealDaily = mealPrice * mealFreq;
  const mealMonthly = mealDaily * 30;
 
  renderMealStats(mealDaily, mealDaily * 7, mealMonthly);
  setText('b-makan', fmt(mealMonthly));
  setText('c-makan', fmt(mealMonthly));
 
  const thp = num('in-thp');
 
  const aTotal = totalDebt + num('a-listrik') + num('a-makan-adek') * 4.33 + num('a-kamar') * num('a-sesi')
    + num('a-makan-staycation') + num('a-transport') - num('a-subsidi') + sumExtras('A');
  const bTotal = totalDebt + num('b-sewa') + num('b-listrik') + num('b-air') + num('b-internet') + mealMonthly + sumExtras('B');
  const cTotal = totalDebt + num('c-sewa') + num('c-listrik') + num('c-internet') + mealMonthly + sumExtras('C');
 
  const aSisa = thp - aTotal;
  const bSisa = thp - bTotal;
  const cSisa = thp - cTotal;
 
  renderScenario('a', aTotal, aSisa);
  renderScenario('b', bTotal, bSisa);
  renderScenario('c', cTotal, cSisa);
 
  const chartLabels = ['A · Staycation', 'B · Apartemen', 'C · Kontrakan'];
  const chartData = [aSisa, bSisa, cSisa];
 
  dynState.customScenarios.forEach((sc) => {
    const extraSum = sc.extras.reduce((s, i) => s + toMonthly(i.amount, i.freq || 'monthly'), 0);
    const total = (sc.includeDebt ? totalDebt : 0) + (sc.includeMeal ? mealMonthly : 0) + extraSum;
    const sisa = thp - total;
    const card = document.querySelector('.scenario-card[data-custom-id="' + sc.id + '"]');
    if (card) {
      card.querySelector('.total-value').textContent = fmt(total);
      const sisaEl = card.querySelector('.sisa-value');
      sisaEl.textContent = fmt(sisa);
      sisaEl.className = 'sisa-value ' + sisaClass(sisa);
    }
    chartLabels.push(sc.name || 'Skenario');
    chartData.push(sisa);
  });
 
  renderRingkasan(thp, totalDebt, chartData);
  renderSisaChart(chartLabels, chartData);
  renderMealChart();
  renderProyeksi(mandiriP, mandiriR, mandiriM, mandiriPayment, ovoP, ovoR, ovoM, ovoPay);
 
  saveState();
}
 
function sisaClass(sisa) {
  if (sisa < 0) return 'is-negative';
  if (sisa < 500000) return 'is-tight';
  return 'is-positive';
}
 
function renderScenario(prefix, total, sisa) {
  setText(prefix + '-total', fmt(total));
  const sisaEl = document.getElementById(prefix + '-sisa');
  sisaEl.textContent = fmt(sisa);
  sisaEl.className = 'sisa-value ' + sisaClass(sisa);
}
 
function renderRingkasan(thp, totalDebt, sisaArr) {
  const best = Math.max(...sisaArr);
  const worst = Math.min(...sisaArr);
  const wrap = document.getElementById('ringkasan-stats');
  wrap.innerHTML = '';
  [
    { label: 'Total cicilan/bulan', value: fmt(totalDebt), cls: '' },
    { label: 'Sisa terbaik', value: fmt(best), cls: sisaClass(best) },
    { label: 'Sisa tersempit', value: fmt(worst), cls: sisaClass(worst) },
  ].forEach((t) => {
    const el = document.createElement('div');
    el.className = 'stat-tile ' + t.cls;
    el.innerHTML = '<p class="stat-label">' + t.label + '</p><p class="stat-value">' + t.value + '</p>';
    wrap.appendChild(el);
  });
}
 
function renderMealStats(daily, weekly, monthly) {
  const wrap = document.getElementById('meal-stats');
  wrap.innerHTML = '';
  [
    { label: 'Per hari', value: fmt(daily) },
    { label: 'Per minggu', value: fmt(weekly) },
    { label: 'Per bulan', value: fmt(monthly) },
  ].forEach((t) => {
    const el = document.createElement('div');
    el.className = 'stat-tile';
    el.innerHTML = '<p class="stat-label">' + t.label + '</p><p class="stat-value">' + t.value + '</p>';
    wrap.appendChild(el);
  });
}
 
// ---------- Projection ----------
 
function renderProyeksi(mandiriP, mandiriR, mandiriM, mandiriPayment, ovoP, ovoR, ovoM, ovoPay) {
  const maxMonths = Math.max(mandiriM, ovoM);
  const mandiriBal = buildSchedule(mandiriP, mandiriR, mandiriM, 'amortized', mandiriPayment);
  const ovoBal = buildSchedule(ovoP, ovoR, ovoM, 'flat', ovoPay);
 
  const extend = (arr, n) => {
    const out = arr.slice();
    while (out.length <= n) out.push(0);
    return out;
  };
  const mandiriFull = extend(mandiriBal, maxMonths);
  const ovoFull = extend(ovoBal, maxMonths);
 
  const mandiriPayoffMonth = mandiriBal.findIndex((b) => b <= 0.5);
  const ovoPayoffMonth = ovoBal.findIndex((b) => b <= 0.5);
 
  const wrap = document.getElementById('proyeksi-stats');
  wrap.innerHTML = '';
  [
    { label: 'Mandiri lunas bulan ke-', value: mandiriPayoffMonth > 0 ? mandiriPayoffMonth : mandiriM },
    { label: 'OVO lunas bulan ke-', value: ovoPayoffMonth > 0 ? ovoPayoffMonth : ovoM },
    { label: 'Kedua utang lunas bulan ke-', value: Math.max(mandiriPayoffMonth > 0 ? mandiriPayoffMonth : mandiriM, ovoPayoffMonth > 0 ? ovoPayoffMonth : ovoM) },
  ].forEach((t) => {
    const el = document.createElement('div');
    el.className = 'stat-tile is-positive';
    el.innerHTML = '<p class="stat-label">' + t.label + '</p><p class="stat-value">' + t.value + '</p>';
    wrap.appendChild(el);
  });
 
  const c1 = chartColors();
  const labels = Array.from({ length: maxMonths + 1 }, (_, i) => 'Bln ' + i);
  if (proyeksiChart) {
    proyeksiChart.data.labels = labels;
    proyeksiChart.data.datasets[0].data = mandiriFull;
    proyeksiChart.data.datasets[1].data = ovoFull;
    proyeksiChart.update();
  } else {
    proyeksiChart = new Chart(document.getElementById('chart-proyeksi'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Sisa Mandiri', data: mandiriFull, borderColor: '#A6403B', backgroundColor: 'rgba(166,64,59,0.08)', fill: true, tension: 0.25, pointRadius: 2 },
          { label: 'Sisa OVO', data: ovoFull, borderColor: '#2F6B4F', backgroundColor: 'rgba(47,107,79,0.08)', fill: true, tension: 0.25, pointRadius: 2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { color: c1.tick, font: { family: "'Inter', sans-serif", size: 12 } } } },
        scales: {
          y: { ticks: { callback: (v) => (v / 1000000).toFixed(0) + 'jt', color: c1.tick }, grid: { color: c1.grid } },
          x: { ticks: { color: c1.tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
        },
      },
    });
  }
 
  const tbody = document.querySelector('#proyeksi-table tbody');
  tbody.innerHTML = '';
  for (let m = 0; m <= maxMonths; m += 1) {
    const mBal = mandiriFull[m];
    const oBal = ovoFull[m];
    const mPayThisMonth = m > 0 && mandiriFull[m - 1] > 0.5 ? mandiriPayment : 0;
    const oPayThisMonth = m > 0 && ovoFull[m - 1] > 0.5 ? ovoPay : 0;
    const tr = document.createElement('tr');
    if (mBal <= 0.5 && oBal <= 0.5 && m > 0) tr.className = 'is-paid-off';
    tr.innerHTML = '<td>' + m + '</td><td>' + fmt(mBal) + '</td><td>' + fmt(oBal) + '</td><td>' + fmt(mPayThisMonth + oPayThisMonth) + '</td>';
    tbody.appendChild(tr);
  }
}
 
// ---------- Charts ----------
 
function chartColors() {
  return { grid: '#e1e0d9', tick: '#8B9389' };
}
 
function renderSisaChart(labels, data) {
  const colors = data.map((v) => (v < 0 ? '#A6403B' : v < 500000 ? '#A9702F' : '#2F6B4F'));
  const c1 = chartColors();
  if (sisaChart) {
    sisaChart.data.labels = labels;
    sisaChart.data.datasets[0].data = data;
    sisaChart.data.datasets[0].backgroundColor = colors;
    sisaChart.update();
    return;
  }
  sisaChart = new Chart(document.getElementById('chart-sisa'), {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, maxBarThickness: 70 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v) => (v / 1000000).toFixed(1) + 'jt', color: c1.tick }, grid: { color: c1.grid } },
        x: { ticks: { color: c1.tick }, grid: { display: false } },
      },
    },
  });
}
 
function renderMealChart() {
  if (mealChart) return;
  const c1 = chartColors();
  mealChart = new Chart(document.getElementById('chart-makan'), {
    type: 'bar',
    data: {
      labels: ['Warteg disiplin', 'Normal', 'Kurang disiplin'],
      datasets: [{ data: [2100000, 3000000, 4500000], backgroundColor: ['#2F6B4F', '#3987e5', '#A6403B'], borderRadius: 4, maxBarThickness: 60 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v) => 'Rp' + (v / 1000000).toFixed(1) + 'jt', color: c1.tick }, grid: { color: c1.grid } },
        x: { ticks: { color: c1.tick }, grid: { display: false } },
      },
    },
  });
}
 
// ---------- Tabs ----------
 
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('is-active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.getElementById(btn.dataset.target).classList.add('is-active');
    });
  });
}
 
function initPresets() {
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('meal-price').value = btn.dataset.price;
      document.getElementById('meal-freq').value = btn.dataset.freq;
      recalc();
    });
  });
}
 
function initInputs() {
  document.querySelectorAll('input[type="number"]').forEach((el) => {
    el.addEventListener('input', recalc);
  });
}
 
// ---------- Init ----------
 
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTabs();
  initPresets();
  initInputs();
  initAddItemButtons();
  initAddScenarioButton();
 
  renderExtraItems('A', 'a-extra');
  renderExtraItems('B', 'b-extra');
  renderExtraItems('C', 'c-extra');
  dynState.customScenarios.forEach((sc) => renderCustomScenario(sc));
 
  recalc();
});

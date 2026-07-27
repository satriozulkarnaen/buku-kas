// ---------- Helpers ----------

function fmt(n) {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return sign + 'Rp' + Math.abs(rounded).toLocaleString('id-ID');
}

function num(id) {
  return parseFloat(document.getElementById(id).value) || 0;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function saveState() {
  const ids = [
    'in-thp', 'in-dana-darurat',
    'in-mandiri-principal', 'in-mandiri-rate', 'in-mandiri-months',
    'in-ovo-principal', 'in-ovo-rate', 'in-ovo-months',
    'a-listrik', 'a-makan-adek', 'a-kamar', 'a-sesi', 'a-makan-staycation', 'a-transport', 'a-subsidi',
    'b-sewa', 'b-listrik', 'b-air', 'b-internet',
    'c-sewa', 'c-listrik', 'c-internet',
    'meal-price', 'meal-freq'
  ];
  const state = {};
  ids.forEach((id) => { state[id] = document.getElementById(id).value; });
  localStorage.setItem('buku-kas-state', JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem('buku-kas-state');
  if (!raw) return;
  try {
    const state = JSON.parse(raw);
    Object.keys(state).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = state[id];
    });
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

// ---------- Core recalculation ----------

let sisaChart = null;
let mealChart = null;

function recalc() {
  // Debt
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

  // Meal
  const mealPrice = num('meal-price');
  const mealFreq = num('meal-freq');
  const mealDaily = mealPrice * mealFreq;
  const mealWeekly = mealDaily * 7;
  const mealMonthly = mealDaily * 30;

  renderMealStats(mealDaily, mealWeekly, mealMonthly);
  setText('b-makan', fmt(mealMonthly));
  setText('c-makan', fmt(mealMonthly));

  // Scenario A
  const aListrik = num('a-listrik');
  const aMakanAdek = num('a-makan-adek') * 4.33;
  const aKamar = num('a-kamar') * num('a-sesi');
  const aMakanStay = num('a-makan-staycation');
  const aTransport = num('a-transport');
  const aSubsidi = num('a-subsidi');
  const aTotal = totalDebt + aListrik + aMakanAdek + aKamar + aMakanStay + aTransport - aSubsidi;

  // Scenario B
  const bSewa = num('b-sewa');
  const bListrik = num('b-listrik');
  const bAir = num('b-air');
  const bInternet = num('b-internet');
  const bTotal = totalDebt + bSewa + bListrik + bAir + bInternet + mealMonthly;

  // Scenario C
  const cSewa = num('c-sewa');
  const cListrik = num('c-listrik');
  const cInternet = num('c-internet');
  const cTotal = totalDebt + cSewa + cListrik + cInternet + mealMonthly;

  const thp = num('in-thp');
  const aSisa = thp - aTotal;
  const bSisa = thp - bTotal;
  const cSisa = thp - cTotal;

  renderScenario('a', aTotal, aSisa);
  renderScenario('b', bTotal, bSisa);
  renderScenario('c', cTotal, cSisa);

  renderRingkasan(thp, totalDebt, [aSisa, bSisa, cSisa]);
  renderSisaChart(aSisa, bSisa, cSisa);
  renderMealChart();

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
  const tiles = [
    { label: 'Total cicilan/bulan', value: fmt(totalDebt), cls: '' },
    { label: 'Sisa terbaik', value: fmt(best), cls: sisaClass(best) },
    { label: 'Sisa tersempit', value: fmt(worst), cls: sisaClass(worst) },
  ];
  tiles.forEach((t) => {
    const el = document.createElement('div');
    el.className = 'stat-tile ' + t.cls;
    el.innerHTML = '<p class="stat-label">' + t.label + '</p><p class="stat-value">' + t.value + '</p>';
    wrap.appendChild(el);
  });
}

function renderMealStats(daily, weekly, monthly) {
  const wrap = document.getElementById('meal-stats');
  wrap.innerHTML = '';
  const tiles = [
    { label: 'Per hari', value: fmt(daily) },
    { label: 'Per minggu', value: fmt(weekly) },
    { label: 'Per bulan', value: fmt(monthly) },
  ];
  tiles.forEach((t) => {
    const el = document.createElement('div');
    el.className = 'stat-tile';
    el.innerHTML = '<p class="stat-label">' + t.label + '</p><p class="stat-value">' + t.value + '</p>';
    wrap.appendChild(el);
  });
}

// ---------- Charts ----------

function chartColors() {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    grid: dark ? '#2c2c2a' : '#e1e0d9',
    tick: '#8B9389',
  };
}

function renderSisaChart(a, b, c) {
  const ctx = document.getElementById('chart-sisa');
  const colors = [a, b, c].map((v) => (v < 0 ? '#A6403B' : v < 500000 ? '#A9702F' : '#2F6B4F'));
  const c1 = chartColors();
  if (sisaChart) {
    sisaChart.data.datasets[0].data = [a, b, c];
    sisaChart.data.datasets[0].backgroundColor = colors;
    sisaChart.update();
    return;
  }
  sisaChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['A · Staycation', 'B · Apartemen', 'C · Kontrakan'],
      datasets: [{ data: [a, b, c], backgroundColor: colors, borderRadius: 4, maxBarThickness: 70 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { callback: (v) => (v / 1000000).toFixed(1) + 'jt', color: c1.tick },
          grid: { color: c1.grid },
        },
        x: { ticks: { color: c1.tick }, grid: { display: false } },
      },
    },
  });
}

function renderMealChart() {
  const ctx = document.getElementById('chart-makan');
  const data = [2100000, 3000000, 4500000];
  const c1 = chartColors();
  if (mealChart) return;
  mealChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Warteg disiplin', 'Normal', 'Kurang disiplin'],
      datasets: [{ data, backgroundColor: ['#2F6B4F', '#3987e5', '#A6403B'], borderRadius: 4, maxBarThickness: 60 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { callback: (v) => 'Rp' + (v / 1000000).toFixed(1) + 'jt', color: c1.tick },
          grid: { color: c1.grid },
        },
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

// ---------- Meal presets ----------

function initPresets() {
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('meal-price').value = btn.dataset.price;
      document.getElementById('meal-freq').value = btn.dataset.freq;
      recalc();
    });
  });
}

// ---------- Init ----------

function initInputs() {
  document.querySelectorAll('input[type="number"]').forEach((el) => {
    el.addEventListener('input', recalc);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTabs();
  initPresets();
  initInputs();
  recalc();
});

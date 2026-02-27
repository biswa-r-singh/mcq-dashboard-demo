import {
  clusterRegions,
  services,
  deploymentAttempts,
  testRuns,
  getClusterRegion,
} from '../data.js';
import { layout, sectionCard } from '../ui.js';

/* ───────────────────────── helpers ───────────────────────── */

function toDay(iso) {
  return iso ? iso.slice(0, 10) : null;
}

function daysFrom(attempts) {
  const set = new Set();
  for (const a of attempts) {
    const d = toDay(a.startedAt);
    if (d) set.add(d);
  }
  return Array.from(set).sort();
}

function durationMin(a) {
  if (!a.startedAt || !a.endedAt) return null;
  return (Date.parse(a.endedAt) - Date.parse(a.startedAt)) / 60000;
}

function filterAttempts(serviceId, clusterId) {
  return deploymentAttempts.filter((a) => {
    if (serviceId !== 'ALL' && a.serviceId !== serviceId) return false;
    if (clusterId !== 'ALL' && a.clusterId !== clusterId) return false;
    return true;
  });
}

function filterTestRuns(attempts) {
  const ids = new Set(attempts.map((a) => a.id));
  return testRuns.filter((t) => ids.has(t.attemptId));
}

const COLORS = {
  success: 'rgba(52,211,153,0.8)',
  failed: 'rgba(251,113,133,0.8)',
  rollback: 'rgba(251,191,36,0.8)',
  functional: 'rgba(56,189,248,0.85)',
  sanity: 'rgba(167,139,250,0.85)',
  regression: 'rgba(248,113,113,0.85)',
  frequency: 'rgba(96,165,250,0.8)',
  leadTime: 'rgba(251,191,36,0.8)',
};

/* ───────────────── 1. Build Attempts Over Time ──────────── */

function buildAttemptsData(filteredAttempts) {
  const days = daysFrom(filteredAttempts);
  const successByDay = {};
  const failedByDay = {};
  const rollbackByDay = {};

  for (const a of filteredAttempts) {
    const d = toDay(a.startedAt);
    if (!d) continue;
    if (a.status === 'SUCCESS' || a.status === 'LIVE') successByDay[d] = (successByDay[d] || 0) + 1;
    else if (a.status === 'FAILED') failedByDay[d] = (failedByDay[d] || 0) + 1;
    else if (a.status === 'ROLLBACK') rollbackByDay[d] = (rollbackByDay[d] || 0) + 1;
  }

  return {
    labels: days,
    datasets: [
      { label: 'Success', data: days.map((d) => successByDay[d] || 0), backgroundColor: COLORS.success, borderColor: COLORS.success, borderWidth: 1 },
      { label: 'Failed', data: days.map((d) => failedByDay[d] || 0), backgroundColor: COLORS.failed, borderColor: COLORS.failed, borderWidth: 1 },
      { label: 'Rollback', data: days.map((d) => rollbackByDay[d] || 0), backgroundColor: COLORS.rollback, borderColor: COLORS.rollback, borderWidth: 1 },
    ],
  };
}

/* ───────────────── 2. Test Pass Rates Over Time ─────────── */

function testPassRateData(filteredAttempts, filteredRuns) {
  const days = daysFrom(filteredAttempts);
  const attemptMap = new Map(filteredAttempts.map((a) => [a.id, a]));

  const suiteTypes = ['FUNCTIONAL', 'SANITY', 'REGRESSION'];
  const rateByDaySuite = {};
  for (const st of suiteTypes) rateByDaySuite[st] = {};

  for (const t of filteredRuns) {
    const attempt = attemptMap.get(t.attemptId);
    if (!attempt) continue;
    const d = toDay(attempt.startedAt);
    if (!d) continue;
    if (!rateByDaySuite[t.suiteType]) continue;

    if (!rateByDaySuite[t.suiteType][d]) {
      rateByDaySuite[t.suiteType][d] = { passed: 0, total: 0 };
    }
    rateByDaySuite[t.suiteType][d].passed += t.passed;
    rateByDaySuite[t.suiteType][d].total += t.total;
  }

  function rateArray(st) {
    return days.map((d) => {
      const r = rateByDaySuite[st]?.[d];
      if (!r || r.total === 0) return null;
      return +((r.passed / r.total) * 100).toFixed(1);
    });
  }

  return {
    labels: days,
    datasets: [
      { label: 'Functional %', data: rateArray('FUNCTIONAL'), borderColor: COLORS.functional, backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
      { label: 'Sanity %', data: rateArray('SANITY'), borderColor: COLORS.sanity, backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
      { label: 'Regression %', data: rateArray('REGRESSION'), borderColor: COLORS.regression, backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
    ],
  };
}

/* ──────────── 3. Deployment Frequency & Lead Time ────────── */

function deployFreqLeadTimeData(filteredAttempts) {
  const days = daysFrom(filteredAttempts);

  const countByDay = {};
  const durationSumByDay = {};
  const durationCountByDay = {};

  for (const a of filteredAttempts) {
    const d = toDay(a.startedAt);
    if (!d) continue;
    countByDay[d] = (countByDay[d] || 0) + 1;

    const dur = durationMin(a);
    if (dur !== null) {
      durationSumByDay[d] = (durationSumByDay[d] || 0) + dur;
      durationCountByDay[d] = (durationCountByDay[d] || 0) + 1;
    }
  }

  return {
    labels: days,
    datasets: [
      {
        label: 'Deploys / day',
        data: days.map((d) => countByDay[d] || 0),
        backgroundColor: COLORS.frequency,
        borderColor: COLORS.frequency,
        borderWidth: 1,
        type: 'bar',
        yAxisID: 'y',
        order: 2,
      },
      {
        label: 'Avg lead time (min)',
        data: days.map((d) => {
          const c = durationCountByDay[d];
          if (!c) return null;
          return +((durationSumByDay[d] || 0) / c).toFixed(1);
        }),
        borderColor: COLORS.leadTime,
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 3,
        type: 'line',
        yAxisID: 'y1',
        order: 1,
      },
    ],
  };
}

/* ──────────────────── dropdown builders ──────────────────── */

function serviceOptions() {
  return `<option value="ALL">All services</option>` +
    services.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
}

function clusterOptions() {
  return `<option value="ALL">All cluster-regions</option>` +
    clusterRegions.map((c) => {
      const info = getClusterRegion(c.id);
      return `<option value="${c.id}">${info?.name || c.id}</option>`;
    }).join('');
}

/* ───────────────────────── render ────────────────────────── */

export function renderAnalytics() {
  const selectCls = 'px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-600';

  const content = `
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <div>
        <label class="text-xs text-slate-400 block mb-1">Service</label>
        <select id="analyticsService" class="${selectCls}">${serviceOptions()}</select>
      </div>
      <div>
        <label class="text-xs text-slate-400 block mb-1">Cluster-Region</label>
        <select id="analyticsCluster" class="${selectCls}">${clusterOptions()}</select>
      </div>
      <div class="self-end">
        <span id="analyticsLabel" class="text-sm text-slate-300"></span>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6">
      ${sectionCard({
        title: 'Build Attempts Over Time',
        right: '<span class="text-xs text-slate-400">Stacked bar — per day</span>',
        body: '<div style="position:relative;height:320px;"><canvas id="chartBuildAttempts"></canvas></div>',
      })}

      ${sectionCard({
        title: 'Test Pass Rates Over Time',
        right: '<span class="text-xs text-slate-400">Functional / Sanity / Regression</span>',
        body: '<div style="position:relative;height:320px;"><canvas id="chartTestPassRates"></canvas></div>',
      })}

      ${sectionCard({
        title: 'Deployment Frequency & Lead Time',
        right: '<span class="text-xs text-slate-400">Bar = deploys/day · Line = avg lead time</span>',
        body: '<div style="position:relative;height:320px;"><canvas id="chartFreqLeadTime"></canvas></div>',
      })}
    </div>
  `;

  return layout({
    title: 'Analytics & Trends',
    subtitle: 'Time series views per service per cluster-region. Select filters above to drill down. (UX prototype — mock data)',
    activeNav: 'analytics',
    content,
  });
}

/* ─────────────────── bindAnalyticsCharts ─────────────────── */

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#e2e8f0', font: { size: 12 } } },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8' },
      grid: { color: 'rgba(148,163,184,0.1)' },
    },
    y: {
      ticks: { color: '#94a3b8' },
      grid: { color: 'rgba(148,163,184,0.1)' },
    },
  },
};

let chart1 = null;
let chart2 = null;
let chart3 = null;

function destroyCharts() {
  chart1?.destroy(); chart1 = null;
  chart2?.destroy(); chart2 = null;
  chart3?.destroy(); chart3 = null;
}

function createCharts(serviceId, clusterId) {
  const Chart = window.Chart;
  if (!Chart) return;

  destroyCharts();

  const filteredAttempts = filterAttempts(serviceId, clusterId);
  const filteredRuns = filterTestRuns(filteredAttempts);

  // Update label
  const label = document.getElementById('analyticsLabel');
  if (label) {
    const svcName = serviceId === 'ALL' ? 'All services' : services.find((s) => s.id === serviceId)?.name || serviceId;
    const clName = clusterId === 'ALL' ? 'All cluster-regions' : (getClusterRegion(clusterId)?.name || clusterId);
    label.textContent = `Showing: ${svcName} · ${clName} (${filteredAttempts.length} attempts)`;
  }

  // 1. Build Attempts (stacked bar)
  const ctx1 = document.getElementById('chartBuildAttempts')?.getContext('2d');
  if (ctx1) {
    chart1 = new Chart(ctx1, {
      type: 'bar',
      data: buildAttemptsData(filteredAttempts),
      options: {
        ...chartDefaults,
        scales: {
          ...chartDefaults.scales,
          x: { ...chartDefaults.scales.x, stacked: true },
          y: { ...chartDefaults.scales.y, stacked: true, beginAtZero: true },
        },
      },
    });
  }

  // 2. Test Pass Rates (line)
  const ctx2 = document.getElementById('chartTestPassRates')?.getContext('2d');
  if (ctx2) {
    chart2 = new Chart(ctx2, {
      type: 'line',
      data: testPassRateData(filteredAttempts, filteredRuns),
      options: {
        ...chartDefaults,
        scales: {
          ...chartDefaults.scales,
          y: {
            ...chartDefaults.scales.y,
            beginAtZero: false,
            min: 80,
            max: 100,
            ticks: { ...chartDefaults.scales.y.ticks, callback: (v) => `${v}%` },
          },
        },
      },
    });
  }

  // 3. Deployment Frequency & Lead Time (mixed bar + line, dual axis)
  const ctx3 = document.getElementById('chartFreqLeadTime')?.getContext('2d');
  if (ctx3) {
    chart3 = new Chart(ctx3, {
      type: 'bar',
      data: deployFreqLeadTimeData(filteredAttempts),
      options: {
        ...chartDefaults,
        scales: {
          x: { ...chartDefaults.scales.x },
          y: {
            ...chartDefaults.scales.y,
            beginAtZero: true,
            position: 'left',
            title: { display: true, text: 'Deploys', color: '#94a3b8' },
          },
          y1: {
            ticks: { color: '#94a3b8', callback: (v) => `${v}m` },
            grid: { drawOnChartArea: false },
            beginAtZero: true,
            position: 'right',
            title: { display: true, text: 'Avg Lead Time (min)', color: '#94a3b8' },
          },
        },
      },
    });
  }
}

export function bindAnalyticsCharts() {
  const svcSelect = document.getElementById('analyticsService');
  const clSelect = document.getElementById('analyticsCluster');

  function refresh() {
    const serviceId = svcSelect?.value || 'ALL';
    const clusterId = clSelect?.value || 'ALL';
    createCharts(serviceId, clusterId);
  }

  svcSelect?.addEventListener('change', refresh);
  clSelect?.addEventListener('change', refresh);

  // Initial render with ALL / ALL
  refresh();
}

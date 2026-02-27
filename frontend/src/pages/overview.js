import {
  clusters,
  clusterRegions,
  services,
  currentRunning,
  deploymentAttempts,
  testRuns,
  clusterTestRuns,
  jiraTickets,
  statusMeta,
  suiteMeta,
  getClusterRegion,
} from '../data.js';
import { layout, sectionCard, keyValueGrid, badge, emptyState } from '../ui.js';

function attemptsForCluster(clusterId) {
  return deploymentAttempts.filter((a) => a.clusterId === clusterId);
}

function parseSemver(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmpSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa && !pb) return String(a).localeCompare(String(b));
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function summarizeCluster(clusterId) {
  const attempts = attemptsForCluster(clusterId);

  // Snapshot view: summarize by the *latest* attempt per service for this cluster-region.
  // This prevents old historical failures/rollbacks from flagging the cluster as Attention.
  const latestByService = new Map();

  for (const a of attempts) {
    const prev = latestByService.get(a.serviceId);
    if (!prev) {
      latestByService.set(a.serviceId, a);
      continue;
    }

    const v = cmpSemver(a.buildVersion, prev.buildVersion);
    if (v > 0) {
      latestByService.set(a.serviceId, a);
      continue;
    }

    if (v === 0 && String(a.startedAt) > String(prev.startedAt)) {
      latestByService.set(a.serviceId, a);
    }
  }

  const latestAttempts = Array.from(latestByService.values());
  const total = latestAttempts.length;
  const success = latestAttempts.filter((a) => a.status === 'SUCCESS' || a.status === 'LIVE').length;
  const rollback = latestAttempts.filter((a) => a.status === 'ROLLBACK').length;
  const failed = latestAttempts.filter((a) => a.status === 'FAILED').length;
  const unhealthy = latestAttempts.filter((a) => a.status === 'ROLLBACK' || a.status === 'FAILED');
  return { total, success, rollback, failed, unhealthy };
}

function suiteOverviewRow(label, run) {
  if (!run) return '';
  const passPct = ((run.passed / run.total) * 100).toFixed(1);
  const failPct = ((run.failed / run.total) * 100).toFixed(1);
  const skipPct = (((run.skipped || 0) / run.total) * 100).toFixed(1);
  const healthLabel = Number(passPct) >= 95 ? 'Healthy' : 'At Risk';
  const healthTone = Number(passPct) >= 95 ? 'emerald' : 'rose';
  const failTone = run.failed > 0 ? 'text-rose-400' : 'text-slate-400';
  const dateStr = run.executedAt ? run.executedAt.slice(0, 10) : '—';
  return `
    <div class="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-b-0">
      <div class="flex items-center gap-2">
        <div class="text-[11px] text-slate-300 w-28">${label}</div>
        ${badge({ label: healthLabel, tone: healthTone, subtle: true })}
      </div>
      <div class="flex items-center gap-3 text-xs">
        <span class="${Number(passPct) >= 95 ? 'text-emerald-400' : 'text-rose-400'} font-medium">${passPct}%</span>
        <span class="${failTone} font-medium">${failPct}%</span>
        <span class="text-slate-500">${skipPct}%</span>
        <span class="text-slate-500 text-[10px]">${dateStr}</span>
      </div>
    </div>
  `;
}

function canaryOverview(clusterId) {
  if (!String(clusterId).startsWith('aquila-')) return '';

  const running = currentRunning[clusterId] || {};
  let totalTests = 0, totalPassed = 0, totalFailed = 0, svcCount = 0;

  for (const s of services) {
    if (!running[s.id]) continue;
    const attempts = attemptsForCluster(clusterId)
      .filter((a) => a.serviceId === s.id)
      .sort((a, b) => (a.startedAt > b.startedAt ? 1 : -1));
    const latest = attempts.length ? attempts[attempts.length - 1] : null;
    if (!latest) continue;
    const canary = testRuns.find((t) => t.attemptId === latest.id && t.suiteType === 'CANARY');
    if (canary) {
      totalTests += canary.total;
      totalPassed += canary.passed;
      totalFailed += canary.failed;
      svcCount++;
    }
  }
  if (totalTests === 0) return '';

  const passPct = ((totalPassed / totalTests) * 100).toFixed(1);
  const failPct = ((totalFailed / totalTests) * 100).toFixed(1);
  const healthLabel = Number(passPct) >= 95 ? 'Healthy' : 'At Risk';
  const healthTone = Number(passPct) >= 95 ? 'emerald' : 'rose';
  const failTone = totalFailed > 0 ? 'text-rose-400' : 'text-slate-400';

  return `
    <div class="mt-3 rounded-xl border border-slate-800 bg-slate-950/30 p-2.5">
      <div class="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5 flex justify-between">
        <span>Canary Tests (latest per service)</span>
        <span class="normal-case">pass% · fail%</span>
      </div>
      <div class="flex items-center justify-between py-1.5">
        <div class="flex items-center gap-2">
          <div class="text-[11px] text-slate-300 w-28">Canary</div>
          ${badge({ label: healthLabel, tone: healthTone, subtle: true })}
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span class="${Number(passPct) >= 95 ? 'text-emerald-400' : 'text-rose-400'} font-medium">${passPct}%</span>
          <span class="${failTone} font-medium">${failPct}%</span>
          <span class="text-slate-500 text-[10px]">${svcCount} services</span>
        </div>
      </div>
    </div>
  `;
}

function nightlyOverview(clusterId) {
  const isMira = String(clusterId).startsWith('mira-');
  const isPavo = String(clusterId).startsWith('pavo-');
  if (!isMira && !isPavo) return '';

  // Use the same fail/skip percentages as cluster detail page for nightly
  const failPcts =  [1.2, 0.0, 3.5, 0.8, 2.1];
  const skipPcts =  [0.5, 0.3, 1.0, 0.0, 0.7];
  const latestFail = failPcts[0];
  const latestSkip = skipPcts[0];
  const latestPass = (100 - latestFail - latestSkip).toFixed(1);
  const nightlyHealth = Number(latestPass) >= 95 ? 'Healthy' : 'At Risk';
  const nightlyTone = Number(latestPass) >= 95 ? 'emerald' : 'rose';
  const nightlyFailTone = latestFail > 0 ? 'text-rose-400' : 'text-slate-400';

  // Latest Solution & System runs for this cluster
  const solRuns = clusterTestRuns.filter((r) => r.clusterId === clusterId && r.suiteType === 'SOLUTION').sort((a, b) => b.executedAt.localeCompare(a.executedAt));
  const sysRuns = clusterTestRuns.filter((r) => r.clusterId === clusterId && r.suiteType === 'SYSTEM').sort((a, b) => b.executedAt.localeCompare(a.executedAt));
  const latestSol = solRuns[0] || null;
  const latestSys = sysRuns[0] || null;

  return `
    <div class="mt-3 rounded-xl border border-slate-800 bg-slate-950/30 p-2.5">
      <div class="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5 flex justify-between">
        <span>Cluster Test Suites (latest)</span>
        <span class="normal-case">pass% · fail% · skip%</span>
      </div>
      <div class="flex items-center justify-between py-1.5 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <div class="text-[11px] text-slate-300 w-28">Nightly Regression</div>
          ${badge({ label: nightlyHealth, tone: nightlyTone, subtle: true })}
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span class="${Number(latestPass) >= 95 ? 'text-emerald-400' : 'text-rose-400'} font-medium">${latestPass}%</span>
          <span class="${nightlyFailTone} font-medium">${latestFail}%</span>
          <span class="text-slate-500">${latestSkip}%</span>
          <span class="text-slate-500 text-[10px]">2026-02-05</span>
        </div>
      </div>
      ${suiteOverviewRow('Solution Tests', latestSol)}
      ${suiteOverviewRow('System Tests', latestSys)}
    </div>
  `;
}

function regionCard(clusterRegion) {
  const info = getClusterRegion(clusterRegion.id);
  const sum = summarizeCluster(clusterRegion.id);

  return `
    <div class="rounded-xl border border-slate-800 bg-slate-950/30 hover:bg-slate-900/60 transition cursor-pointer" data-cluster-nav="#/clusters/${clusterRegion.id}">
      <div class="p-4">
        <div class="flex items-center gap-2">
          <div class="text-base font-semibold">${info?.region || clusterRegion.region}</div>
          ${badge({ label: info?.role || '—', tone: info?.role === 'Active' || info?.role === 'Hot-standby' ? 'emerald' : 'slate', subtle: true })}
        </div>

        <div class="mt-3 grid grid-cols-4 gap-2">
          ${miniStat('Services', sum.total)}
          ${miniStat('Success', sum.success)}
          ${miniStat('Rollback', sum.rollback, `#/clusters/${clusterRegion.id}?filter=ROLLBACK`)}
          ${miniStat('Failed', sum.failed, `#/clusters/${clusterRegion.id}?filter=FAILED`)}
        </div>

        ${nightlyOverview(clusterRegion.id)}
        ${canaryOverview(clusterRegion.id)}
      </div>
    </div>
  `;
}

function baseClusterCard(cluster) {
  const regions = clusterRegions.filter((cr) => cr.baseId === cluster.id);

  return `
    <div class="rounded-2xl border border-slate-800 bg-slate-900/40">
      <div class="p-4 cursor-pointer hover:bg-slate-900/60 transition rounded-t-2xl" data-cluster-toggle="${cluster.id}">
        <div class="flex items-center gap-2">
          <div class="text-lg font-semibold">${cluster.name}</div>
          ${badge({ label: cluster.type, tone: 'slate', subtle: true })}
          <div class="flex-1"></div>
          <span class="text-xs text-slate-400" id="toggleLabel-${cluster.id}">Click to expand</span>
        </div>
        <div class="mt-1 text-sm text-slate-300">${cluster.description}</div>
      </div>
      <div id="regions-${cluster.id}" class="hidden border-t border-slate-800 p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${regions.map((cr) => regionCard(cr)).join('')}
        </div>
      </div>
    </div>
  `;
}

function miniStat(label, value, href) {
  if (href && value > 0) {
    return `
      <a href="${href}" class="rounded-xl border border-slate-800 bg-slate-950/30 p-2 hover:bg-slate-900/60 transition block">
        <div class="text-[11px] text-slate-400">${label}</div>
        <div class="mt-0.5 text-base font-semibold">${value}</div>
      </a>
    `;
  }
  return `
    <div class="rounded-xl border border-slate-800 bg-slate-950/30 p-2">
      <div class="text-[11px] text-slate-400">${label}</div>
      <div class="mt-0.5 text-base font-semibold">${value}</div>
    </div>
  `;
}

function pipelineRow(serviceId) {
  const svc = services.find((s) => s.id === serviceId);
  const miraW = currentRunning['mira-us-west-2']?.[serviceId] || '—';
  const miraE = currentRunning['mira-us-east-2']?.[serviceId] || '—';
  const pavoW = currentRunning['pavo-us-west-2']?.[serviceId] || '—';
  const pavoE = currentRunning['pavo-us-east-2']?.[serviceId] || '—';
  const aquilaW = currentRunning['aquila-us-west-2']?.[serviceId] || '—';
  const aquilaE = currentRunning['aquila-us-east-2']?.[serviceId] || '—';

  return `
    <div class="grid grid-cols-12 gap-3 items-center py-3 border-b border-slate-800 last:border-b-0">
      <div class="col-span-12 md:col-span-3">
        <a href="#/services/${serviceId}" class="font-semibold hover:underline">${svc?.name || serviceId}</a>
        <div class="text-xs text-slate-400">Owner: ${svc?.owner || '—'}</div>
      </div>

      ${pipelineCellTwo('Mira', 'us-west-2', miraW, 'us-east-2', miraE)}
      ${pipelineCellTwo('Pavo', 'us-west-2', pavoW, 'us-east-2', pavoE)}
      ${pipelineCellTwo('Aquila', 'us-west-2', aquilaW, 'us-east-2', aquilaE)}
    </div>
  `;
}

function pipelineCellTwo(label, r1, v1, r2, v2) {
  return `
    <div class="col-span-4 md:col-span-2 rounded-xl border border-slate-800 bg-slate-950/30 p-2">
      <div class="text-[11px] text-slate-400">${label}</div>
      <div class="mt-1 text-[11px] text-slate-400">${r1}</div>
      <div class="font-mono text-sm">v${v1}</div>
      <div class="mt-1 text-[11px] text-slate-400">${r2}</div>
      <div class="font-mono text-sm">v${v2}</div>
    </div>
  `;
}

/* ── Jira ticket comparison panel ──────────────────────────── */
function jiraComparePanel() {
  return `
    <div id="jiraPanel" class="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div class="text-sm font-semibold text-slate-200 mb-3">Jira Tickets Between Versions</div>
      <div class="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Service</label>
          <select id="jiraService" class="rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-200 px-3 py-1.5 w-48">
            ${services.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">From version</label>
          <input id="jiraFrom" type="text" placeholder="e.g. 3.4.0" class="rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-200 px-3 py-1.5 w-32 font-mono" />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">To version</label>
          <input id="jiraTo" type="text" placeholder="e.g. 3.4.2" class="rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-200 px-3 py-1.5 w-32 font-mono" />
        </div>
        <button id="jiraSearch" class="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-1.5 font-medium transition">Find Tickets</button>
      </div>
      <div id="jiraResults"></div>
    </div>
  `;
}

function renderJiraResults(serviceId, fromVer, toVer) {
  const tickets = jiraTickets[serviceId] || [];
  const matched = tickets.filter((t) => {
    const v = cmpSemver(t.version, fromVer);
    const v2 = cmpSemver(t.version, toVer);
    return v > 0 && v2 <= 0;
  });

  if (!matched.length) {
    return `<div class="text-sm text-slate-400 py-3">No Jira tickets found between v${fromVer} and v${toVer}.</div>`;
  }

  const priorityTone = { Critical: 'rose', High: 'amber', Medium: 'slate', Low: 'slate' };
  const typeTone = { Bug: 'rose', Story: 'emerald', Task: 'sky' };

  const rows = matched.map((t) => `
    <div class="grid grid-cols-12 gap-2 items-center py-2 border-b border-slate-800 last:border-b-0">
      <div class="col-span-2 font-mono text-sm text-indigo-400">${t.key}</div>
      <div class="col-span-5 text-sm text-slate-200">${t.summary}</div>
      <div class="col-span-1"><span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-${typeTone[t.type] || 'slate'}-500/20 text-${typeTone[t.type] || 'slate'}-400">${t.type}</span></div>
      <div class="col-span-2"><span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-${priorityTone[t.priority] || 'slate'}-500/20 text-${priorityTone[t.priority] || 'slate'}-400">${t.priority}</span></div>
      <div class="col-span-1 font-mono text-xs text-slate-400">v${t.version}</div>
      <div class="col-span-1 text-xs text-emerald-400">${t.status}</div>
    </div>
  `).join('');

  return `
    <div class="text-xs text-slate-400 mb-2">${matched.length} ticket${matched.length !== 1 ? 's' : ''} between v${fromVer} → v${toVer}</div>
    <div class="grid grid-cols-12 gap-2 items-center py-1 px-0 mb-1">
      <div class="col-span-2 text-[10px] text-slate-500 uppercase tracking-wide">Key</div>
      <div class="col-span-5 text-[10px] text-slate-500 uppercase tracking-wide">Summary</div>
      <div class="col-span-1 text-[10px] text-slate-500 uppercase tracking-wide">Type</div>
      <div class="col-span-2 text-[10px] text-slate-500 uppercase tracking-wide">Priority</div>
      <div class="col-span-1 text-[10px] text-slate-500 uppercase tracking-wide">Version</div>
      <div class="col-span-1 text-[10px] text-slate-500 uppercase tracking-wide">Status</div>
    </div>
    ${rows}
  `;
}

function riskRows() {
  const rollbacks = deploymentAttempts
    .filter((a) => a.status === 'ROLLBACK')
    .slice(0, 5)
    .map((a) => riskRow(a, 'Rollback'));

  const nightliesFailed = testRuns
    .filter((t) => (t.suiteType === 'REGRESSION' || t.suiteType === 'SANITY') && t.failed > 0)
    .slice(0, 5)
    .map((t) => nightlyRiskRow(t));

  return { rollbacks, nightliesFailed };
}

function riskRow(attempt, label) {
  const svc = services.find((s) => s.id === attempt.serviceId);
  const meta = statusMeta[attempt.status] || { label: attempt.status, tone: 'slate' };
  return `
    <div class="grid grid-cols-12 gap-3 items-center py-2 border-b border-slate-800 last:border-b-0">
      <div class="col-span-12 md:col-span-3">
        <div class="text-sm font-semibold">${label}</div>
        <div class="text-xs text-slate-400">${attempt.clusterId.toUpperCase()}</div>
      </div>
      <div class="col-span-12 md:col-span-4">
        <a class="hover:underline" href="#/builds/${encodeURIComponent(attempt.id)}">${svc?.name || attempt.serviceId} <span class="text-slate-400">v${attempt.buildVersion}</span></a>
        <div class="text-xs text-slate-400">${attempt.failureReason || '—'}</div>
      </div>
      <div class="col-span-12 md:col-span-3">
        ${badge({ label: meta.label, tone: meta.tone, subtle: true })}
      </div>
      <div class="col-span-12 md:col-span-2 text-right">
        <a href="#/clusters/${attempt.clusterId}" class="text-sm text-slate-200 hover:underline">View cluster</a>
      </div>
    </div>
  `;
}

function nightlyRiskRow(t) {
  const attempt = deploymentAttempts.find((a) => a.id === t.attemptId);
  const svc = services.find((s) => s.id === attempt?.serviceId);
  const sm = suiteMeta[t.suiteType] || { label: t.suiteType, color: 'slate' };
  return `
    <div class="grid grid-cols-12 gap-3 items-center py-2 border-b border-slate-800 last:border-b-0">
      <div class="col-span-12 md:col-span-3">
        <div class="text-sm font-semibold">Nightly failure</div>
        <div class="text-xs text-slate-400">${sm.label}</div>
      </div>
      <div class="col-span-12 md:col-span-4">
        <a class="hover:underline" href="#/builds/${encodeURIComponent(t.attemptId)}">${svc?.name || attempt?.serviceId || '—'} <span class="text-slate-400">v${attempt?.buildVersion || '—'}</span></a>
        <div class="text-xs text-slate-400">${attempt?.clusterId?.toUpperCase() || '—'}</div>
      </div>
      <div class="col-span-12 md:col-span-3">
        ${badge({ label: `${t.passed}/${t.total} passed`, tone: 'amber', subtle: true })}
        <span class="ml-2">${badge({ label: `${t.failed} failed`, tone: 'rose', subtle: true })}</span>
      </div>
      <div class="col-span-12 md:col-span-2 text-right">
        <a href="#/scorecard" class="text-sm text-slate-200 hover:underline">Open</a>
      </div>
    </div>
  `;
}

export function renderOverview() {
  const content = `
    <div class="grid grid-cols-1 gap-4">
      ${clusters.map((c) => baseClusterCard(c)).join('')}
    </div>
  `;

  return layout({
    title: 'Service Health Overview',
    subtitle: 'Real-time cluster health, deployment status, and test suite results across all environments.',
    activeNav: 'overview',
    content,
  });
}

export function bindOverviewInteractions() {
  // Toggle base cluster → show/hide regions
  document.querySelectorAll('[data-cluster-toggle]').forEach((header) => {
    header.addEventListener('click', () => {
      const baseId = header.getAttribute('data-cluster-toggle');
      const regionsDiv = document.getElementById(`regions-${baseId}`);
      const label = document.getElementById(`toggleLabel-${baseId}`);
      if (regionsDiv) {
        const isHidden = regionsDiv.classList.contains('hidden');
        regionsDiv.classList.toggle('hidden', !isHidden);
        if (label) label.textContent = isHidden ? 'Click to collapse' : 'Click to expand';
      }
    });
  });

  // Region card click → navigate to cluster page (but not when clicking filter links)
  document.querySelectorAll('[data-cluster-nav]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      window.location.hash = card.getAttribute('data-cluster-nav');
    });
  });
}

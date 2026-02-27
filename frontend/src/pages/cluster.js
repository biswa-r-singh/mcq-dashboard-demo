import {
  getClusterRegion,
  services,
  currentRunning,
  deploymentAttempts,
  testRuns,
  clusterTestRuns,
  statusMeta,
} from '../data.js';
import { layout, sectionCard, badge, pillButton, fmtDate, emptyState } from '../ui.js';

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

function attemptsFor(clusterId, serviceId) {
  return deploymentAttempts
    .filter((a) => a.clusterId === clusterId && a.serviceId === serviceId)
    .sort((a, b) => {
      const v = cmpSemver(a.buildVersion, b.buildVersion);
      if (v !== 0) return v;
      return a.startedAt > b.startedAt ? 1 : -1;
    });
}

function recentAttemptsForCluster(clusterId) {
  return deploymentAttempts
    .filter((a) => a.clusterId === clusterId)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

function recentAttemptsTable(clusterId, statusFilter = 'ALL') {
  const base = recentAttemptsForCluster(clusterId);
  const attempts = base
    .filter((a) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'SUCCESS') return a.status === 'SUCCESS' || a.status === 'LIVE';
      return a.status === statusFilter;
    })
    .slice(0, 15);
  if (!attempts.length) {
    return `<div class="text-sm text-slate-500">No attempts recorded for this cluster-region (mock).</div>`;
  }

  const rows = attempts.map((a) => {
    const meta = statusMeta[a.status] || { label: a.status, tone: 'slate' };
    const svc = services.find((s) => s.id === a.serviceId);
    return `
      <div class="grid grid-cols-12 gap-3 items-center py-2 border-b border-slate-800 last:border-b-0">
        <div class="col-span-12 md:col-span-4">
          <a class="hover:underline" href="#/builds/${encodeURIComponent(a.id)}">${svc?.name || a.serviceId} <span class="font-mono text-slate-300">v${a.buildVersion}</span></a>
          <div class="text-xs text-slate-400">${a.gitSha ? `SHA: ${a.gitSha}` : ''}</div>
        </div>
        <div class="col-span-12 md:col-span-3">
          ${badge({ label: meta.label, tone: meta.tone, subtle: true })}
          ${a.rollbackToBuild ? `<div class="text-xs text-slate-400">Rollback → v${a.rollbackToBuild}</div>` : ''}
        </div>
        <div class="col-span-12 md:col-span-3">
          <div class="text-xs text-slate-400">Gates</div>
          ${gateBadges(clusterId, a.id)}
        </div>
        <div class="col-span-12 md:col-span-1 text-xs text-slate-400">
          ${fmtDate(a.startedAt)}
        </div>
        <div class="col-span-12 md:col-span-1 text-right">
          <a class="text-sm hover:underline" href="#/builds/${encodeURIComponent(a.id)}">Details</a>
        </div>
      </div>
    `;
  });

  return `<div class="rounded-xl border border-slate-800 bg-slate-900/30 p-2">${rows.join('')}</div>`;
}

function ftBadge(attemptId) {
  const runs = testRuns.filter((t) => t.attemptId === attemptId);
  const func = runs.find((r) => r.suiteType === 'FUNCTIONAL');
  if (func) {
    const label = func.failed > 0
      ? `FT ${func.passed}/${func.total} (${func.failed} failed)`
      : `FT ${func.passed}/${func.total} passed`;
    return badge({ label, tone: func.failed > 0 ? 'rose' : 'emerald', subtle: true });
  }
  return badge({ label: 'FT —', tone: 'slate', subtle: true });
}

function nightlyBadge(attemptId) {
  const runs = testRuns.filter((t) => t.attemptId === attemptId);
  const reg = runs.find((r) => r.suiteType === 'REGRESSION');
  if (reg) {
    const label = reg.failed > 0
      ? `${reg.passed}/${reg.total} (${reg.failed} failed)`
      : `${reg.passed}/${reg.total} passed`;
    return badge({ label, tone: reg.failed > 0 ? 'rose' : 'emerald', subtle: true });
  }
  return badge({ label: '—', tone: 'slate', subtle: true });
}

function hasNightly(clusterId) {
  return String(clusterId).startsWith('mira-') || String(clusterId).startsWith('pavo-');
}

function hasCanary(clusterId) {
  return String(clusterId).startsWith('aquila-');
}

function canaryBadge(attemptId) {
  const runs = testRuns.filter((t) => t.attemptId === attemptId);
  const canary = runs.find((r) => r.suiteType === 'CANARY');
  if (canary) {
    const label = canary.failed > 0
      ? `${canary.passed}/${canary.total} (${canary.failed} failed)`
      : `${canary.passed}/${canary.total} passed`;
    return badge({ label, tone: canary.failed > 0 ? 'rose' : 'emerald', subtle: true });
  }
  return badge({ label: '—', tone: 'slate', subtle: true });
}

function servicesTable(clusterId, statusFilter) {
  const running = currentRunning[clusterId] || {};

  const rows = services
    .map((s) => {
      const ver = running[s.id] || '—';
      const attempts = attemptsFor(clusterId, s.id);
      const latest = attempts.length ? attempts[attempts.length - 1] : null;

      const meta = latest ? statusMeta[latest.status] : null;
      if (statusFilter === 'issues' && !(latest && (latest.status === 'FAILED' || latest.status === 'ROLLBACK'))) return '';
      if (statusFilter === 'ROLLBACK' && !(latest && latest.status === 'ROLLBACK')) return '';
      if (statusFilter === 'FAILED' && !(latest && latest.status === 'FAILED')) return '';

      const latestCell = latest
        ? `
          <div class="flex flex-col">
            <a class="hover:underline" href="#/builds/${encodeURIComponent(latest.id)}">${badge({ label: meta.label, tone: meta.tone, subtle: true })}</a>
            ${latest.status === 'ROLLBACK' ? `<div class="text-xs text-slate-400 mt-1"><span class="font-mono">v${latest.buildVersion}</span> failed → rolled back to <span class="font-mono">v${latest.rollbackToBuild}</span></div>` : ''}
            ${latest.status === 'FAILED' ? `<div class="text-xs text-slate-400 mt-1"><span class="font-mono">v${latest.buildVersion}</span> deployment failed</div>` : ''}
            <div class="text-xs text-slate-400">${fmtDate(latest.endedAt || latest.startedAt)}</div>
          </div>
        `
        : `<div class="text-sm text-slate-500">—</div>`;

      const expandId = `exp:${clusterId}:${s.id}`;
      const hasAttempts = attempts.length > 0;

      const showNightly = hasNightly(clusterId);
      const showCanary = hasCanary(clusterId);

      return `
        <div class="rounded-xl border border-slate-800 bg-slate-950/20">
          <div class="grid grid-cols-12 gap-3 p-3 items-center">
            <div class="col-span-12 md:col-span-2">
              <a href="#/services/${s.id}" class="font-semibold hover:underline">${s.name}</a>
              <div class="text-xs text-slate-400">Owner: ${s.owner}</div>
            </div>

            <div class="col-span-6 md:col-span-1">
              <div class="text-xs text-slate-400">Current</div>
              <div class="font-mono text-sm">v${ver}</div>
            </div>

            <div class="col-span-6 md:col-span-3">
              <div class="text-xs text-slate-400">Latest attempt</div>
              ${latestCell}
            </div>

            <div class="col-span-12 md:col-span-2">
              <div class="text-xs text-slate-400">FT Results</div>
              ${latest ? ftBadge(latest.id) : `<div class="text-sm text-slate-500">—</div>`}
            </div>

            ${showNightly ? `<div class="col-span-12 md:col-span-2">
              <div class="text-xs text-slate-400">Nightly Regression</div>
              ${latest ? nightlyBadge(latest.id) : `<div class="text-sm text-slate-500">—</div>`}
            </div>` : showCanary ? `<div class="col-span-12 md:col-span-2">
              <div class="text-xs text-slate-400">Canary</div>
              ${latest ? canaryBadge(latest.id) : `<div class="text-sm text-slate-500">—</div>`}
            </div>` : `<div class="col-span-12 md:col-span-2">
              <div class="text-xs text-slate-400">—</div>
              <div class="text-sm text-slate-500">N/A</div>
            </div>`}

            <div class="col-span-12 md:col-span-2 text-right">
              ${hasAttempts ? `<button data-expand="${expandId}" class="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 text-sm">Expand</button>` : ''}
            </div>
          </div>

          ${hasAttempts ? `<div id="${cssEscape(expandId)}" class="hidden border-t border-slate-800 p-3">${attemptsList(attempts)}</div>` : ''}
        </div>
      `;
    })
    .filter(Boolean)
    .join('');

  return rows || emptyState({ title: 'No services match filters', description: 'Try clearing filters or selecting another cluster.' });
}

function attemptsList(attempts) {
  const recent = attempts.slice().reverse().slice(0, 5);
  const showNightlyCol = recent.length > 0 && hasNightly(recent[0].clusterId);
  const showCanaryCol = recent.length > 0 && hasCanary(recent[0].clusterId);
  const rows = recent.map((a) => {
    const meta = statusMeta[a.status] || { label: a.status, tone: 'slate' };
    return `
      <div class="grid grid-cols-12 gap-3 items-center py-2 border-b border-slate-800 last:border-b-0">
        <div class="col-span-12 md:col-span-2">
          <a class="hover:underline" href="#/builds/${encodeURIComponent(a.id)}"><span class="font-mono">v${a.buildVersion}</span></a>
          <div class="text-xs text-slate-400">${a.gitSha}</div>
        </div>
        <div class="col-span-12 md:col-span-2">
          ${badge({ label: meta.label, tone: meta.tone, subtle: true })}
          ${a.rollbackToBuild ? `<div class="text-xs text-slate-400 mt-1">→ v${a.rollbackToBuild}</div>` : ''}
        </div>
        <div class="col-span-12 md:col-span-3">
          <div class="text-xs text-slate-400">FT</div>
          ${ftBadge(a.id)}
        </div>
        ${showNightlyCol ? `<div class="col-span-12 md:col-span-3">
          <div class="text-xs text-slate-400">Nightly</div>
          ${nightlyBadge(a.id)}
        </div>` : showCanaryCol ? `<div class="col-span-12 md:col-span-3">
          <div class="text-xs text-slate-400">Canary</div>
          ${canaryBadge(a.id)}
        </div>` : ''}
        <div class="col-span-12 md:col-span-2 text-xs text-slate-400 text-right">
          ${fmtDate(a.startedAt)}
        </div>
      </div>
    `;
  });

  return `
    <div class="text-xs text-slate-400 mb-2">Last 5 builds (newest first)</div>
    <div class="rounded-xl border border-slate-800 bg-slate-900/30 p-2">${rows.join('')}</div>
  `;
}

function suiteLatestRow(r) {
  const passPct = ((r.passed / r.total) * 100);
  const failPct = ((r.failed / r.total) * 100);
  const skipPct = (((r.skipped || 0) / r.total) * 100);
  const passTone = passPct < 95 ? 'text-rose-400' : 'text-emerald-400';
  const failTone = r.failed > 0 ? 'text-rose-400' : 'text-slate-500';
  const dateStr = typeof r.date === 'string' && r.date.length === 10 ? r.date : (r.executedAt || '').slice(0, 10);
  return `
    <div class="flex items-center gap-4 text-xs">
      <span class="text-slate-400">${dateStr}</span>
      <span class="text-slate-300">${r.total.toLocaleString()} tests</span>
      <span class="${passTone} font-medium">${passPct.toFixed(1)}% passed</span>
      <span class="${failTone} font-medium">${failPct.toFixed(1)}% failed</span>
      <span class="text-slate-500">${skipPct.toFixed(1)}% skipped</span>
    </div>
  `;
}

function suiteHistoryRows(runs, showCoverage) {
  return runs.map((r, i) => {
    const isLatest = i === 0;
    const rowBg = isLatest ? 'bg-slate-900/60' : '';
    const passPct = r.passPct != null ? r.passPct : ((r.passed / r.total) * 100);
    const failPct = r.failPct != null ? r.failPct : ((r.failed / r.total) * 100);
    const skipPct = r.skipPct != null ? r.skipPct : (((r.skipped || 0) / r.total) * 100);
    const passTone = passPct < 95 ? 'text-rose-400' : 'text-emerald-400';
    const failTone = (r.failed > 0 || failPct > 0) ? 'text-rose-400' : 'text-slate-500';
    const dateStr = r.date || (r.executedAt || '').slice(0, 10);
    const covCol = showCoverage
      ? `<div class="col-span-2 text-xs text-slate-500 text-right">${r.covered != null ? r.covered + ' svc' : ''}</div>`
      : '';
    const skipSpan = showCoverage ? 1 : 3;
    return `
      <div class="grid grid-cols-12 gap-2 items-center py-1.5 px-2 rounded-lg ${rowBg} ${isLatest ? 'border border-slate-700' : ''}">
        <div class="col-span-3 text-xs ${isLatest ? 'text-slate-200 font-medium' : 'text-slate-400'}">
          ${dateStr}${isLatest ? ' <span class="text-[10px] text-slate-500">(latest)</span>' : ''}
        </div>
        <div class="col-span-2 text-xs text-slate-300 text-center">${r.total.toLocaleString()}</div>
        <div class="col-span-2 text-xs ${passTone} text-center font-medium">${passPct.toFixed(1)}%</div>
        <div class="col-span-2 text-xs ${failTone} text-center font-medium">${failPct.toFixed(1)}%</div>
        <div class="col-span-${skipSpan} text-xs text-slate-500 text-center">${skipPct.toFixed(1)}%</div>
        ${covCol}
      </div>
    `;
  }).join('');
}

function suiteHistoryHeader(showCoverage) {
  const skipSpan = showCoverage ? 1 : 3;
  return `
    <div class="grid grid-cols-12 gap-2 items-center py-1 px-2 mb-1">
      <div class="col-span-3 text-[10px] text-slate-500 uppercase tracking-wide">Date</div>
      <div class="col-span-2 text-[10px] text-slate-500 uppercase tracking-wide text-center">Total</div>
      <div class="col-span-2 text-[10px] text-slate-500 uppercase tracking-wide text-center">Passed</div>
      <div class="col-span-2 text-[10px] text-slate-500 uppercase tracking-wide text-center">Failed</div>
      <div class="col-span-${skipSpan} text-[10px] text-slate-500 uppercase tracking-wide text-center">Skip</div>
      ${showCoverage ? '<div class="col-span-2 text-[10px] text-slate-500 uppercase tracking-wide text-right">Coverage</div>' : ''}
    </div>`;
}

function canarySummary(clusterId) {
  if (!hasCanary(clusterId)) return '';

  const running = currentRunning[clusterId] || {};
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let svcCount = 0;

  for (const s of services) {
    if (!running[s.id]) continue;
    const attempts = attemptsFor(clusterId, s.id);
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

  const passPct = (totalPassed / totalTests * 100);
  const failPct = (totalFailed / totalTests * 100);
  const skipPct = 0;
  const healthLabel = passPct >= 95 ? 'Healthy' : 'At Risk';
  const healthTone = passPct >= 95 ? 'emerald' : 'rose';

  const latestRun = {
    total: totalTests,
    passed: totalPassed,
    failed: totalFailed,
    skipped: 0,
    passPct,
    failPct,
    skipPct,
    executedAt: new Date().toISOString(),
    covered: svcCount,
  };

  return `
    <div class="mb-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div class="flex items-center gap-3">
        <div class="text-sm font-semibold text-slate-200">Canary Tests (latest per service)</div>
        ${badge({ label: healthLabel, tone: healthTone, subtle: true })}
      </div>
      <div class="mt-2">${suiteLatestRow(latestRun)}</div>
      <div class="mt-2 text-xs text-slate-400">${svcCount} service${svcCount !== 1 ? 's' : ''} with canary results</div>
    </div>
  `;
}

function nightlySummary(clusterId) {
  if (!hasNightly(clusterId)) return '';

  // Compute base total from services deployed to this cluster
  const running = currentRunning[clusterId] || {};
  let baseTotal = 0;
  let servicesTotal = 0;
  for (const s of services) {
    if (!running[s.id]) continue;
    servicesTotal++;
    const attempts = attemptsFor(clusterId, s.id);
    const latest = attempts.length ? attempts[attempts.length - 1] : null;
    if (!latest) continue;
    const reg = testRuns.find((t) => t.attemptId === latest.id && t.suiteType === 'REGRESSION');
    if (reg) baseTotal += reg.total;
  }
  if (baseTotal === 0) return '';

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  const nightlyRuns = [];
  const baseDate = new Date('2026-02-05T02:00:00Z');
  const failPcts =  [1.2, 0.0, 3.5, 0.8, 2.1];
  const skipPcts =  [0.5, 0.3, 1.0, 0.0, 0.7];
  const coverages = [12, 15, 13, 15, 14];

  for (let i = 0; i < 5; i++) {
    const h = hashStr(`${clusterId}:night:${i}`);
    const date = new Date(baseDate.getTime() - i * 86400000);
    const dateStr = date.toISOString().slice(0, 10);
    const total = baseTotal + (h % 50) - 25;
    const failPct = failPcts[i];
    const skipPct = skipPcts[i];
    const passPct = 100 - failPct - skipPct;
    const failed = Math.round(total * failPct / 100);
    const skipped = Math.round(total * skipPct / 100);
    const passed = total - failed - skipped;
    const covered = Math.min(coverages[i], servicesTotal);
    nightlyRuns.push({ date: dateStr, total, passed, failed, skipped, passPct, failPct, skipPct, covered });
  }

  const latest = nightlyRuns[0];
  const healthLabel = latest.passPct >= 95 ? 'Healthy' : 'At Risk';
  const healthTone = latest.passPct >= 95 ? 'emerald' : 'rose';
  const expandId = `suite:${clusterId}:nightly`;

  return `
    ${collapsibleSuiteCard('Nightly Regression', healthLabel, healthTone, latest, nightlyRuns, expandId, true)}
    ${collapsibleSuiteCard('Solution Tests', ...clusterSuiteData(clusterId, 'SOLUTION'), `suite:${clusterId}:solution`, false)}
    ${collapsibleSuiteCard('System Tests', ...clusterSuiteData(clusterId, 'SYSTEM'), `suite:${clusterId}:system`, false)}
  `;
}

function clusterSuiteData(clusterId, suiteType) {
  const runs = clusterTestRuns
    .filter((r) => r.clusterId === clusterId && r.suiteType === suiteType)
    .sort((a, b) => b.executedAt.localeCompare(a.executedAt))
    .slice(0, 5);

  if (!runs.length) return ['—', 'slate', null, [], ''];

  const latest = runs[0];
  const latestPassPct = (latest.passed / latest.total) * 100;
  const healthLabel = latestPassPct >= 95 ? 'Healthy' : 'At Risk';
  const healthTone = latestPassPct >= 95 ? 'emerald' : 'rose';
  return [healthLabel, healthTone, latest, runs];
}

function collapsibleSuiteCard(label, healthLabel, healthTone, latest, runs, expandId, showCoverage) {
  if (!latest) return '';

  const escapedId = expandId.replaceAll(':', '_');
  return `
    <div class="mb-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="text-sm font-semibold text-slate-200">${label}</div>
          ${badge({ label: healthLabel, tone: healthTone, subtle: true })}
        </div>
        <button data-expand="${expandId}" class="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 text-xs">Expand</button>
      </div>
      <div class="mt-2">${suiteLatestRow(latest)}</div>
      <div id="${escapedId}" class="hidden mt-3 border-t border-slate-800 pt-3">
        ${suiteHistoryHeader(showCoverage)}
        <div class="flex flex-col gap-1">${suiteHistoryRows(runs, showCoverage)}</div>
      </div>
    </div>
  `;
}

function cssEscape(id) {
  // Safe for using in HTML id attribute and querySelector; we only use our own IDs.
  return id.replaceAll(':', '_');
}

export function renderCluster({ clusterId }) {
  const cluster = getClusterRegion(clusterId);
  if (!cluster) {
    return layout({
      title: 'Cluster not found',
      subtitle: 'Unknown cluster',
      activeNav: 'overview',
      content: emptyState({ title: 'Cluster not found', description: 'Check the URL and try again.' }),
    });
  }

  const content = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        ${badge({ label: cluster.type || '—', tone: 'slate', subtle: true })}
        ${badge({ label: cluster.role || '—', tone: cluster.role === 'Active' ? 'emerald' : cluster.role === 'Hot-standby' ? 'amber' : 'slate', subtle: true })}
      </div>
      <a class="text-sm text-slate-200 hover:underline" href="#/">← Back to overview</a>
    </div>

    ${nightlySummary(clusterId)}
    ${canarySummary(clusterId)}

    <div class="flex items-center gap-2 mb-4">
      ${pillButton({ id: 'filterAll', label: 'All services', active: true })}
      ${pillButton({ id: 'filterIssues', label: 'Only issues', active: false })}
      ${pillButton({ id: 'filterRollback', label: 'Rollbacks', active: false })}
      ${pillButton({ id: 'filterFailed', label: 'Failed', active: false })}
    </div>

    <div class="flex flex-col gap-3" id="servicesWrap">
      ${servicesTable(clusterId, null)}
    </div>
  `;

  const html = layout({
    title: `${cluster.name} (${cluster.type})`,
    subtitle: 'Current running versions with expandable deployment attempt history and gates.',
    activeNav: 'overview',
    content,
  });

  return html;
}

export function bindClusterInteractions({ clusterId }) {
  let statusFilter = null;

  // Read initial filter from URL query string (e.g. ?filter=ROLLBACK)
  const hashParts = window.location.hash.split('?');
  if (hashParts[1]) {
    const params = new URLSearchParams(hashParts[1]);
    const f = params.get('filter');
    if (f === 'ROLLBACK' || f === 'FAILED') statusFilter = f;
  }

  const wrap = document.getElementById('servicesWrap');
  const allBtn = document.getElementById('filterAll');
  const issuesBtn = document.getElementById('filterIssues');
  const rollbackBtn = document.getElementById('filterRollback');
  const failedBtn = document.getElementById('filterFailed');
  const filterBtns = [allBtn, issuesBtn, rollbackBtn, failedBtn];

  function setActive(activeBtn) {
    filterBtns.forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle('bg-slate-200', btn === activeBtn);
      btn.classList.toggle('text-slate-950', btn === activeBtn);
      btn.classList.toggle('bg-slate-800', btn !== activeBtn);
      btn.classList.toggle('text-slate-200', btn !== activeBtn);
    });
  }

  function rerender() {
    wrap.innerHTML = servicesTable(clusterId, statusFilter);
    bindExpands();
  }

  // Apply initial filter from URL
  if (statusFilter === 'ROLLBACK') { setActive(rollbackBtn); rerender(); }
  else if (statusFilter === 'FAILED') { setActive(failedBtn); rerender(); }

  allBtn?.addEventListener('click', () => {
    statusFilter = null;
    setActive(allBtn);
    rerender();
  });
  issuesBtn?.addEventListener('click', () => {
    statusFilter = 'issues';
    setActive(issuesBtn);
    rerender();
  });
  rollbackBtn?.addEventListener('click', () => {
    statusFilter = 'ROLLBACK';
    setActive(rollbackBtn);
    rerender();
  });
  failedBtn?.addEventListener('click', () => {
    statusFilter = 'FAILED';
    setActive(failedBtn);
    rerender();
  });

  function bindExpands() {
    document.querySelectorAll('[data-expand]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-expand');
        if (!id) return;
        const panel = document.getElementById(id.replaceAll(':', '_'));
        if (!panel) return;
        const isHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !isHidden);
        btn.textContent = isHidden ? 'Collapse' : 'Expand';
      });
    });
  }

  bindExpands();
}

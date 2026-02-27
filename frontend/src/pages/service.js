import {
  clusterRegions,
  services,
  currentRunning,
  deploymentAttempts,
  testRuns,
  statusMeta,
  getClusterRegion,
} from '../data.js';
import { layout, sectionCard, badge, fmtDate, emptyState } from '../ui.js';

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

function serviceById(serviceId) {
  return services.find((s) => s.id === serviceId);
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

function allAttemptsForService(serviceId) {
  return deploymentAttempts
    .filter((a) => a.serviceId === serviceId)
    .sort((a, b) => {
      const v = cmpSemver(a.buildVersion, b.buildVersion);
      if (v !== 0) return v;
      return a.startedAt > b.startedAt ? 1 : -1;
    });
}

function allAttemptsTable(serviceId) {
  const attempts = allAttemptsForService(serviceId);
  if (!attempts.length) {
    return `<div class="text-sm text-slate-500">No attempts recorded for this service (mock).</div>`;
  }

  const rows = attempts.slice(0, 50).map((a) => {
    const meta = statusMeta[a.status] || { label: a.status, tone: 'slate' };
    const cluster = getClusterRegion(a.clusterId);
    const runs = testRuns.filter((t) => t.attemptId === a.id);
    const functional = runs.find((r) => r.suiteType === 'FUNCTIONAL');
    const sanity = runs.find((r) => r.suiteType === 'SANITY');
    const regression = runs.find((r) => r.suiteType === 'REGRESSION');

    const gates = [
      functional
        ? badge({
            label: `Functional ${functional.failed > 0 ? 'FAIL' : 'PASS'}`,
            tone: functional.failed > 0 ? 'rose' : 'emerald',
            subtle: true,
          })
        : null,
      sanity
        ? badge({
            label: `Sanity ${sanity.failed > 0 ? 'FAIL' : 'PASS'}`,
            tone: sanity.failed > 0 ? 'rose' : 'emerald',
            subtle: true,
          })
        : null,
      regression
        ? badge({
            label: `Regression ${regression.failed > 0 ? 'FAIL' : 'PASS'}`,
            tone: regression.failed > 0 ? 'rose' : 'violet',
            subtle: true,
          })
        : null,
    ].filter(Boolean);

    return `
      <div class="grid grid-cols-12 gap-3 items-center py-2 border-b border-slate-800 last:border-b-0">
        <div class="col-span-12 md:col-span-3">
          <div class="text-sm font-semibold">${cluster?.name || a.clusterId}</div>
          <div class="text-xs text-slate-400">${cluster?.role ? `${cluster.role} • ` : ''}${cluster?.type || ''}</div>
        </div>

        <div class="col-span-12 md:col-span-3">
          <a class="hover:underline" href="#/builds/${encodeURIComponent(a.id)}">Build <span class="font-mono">v${a.buildVersion}</span></a>
          <div class="text-xs text-slate-400">${fmtDate(a.startedAt)}${a.endedAt ? ` → ${fmtDate(a.endedAt)}` : ''}</div>
        </div>

        <div class="col-span-12 md:col-span-3">
          ${badge({ label: meta.label, tone: meta.tone, subtle: true })}
          ${a.rollbackToBuild ? `<div class="text-xs text-slate-400">Rollback → v${a.rollbackToBuild}</div>` : ''}
          ${a.failureReason ? `<div class="text-xs text-slate-400">${a.failureReason}</div>` : ''}
        </div>

        <div class="col-span-12 md:col-span-3">
          <div class="flex flex-wrap gap-2">${gates.join('') || `<span class=\"text-sm text-slate-500\">No gate data</span>`}</div>
        </div>
      </div>
    `;
  });

  return `<div class="rounded-xl border border-slate-800 bg-slate-900/30 p-2">${rows.join('')}</div>`;
}

function attemptRow(a) {
  const meta = statusMeta[a.status] || { label: a.status, tone: 'slate' };
  const runs = testRuns.filter((t) => t.attemptId === a.id);

  const func = runs.find((r) => r.suiteType === 'FUNCTIONAL');
  const reg = runs.find((r) => r.suiteType === 'REGRESSION');
  const san = runs.find((r) => r.suiteType === 'SANITY');

  const gates = [
    func
      ? badge({ label: `Functional ${func.passed}/${func.total}`, tone: func.failed > 0 ? 'amber' : 'emerald', subtle: true })
      : null,
    reg
      ? badge({ label: `Regression ${reg.passed}/${reg.total}`, tone: reg.failed > 0 ? 'rose' : 'violet', subtle: true })
      : null,
    san
      ? badge({ label: `Sanity ${san.passed}/${san.total}`, tone: san.failed > 0 ? 'rose' : 'emerald', subtle: true })
      : null,
  ].filter(Boolean);

  return `
    <div class="grid grid-cols-12 gap-3 items-center py-2 border-b border-slate-800 last:border-b-0">
      <div class="col-span-12 md:col-span-4">
        <a class="hover:underline" href="#/builds/${encodeURIComponent(a.id)}">Build <span class="font-mono">v${a.buildVersion}</span> <span class="text-slate-500">(${a.gitSha})</span></a>
        <div class="text-xs text-slate-400">${fmtDate(a.startedAt)} → ${fmtDate(a.endedAt)}</div>
      </div>
      <div class="col-span-12 md:col-span-3">
        ${badge({ label: meta.label, tone: meta.tone, subtle: true })}
        ${a.rollbackToBuild ? `<div class="text-xs text-slate-400">Rollback to v${a.rollbackToBuild}</div>` : ''}
      </div>
      <div class="col-span-12 md:col-span-5">
        <div class="flex flex-wrap gap-2">${gates.join('') || `<span class="text-sm text-slate-500">No gate data</span>`}</div>
      </div>
    </div>
  `;
}

function clusterSnapshotCard(clusterId, serviceId) {
  const cluster = getClusterRegion(clusterId);
  const ver = currentRunning[clusterId]?.[serviceId] || '—';
  const attempts = attemptsFor(clusterId, serviceId);
  const latest = attempts.length ? attempts[attempts.length - 1] : null;
  const meta = latest ? statusMeta[latest.status] : null;

  return `
    <a href="#/clusters/${clusterId}" class="block rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 transition">
      <div class="p-4">
        <div class="flex items-center gap-2">
          <div class="text-lg font-semibold">${cluster?.name || clusterId}</div>
          ${badge({ label: cluster?.type || '—', tone: 'slate', subtle: true })}
          ${badge({ label: cluster?.role || '—', tone: cluster?.role === 'Active' ? 'emerald' : cluster?.role === 'Hot-standby' ? 'amber' : 'slate', subtle: true })}
          <div class="flex-1"></div>
          ${latest ? badge({ label: meta.label, tone: meta.tone, subtle: true }) : badge({ label: 'No attempts', tone: 'slate', subtle: true })}
        </div>
        <div class="mt-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
          <div class="text-xs text-slate-400">Current running</div>
          <div class="mt-1 font-mono text-sm">v${ver}</div>
        </div>
        <div class="mt-3 text-sm text-slate-300">Attempts (sample): <span class="font-semibold">${attempts.length}</span></div>
      </div>
    </a>
  `;
}

export function renderService({ serviceId }) {
  const svc = serviceById(serviceId);
  if (!svc) {
    return layout({
      title: 'Service not found',
      subtitle: 'Unknown service',
      activeNav: 'overview',
      content: emptyState({ title: 'Service not found', description: 'Check the service name and try again.' }),
    });
  }

  const content = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${clusterRegions.map((c) => clusterSnapshotCard(c.id, serviceId)).join('')}
    </div>

    <div class="mt-6">
      ${sectionCard({
        title: 'All build attempts (across cluster-regions)',
        right: `<span class="text-xs text-slate-400">Showing latest 50</span>`,
        body: allAttemptsTable(serviceId),
      })}
    </div>

    <div class="mt-6">
      ${sectionCard({
        title: 'Deployment attempts (by cluster)',
        right: `<a class="text-sm text-slate-200 hover:underline" href="#/">Back to overview</a>`,
        body: `
          <div class="flex flex-col gap-4">
            ${clusterRegions
              .map((cr) => {
                const clusterId = cr.id;
                const attempts = attemptsFor(clusterId, serviceId);
                return `
                  <div class="rounded-xl border border-slate-800 bg-slate-950/20">
                    <div class="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
                      <div class="font-semibold">${getClusterRegion(clusterId)?.name || clusterId}</div>
                      ${badge({ label: getClusterRegion(clusterId)?.type || '—', tone: 'slate', subtle: true })}
                      <div class="flex-1"></div>
                      <a class="text-sm hover:underline" href="#/clusters/${clusterId}">View cluster</a>
                    </div>
                    <div class="p-3">
                      ${attempts.length ? `<div class="rounded-xl border border-slate-800 bg-slate-900/30 p-2">${attempts.slice(0, 10).map(attemptRow).join('')}</div>` : `<div class="text-sm text-slate-500">No attempts recorded (mock).</div>`}
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        `,
      })}
    </div>
  `;

  return layout({
    title: `Service: ${svc.name}`,
    subtitle: `Owner: ${svc.owner}. Compare current running versions and drill into attempt evidence.`,
    activeNav: 'overview',
    content,
  });
}

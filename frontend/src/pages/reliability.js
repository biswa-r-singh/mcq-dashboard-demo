import { deploymentAttempts, services, testRuns, statusMeta, suiteMeta } from '../data.js';
import { layout, sectionCard, badge, fmtDate, emptyState } from '../ui.js';

function topRollbacks() {
  return deploymentAttempts
    .filter((a) => a.status === 'ROLLBACK')
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1));
}

function failingNightlies() {
  return testRuns
    .filter((t) => (t.suiteType === 'REGRESSION' || t.suiteType === 'SANITY') && t.failed > 0)
    .sort((a, b) => (a.executedAt < b.executedAt ? 1 : -1));
}

function rollbackRow(a) {
  const svc = services.find((s) => s.id === a.serviceId);
  const meta = statusMeta[a.status] || { label: a.status, tone: 'slate' };
  return `
    <div class="grid grid-cols-12 gap-3 items-center py-2 border-b border-slate-800 last:border-b-0">
      <div class="col-span-12 md:col-span-4">
        <a class="hover:underline" href="#/builds/${encodeURIComponent(a.id)}">${svc?.name || a.serviceId} <span class="font-mono text-slate-300">v${a.buildVersion}</span></a>
        <div class="text-xs text-slate-400">Cluster: ${a.clusterId.toUpperCase()}</div>
      </div>
      <div class="col-span-12 md:col-span-4">
        ${badge({ label: meta.label, tone: meta.tone, subtle: true })}
        <div class="text-xs text-slate-400">Rollback → v${a.rollbackToBuild || '—'}</div>
      </div>
      <div class="col-span-12 md:col-span-4 text-xs text-slate-400">
        ${a.failureReason || '—'}
        <div class="mt-1">${fmtDate(a.endedAt || a.startedAt)}</div>
      </div>
    </div>
  `;
}

function nightlyRow(t) {
  const attempt = deploymentAttempts.find((a) => a.id === t.attemptId);
  const svc = services.find((s) => s.id === attempt?.serviceId);
  const sm = suiteMeta[t.suiteType] || { label: t.suiteType, color: 'slate' };
  return `
    <div class="grid grid-cols-12 gap-3 items-center py-2 border-b border-slate-800 last:border-b-0">
      <div class="col-span-12 md:col-span-4">
        <a class="hover:underline" href="#/builds/${encodeURIComponent(t.attemptId)}">${svc?.name || attempt?.serviceId || '—'} <span class="font-mono text-slate-300">v${attempt?.buildVersion || '—'}</span></a>
        <div class="text-xs text-slate-400">${attempt?.clusterId?.toUpperCase() || '—'}</div>
      </div>
      <div class="col-span-12 md:col-span-4">
        ${badge({ label: sm.label, tone: sm.color, subtle: true })}
        <span class="ml-2">${badge({ label: `${t.failed} failed`, tone: 'rose', subtle: true })}</span>
      </div>
      <div class="col-span-12 md:col-span-4 text-xs text-slate-400">
        ${t.passed}/${t.total} passed • ${fmtDate(t.executedAt)}
      </div>
    </div>
  `;
}

export function renderReliability() {
  const r = topRollbacks();
  const n = failingNightlies();

  const content = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${sectionCard({
        title: 'Recent rollbacks',
        body: r.length
          ? `<div class="rounded-xl border border-slate-800 bg-slate-900/30 p-2">${r.slice(0, 10).map(rollbackRow).join('')}</div>`
          : emptyState({ title: 'No rollbacks found', description: 'Once wired to real deployments, rollbacks will show here.' }),
      })}

      ${sectionCard({
        title: 'Nightly failures (regression/sanity)',
        body: n.length
          ? `<div class="rounded-xl border border-slate-800 bg-slate-900/30 p-2">${n.slice(0, 10).map(nightlyRow).join('')}</div>`
          : emptyState({ title: 'No nightly failures', description: 'Nightly regression/sanity failures will show here.' }),
      })}
    </div>
  `;

  return layout({
    title: 'Reliability',
    subtitle: 'High-signal view for rollbacks and nightly failures.',
    activeNav: 'reliability',
    content,
  });
}

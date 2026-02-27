import {
  deploymentAttempts,
  services,
  clusters,
  testRuns,
  suiteMeta,
  statusMeta,
} from '../data.js';
import { layout, sectionCard, badge, fmtDate, fmtDuration, emptyState } from '../ui.js';

function attemptById(attemptId) {
  return deploymentAttempts.find((a) => a.id === attemptId);
}

function suiteBadge(t) {
  const meta = suiteMeta[t.suiteType] || { label: t.suiteType, color: 'slate' };
  const tone = t.failed > 0 ? 'rose' : meta.color;
  return badge({ label: meta.label, tone, subtle: true });
}

function testTable(runs) {
  if (!runs.length) {
    return `<div class="text-sm text-slate-500">No test runs recorded for this attempt (mock).</div>`;
  }

  return `
    <div class="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
      <div class="grid grid-cols-12 gap-3 px-3 py-2 border-b border-slate-800 text-xs text-slate-400">
        <div class="col-span-4">Suite</div>
        <div class="col-span-3">Result</div>
        <div class="col-span-3">Executed</div>
        <div class="col-span-2 text-right">Report</div>
      </div>
      ${runs
        .map((t) => {
          const resultTone = t.failed > 0 ? 'rose' : 'emerald';
          const result = `${t.passed}/${t.total} passed`;
          const extra = t.failed > 0 ? ` • ${t.failed} failed` : '';
          return `
            <div class="grid grid-cols-12 gap-3 px-3 py-2 border-b border-slate-800 last:border-b-0 items-center">
              <div class="col-span-4 flex items-center gap-2">
                ${suiteBadge(t)}
                <div class="text-sm font-semibold">${t.suiteType}</div>
              </div>
              <div class="col-span-3">
                ${badge({ label: result + extra, tone: resultTone, subtle: true })}
                <div class="text-xs text-slate-400">Duration: ${fmtDuration(t.durationSec)}</div>
              </div>
              <div class="col-span-3 text-xs text-slate-400">${fmtDate(t.executedAt)}</div>
              <div class="col-span-2 text-right">
                <a class="text-sm hover:underline" href="${t.reportUrl || '#'}">Open</a>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

export function renderBuild({ attemptId }) {
  const attempt = attemptById(attemptId);
  if (!attempt) {
    return layout({
      title: 'Build attempt not found',
      subtitle: 'Unknown attempt',
      activeNav: 'overview',
      content: emptyState({ title: 'Attempt not found', description: 'Check the URL and try again.' }),
    });
  }

  const svc = services.find((s) => s.id === attempt.serviceId);
  const cluster = clusters.find((c) => c.id === attempt.clusterId);
  const meta = statusMeta[attempt.status] || { label: attempt.status, tone: 'slate' };

  const runs = testRuns.filter((t) => t.attemptId === attempt.id);
  const content = `
    <div class="flex flex-col gap-4">
      ${sectionCard({
        title: 'Build summary',
        right: `<a class="text-sm text-slate-200 hover:underline" href="#/clusters/${attempt.clusterId}">Back to cluster</a>`,
        body: `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
              <div class="text-xs text-slate-400">Service</div>
              <div class="mt-1 text-lg font-semibold">${svc?.name || attempt.serviceId}</div>
              <div class="text-xs text-slate-400">Owner: ${svc?.owner || '—'}</div>
            </div>
            <div class="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
              <div class="text-xs text-slate-400">Cluster</div>
              <div class="mt-1 text-lg font-semibold">${cluster?.name || attempt.clusterId}</div>
              <div class="text-xs text-slate-400">${cluster?.type || '—'}</div>
            </div>
            <div class="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
              <div class="text-xs text-slate-400">Build</div>
              <div class="mt-1 font-mono text-lg">v${attempt.buildVersion}</div>
              <div class="text-xs text-slate-400">SHA: ${attempt.gitSha}</div>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            ${badge({ label: meta.label, tone: meta.tone, subtle: true })}
            ${badge({ label: `Trigger: ${attempt.trigger}`, tone: 'slate', subtle: true })}
            ${attempt.rollbackToBuild ? badge({ label: `Rollback → v${attempt.rollbackToBuild}`, tone: 'amber', subtle: true }) : ''}
          </div>

          ${attempt.failureReason ? `<div class="mt-2 text-sm text-slate-300"><span class="text-slate-400">Reason:</span> ${attempt.failureReason}</div>` : ''}

          <div class="mt-3 text-xs text-slate-400">${fmtDate(attempt.startedAt)} → ${fmtDate(attempt.endedAt)}</div>
        `,
      })}

      ${sectionCard({
        title: 'Quality gates & test evidence',
        body: testTable(runs),
      })}

      ${sectionCard({
        title: 'Deployment timeline (simplified)',
        body: `
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            ${timelineStep('Build created', 'CI', '—')}
            ${timelineStep('Deploy started', 'CD', fmtDate(attempt.startedAt))}
            ${timelineStep('Gates executed', 'Tests', runs.length ? `${runs.length} suite(s)` : '—')}
            ${timelineStep(attempt.status === 'ROLLBACK' ? 'Rollback executed' : 'Deploy completed', 'Cluster', fmtDate(attempt.endedAt || attempt.startedAt))}
          </div>
        `,
      })}
    </div>
  `;

  return layout({
    title: `Build attempt: ${svc?.name || attempt.serviceId} @ ${cluster?.name || attempt.clusterId}`,
    subtitle: 'Single build drilldown showing status, rollback info, and test suite counts.',
    activeNav: 'overview',
    content,
  });
}

function timelineStep(title, label, value) {
  return `
    <div class="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
      <div class="text-sm font-semibold">${title}</div>
      <div class="mt-1 text-xs text-slate-400">${label}</div>
      <div class="mt-2 text-sm text-slate-200">${value}</div>
    </div>
  `;
}

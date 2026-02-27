import { services, scorecards, scorecardWeights } from '../data.js';
import { layout, sectionCard, badge, emptyState, keyValueGrid } from '../ui.js';

function weightedOverall(sc) {
  const w = scorecardWeights || {};
  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0);
  if (!totalWeight) return 0;
  const sum =
    (sc.gameday ?? 0) * (w.gameday ?? 0) +
    (sc.outages ?? 0) * (w.outages ?? 0) +
    (sc.tests ?? 0) * (w.tests ?? 0) +
    (sc.incidents ?? 0) * (w.incidents ?? 0) +
    (sc.readiness ?? 0) * (w.readiness ?? 0);
  return Math.round(sum / totalWeight);
}

function scoreTone(score) {
  if (score >= 90) return 'emerald';
  if (score >= 80) return 'violet';
  if (score >= 70) return 'amber';
  return 'rose';
}

function bar(label, value) {
  const v = value ?? 0;
  const tone = scoreTone(v);
  const toneMap = {
    emerald: 'bg-emerald-400',
    violet: 'bg-violet-300',
    amber: 'bg-amber-300',
    rose: 'bg-rose-400',
  };

  return `
    <div class="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
      <div class="flex items-center gap-2">
        <div class="text-sm font-semibold">${label}</div>
        <div class="flex-1"></div>
        ${badge({ label: String(v), tone, subtle: true })}
      </div>
      <div class="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div class="h-2 ${toneMap[tone]}" style="width:${Math.max(0, Math.min(100, v))}%"></div>
      </div>
    </div>
  `;
}

function serviceRow(s) {
  const sc = scorecards[s.id];
  if (!sc) {
    return `
      <div class="grid grid-cols-12 gap-3 items-center py-3 border-b border-slate-800 last:border-b-0">
        <div class="col-span-12 md:col-span-4">
          <a class="font-semibold hover:underline" href="#/services/${s.id}">${s.name}</a>
          <div class="text-xs text-slate-400">Owner: ${s.owner}</div>
        </div>
        <div class="col-span-12 md:col-span-8 text-sm text-slate-500">No scorecard data</div>
      </div>
    `;
  }

  const overall = weightedOverall(sc);
  const tone = scoreTone(overall);

  return `
    <div class="grid grid-cols-12 gap-3 items-start py-3 border-b border-slate-800 last:border-b-0">
      <div class="col-span-12 md:col-span-3">
        <a class="font-semibold hover:underline" href="#/services/${s.id}">${s.name}</a>
        <div class="text-xs text-slate-400">Owner: ${s.owner}</div>
        <div class="mt-2">${badge({ label: `Overall ${overall}/100`, tone, subtle: true })}</div>
      </div>

      <div class="col-span-12 md:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${bar('Gameday', sc.gameday)}
        ${bar('Prod outages', sc.outages)}
        ${bar('Solution/System tests', sc.tests)}
        ${bar('Incidents', sc.incidents)}
        ${bar('Prod readiness', sc.readiness)}
      </div>

      <div class="col-span-12 md:col-span-3">
        <div class="text-xs text-slate-400">Notes</div>
        <div class="mt-1 text-sm text-slate-200">${sc.notes || '—'}</div>
      </div>
    </div>
  `;
}

export function renderScorecard() {
  const weights = scorecardWeights || {};

  const content = `
    ${sectionCard({
      title: 'Scoring model',
      body: `
        <div class="text-slate-300">
          Each service is scored out of <span class="font-semibold">100</span> based on production readiness parameters.
          Category scores are normalized 0–100 and combined using weights.
        </div>
        <div class="mt-4">${keyValueGrid([
          { label: 'Gameday', value: `${weights.gameday ?? 0}%` },
          { label: 'Production outages', value: `${weights.outages ?? 0}%` },
          { label: 'Solution/System tests', value: `${weights.tests ?? 0}%` },
          { label: 'Incidents', value: `${weights.incidents ?? 0}%` },
          { label: 'Production readiness', value: `${weights.readiness ?? 0}%` },
        ])}</div>
      `,
    })}

    <div class="mt-4">
      ${sectionCard({
        title: 'Service score cards',
        right: `<a class="text-sm text-slate-200 hover:underline" href="#/">Back to overview</a>`,
        body: services.length
          ? `<div class="rounded-xl border border-slate-800 bg-slate-900/30 px-3">${services
              .map((s) => serviceRow(s))
              .join('')}</div>`
          : emptyState({ title: 'No services configured', description: 'Add services in src/data.js.' }),
      })}
    </div>
  `;

  return layout({
    title: 'Score card',
    subtitle:
      'Per-service scoring (out of 100) driven by gameday performance, production outcomes, test coverage, incidents, and readiness.',
    activeNav: 'scorecard',
    content,
  });
}

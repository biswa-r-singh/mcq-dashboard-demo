export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDuration(seconds) {
  if (seconds == null) return '—';
  const s = Math.max(0, Number(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 1) return `${rem}s`;
  return `${m}m ${rem}s`;
}

export function badge({ label, tone = 'slate', subtle = false }) {
  const map = {
    slate: subtle
      ? 'bg-slate-800/50 text-slate-200 border-slate-700'
      : 'bg-slate-200 text-slate-900 border-slate-200',
    emerald: subtle
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
      : 'bg-emerald-400 text-emerald-950 border-emerald-400',
    rose: subtle
      ? 'bg-rose-500/10 text-rose-200 border-rose-500/20'
      : 'bg-rose-400 text-rose-950 border-rose-400',
    amber: subtle
      ? 'bg-amber-500/10 text-amber-200 border-amber-500/20'
      : 'bg-amber-300 text-amber-950 border-amber-300',
    sky: subtle
      ? 'bg-sky-500/10 text-sky-200 border-sky-500/20'
      : 'bg-sky-300 text-sky-950 border-sky-300',
    violet: subtle
      ? 'bg-violet-500/10 text-violet-200 border-violet-500/20'
      : 'bg-violet-300 text-violet-950 border-violet-300',
  };
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${map[tone] || map.slate}">${label}</span>`;
}

export function layout({ title, subtitle, activeNav, content }) {
  return `
  <div class="min-h-screen">
    <div class="sticky top-0 z-40 bg-slate-950/70 backdrop-blur border-b border-slate-800">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div class="flex items-center gap-2">
          <div class="h-8 w-8 rounded-lg bg-slate-100 text-slate-950 font-black flex items-center justify-center">D</div>
          <div>
            <div class="text-sm font-semibold">Quality Center Dashboard</div>
            <div class="text-xs text-slate-400">UX prototype (mock data)</div>
          </div>
        </div>

        <div class="flex-1"></div>

        <div class="hidden md:flex items-center gap-2 text-sm">
          ${navLink('#/', 'Service Health', activeNav === 'overview')}
          ${navLink('#/versions', 'Version Compare', activeNav === 'versions')}
          ${navLink('#/analytics', 'Analytics', activeNav === 'analytics')}
          ${navLink('#/scorecard', 'Score card', activeNav === 'scorecard')}
        </div>

        <div class="w-px h-6 bg-slate-800 hidden md:block"></div>

        <div class="w-full max-w-sm hidden md:block">
          <input id="globalSearch" placeholder="Search service or build…" class="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-600" />
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="flex flex-col gap-1">
        <div class="text-2xl font-semibold">${title}</div>
        ${subtitle ? `<div class="text-slate-300">${subtitle}</div>` : ''}
      </div>
      <div class="mt-6">${content}</div>
    </div>

    <div class="max-w-7xl mx-auto px-4 pb-10 text-xs text-slate-500">
      Last updated: <span id="lastUpdated"></span>
    </div>
  </div>
  `;
}

function navLink(href, label, active) {
  return `
    <a href="${href}" class="px-3 py-2 rounded-lg border ${
      active
        ? 'bg-slate-100 text-slate-950 border-slate-100'
        : 'bg-slate-900/40 text-slate-200 border-slate-800 hover:bg-slate-900/70'
    }">${label}</a>
  `;
}

export function sectionCard({ title, right, body, className }) {
  return `
    <div class="${cx('rounded-xl border border-slate-800 bg-slate-900/40', className)}">
      <div class="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
        <div class="font-semibold">${title}</div>
        <div class="flex-1"></div>
        ${right || ''}
      </div>
      <div class="p-4">${body}</div>
    </div>
  `;
}

export function keyValueGrid(items) {
  return `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${items
        .map(
          (it) => `
        <div class="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
          <div class="text-xs text-slate-400">${it.label}</div>
          <div class="mt-1 text-lg font-semibold">${it.value}</div>
        </div>
      `,
        )
        .join('')}
    </div>
  `;
}

export function pillButton({ id, label, active }) {
  return `
    <button id="${id}" class="px-3 py-1.5 rounded-full text-sm border ${
      active
        ? 'bg-slate-100 text-slate-950 border-slate-100'
        : 'bg-slate-900/40 text-slate-200 border-slate-800 hover:bg-slate-900/70'
    }">${label}</button>
  `;
}

export function emptyState({ title, description }) {
  return `
    <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <div class="text-lg font-semibold">${title}</div>
      <div class="mt-1 text-slate-300">${description}</div>
    </div>
  `;
}

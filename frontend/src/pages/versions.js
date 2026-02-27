import {
  services,
  currentRunning,
  jiraTickets,
} from '../data.js';
import { layout, sectionCard, badge } from '../ui.js';

/* ── Semver helpers ────────────────────────────────────────── */
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

/* ── Version matrix row ────────────────────────────────────── */
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
        <div class="flex items-center gap-2">
          <a href="#/services/${serviceId}" class="font-semibold hover:underline">${svc?.name || serviceId}</a>
          <button class="compare-btn rounded-md bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 text-[10px] px-2 py-0.5 font-medium transition"
            data-svc="${serviceId}"
            data-mira-w="${miraW}" data-mira-e="${miraE}"
            data-pavo-w="${pavoW}" data-pavo-e="${pavoE}"
            data-aquila-w="${aquilaW}" data-aquila-e="${aquilaE}"
          >Compare</button>
        </div>
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
    <div class="col-span-4 md:col-span-3 rounded-xl border border-slate-800 bg-slate-950/30 p-2">
      <div class="text-[11px] text-slate-400">${label}</div>
      <div class="mt-1 text-[11px] text-slate-400">${r1}</div>
      <div class="font-mono text-sm">v${v1}</div>
      <div class="mt-1 text-[11px] text-slate-400">${r2}</div>
      <div class="font-mono text-sm">v${v2}</div>
    </div>
  `;
}

/* ── Cluster options for dropdowns ──────────────────────────── */
const clusterOptions = [
  { value: 'mira-w', label: 'Mira (us-west-2)', key: 'mira-us-west-2' },
  { value: 'mira-e', label: 'Mira (us-east-2)', key: 'mira-us-east-2' },
  { value: 'pavo-w', label: 'Pavo (us-west-2)', key: 'pavo-us-west-2' },
  { value: 'pavo-e', label: 'Pavo (us-east-2)', key: 'pavo-us-east-2' },
  { value: 'aquila-w', label: 'Aquila (us-west-2)', key: 'aquila-us-west-2' },
  { value: 'aquila-e', label: 'Aquila (us-east-2)', key: 'aquila-us-east-2' },
  { value: 'custom', label: 'Custom version', key: null },
];

function clusterSelect(id, defaultVal) {
  return `<select id="${id}" class="rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-200 px-3 py-1.5 w-52">
    ${clusterOptions.map((o) => `<option value="${o.value}" ${o.value === defaultVal ? 'selected' : ''}>${o.label}</option>`).join('')}
  </select>`;
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
          <label class="block text-[11px] text-slate-400 mb-1">From cluster</label>
          ${clusterSelect('jiraFromCluster', 'mira-w')}
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">From version</label>
          <input id="jiraFrom" type="text" placeholder="auto-filled or custom" class="rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-200 px-3 py-1.5 w-32 font-mono" />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">To cluster</label>
          ${clusterSelect('jiraToCluster', 'pavo-w')}
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">To version</label>
          <input id="jiraTo" type="text" placeholder="auto-filled or custom" class="rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-200 px-3 py-1.5 w-32 font-mono" />
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

/* ── Page render ───────────────────────────────────────────── */
export function renderVersions() {
  const content = `
    <div class="flex flex-col gap-6">
      ${sectionCard({
        title: 'Cross-Cluster Version Matrix',
        right: `<span class="text-xs text-slate-400">${services.length} services</span>`,
        body: services.map((s) => pipelineRow(s.id)).join(''),
      })}

      ${jiraComparePanel()}
    </div>
  `;

  return layout({
    title: 'Version Comparison',
    subtitle: 'Compare service versions across all clusters and regions. Look up Jira tickets between releases.',
    activeNav: 'versions',
    content,
  });
}

/* ── Helper: resolve version from cluster dropdown ─────────── */
function resolveVersion(clusterDropdownId, serviceId) {
  const sel = document.getElementById(clusterDropdownId);
  if (!sel) return '';
  const opt = clusterOptions.find((o) => o.value === sel.value);
  if (!opt || !opt.key) return ''; // custom — leave editable
  return currentRunning[opt.key]?.[serviceId] || '';
}

function syncVersionFields() {
  const serviceId = document.getElementById('jiraService')?.value;
  if (!serviceId) return;

  const fromCluster = document.getElementById('jiraFromCluster');
  const toCluster = document.getElementById('jiraToCluster');
  const fromInput = document.getElementById('jiraFrom');
  const toInput = document.getElementById('jiraTo');

  if (fromCluster?.value !== 'custom' && fromInput) {
    fromInput.value = resolveVersion('jiraFromCluster', serviceId);
  }
  if (toCluster?.value !== 'custom' && toInput) {
    toInput.value = resolveVersion('jiraToCluster', serviceId);
  }
}

export function bindVersionsInteractions() {
  // Sync versions when cluster dropdowns or service changes
  ['jiraFromCluster', 'jiraToCluster', 'jiraService'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', syncVersionFields);
  });

  // Initial sync
  syncVersionFields();

  // Jira search
  const btn = document.getElementById('jiraSearch');
  if (btn) {
    btn.addEventListener('click', () => {
      const serviceId = document.getElementById('jiraService')?.value;
      const fromVer = document.getElementById('jiraFrom')?.value?.trim();
      const toVer = document.getElementById('jiraTo')?.value?.trim();
      const resultsDiv = document.getElementById('jiraResults');
      if (!resultsDiv) return;

      if (!fromVer || !toVer) {
        resultsDiv.innerHTML = '<div class="text-sm text-rose-400 py-2">Please enter both From and To versions.</div>';
        return;
      }

      resultsDiv.innerHTML = renderJiraResults(serviceId, fromVer, toVer);
    });
  }

  // Compare buttons in matrix rows
  document.querySelectorAll('.compare-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const svcId = btn.dataset.svc;

      // Set service
      const svcSelect = document.getElementById('jiraService');
      if (svcSelect) svcSelect.value = svcId;

      // Default: compare Mira (from) → Pavo (to)
      const fromCluster = document.getElementById('jiraFromCluster');
      const toCluster = document.getElementById('jiraToCluster');
      if (fromCluster) fromCluster.value = 'mira-w';
      if (toCluster) toCluster.value = 'pavo-w';

      // Sync version fields
      syncVersionFields();

      // Scroll to Jira panel and auto-search
      const panel = document.getElementById('jiraPanel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Auto-trigger search
      const fromVer = document.getElementById('jiraFrom')?.value?.trim();
      const toVer = document.getElementById('jiraTo')?.value?.trim();
      const resultsDiv = document.getElementById('jiraResults');
      if (resultsDiv && fromVer && toVer) {
        resultsDiv.innerHTML = renderJiraResults(svcId, fromVer, toVer);
      }
    });
  });
}

const routes = [];

export function addRoute(pattern, handler) {
  // pattern example: /^#\/clusters\/(mira|pavo|aquila)$/
  routes.push({ pattern, handler });
}

export function navigate(hash) {
  if (window.location.hash === hash) {
    render();
    return;
  }
  window.location.hash = hash;
}

export function getHash() {
  return window.location.hash || '#/';
}

export function render() {
  const hash = getHash();
  for (const r of routes) {
    const match = hash.match(r.pattern);
    if (match) return r.handler({ hash, match });
  }
  // Default fallback
  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center">
      <div class="max-w-xl w-full p-6 bg-slate-900/60 border border-slate-800 rounded-xl">
        <div class="text-xl font-semibold">Page not found</div>
        <div class="mt-2 text-slate-300">Unknown route: <span class="font-mono">${escapeHtml(hash)}</span></div>
        <button id="goHome" class="mt-4 px-3 py-2 rounded-lg bg-slate-100 text-slate-950 font-medium">Go Home</button>
      </div>
    </div>
  `;
  root.querySelector('#goHome')?.addEventListener('click', () => navigate('#/'));
}

export function startRouter() {
  window.addEventListener('hashchange', () => render());
  render();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

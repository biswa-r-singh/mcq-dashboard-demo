import { layout, sectionCard, badge } from '../ui.js';

/* ── Helper: render a box in the diagram ───────────────────── */
function box({ label, sub, tone = 'slate', icon = '', width = 'w-48' }) {
  const toneMap = {
    slate: 'border-slate-700 bg-slate-900/60',
    emerald: 'border-emerald-500/30 bg-emerald-500/10',
    sky: 'border-sky-500/30 bg-sky-500/10',
    amber: 'border-amber-500/30 bg-amber-500/10',
    violet: 'border-violet-500/30 bg-violet-500/10',
    rose: 'border-rose-500/30 bg-rose-500/10',
    indigo: 'border-indigo-500/30 bg-indigo-500/10',
  };
  const cls = toneMap[tone] || toneMap.slate;
  return `
    <div class="${width} rounded-xl border ${cls} p-3 text-center">
      ${icon ? `<div class="text-lg mb-1">${icon}</div>` : ''}
      <div class="text-sm font-semibold text-slate-100">${label}</div>
      ${sub ? `<div class="text-[11px] text-slate-400 mt-0.5">${sub}</div>` : ''}
    </div>
  `;
}

function arrow(direction = 'down', label = '') {
  const arrows = {
    down: '↓',
    up: '↑',
    right: '→',
    left: '←',
    bidir: '⇅',
  };
  return `
    <div class="flex flex-col items-center py-1">
      <div class="text-slate-500 text-lg leading-none">${arrows[direction] || '↓'}</div>
      ${label ? `<div class="text-[10px] text-slate-500">${label}</div>` : ''}
    </div>
  `;
}

function connector(label = '') {
  return `
    <div class="flex items-center gap-1 px-2">
      <div class="h-px flex-1 bg-slate-700"></div>
      ${label ? `<div class="text-[10px] text-slate-500 whitespace-nowrap">${label}</div>` : ''}
      <div class="h-px flex-1 bg-slate-700"></div>
    </div>
  `;
}

function docSection({ id, title, content }) {
  return `
    <div id="${id}" class="scroll-mt-24">
      ${sectionCard({ title, body: content })}
    </div>
  `;
}

function tocItem(id, label) {
  return `<a href="#/architecture#${id}" class="block px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800/50 rounded-lg transition">${label}</a>`;
}

/* ── Main render ───────────────────────────────────────────── */
export function renderArchitecture() {
  const toc = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-4 sticky top-24">
      <div class="text-xs text-slate-500 uppercase tracking-wide mb-2">Contents</div>
      ${tocItem('overview', '1. System Overview')}
      ${tocItem('high-level', '2. High-Level Architecture')}
      ${tocItem('data-sources', '3. Data Sources & Ingestion')}
      ${tocItem('backend', '4. Backend Service Design')}
      ${tocItem('frontend', '5. Frontend Service Design')}
      ${tocItem('aws-infra', '6. AWS Infrastructure')}
      ${tocItem('data-model', '7. Data Model')}
      ${tocItem('api-contracts', '8. API Contracts')}
      ${tocItem('cicd', '9. CI/CD Pipeline')}
      ${tocItem('security', '10. Security & Access Control')}
      ${tocItem('observability', '11. Observability')}
      ${tocItem('rollout', '12. Implementation Roadmap')}
    </div>
  `;

  const sections = `
    <div class="flex flex-col gap-6">

    ${docSection({
      id: 'overview',
      title: '1. System Overview',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed space-y-3">
          <p>The <strong>Deployment &amp; Quality Dashboard</strong> provides a unified view of service deployments, test results, and cluster health across all environments (Mira/QA, Pavo/Stage, Aquila/Production). It is designed as a <strong>two-service microservice architecture</strong> deployed on Kubernetes within an AWS VPC.</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div class="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <div class="flex items-center gap-2 mb-2">
                ${badge({ label: 'Frontend Service', tone: 'sky', subtle: true })}
              </div>
              <div class="text-sm text-slate-300">React SPA served via Nginx. Renders all UI components — overview cards, cluster detail pages, analytics charts, and this architecture doc. Calls the Backend API for all data.</div>
            </div>
            <div class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div class="flex items-center gap-2 mb-2">
                ${badge({ label: 'Backend Service', tone: 'emerald', subtle: true })}
              </div>
              <div class="text-sm text-slate-300">Go/Python REST API. Aggregates data from Kubernetes APIs, CI/CD pipelines, test runners, and Jira. Stores normalized data in PostgreSQL and exposes it via versioned REST endpoints.</div>
            </div>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'high-level',
      title: '2. High-Level Architecture Diagram',
      content: `
        <div class="overflow-x-auto">
          <div class="min-w-[700px] flex flex-col items-center gap-1 py-4">

            <!-- Users -->
            <div class="flex items-center gap-4">
              ${box({ label: 'Engineers / SREs', sub: 'Browser', tone: 'slate', icon: '👤' })}
            </div>
            ${arrow('down', 'HTTPS')}

            <!-- ALB -->
            ${box({ label: 'AWS ALB', sub: 'Application Load Balancer', tone: 'amber', icon: '⚖️', width: 'w-64' })}
            ${arrow('down', 'Path-based routing')}

            <!-- Services row -->
            <div class="flex items-center gap-6">
              <div class="flex flex-col items-center">
                ${box({ label: 'Frontend Service', sub: 'React SPA + Nginx\nK8s Deployment', tone: 'sky', icon: '🖥️' })}
                <div class="text-[10px] text-slate-500 mt-1">/  →  static assets</div>
              </div>
              <div class="text-slate-600 text-2xl">|</div>
              <div class="flex flex-col items-center">
                ${box({ label: 'Backend API', sub: 'Go/Python\nK8s Deployment', tone: 'emerald', icon: '⚙️' })}
                <div class="text-[10px] text-slate-500 mt-1">/api/*  →  REST endpoints</div>
              </div>
            </div>

            ${arrow('down', 'Internal cluster network')}

            <!-- Data stores row -->
            <div class="flex items-center gap-4">
              ${box({ label: 'PostgreSQL (RDS)', sub: 'Primary datastore', tone: 'violet', icon: '🗄️' })}
              ${box({ label: 'Redis (ElastiCache)', sub: 'Cache + sessions', tone: 'rose', icon: '⚡' })}
              ${box({ label: 'S3', sub: 'Test reports &\nartifact storage', tone: 'amber', icon: '📦' })}
            </div>

            ${arrow('up', 'Ingestion workers poll / webhook')}

            <!-- External sources -->
            <div class="flex flex-wrap items-center justify-center gap-3 mt-2">
              ${box({ label: 'Kubernetes API', sub: 'Cluster state\n& deployments', tone: 'sky', icon: '☸️', width: 'w-36' })}
              ${box({ label: 'Melody / ArgoCD', sub: 'CI/CD pipeline\nevents', tone: 'emerald', icon: '🔄', width: 'w-36' })}
              ${box({ label: 'Test Runners', sub: 'FT, Nightly,\nCanary, Solution', tone: 'amber', icon: '🧪', width: 'w-36' })}
              ${box({ label: 'Jira API', sub: 'Tickets &\nchangelogs', tone: 'indigo', icon: '📋', width: 'w-36' })}
              ${box({ label: 'Vault', sub: 'Secrets &\ncredentials', tone: 'rose', icon: '🔐', width: 'w-36' })}
            </div>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'data-sources',
      title: '3. Data Sources & Ingestion',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed">
          <p class="mb-4">The Backend Service ingests data from multiple sources using a combination of <strong>webhook receivers</strong> and <strong>periodic polling workers</strong>:</p>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-700">
                  <th class="text-left py-2 px-3 text-slate-400 font-medium">Source</th>
                  <th class="text-left py-2 px-3 text-slate-400 font-medium">Data</th>
                  <th class="text-left py-2 px-3 text-slate-400 font-medium">Ingestion Method</th>
                  <th class="text-left py-2 px-3 text-slate-400 font-medium">Frequency</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-slate-800">
                  <td class="py-2 px-3 font-medium text-sky-400">Kubernetes API</td>
                  <td class="py-2 px-3">Deployment status, pod health, running versions, replica counts</td>
                  <td class="py-2 px-3">${badge({ label: 'Watch API', tone: 'sky', subtle: true })}</td>
                  <td class="py-2 px-3 text-slate-400">Real-time (watch stream)</td>
                </tr>
                <tr class="border-b border-slate-800">
                  <td class="py-2 px-3 font-medium text-emerald-400">Melody / ArgoCD</td>
                  <td class="py-2 px-3">Build versions, deployment attempts, rollbacks, promotion events</td>
                  <td class="py-2 px-3">${badge({ label: 'Webhook', tone: 'emerald', subtle: true })}</td>
                  <td class="py-2 px-3 text-slate-400">Event-driven</td>
                </tr>
                <tr class="border-b border-slate-800">
                  <td class="py-2 px-3 font-medium text-amber-400">Test Runners</td>
                  <td class="py-2 px-3">FT results, nightly regression, canary, solution &amp; system test suites</td>
                  <td class="py-2 px-3">${badge({ label: 'Webhook + S3', tone: 'amber', subtle: true })}</td>
                  <td class="py-2 px-3 text-slate-400">On completion + nightly</td>
                </tr>
                <tr class="border-b border-slate-800">
                  <td class="py-2 px-3 font-medium text-indigo-400">Jira API</td>
                  <td class="py-2 px-3">Tickets between versions, release notes, changelog</td>
                  <td class="py-2 px-3">${badge({ label: 'REST Poll', tone: 'violet', subtle: true })}</td>
                  <td class="py-2 px-3 text-slate-400">Every 15 min + on-demand</td>
                </tr>
                <tr class="border-b border-slate-800">
                  <td class="py-2 px-3 font-medium text-rose-400">Vault</td>
                  <td class="py-2 px-3">API keys, DB credentials, service account tokens</td>
                  <td class="py-2 px-3">${badge({ label: 'Agent Inject', tone: 'rose', subtle: true })}</td>
                  <td class="py-2 px-3 text-slate-400">Pod startup (injected)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'backend',
      title: '4. Backend Service Design',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed space-y-4">
          <p>The backend is a single deployable microservice with clear internal modules:</p>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">API Layer</div>
              <ul class="text-xs text-slate-400 space-y-1">
                <li>• RESTful endpoints (versioned: /api/v1/*)</li>
                <li>• Request validation &amp; auth middleware</li>
                <li>• Rate limiting (per-user token bucket)</li>
                <li>• OpenAPI/Swagger documentation</li>
                <li>• CORS configured for frontend origin</li>
              </ul>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Ingestion Workers</div>
              <ul class="text-xs text-slate-400 space-y-1">
                <li>• K8s watcher (informer pattern)</li>
                <li>• Webhook receiver (Melody callbacks)</li>
                <li>• Test result parser (JUnit XML / JSON)</li>
                <li>• Jira sync worker (periodic cron)</li>
                <li>• S3 report fetcher</li>
              </ul>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Data Layer</div>
              <ul class="text-xs text-slate-400 space-y-1">
                <li>• PostgreSQL via connection pool</li>
                <li>• Redis for caching &amp; rate limits</li>
                <li>• Database migrations (Flyway/Alembic)</li>
                <li>• Read replicas for dashboard queries</li>
                <li>• S3 client for report storage</li>
              </ul>
            </div>
          </div>

          <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-4 mt-4">
            <div class="font-semibold text-slate-100 mb-2">Tech Stack Options</div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div><span class="text-slate-400">Language:</span> <span class="text-emerald-400">Go (preferred)</span> or Python (FastAPI)</div>
              <div><span class="text-slate-400">Framework:</span> <span class="text-emerald-400">Gin / Echo</span> or FastAPI</div>
              <div><span class="text-slate-400">ORM:</span> <span class="text-emerald-400">sqlc / GORM</span> or SQLAlchemy</div>
              <div><span class="text-slate-400">Migrations:</span> golang-migrate or Alembic</div>
              <div><span class="text-slate-400">Container:</span> Distroless base image</div>
              <div><span class="text-slate-400">K8s Client:</span> client-go / kubernetes python client</div>
            </div>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'frontend',
      title: '5. Frontend Service Design',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed space-y-4">
          <p>The frontend is a <strong>React SPA</strong> served by Nginx, packaged as a container image and deployed as a Kubernetes Deployment.</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Application Stack</div>
              <ul class="text-xs text-slate-400 space-y-1">
                <li>• <strong>React 18+</strong> with TypeScript</li>
                <li>• <strong>TailwindCSS</strong> for styling</li>
                <li>• <strong>React Router</strong> for client-side routing</li>
                <li>• <strong>TanStack Query</strong> for data fetching &amp; caching</li>
                <li>• <strong>Recharts / D3</strong> for analytics charts</li>
                <li>• <strong>Vite</strong> for build tooling</li>
              </ul>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Deployment</div>
              <ul class="text-xs text-slate-400 space-y-1">
                <li>• Multi-stage Docker build (node → nginx)</li>
                <li>• Nginx serves static assets + proxies /api/* to backend</li>
                <li>• Environment config via window.__ENV__ injection</li>
                <li>• Gzip/Brotli compression enabled</li>
                <li>• Cache headers: immutable for hashed assets</li>
                <li>• Health check: /healthz returns 200</li>
              </ul>
            </div>
          </div>

          <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <div class="font-semibold text-slate-100 mb-2">Pages → API Mapping</div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b border-slate-700">
                    <th class="text-left py-1.5 px-2 text-slate-400">Page</th>
                    <th class="text-left py-1.5 px-2 text-slate-400">API Endpoints Used</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-slate-800"><td class="py-1.5 px-2">Executive Overview</td><td class="py-1.5 px-2 font-mono text-sky-400">GET /api/v1/clusters, GET /api/v1/clusters/{id}/summary</td></tr>
                  <tr class="border-b border-slate-800"><td class="py-1.5 px-2">Cluster Detail</td><td class="py-1.5 px-2 font-mono text-sky-400">GET /api/v1/clusters/{id}/services, GET /api/v1/clusters/{id}/test-suites</td></tr>
                  <tr class="border-b border-slate-800"><td class="py-1.5 px-2">Service Detail</td><td class="py-1.5 px-2 font-mono text-sky-400">GET /api/v1/services/{id}/attempts, GET /api/v1/services/{id}/tests</td></tr>
                  <tr class="border-b border-slate-800"><td class="py-1.5 px-2">Build Detail</td><td class="py-1.5 px-2 font-mono text-sky-400">GET /api/v1/attempts/{id}, GET /api/v1/attempts/{id}/tests</td></tr>
                  <tr class="border-b border-slate-800"><td class="py-1.5 px-2">Version Matrix</td><td class="py-1.5 px-2 font-mono text-sky-400">GET /api/v1/services/versions</td></tr>
                  <tr class="border-b border-slate-800"><td class="py-1.5 px-2">Jira Compare</td><td class="py-1.5 px-2 font-mono text-sky-400">GET /api/v1/services/{id}/jira?from=x&amp;to=y</td></tr>
                  <tr class="border-b border-slate-800"><td class="py-1.5 px-2">Analytics</td><td class="py-1.5 px-2 font-mono text-sky-400">GET /api/v1/analytics/deployments, GET /api/v1/analytics/tests</td></tr>
                  <tr class="border-b border-slate-800"><td class="py-1.5 px-2">Score Card</td><td class="py-1.5 px-2 font-mono text-sky-400">GET /api/v1/scorecards</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'aws-infra',
      title: '6. AWS Infrastructure',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed space-y-4">
          <p>All components run within an <strong>AWS VPC</strong> with public and private subnets across multiple AZs.</p>

          <div class="overflow-x-auto">
            <div class="min-w-[700px] rounded-2xl border-2 border-dashed border-slate-600 p-6">
              <div class="text-xs text-slate-500 uppercase tracking-wide mb-4">AWS VPC (10.0.0.0/16)</div>

              <!-- Public subnet -->
              <div class="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-4">
                <div class="text-xs text-amber-400 font-semibold mb-3">Public Subnets (10.0.1.0/24, 10.0.2.0/24)</div>
                <div class="flex items-center gap-4">
                  ${box({ label: 'ALB', sub: 'HTTPS termination\nPath routing', tone: 'amber', icon: '⚖️', width: 'w-44' })}
                  ${box({ label: 'NAT Gateway', sub: 'Outbound internet\nfor private subnets', tone: 'amber', icon: '🌐', width: 'w-44' })}
                  ${box({ label: 'Route 53', sub: 'DNS\ndashboard.example.com', tone: 'amber', icon: '🔗', width: 'w-44' })}
                </div>
              </div>

              <!-- Private subnet -->
              <div class="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 mb-4">
                <div class="text-xs text-sky-400 font-semibold mb-3">Private Subnets (10.0.10.0/24, 10.0.11.0/24)</div>
                <div class="flex flex-wrap items-start gap-4">
                  <div class="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 flex-1 min-w-[280px]">
                    <div class="text-xs text-sky-300 font-semibold mb-2">EKS Cluster</div>
                    <div class="flex flex-wrap gap-2">
                      ${box({ label: 'Frontend Pod', sub: '2 replicas', tone: 'sky', width: 'w-28' })}
                      ${box({ label: 'Backend Pod', sub: '3 replicas', tone: 'emerald', width: 'w-28' })}
                      ${box({ label: 'Vault Agent', sub: 'Sidecar', tone: 'rose', width: 'w-28' })}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Data subnet -->
              <div class="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <div class="text-xs text-violet-400 font-semibold mb-3">Data Subnets (10.0.20.0/24, 10.0.21.0/24)</div>
                <div class="flex items-center gap-4">
                  ${box({ label: 'RDS PostgreSQL', sub: 'Multi-AZ\ndb.r6g.large', tone: 'violet', icon: '🗄️', width: 'w-44' })}
                  ${box({ label: 'ElastiCache Redis', sub: 'Cluster mode\ncache.r6g.large', tone: 'rose', icon: '⚡', width: 'w-44' })}
                  ${box({ label: 'S3 Bucket', sub: 'Test reports\n& artifacts', tone: 'amber', icon: '📦', width: 'w-44' })}
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <div class="font-semibold text-slate-100 mb-2">Infrastructure as Code</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div class="space-y-1">
                <div class="font-medium text-slate-200">Terraform Modules</div>
                <ul class="text-slate-400 space-y-0.5">
                  <li>• <span class="text-sky-400 font-mono">module/vpc</span> — VPC, subnets, NAT, IGW</li>
                  <li>• <span class="text-sky-400 font-mono">module/eks</span> — EKS cluster, node groups, IRSA</li>
                  <li>• <span class="text-sky-400 font-mono">module/rds</span> — PostgreSQL, parameter groups, backups</li>
                  <li>• <span class="text-sky-400 font-mono">module/elasticache</span> — Redis cluster</li>
                  <li>• <span class="text-sky-400 font-mono">module/alb</span> — ALB, target groups, ACM certs</li>
                  <li>• <span class="text-sky-400 font-mono">module/s3</span> — Bucket policies, lifecycle rules</li>
                </ul>
              </div>
              <div class="space-y-1">
                <div class="font-medium text-slate-200">Helm Charts</div>
                <ul class="text-slate-400 space-y-0.5">
                  <li>• <span class="text-emerald-400 font-mono">charts/frontend</span> — Deployment, Service, Ingress, HPA</li>
                  <li>• <span class="text-emerald-400 font-mono">charts/backend</span> — Deployment, Service, Ingress, HPA, CronJobs</li>
                  <li>• <span class="text-emerald-400 font-mono">charts/migrations</span> — Job for DB migrations</li>
                  <li>• Vault annotations for secret injection</li>
                  <li>• PodDisruptionBudgets for HA</li>
                  <li>• NetworkPolicies for pod isolation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'data-model',
      title: '7. Data Model',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed space-y-4">
          <p>Core PostgreSQL tables that power the dashboard:</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${['clusters — id, base_id, region, type, role, description',
              'services — id, name, owner, tier, app_id',
              'deployment_attempts — id, cluster_id, service_id, build_version, git_sha, status, started_at, ended_at, rollback_to_build',
              'test_runs — id, attempt_id, cluster_id, suite_type (FUNCTIONAL|REGRESSION|CANARY|SOLUTION|SYSTEM), total, passed, failed, skipped, duration_sec, executed_at, report_url',
              'cluster_test_runs — id, cluster_id, suite_type, total, passed, failed, skipped, executed_at',
              'jira_tickets — id, service_id, key, summary, type, priority, version, status',
              'current_versions — cluster_id, service_id, version (materialized view)',
              'scorecards — service_id, category, score, updated_at',
            ].map((t) => {
              const [name, ...cols] = t.split(' — ');
              return `
                <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                  <div class="font-mono text-sm font-semibold text-violet-400 mb-1">${name}</div>
                  <div class="text-xs text-slate-400">${cols.join('')}</div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <div class="font-semibold text-slate-100 mb-1">Key Indexes</div>
            <ul class="text-xs text-slate-400 space-y-0.5">
              <li>• <span class="font-mono text-sky-400">deployment_attempts(cluster_id, service_id, started_at DESC)</span></li>
              <li>• <span class="font-mono text-sky-400">test_runs(attempt_id, suite_type)</span></li>
              <li>• <span class="font-mono text-sky-400">cluster_test_runs(cluster_id, suite_type, executed_at DESC)</span></li>
              <li>• <span class="font-mono text-sky-400">jira_tickets(service_id, version)</span></li>
            </ul>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'api-contracts',
      title: '8. API Contracts',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed">
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-slate-700">
                  <th class="text-left py-2 px-2 text-slate-400">Method</th>
                  <th class="text-left py-2 px-2 text-slate-400">Endpoint</th>
                  <th class="text-left py-2 px-2 text-slate-400">Description</th>
                  <th class="text-left py-2 px-2 text-slate-400">Response</th>
                </tr>
              </thead>
              <tbody>
                ${[
                  ['GET', '/api/v1/clusters', 'List all cluster-regions with health summary', '[ { id, name, type, role, summary } ]'],
                  ['GET', '/api/v1/clusters/{id}/services', 'Services in a cluster with latest attempt &amp; test results', '[ { service, version, attempt, ft, nightly|canary } ]'],
                  ['GET', '/api/v1/clusters/{id}/test-suites', 'Nightly/Solution/System/Canary aggregate runs', '[ { suiteType, runs: [...] } ]'],
                  ['GET', '/api/v1/services', 'List all services', '[ { id, name, owner, tier } ]'],
                  ['GET', '/api/v1/services/versions', 'Cross-cluster version matrix', '{ serviceId: { clusterId: version } }'],
                  ['GET', '/api/v1/services/{id}/attempts', 'Deployment history for a service', '[ { attempt with tests } ]'],
                  ['GET', '/api/v1/services/{id}/jira?from=x&to=y', 'Jira tickets between two versions', '[ { key, summary, type, priority } ]'],
                  ['GET', '/api/v1/attempts/{id}', 'Single attempt detail', '{ attempt, tests, logs }'],
                  ['GET', '/api/v1/analytics/deployments', 'Deployment frequency &amp; MTTR metrics', '{ daily: [...], mttr: ... }'],
                  ['GET', '/api/v1/scorecards', 'Reliability scorecards for all services', '{ serviceId: { scores } }'],
                  ['POST', '/api/v1/webhooks/melody', 'Receive deployment event callbacks', '202 Accepted'],
                  ['POST', '/api/v1/webhooks/test-results', 'Receive test completion callbacks', '202 Accepted'],
                ].map(([method, path, desc, resp]) => `
                  <tr class="border-b border-slate-800">
                    <td class="py-1.5 px-2">${badge({ label: method, tone: method === 'POST' ? 'amber' : 'emerald', subtle: true })}</td>
                    <td class="py-1.5 px-2 font-mono text-sky-400">${path}</td>
                    <td class="py-1.5 px-2 text-slate-300">${desc}</td>
                    <td class="py-1.5 px-2 text-slate-400 font-mono">${resp}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'cicd',
      title: '9. CI/CD Pipeline',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed space-y-4">
          <p>Both services follow the same pipeline pattern, deployed via <strong>Melody</strong> (or ArgoCD):</p>

          <div class="flex flex-wrap items-center gap-2 justify-center py-4">
            ${['PR Merge', 'Build Image', 'Push to ECR', 'Deploy to Mira (QA)', 'Run FT', 'Promote to Pavo', 'Run Nightly', 'Promote to Aquila', 'Run Canary'].map((step, i) => `
              ${i > 0 ? '<div class="text-slate-600">→</div>' : ''}
              <div class="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200">${step}</div>
            `).join('')}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Frontend Pipeline</div>
              <ul class="text-xs text-slate-400 space-y-0.5">
                <li>1. Lint + type-check (ESLint, tsc)</li>
                <li>2. Unit tests (Vitest)</li>
                <li>3. Build (Vite → dist/)</li>
                <li>4. Docker build (nginx + dist)</li>
                <li>5. Push to ECR</li>
                <li>6. Helm upgrade via Melody</li>
              </ul>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Backend Pipeline</div>
              <ul class="text-xs text-slate-400 space-y-0.5">
                <li>1. Lint + static analysis (golangci-lint / ruff)</li>
                <li>2. Unit tests + coverage</li>
                <li>3. Build binary (Go) or wheel (Python)</li>
                <li>4. Docker build (distroless base)</li>
                <li>5. Push to ECR</li>
                <li>6. Run DB migrations (K8s Job)</li>
                <li>7. Helm upgrade via Melody</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'security',
      title: '10. Security & Access Control',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Authentication</div>
              <ul class="text-xs text-slate-400 space-y-0.5">
                <li>• SSO via corporate OIDC / SAML (PingFed)</li>
                <li>• JWT tokens with short expiry (15 min)</li>
                <li>• Refresh tokens in HttpOnly cookies</li>
                <li>• Service-to-service auth via mTLS</li>
              </ul>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Authorization</div>
              <ul class="text-xs text-slate-400 space-y-0.5">
                <li>• RBAC: Admin, SRE, Developer (read-only)</li>
                <li>• Cluster-scoped permissions</li>
                <li>• API keys for webhook integrations</li>
                <li>• Audit log for all write operations</li>
              </ul>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Secrets Management</div>
              <ul class="text-xs text-slate-400 space-y-0.5">
                <li>• HashiCorp Vault for all secrets</li>
                <li>• Vault Agent Injector (sidecar pattern)</li>
                <li>• No secrets in env vars or ConfigMaps</li>
                <li>• Auto-rotation for DB credentials</li>
              </ul>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Network Security</div>
              <ul class="text-xs text-slate-400 space-y-0.5">
                <li>• ALB with WAF rules</li>
                <li>• K8s NetworkPolicies (deny-all default)</li>
                <li>• Private subnets for all workloads</li>
                <li>• TLS everywhere (ACM certs on ALB)</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'observability',
      title: '11. Observability',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Metrics</div>
              <ul class="text-xs text-slate-400 space-y-0.5">
                <li>• Prometheus metrics endpoint (/metrics)</li>
                <li>• API latency histograms (p50/p95/p99)</li>
                <li>• Ingestion lag &amp; error rates</li>
                <li>• DB connection pool utilization</li>
                <li>• Grafana dashboards</li>
              </ul>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Logging</div>
              <ul class="text-xs text-slate-400 space-y-0.5">
                <li>• Structured JSON logs (stdout)</li>
                <li>• FluentBit → CloudWatch / ELK</li>
                <li>• Request ID correlation</li>
                <li>• Log level: INFO (prod), DEBUG (dev)</li>
              </ul>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
              <div class="font-semibold text-slate-100 mb-1">Tracing</div>
              <ul class="text-xs text-slate-400 space-y-0.5">
                <li>• OpenTelemetry SDK</li>
                <li>• Distributed traces (Jaeger / X-Ray)</li>
                <li>• Trace context propagation (W3C)</li>
                <li>• Span annotations for DB queries</li>
              </ul>
            </div>
          </div>

          <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <div class="font-semibold text-slate-100 mb-1">Alerting</div>
            <div class="text-xs text-slate-400 space-y-0.5">
              <div>• <strong>P1</strong>: API error rate > 5% for 5 min → PagerDuty</div>
              <div>• <strong>P2</strong>: Ingestion lag > 10 min → Slack #deploy-dashboard-alerts</div>
              <div>• <strong>P3</strong>: DB connection pool > 80% → Slack</div>
              <div>• <strong>P4</strong>: Cache hit rate < 70% → Dashboard annotation</div>
            </div>
          </div>
        </div>
      `,
    })}

    ${docSection({
      id: 'rollout',
      title: '12. Implementation Roadmap',
      content: `
        <div class="text-sm text-slate-300 leading-relaxed">
          <div class="space-y-3">
            ${[
              { phase: 'Phase 1 — Foundation (Weeks 1-3)', tone: 'emerald', items: [
                'Provision AWS infra via Terraform (VPC, EKS, RDS, ElastiCache, S3)',
                'Set up Vault with K8s auth and secret injection',
                'Bootstrap backend service repo (API skeleton, DB migrations, health checks)',
                'Bootstrap frontend service repo (React + Vite + Tailwind, Nginx container)',
                'Helm charts for both services with CI/CD pipeline integration',
                'ALB Ingress with path-based routing (/ → frontend, /api → backend)',
              ]},
              { phase: 'Phase 2 — Core Data (Weeks 3-5)', tone: 'sky', items: [
                'K8s watcher: stream deployment events from all 6 cluster-regions',
                'Melody webhook receiver: capture deployment attempts + statuses',
                'Test result ingestion: FT results on deploy, store in DB',
                'API: /clusters, /clusters/{id}/services, /services/versions',
                'Frontend: Overview page, Cluster detail page, Version matrix',
              ]},
              { phase: 'Phase 3 — Test Suites (Weeks 5-7)', tone: 'amber', items: [
                'Nightly regression ingestion (Mira/Pavo)',
                'Canary test ingestion (Aquila)',
                'Solution & System test ingestion (cluster-level)',
                'API: /clusters/{id}/test-suites, /attempts/{id}/tests',
                'Frontend: Test suite cards, collapsible history, health badges',
              ]},
              { phase: 'Phase 4 — Intelligence (Weeks 7-9)', tone: 'violet', items: [
                'Jira API integration: sync tickets by version',
                'API: /services/{id}/jira?from=x&to=y',
                'Analytics API: deployment frequency, MTTR, test pass rates',
                'Scorecard API: reliability scores per service',
                'Frontend: Jira compare panel, Analytics page, Scorecard page',
              ]},
              { phase: 'Phase 5 — Hardening (Weeks 9-11)', tone: 'rose', items: [
                'SSO integration (PingFed OIDC)',
                'RBAC middleware + audit logging',
                'Performance: Redis caching for hot queries, read replicas',
                'Observability: Prometheus, Grafana dashboards, alerting rules',
                'Load testing: simulate 50 concurrent users',
                'Documentation: API docs (OpenAPI), runbook, on-call guide',
              ]},
            ].map(({ phase, tone, items }) => `
              <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
                <div class="flex items-center gap-2 mb-2">
                  ${badge({ label: phase, tone, subtle: true })}
                </div>
                <ul class="text-xs text-slate-400 space-y-1">
                  ${items.map((it) => `<li>• ${it}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>
      `,
    })}

    </div>
  `;

  const content = `
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div class="lg:col-span-1">
        ${toc}
      </div>
      <div class="lg:col-span-3">
        ${sections}
      </div>
    </div>
  `;

  return layout({
    title: 'Architecture Design Document',
    subtitle: 'System design for the Deployment & Quality Dashboard — microservices, AWS infrastructure, data flow, and implementation roadmap.',
    activeNav: 'architecture',
    content,
  });
}

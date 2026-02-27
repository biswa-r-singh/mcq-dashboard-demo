/* ── data.js — loads all dashboard data from the Dashboard API ─────
 *
 *  API endpoints (Dashboard API Gateway):
 *    GET /v1/qcd/clusters          → clusters, clusterRegions, clusterRegionRoles, currentRunning
 *    GET /v1/qcd/services          → services
 *    GET /v1/qcd/deployments       → deploymentAttempts
 *    GET /v1/qcd/test-runs         → testRuns
 *    GET /v1/qcd/cluster-test-runs → clusterTestRuns
 *    GET /v1/qcd/promotions        → promotions
 *    GET /v1/qcd/jira-tickets      → jiraTickets
 *    GET /v1/qcd/scorecards        → scorecardWeights, scorecards
 *    GET /v1/qcd/metadata          → suiteMeta, statusMeta
 *
 *  Set window.MCQ_API_BASE to override the API URL.
 *  Falls back to sample-data/ JSON files if API is unreachable.
 *  ─────────────────────────────────────────────────────────── */

// API base URL — set via CloudFront or window override
const API_BASE = window.MCQ_API_BASE || '';
const STATIC_BASE = './sample-data';

// ── Mutable module-level variables (populated by init) ──────
export let clusters = [];
export let clusterRegions = [];
export let clusterRegionRoles = {};
export let services = [];
export let currentRunning = {};
export let deploymentAttempts = [];
export let testRuns = [];
export let clusterTestRuns = [];
export let promotions = [];
export let jiraTickets = {};
export let scorecardWeights = {};
export let scorecards = {};
export let suiteMeta = {};
export let statusMeta = {};

// Derived lookup (populated after services load)
export let appIdToServiceId = {};

// ── Helper functions (always available) ─────────────────────

export function getBaseCluster(baseId) {
  return clusters.find((c) => c.id === baseId);
}

export function getClusterRegion(clusterRegionId) {
  const cr = clusterRegions.find((x) => x.id === clusterRegionId);
  if (!cr) return null;
  const base = getBaseCluster(cr.baseId);

  const roles = clusterRegionRoles[cr.baseId];
  const role = roles
    ? roles.active === cr.region
      ? 'Active'
      : roles.hotStandby === cr.region
        ? 'Hot-standby'
        : '—'
    : '—';

  return {
    ...cr,
    name: `${base?.name || cr.baseId}-${cr.region}`,
    type: base?.type || '—',
    description: base?.description || '',
    role,
  };
}

// ── Fetch helpers ───────────────────────────────────────────

async function fetchAPI(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

async function loadJSON(path) {
  const res = await fetch(`${STATIC_BASE}/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// ── init() — call once before rendering ─────────────────────

let _initialized = false;

export async function init() {
  if (_initialized) return;

  try {
    // Try loading from API first
    const [
      clustersData,
      servicesData,
      deploymentsData,
      testRunsData,
      clusterTestRunsData,
      promotionsData,
      jiraData,
      scorecardData,
      metaData,
    ] = await Promise.all([
      fetchAPI('/v1/qcd/clusters'),
      fetchAPI('/v1/qcd/services'),
      fetchAPI('/v1/qcd/deployments'),
      fetchAPI('/v1/qcd/test-runs'),
      fetchAPI('/v1/qcd/cluster-test-runs'),
      fetchAPI('/v1/qcd/promotions'),
      fetchAPI('/v1/qcd/jira-tickets'),
      fetchAPI('/v1/qcd/scorecards'),
      fetchAPI('/v1/qcd/metadata'),
    ]);

    clusters = clustersData.clusters || [];
    clusterRegions = clustersData.clusterRegions || [];
    clusterRegionRoles = clustersData.clusterRegionRoles || {};
    currentRunning = clustersData.currentRunning || {};
    services = servicesData.services || [];
    deploymentAttempts = deploymentsData.deploymentAttempts || [];
    testRuns = testRunsData.testRuns || [];
    clusterTestRuns = clusterTestRunsData.clusterTestRuns || [];
    promotions = promotionsData.promotions || [];
    jiraTickets = jiraData.jiraTickets || {};
    scorecardWeights = scorecardData.scorecardWeights || {};
    scorecards = scorecardData.scorecards || {};
    suiteMeta = metaData.suiteMeta || {};
    statusMeta = metaData.statusMeta || {};

    console.log('[data] Loaded from API');
  } catch (apiErr) {
    console.warn('[data] API not available, falling back to static JSON:', apiErr.message);

    // Fallback to static JSON files
    const [
      clustersData,
      servicesData,
      currentRunningData,
      deploymentsData,
      testRunsData,
      clusterTestRunsData,
      promotionsData,
      jiraData,
      scorecardData,
      metaData,
    ] = await Promise.all([
      loadJSON('service-health/clusters.json'),
      loadJSON('service-health/services.json'),
      loadJSON('service-health/current-running.json'),
      loadJSON('service-health/deployments.json'),
      loadJSON('service-health/test-runs.json'),
      loadJSON('service-health/cluster-test-runs.json'),
      loadJSON('service-health/promotions.json'),
      loadJSON('version-compare/jira-tickets.json'),
      loadJSON('scorecard/scorecards.json'),
      loadJSON('common/metadata.json'),
    ]);

    clusters = clustersData.clusters;
    clusterRegions = clustersData.clusterRegions;
    clusterRegionRoles = clustersData.clusterRegionRoles;
    services = servicesData.services;
    currentRunning = currentRunningData.currentRunning;
    deploymentAttempts = deploymentsData.deploymentAttempts;
    testRuns = testRunsData.testRuns;
    clusterTestRuns = clusterTestRunsData.clusterTestRuns;
    promotions = promotionsData.promotions;
    jiraTickets = jiraData.jiraTickets;
    scorecardWeights = scorecardData.scorecardWeights;
    scorecards = scorecardData.scorecards;
    suiteMeta = metaData.suiteMeta;
    statusMeta = metaData.statusMeta;

    console.log('[data] Loaded from static JSON files');
  }

  // derived lookups
  appIdToServiceId = Object.fromEntries(
    services.filter((s) => s.appId).map((s) => [s.appId, s.id]),
  );

  _initialized = true;
}

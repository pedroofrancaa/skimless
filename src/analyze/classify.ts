import { normalizePath } from "../paths.ts";
import type { Role } from "../types.ts";

const LOCKFILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "cargo.lock",
  "poetry.lock",
  "pipfile.lock",
  "composer.lock",
  "gemfile.lock",
  "go.sum",
  "bun.lock",
  "uv.lock",
]);

const MANIFESTS = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "cargo.toml",
  "gemfile",
  "composer.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
]);

const ROLE_PRIORITY: readonly Role[] = [
  "test",
  "lockfile",
  "generated",
  "asset",
  "docs",
  "migration",
  "ci",
  "deps",
  "auth",
  "crypto",
  "payment",
  "api",
  "types",
  "schema",
  "config",
  "source",
];

export function isTestPath(filePath: string): boolean {
  const path = normalizePath(filePath);
  return (
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    /(?:^|\/)__tests__\//.test(path) ||
    /(?:^|\/)tests?\//.test(path) ||
    /_test\.go$/.test(path) ||
    /(?:^|\/)test_[^/]*\.py$/.test(path) ||
    /Test\.java$/.test(path)
  );
}

export function classify(filePath: string): Role[] {
  const path = normalizePath(filePath);
  const base = path.split("/").pop()?.toLowerCase() ?? path.toLowerCase();
  const roles: Role[] = [];

  if (isTestPath(path)) roles.push("test");
  if (LOCKFILES.has(base)) roles.push("lockfile");
  if (/(?:^|\/)(?:dist|generated|vendor|__generated__)\//.test(path) || /\.min\.js$/.test(path) || /\.pb\.go$/.test(path)) {
    roles.push("generated");
  }
  if (/\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|pdf)$/i.test(path)) roles.push("asset");
  if (/\.(?:md|mdx|rst|adoc)$/i.test(path) || /(?:^|\/)docs?\//.test(path) || /^(?:readme|changelog)/i.test(base)) {
    roles.push("docs");
  }
  if (/migrat(?:e|ion|ions)/i.test(path) || /alembic|flyway|prisma\/migrations/i.test(path)) roles.push("migration");
  if (path.endsWith(".sql") && /migrat|\/db\/|schema/i.test(path)) roles.push("migration");
  if (
    path.includes(".github/workflows/") ||
    path.includes(".github/actions/") ||
    /jenkinsfile|\.gitlab-ci|azure-pipelines|\.circleci/i.test(path) ||
    /(?:^|\/)\.(?:gitlab\/ci|buildkite|woodpecker)\//.test(path) ||
    /(?:^|\/)(?:bitbucket-pipelines|\.travis|\.drone|\.woodpecker)\.ya?ml$/.test(path)
  ) {
    roles.push("ci");
  }
  if (MANIFESTS.has(base)) roles.push("deps");
  const prose = roles.includes("docs") || roles.includes("generated") || roles.includes("asset") || roles.includes("test");
  if (!prose && /(?:^|\/)(?:auth|authentication|session|sessions|oauth|jwt|rbac|permissions|permission|secrets)(?:\/|\.|$)/i.test(path)) {
    roles.push("auth");
  }
  if (!prose && /(?:^|\/)(?:crypto|cipher|kms|webhooks?|signing|hmac|signatures?)(?:\/|\.|$)/i.test(path)) roles.push("crypto");
  if (!prose && /(?:^|\/)(?:billing|payments?|checkout|invoices?|stripe)(?:\/|\.|$)/i.test(path)) roles.push("payment");
  if (/(?:^|\/)(?:api|routes|handlers|controllers)\//.test(path) || /\/index\.[cm]?[jt]s$/.test(path)) roles.push("api");
  if (/\.d\.ts$/.test(path) || /(?:^|\/)types?\//.test(path)) roles.push("types");
  if (/schema\.prisma$|\.proto$|schema\.graphql|openapi\.(?:ya?ml|json)$|(?:^|\/)schemas?\//i.test(path)) {
    roles.push("schema");
  }
  if (
    /(?:^|\/)Dockerfile(?:\.[^/]+)?$/.test(path) ||
    /(?:^|\/)docker-compose[^/]*\.ya?ml$/.test(path) ||
    path.endsWith(".tf") ||
    /(?:^|\/)(?:k8s|helm|charts|deploy)\//.test(path)
  ) {
    roles.push("config");
  }
  if (roles.length === 0) roles.push("source");
  return roles;
}

export function primaryRole(roles: readonly Role[]): Role {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return "source";
}

export function fileStem(filePath: string): string {
  const base = normalizePath(filePath).split("/").pop()?.toLowerCase() ?? "";
  return base
    .replace(/\.(?:tsx|ts|jsx|js|mjs|cjs|py|go|rb|rs|java|kt|php)$/i, "")
    .replace(/\.(?:test|spec)$/i, "")
    .replace(/_test$/i, "")
    .replace(/^test_/, "");
}

const BAND: Record<Role, number> = {
  api: 10,
  types: 10,
  schema: 10,
  auth: 20,
  crypto: 20,
  payment: 20,
  migration: 20,
  ci: 20,
  deps: 30,
  config: 40,
  source: 50,
  test: 70,
  docs: 80,
  lockfile: 90,
  generated: 90,
  asset: 90,
};

export function bandFor(role: Role): number {
  return BAND[role];
}

const CLUSTER_ROLES = new Set<Role>([
  "test",
  "docs",
  "ci",
  "lockfile",
  "migration",
  "deps",
  "generated",
  "asset",
  "config",
]);

export function clusterIdFor(filePath: string, role: Role): string {
  if (CLUSTER_ROLES.has(role)) return role;
  const parts = normalizePath(filePath).split("/");
  if (parts.length <= 1) return "root";
  if (parts.length === 2) return parts[0] || "root";
  return parts.slice(0, 2).join("/");
}

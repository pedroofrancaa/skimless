import type { Finding, RiskLabel, Severity } from "../types.ts";

export const RULE_WEIGHT: Record<string, number> = {
  "secret-pattern": 34,
  "code-exec": 32,
  "timing-compare": 30,
  "workflow-permissions": 28,
  "deleted-tests": 26,
  migration: 24,
  "sensitive-surface": 14,
  "missing-tests": 12,
  "html-sink": 12,
  "over-budget": 10,
  "dependency-manifest": 10,
  "runtime-config": 9,
  "api-change": 8,
  "large-file": 8,
  lockfile: 5,
  "ci-changed": 4,
  "binary-file": 3,
  "whitespace-only": 1,
  "generated-file": 1,
};

const SEVERITY_RANK: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  info: 3,
};

export function weightOf(ruleId: string): number {
  return RULE_WEIGHT[ruleId] ?? 5;
}

const HIGH_THRESHOLD = 70;

export function scoreOf(findings: readonly Finding[]): number {
  const raw = findings.reduce((sum, finding) => sum + weightOf(finding.ruleId), 0);
  const ceiling = findings.some((finding) => finding.severity === "high") ? 100 : HIGH_THRESHOLD - 1;
  return Math.min(ceiling, raw);
}

export function labelFor(score: number, findings: readonly { severity: Severity }[]): RiskLabel {
  if (findings.some((finding) => finding.severity === "high") || score >= HIGH_THRESHOLD) return "high";
  if (findings.some((finding) => finding.severity === "medium") || score >= 32) return "medium";
  if (findings.some((finding) => finding.severity === "low") || score >= 10) return "low";
  return "calm";
}

export function sortFindings(findings: readonly Finding[]): Finding[] {
  return findings.slice().sort((left, right) => {
    const bySeverity = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
    if (bySeverity !== 0) return bySeverity;
    const byWeight = weightOf(right.ruleId) - weightOf(left.ruleId);
    if (byWeight !== 0) return byWeight;
    const byPath = (left.path ?? "").localeCompare(right.path ?? "");
    if (byPath !== 0) return byPath;
    return left.ruleId.localeCompare(right.ruleId);
  });
}

export function severityRank(severity: Severity): number {
  return SEVERITY_RANK[severity];
}

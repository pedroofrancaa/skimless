import { createHash } from "node:crypto";

import { clusterIdFor } from "./analyze/classify.ts";
import { addCrossFileFindings, assessFile, budgetFinding } from "./analyze/rules.ts";
import { labelFor, scoreOf, sortFindings } from "./analyze/score.ts";
import { clusterTitle, headlineFor, ledeFor, roleLabel } from "./copy.ts";
import { matchAny } from "./glob.ts";
import { parsePatch } from "./parse/patch.ts";
import { pathOf } from "./paths.ts";
import { redactLineSequence, redactText } from "./patterns.ts";
import type {
  FileAssessment,
  Finding,
  Hunk,
  Lang,
  Order,
  ReviewOptions,
  ReviewPacket,
  ReviewStats,
  Severity,
} from "./types.ts";

export function fileReason(lang: Lang, file: FileAssessment): string {
  return file.findings[0]?.title ?? roleLabel(lang, file.primaryRole);
}

export function reviewDiff(patch: string, options: ReviewOptions = {}): ReviewPacket {
  const lang = options.lang ?? "en";
  const order = options.order ?? "story";
  const largeFileLines = options.largeFileLines ?? 400;
  const testGapLines = options.testGapLines ?? 15;
  const parsed = parsePatch(patch);
  const ignored = parsed.filter((file) => matchAny(pathOf(file), options.ignore ?? []));
  const kept = parsed.filter((file) => !matchAny(pathOf(file), options.ignore ?? []));

  const assessed = kept.map((file) => assessFile(file, { lang, largeFileLines, testGapLines }));
  addCrossFileFindings(assessed, lang, testGapLines);

  const additions = assessed.reduce((sum, file) => sum + file.additions, 0);
  const deletions = assessed.reduce((sum, file) => sum + file.deletions, 0);
  const minutes = estimateMinutes(assessed);
  const extra: Finding[] = [];
  if (options.budgetMinutes !== undefined && assessed.length > 0 && minutes > options.budgetMinutes) {
    extra.push(budgetFinding(lang, minutes, options.budgetMinutes));
  }

  const files = sortFiles(assessed, order);
  const findings = sortFindings([...files.flatMap((file) => file.findings), ...extra]);
  const counts = countSeverities(findings);
  const riskScore = scoreOf(findings);
  const riskLabel = labelFor(riskScore, findings);
  const stats: ReviewStats = {
    files: files.length,
    ignored: ignored.length,
    additions,
    deletions,
    minutes: files.length === 0 ? 0 : minutes,
    riskScore,
    riskLabel,
    counts,
  };
  const readingOrder = files.map((file) => ({
    path: file.path,
    reason: fileReason(lang, file),
    riskLabel: file.riskLabel,
    riskScore: file.riskScore,
    disposition: file.disposition,
    primaryRole: file.primaryRole,
  }));
  const firstNames = readingOrder.map((stop) => stop.path.split("/").pop() ?? stop.path);

  return {
    version: 1,
    id: createHash("sha256").update(patch).digest("hex").slice(0, 8),
    language: lang,
    order,
    generatedAt: (options.now ?? new Date()).toISOString(),
    headline: headlineFor(lang, riskLabel, files.length),
    lede: ledeFor(lang, stats, firstNames),
    stats,
    files,
    clusters: buildClusters(files, lang),
    findings,
    readingOrder,
  };
}

export function redactPacket(packet: ReviewPacket): ReviewPacket {
  const clone = structuredClone(packet);
  clone.lede = redactText(clone.lede);
  clone.headline = redactText(clone.headline);
  for (const finding of clone.findings) {
    finding.title = redactText(finding.title);
    finding.detail = redactText(finding.detail);
  }
  for (const file of clone.files) {
    for (const finding of file.findings) {
      finding.title = redactText(finding.title);
      finding.detail = redactText(finding.detail);
    }
    for (const stop of clone.readingOrder) {
      if (stop.path === file.path) stop.reason = redactText(stop.reason);
    }
    for (const hunk of file.hunks) redactHunk(hunk);
  }
  return clone;
}

function redactHunk(hunk: Hunk): void {
  const redacted = redactLineSequence(hunk.lines.map((line) => line.text));
  hunk.lines.forEach((line, index) => {
    line.text = redacted[index] ?? line.text;
  });
}

function sortFiles(files: FileAssessment[], order: Order): FileAssessment[] {
  return files.slice().sort((left, right) => {
    if (order === "risk") {
      return right.riskScore - left.riskScore || left.band - right.band || left.path.localeCompare(right.path);
    }
    return left.band - right.band || right.riskScore - left.riskScore || left.path.localeCompare(right.path);
  });
}

function buildClusters(files: readonly FileAssessment[], lang: Lang): ReviewPacket["clusters"] {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const id = clusterIdFor(file.path, file.primaryRole);
    const list = groups.get(id);
    if (list) list.push(file.path);
    else groups.set(id, [file.path]);
  }
  return [...groups.entries()].map(([id, paths]) => ({
    id,
    title: clusterTitle(lang, id),
    paths,
  }));
}

function estimateMinutes(files: readonly FileAssessment[]): number {
  const noise = new Set(["lockfile", "generated", "asset"]);
  let lines = 0;
  for (const file of files) {
    if (noise.has(file.primaryRole)) continue;
    lines += file.additions + file.deletions;
  }
  return Math.max(2, Math.round(lines / 40));
}

function countSeverities(findings: readonly Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { info: 0, low: 0, medium: 0, high: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

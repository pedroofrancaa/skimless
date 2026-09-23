export type Severity = "info" | "low" | "medium" | "high";
export type Lang = "en" | "pt";
export type Order = "story" | "risk";
export type RiskLabel = "calm" | "low" | "medium" | "high";
export type Disposition = "now" | "soon" | "later";
export type FileStatus = "added" | "modified" | "deleted" | "renamed" | "copied";

export type Role =
  | "test"
  | "docs"
  | "ci"
  | "lockfile"
  | "migration"
  | "schema"
  | "config"
  | "types"
  | "api"
  | "auth"
  | "crypto"
  | "payment"
  | "deps"
  | "generated"
  | "asset"
  | "source";

export interface DiffLine {
  kind: "add" | "del" | "context";
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  section: string;
  lines: DiffLine[];
}

export interface DiffFile {
  oldPath: string | null;
  newPath: string | null;
  status: FileStatus;
  isBinary: boolean;
  hunks: Hunk[];
  additions: number;
  deletions: number;
  similarity: number | null;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  path: string | null;
  title: string;
  detail: string;
}

export interface FileAssessment {
  path: string;
  previousPath: string | null;
  status: FileStatus;
  roles: Role[];
  primaryRole: Role;
  additions: number;
  deletions: number;
  riskScore: number;
  riskLabel: RiskLabel;
  disposition: Disposition;
  band: number;
  findings: Finding[];
  hunks: Hunk[];
  isBinary: boolean;
}

export interface Cluster {
  id: string;
  title: string;
  paths: string[];
}

export interface ReadingStop {
  path: string;
  reason: string;
  riskLabel: RiskLabel;
  riskScore: number;
  disposition: Disposition;
  primaryRole: Role;
}

export interface ReviewStats {
  files: number;
  ignored: number;
  additions: number;
  deletions: number;
  minutes: number;
  riskScore: number;
  riskLabel: RiskLabel;
  counts: Record<Severity, number>;
}

export interface ReviewPacket {
  version: 1;
  id: string;
  language: Lang;
  order: Order;
  generatedAt: string;
  headline: string;
  lede: string;
  stats: ReviewStats;
  files: FileAssessment[];
  clusters: Cluster[];
  findings: Finding[];
  readingOrder: ReadingStop[];
}

export interface ReviewOptions {
  lang?: Lang;
  order?: Order;
  ignore?: string[];
  largeFileLines?: number;
  testGapLines?: number;
  budgetMinutes?: number;
  now?: Date;
}

export interface SkimlessConfig {
  failOn?: "none" | Severity;
  order?: Order;
  lang?: Lang;
  budgetMinutes?: number;
  largeFileLines?: number;
  testGapLines?: number;
  ignore?: string[];
}

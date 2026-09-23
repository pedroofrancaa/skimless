import { readFileSync, existsSync } from "node:fs";

import type { SkimlessConfig, Lang, Order, Severity } from "./types.ts";

const FAIL = new Set(["none", "info", "low", "medium", "high"]);
const ORDERS = new Set(["story", "risk"]);
const LANGS = new Set(["en", "pt"]);

export function loadConfig(filePath: string): SkimlessConfig {
  const raw = readFileSync(filePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Config is not valid JSON: ${filePath}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Config must be a JSON object: ${filePath}`);
  }
  return normalizeConfig(parsed as Record<string, unknown>, filePath);
}

export function loadDefaultConfig(cwd: string): SkimlessConfig {
  const filePath = `${cwd.replace(/\/$/, "")}/skimless.config.json`;
  if (!existsSync(filePath)) return {};
  return loadConfig(filePath);
}

function normalizeConfig(value: Record<string, unknown>, filePath: string): SkimlessConfig {
  const config: SkimlessConfig = {};
  if (value.failOn !== undefined) {
    if (typeof value.failOn !== "string" || !FAIL.has(value.failOn)) {
      throw new Error(`failOn must be none, info, low, medium, or high (${filePath})`);
    }
    config.failOn = value.failOn as "none" | Severity;
  }
  if (value.order !== undefined) {
    if (typeof value.order !== "string" || !ORDERS.has(value.order)) {
      throw new Error(`order must be story or risk (${filePath})`);
    }
    config.order = value.order as Order;
  }
  if (value.lang !== undefined) {
    const lang = normalizeLang(value.lang);
    if (!lang) throw new Error(`lang must be en or pt (${filePath})`);
    config.lang = lang;
  }
  if (value.budgetMinutes !== undefined) config.budgetMinutes = positiveNumber(value.budgetMinutes, "budgetMinutes", filePath);
  if (value.largeFileLines !== undefined) config.largeFileLines = positiveNumber(value.largeFileLines, "largeFileLines", filePath);
  if (value.testGapLines !== undefined) config.testGapLines = positiveNumber(value.testGapLines, "testGapLines", filePath);
  if (value.ignore !== undefined) {
    if (!Array.isArray(value.ignore) || value.ignore.some((item) => typeof item !== "string")) {
      throw new Error(`ignore must be an array of strings (${filePath})`);
    }
    config.ignore = value.ignore as string[];
  }
  return config;
}

export function normalizeLang(value: unknown): Lang | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  if (lower === "pt-br" || lower === "pt_br") return "pt";
  if (LANGS.has(lower)) return lower as Lang;
  return null;
}

function positiveNumber(value: unknown, name: string, filePath: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a number >= 0 (${filePath})`);
  }
  return value;
}

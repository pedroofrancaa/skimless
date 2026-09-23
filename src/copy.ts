import type { Disposition, FileStatus, Lang, RiskLabel, Role, Severity } from "./types.ts";

export function L(lang: Lang, en: string, pt: string): string {
  return lang === "pt" ? pt : en;
}

const HEADLINES: Record<Lang, Record<RiskLabel, string>> = {
  en: {
    high: "Do not skim this one",
    medium: "Worth a real review",
    low: "Light, but look twice",
    calm: "Quiet diff",
  },
  pt: {
    high: "Não passa o olho nesse",
    medium: "Vale uma revisão de verdade",
    low: "Leve, mas olha de novo",
    calm: "Diff quieto",
  },
};

export function headlineFor(lang: Lang, label: RiskLabel, files: number): string {
  if (files === 0) return L(lang, "Nothing to review", "Nada para revisar");
  return HEADLINES[lang][label];
}

export function ledeFor(
  lang: Lang,
  stats: { files: number; additions: number; deletions: number; minutes: number; counts: Record<Severity, number> },
  firstNames: readonly string[],
): string {
  if (stats.files === 0) return L(lang, "The diff is empty.", "O diff está vazio.");
  const names = firstNames.slice(0, 3).join(", ");
  if (lang === "pt") {
    return `${stats.files} arquivos · +${stats.additions} −${stats.deletions} · cerca de ${stats.minutes} min. ${stats.counts.high} achados em prioridade alta. Primeira passada: ${names}.`;
  }
  return `${stats.files} files · +${stats.additions} −${stats.deletions} · about ${stats.minutes} min. ${stats.counts.high} high-priority findings. First pass: ${names}.`;
}

const ROLES: Record<Lang, Record<Role, string>> = {
  en: {
    test: "Tests",
    docs: "Docs",
    ci: "Automation",
    lockfile: "Lockfile",
    migration: "Schema migration",
    schema: "Schema",
    config: "Runtime config",
    types: "Types",
    api: "Public API",
    auth: "Auth",
    crypto: "Signing",
    payment: "Billing",
    deps: "Dependencies",
    generated: "Generated",
    asset: "Asset",
    source: "Implementation",
  },
  pt: {
    test: "Testes",
    docs: "Docs",
    ci: "Automação",
    lockfile: "Lockfile",
    migration: "Migração de schema",
    schema: "Schema",
    config: "Config de runtime",
    types: "Tipos",
    api: "API pública",
    auth: "Auth",
    crypto: "Assinatura",
    payment: "Cobrança",
    deps: "Dependências",
    generated: "Gerado",
    asset: "Asset",
    source: "Implementação",
  },
};

export function roleLabel(lang: Lang, role: Role): string {
  return ROLES[lang][role];
}

const DISPOSITION: Record<Lang, Record<Disposition, string>> = {
  en: { now: "Read now", soon: "Then this", later: "Can wait" },
  pt: { now: "Ler agora", soon: "Depois", later: "Pode esperar" },
};

export function dispositionLabel(lang: Lang, disposition: Disposition): string {
  return DISPOSITION[lang][disposition];
}

const RISK: Record<Lang, Record<RiskLabel, string>> = {
  en: { calm: "calm", low: "low", medium: "medium", high: "high" },
  pt: { calm: "quieto", low: "baixo", medium: "médio", high: "alto" },
};

export function riskLabelText(lang: Lang, label: RiskLabel): string {
  return RISK[lang][label];
}

const SEVERITY: Record<Lang, Record<Severity, string>> = {
  en: { high: "high", medium: "medium", low: "low", info: "info" },
  pt: { high: "alto", medium: "médio", low: "baixo", info: "info" },
};

export function severityLabel(lang: Lang, severity: Severity): string {
  return SEVERITY[lang][severity];
}

const STATUS: Record<Lang, Record<FileStatus, string>> = {
  en: { added: "added", modified: "modified", deleted: "deleted", renamed: "renamed", copied: "copied" },
  pt: { added: "adicionado", modified: "modificado", deleted: "apagado", renamed: "renomeado", copied: "copiado" },
};

export function statusLabel(lang: Lang, status: FileStatus): string {
  return STATUS[lang][status];
}

const CLUSTERS: Record<Lang, Record<string, string>> = {
  en: {
    test: "Tests",
    docs: "Documentation",
    ci: "Automation",
    lockfile: "Lockfiles",
    migration: "Migrations",
    deps: "Dependencies",
    generated: "Generated",
    asset: "Assets",
    config: "Runtime",
    root: "Top level",
  },
  pt: {
    test: "Testes",
    docs: "Documentação",
    ci: "Automação",
    lockfile: "Lockfiles",
    migration: "Migrações",
    deps: "Dependências",
    generated: "Gerado",
    asset: "Assets",
    config: "Runtime",
    root: "Raiz",
  },
};

export function clusterTitle(lang: Lang, id: string): string {
  return CLUSTERS[lang][id] ?? id;
}

export function emptyHint(lang: Lang): string {
  return L(
    lang,
    "Working tree matches HEAD. Try --base main, --input diff.patch, or skimless demo.",
    "A árvore de trabalho está igual ao HEAD. Tente --base main, --input diff.patch ou skimless demo.",
  );
}

export function footerNote(lang: Lang): string {
  return L(
    lang,
    "Skimless does not execute the diff and does not call a model. Scores are a reading priority, not a proof that something is safe.",
    "O Skimless não executa o diff e não chama modelo nenhum. A nota é prioridade de leitura, não prova de que algo está seguro.",
  );
}

import { bandFor, classify, fileStem, isTestPath, primaryRole } from "./classify.ts";
import { labelFor, scoreOf, sortFindings } from "./score.ts";
import { L } from "../copy.ts";
import { pathOf } from "../paths.ts";
import { CODE_EXEC_PATTERNS, SECRET_PATTERNS } from "../patterns.ts";
import type { DiffFile, Disposition, FileAssessment, Finding, Lang, Role, Severity } from "../types.ts";

export interface RuleMeta {
  id: string;
  severity: Severity;
  en: string;
  pt: string;
}

export const RULES: readonly RuleMeta[] = [
  { id: "secret-pattern", severity: "high", en: "Added line matches a credential shape", pt: "Linha adicionada parece uma credencial" },
  { id: "code-exec", severity: "high", en: "Added line can execute untrusted input", pt: "Linha adicionada pode executar entrada não confiável" },
  { id: "timing-compare", severity: "high", en: "Signature or digest compared with ==", pt: "Assinatura ou digest comparado com ==" },
  { id: "workflow-permissions", severity: "high", en: "CI workflow grants a write permission", pt: "Workflow de CI concede permissão de escrita" },
  { id: "privileged-trigger", severity: "high", en: "Workflow runs on a trigger that carries secrets", pt: "Workflow roda num gatilho que carrega segredos" },
  { id: "deleted-tests", severity: "high", en: "A test file was deleted", pt: "Um arquivo de teste foi apagado" },
  { id: "migration", severity: "high", en: "Schema migration or DDL", pt: "Migração de schema ou DDL" },
  { id: "sensitive-surface", severity: "medium", en: "Auth, billing, or signing path changed", pt: "Caminho de auth, cobrança ou assinatura mudou" },
  { id: "missing-tests", severity: "medium", en: "Behavior changed without a matching test", pt: "Comportamento mudou sem um teste correspondente" },
  { id: "html-sink", severity: "medium", en: "HTML sink assigned from data", pt: "Sink de HTML recebendo dado" },
  { id: "dependency-manifest", severity: "medium", en: "Dependency manifest changed", pt: "Manifesto de dependências mudou" },
  { id: "runtime-config", severity: "medium", en: "Runtime packaging changed", pt: "Empacotamento de runtime mudou" },
  { id: "api-change", severity: "medium", en: "Public export changed", pt: "Export público mudou" },
  { id: "large-file", severity: "medium", en: "This file is a large slice of the diff", pt: "Este arquivo é um pedaço grande do diff" },
  { id: "over-budget", severity: "medium", en: "Estimated review exceeds the budget", pt: "A revisão estimada passa do orçamento" },
  { id: "lockfile", severity: "medium", en: "Lockfile changed", pt: "Lockfile mudou" },
  { id: "ci-publish", severity: "medium", en: "Automation publishes or pushes", pt: "Automação publica ou envia" },
  { id: "ci-changed", severity: "low", en: "Automation changed", pt: "Automação mudou" },
  { id: "binary-file", severity: "low", en: "Binary file changed", pt: "Arquivo binário mudou" },
  { id: "whitespace-only", severity: "info", en: "Whitespace-only change", pt: "Mudança só de espaço em branco" },
  { id: "generated-file", severity: "info", en: "Generated file changed", pt: "Arquivo gerado mudou" },
];

const DIGEST_NAME = String.raw`\w*(?:signature|digest|hmac)\w*`;
const EQUALITY = String.raw`[=!]==?`;
const TIMING_COMPARE = new RegExp(`${DIGEST_NAME}[^\\n]{0,80}?${EQUALITY}|${EQUALITY}[^\\n]{0,40}?${DIGEST_NAME}`, "i");
const SENTINEL_COMPARE = /[=!]==?\s*(?:null|undefined|None|nil|true|false|True|False|0|""|'')(?![\w"'])/;

const CI_PUBLISH = /\b(?:npm|yarn|pnpm|bun)\s+publish\b|\btwine\s+upload\b|\bcargo\s+publish\b|\bgem\s+push\b|\bdocker\s+(?:image\s+)?push\b|\bgit\s+push\b|\bpoetry\s+publish\b|\bgh\s+release\s+(?:create|upload)\b|\bnuget\s+push\b|\bgoreleaser\b|pypi-publish|npm-publish/;

const CI_SPECIFIC = new Set(["workflow-permissions", "privileged-trigger", "ci-publish"]);

function isTimingCompare(line: string): boolean {
  return TIMING_COMPARE.test(line) && !SENTINEL_COMPARE.test(line);
}

export interface AssessContext {
  lang: Lang;
  largeFileLines: number;
  testGapLines: number;
}

export function assessFile(file: DiffFile, context: AssessContext): FileAssessment {
  const path = pathOf(file);
  const roles = classify(path);
  const role = primaryRole(roles);
  const findings: Finding[] = [];
  const whitespace = isWhitespaceOnly(file);

  if (whitespace) {
    findings.push(finding(context.lang, "whitespace-only", "info", path, {
      en: "Whitespace-only change",
      pt: "Mudança só de espaço em branco",
      detailEn: "The trimmed lines match. Read it only if you are hunting a formatting fight.",
      detailPt: "As linhas sem espaço nas pontas batem. Leia só se estiver caçando briga de formatação.",
    }));
  } else {
    pushStructural(findings, file, roles, role, path, context);
  }

  const sorted = sortFindings(findings);
  return baseAssessment(file, path, roles, role, sorted);
}

// Also accepts abbreviated test names, as in test/app.router.js for lib/application.js.
function coversStem(testPath: string, stem: string): boolean {
  const testStem = fileStem(testPath);
  if (testStem === stem || testPath.toLowerCase().includes(`/${stem}.`)) return true;
  const head = testStem.split(/[._-]/)[0] ?? "";
  return head.length >= 3 && stem.startsWith(head);
}

export function addCrossFileFindings(
  files: FileAssessment[],
  lang: Lang,
  testGapLines: number,
): void {
  const liveTests = files.filter((file) => file.roles.includes("test") && file.status !== "deleted");
  for (const file of files) {
    if (!needsTestGap(file, testGapLines)) continue;
    const stem = fileStem(file.path);
    if (stem.length < 3) continue;
    const covered = liveTests.some((test) => coversStem(test.path, stem));
    if (covered) continue;
    file.findings.push(finding(lang, "missing-tests", "medium", file.path, {
      en: "Behavior changed without a matching test",
      pt: "Comportamento mudou sem um teste correspondente",
      detailEn: `Nothing in this diff covers “${stem}”. If the change is pure wiring, say so in the pull request.`,
      detailPt: `Nada neste diff cobre “${stem}”. Se a mudança é só ligação, diga isso no pull request.`,
    }));
    file.findings = sortFindings(file.findings);
    copyScore(file);
  }
}

export function budgetFinding(lang: Lang, minutes: number, budget: number): Finding {
  return finding(lang, "over-budget", "medium", null, {
    en: "Estimated review exceeds the budget",
    pt: "A revisão estimada passa do orçamento",
    detailEn: `About ${minutes} minutes, budget is ${budget}. The reading order front-loads the sharp edges so a short pass still hits them.`,
    detailPt: `Cerca de ${minutes} minutos, o orçamento é ${budget}. A ordem de leitura puxa as partes afiadas para o começo, então uma passada curta ainda pega elas.`,
  });
}

function pushStructural(
  findings: Finding[],
  file: DiffFile,
  roles: readonly Role[],
  role: Role,
  path: string,
  context: AssessContext,
): void {
  const lang = context.lang;
  const added = addedTexts(file);
  const blob = added.join("\n");
  const isTest = roles.includes("test");

  const secrets = SECRET_PATTERNS.filter((pattern) => pattern.expression.test(blob));
  if (secrets.length > 0) {
    const names = secrets.map((pattern) => (lang === "pt" ? pattern.namePt : pattern.name)).join(", ");
    findings.push(finding(lang, "secret-pattern", "high", path, {
      en: "Secret-shaped string added",
      pt: "String com cara de segredo adicionada",
      detailEn: `Pattern: ${names}. If it is real, rotate it. If it is a fixture, use an obvious placeholder.`,
      detailPt: `Padrão: ${names}. Se for de verdade, rotacione. Se for fixture, use um placeholder óbvio.`,
    }));
  }

  const execs = CODE_EXEC_PATTERNS.filter((pattern) => (!pattern.files || pattern.files.test(path)) && pattern.expression.test(blob));
  if (execs.length > 0) {
    const names = execs.map((pattern) => (lang === "pt" ? pattern.namePt : pattern.name)).join(", ");
    findings.push(finding(lang, "code-exec", "high", path, {
      en: "Dynamic execution added",
      pt: "Execução dinâmica adicionada",
      detailEn: `Look at ${names}. Confirm the input cannot arrive from a request, a file, or a queue.`,
      detailPt: `Olhe ${names}. Confirme que a entrada não chega de um request, um arquivo ou uma fila.`,
    }));
  }

  if (!isTest && added.some(isTimingCompare)) {
    findings.push(finding(lang, "timing-compare", "high", path, {
      en: "Signature compared with ==",
      pt: "Assinatura comparada com ==",
      detailEn: "Equality on a digest leaks timing. A constant-time compare belongs on the raw bytes, and the two sides need to be the same length.",
      detailPt: "Igualdade em digest vaza tempo. A comparação em tempo constante precisa ser nos bytes crus, com os dois lados do mesmo tamanho.",
    }));
  }

  if (roles.includes("ci") && /(?:contents|packages|pull-requests|actions|id-token|checks|deployments|statuses)\s*:\s*write\b|permissions\s*:\s*write-all/.test(blob)) {
    findings.push(finding(lang, "workflow-permissions", "high", path, {
      en: "Workflow grants write permissions",
      pt: "Workflow concede permissão de escrita",
      detailEn: "A stolen token in this workflow can push code or publish a package. Read the permission block before the step list.",
      detailPt: "Um token roubado neste workflow pode enviar código ou publicar pacote. Leia o bloco de permissões antes da lista de steps.",
    }));
  }

  if (roles.includes("ci") && /\b(?:pull_request_target|workflow_run)\b/.test(blob)) {
    findings.push(finding(lang, "privileged-trigger", "high", path, {
      en: "Workflow runs on a trigger that carries secrets",
      pt: "Workflow roda num gatilho que carrega segredos",
      detailEn: "pull_request_target and workflow_run get the base repository's token and secrets. Check that no step checks out or runs code from the pull request.",
      detailPt: "pull_request_target e workflow_run recebem o token e os segredos do repositório base. Confira que nenhum step faz checkout ou roda código do pull request.",
    }));
  }

  if (roles.includes("ci") && CI_PUBLISH.test(blob)) {
    findings.push(finding(lang, "ci-publish", "medium", path, {
      en: "Automation publishes or pushes",
      pt: "Automação publica ou envia",
      detailEn: "This job can ship a package, an image, or a commit. Read which event triggers it and which credential it uses.",
      detailPt: "Este job pode publicar um pacote, uma imagem ou um commit. Leia qual evento dispara ele e qual credencial ele usa.",
    }));
  }

  if (file.status === "deleted" && isTestPath(path)) {
    findings.push(finding(lang, "deleted-tests", "high", path, {
      en: "Test file deleted",
      pt: "Arquivo de teste apagado",
      detailEn: "Deleted coverage does not come back on its own. Check the replacement test, or the reason there isn't one.",
      detailPt: "Cobertura apagada não volta sozinha. Confira o teste que substitui, ou o motivo de não existir um.",
    }));
  }

  if (roles.includes("migration") || (path.endsWith(".sql") && /\b(?:create|alter|drop)\s+(?:table|index|schema|database|policy|user|role)\b|\badd\s+column\b/i.test(blob))) {
    findings.push(finding(lang, "migration", "high", path, {
      en: "Schema change",
      pt: "Mudança de schema",
      detailEn: "Read the up path and how it rolls back. A default on a hot table is still a migration.",
      detailPt: "Leia o caminho de ida e como ele volta. Um default numa tabela quente continua sendo migração.",
    }));
  }

  if (/dangerouslySetInnerHTML|\.innerHTML\s*=/.test(blob)) {
    findings.push(finding(lang, "html-sink", "medium", path, {
      en: "HTML sink",
      pt: "Sink de HTML",
      detailEn: "Data written as HTML needs an escape or a sanitizer at this call, not three frames up.",
      detailPt: "Dado escrito como HTML precisa de escape ou sanitizer nesta chamada, não três frames acima.",
    }));
  }

  const hasHigh = findings.some((item) => item.severity === "high");
  if (!hasHigh && !isTest && hasSensitiveRole(roles) && file.status !== "deleted" && file.additions + file.deletions > 0) {
    const surface = sensitiveName(lang, roles);
    findings.push(finding(lang, "sensitive-surface", "medium", path, {
      en: `${surface} path changed`,
      pt: `Caminho de ${surface} mudou`,
      detailEn: "Read the behavior here before docs, lockfiles, or generated code.",
      detailPt: "Leia o comportamento aqui antes de docs, lockfiles ou código gerado.",
    }));
  }

  if (roles.includes("deps") && manifestChanged(file)) {
    findings.push(finding(lang, "dependency-manifest", "medium", path, {
      en: "Dependency manifest changed",
      pt: "Manifesto de dependências mudou",
      detailEn: "Read the new range here. The lockfile, later in the packet, is the resolved pin.",
      detailPt: "Leia o intervalo novo aqui. O lockfile, mais adiante no pacote, é o pin resolvido.",
    }));
  }

  if (roles.includes("lockfile") && (file.hunks.length > 0 || file.isBinary || file.additions + file.deletions > 0)) {
    findings.push(finding(lang, "lockfile", "medium", path, {
      en: "Lockfile changed",
      pt: "Lockfile mudou",
      detailEn: "Skim this after the manifest. You are looking for a surprise package, not a line-by-line read.",
      detailPt: "Passe o olho depois do manifesto. Você procura um pacote surpresa, não uma leitura linha a linha.",
    }));
  }

  if (isApiFile(path) && !isTest && exportChanged(file)) {
    findings.push(finding(lang, "api-change", "medium", path, {
      en: "Public export changed",
      pt: "Export público mudou",
      detailEn: "This is the contract other callers will see. Read it before the implementation that backs it.",
      detailPt: "Este é o contrato que os outros chamadores vão ver. Leia antes da implementação que sustenta ele.",
    }));
  }

  if (roles.includes("config")) {
    findings.push(finding(lang, "runtime-config", "medium", path, {
      en: "Runtime packaging changed",
      pt: "Empacotamento de runtime mudou",
      detailEn: "Image, cluster, or infra changed. Read it before the changelog.",
      detailPt: "Imagem, cluster ou infra mudou. Leia antes do changelog.",
    }));
  }

  const noisy = role === "lockfile" || role === "generated" || role === "asset" || role === "docs";
  if (!noisy && file.additions + file.deletions >= context.largeFileLines) {
    findings.push(finding(lang, "large-file", "medium", path, {
      en: "Large file in the diff",
      pt: "Arquivo grande no diff",
      detailEn: `${file.additions + file.deletions} changed lines. If it mixes two concerns, ask for a split.`,
      detailPt: `${file.additions + file.deletions} linhas alteradas. Se mistura dois assuntos, peça para separar.`,
    }));
  }

  if (roles.includes("ci") && !findings.some((item) => CI_SPECIFIC.has(item.ruleId))) {
    findings.push(finding(lang, "ci-changed", "low", path, {
      en: "Automation changed",
      pt: "Automação mudou",
      detailEn: "No new write permission stood out. Still read which trigger and which secrets the job can see.",
      detailPt: "Nenhuma permissão de escrita nova saltou. Ainda assim, leia o gatilho e quais segredos o job enxerga.",
    }));
  }

  if (file.isBinary) {
    findings.push(finding(lang, "binary-file", "low", path, {
      en: "Binary file",
      pt: "Arquivo binário",
      detailEn: "There is no line diff. Open the asset itself if the change is user-visible.",
      detailPt: "Não há diff de linhas. Abra o asset se a mudança aparece para alguém.",
    }));
  }

  if (roles.includes("generated")) {
    findings.push(finding(lang, "generated-file", "info", path, {
      en: "Generated file",
      pt: "Arquivo gerado",
      detailEn: "Review the source that generates it. This file can wait.",
      detailPt: "Revise a fonte que gera ele. Este arquivo pode esperar.",
    }));
  }
}

function baseAssessment(
  file: DiffFile,
  path: string,
  roles: Role[],
  role: Role,
  findings: Finding[],
): FileAssessment {
  const riskScore = scoreOf(findings);
  const riskLabel = labelFor(riskScore, findings);
  let band = bandFor(role);
  if (findings.some((item) => item.severity === "high")) band = Math.min(band, 20);
  return {
    path,
    previousPath: file.oldPath !== path ? file.oldPath : null,
    status: file.status,
    roles,
    primaryRole: role,
    additions: file.additions,
    deletions: file.deletions,
    riskScore,
    riskLabel,
    disposition: dispositionOf(role, riskLabel),
    band,
    findings,
    hunks: file.hunks,
    isBinary: file.isBinary,
  };
}

function copyScore(file: FileAssessment): void {
  file.riskScore = scoreOf(file.findings);
  file.riskLabel = labelFor(file.riskScore, file.findings);
  file.band = bandFor(file.primaryRole);
  if (file.findings.some((item) => item.severity === "high")) file.band = Math.min(file.band, 20);
  file.disposition = dispositionOf(file.primaryRole, file.riskLabel);
}

function needsTestGap(file: FileAssessment, testGapLines: number): boolean {
  if (file.status === "deleted" || file.isBinary) return false;
  if (file.findings.some((item) => item.ruleId === "whitespace-only")) return false;
  const interesting = file.primaryRole === "source" || file.primaryRole === "api" || file.primaryRole === "payment" || file.primaryRole === "auth" || file.primaryRole === "crypto";
  if (!interesting) return false;
  if (file.roles.includes("test") || file.roles.includes("generated") || file.roles.includes("docs")) return false;
  return file.additions + file.deletions >= testGapLines;
}

function dispositionOf(role: Role, label: FileAssessment["riskLabel"]): Disposition {
  if (label === "high") return "now";
  if (role === "lockfile" || role === "generated" || role === "asset" || role === "docs") return "later";
  if (label === "medium") return "soon";
  return "later";
}

function hasSensitiveRole(roles: readonly Role[]): boolean {
  return roles.includes("auth") || roles.includes("crypto") || roles.includes("payment");
}

function sensitiveName(lang: Lang, roles: readonly Role[]): string {
  if (roles.includes("auth")) return L(lang, "Auth", "auth");
  if (roles.includes("payment")) return L(lang, "Billing", "cobrança");
  return L(lang, "Signing", "assinatura");
}

function manifestChanged(file: DiffFile): boolean {
  const base = pathOf(file).split("/").pop()?.toLowerCase() ?? "";
  const lines = [...addedTexts(file), ...removedTexts(file)];
  if (base === "package.json") {
    return lines.some((line) => {
      const match = /^\s*"([^"]+)"\s*:\s*"[\d^~*<>=]/.exec(line);
      return match !== null && match[1] !== "version";
    });
  }
  if (base === "requirements.txt" || base === "go.mod" || base === "cargo.toml" || base === "gemfile") {
    return lines.some((line) => line.trim() !== "" && !line.trim().startsWith("#") && !line.trim().startsWith("//"));
  }
  return lines.length > 0;
}

function isApiFile(filePath: string): boolean {
  return /(?:^|\/)(?:api|routes|handlers|controllers)\//.test(filePath) || /\/index\.[cm]?[jt]s$/.test(filePath) || /(?:openapi|schema\.graphql|\.proto)$/i.test(filePath);
}

function exportChanged(file: DiffFile): boolean {
  const lines = [...addedTexts(file), ...removedTexts(file)];
  return lines.some((line) => /^\s*(?:export\s|pub(?:lic)?\s|def\s|class\s|function\s)/.test(line));
}

function addedTexts(file: DiffFile): string[] {
  const lines: string[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.kind === "add") lines.push(line.text);
    }
  }
  return lines;
}

function removedTexts(file: DiffFile): string[] {
  const lines: string[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.kind === "del") lines.push(line.text);
    }
  }
  return lines;
}

export function isWhitespaceOnly(file: DiffFile): boolean {
  const adds: string[] = [];
  const dels: string[] = [];
  const rawAdds: string[] = [];
  const rawDels: string[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.kind === "add") {
        adds.push(line.text.trim());
        rawAdds.push(line.text);
      } else if (line.kind === "del") {
        dels.push(line.text.trim());
        rawDels.push(line.text);
      }
    }
  }
  if (adds.length === 0 || adds.length !== dels.length) return false;
  const norm = (values: string[]): string => values.slice().sort().join("\n");
  return norm(adds) === norm(dels) && norm(rawAdds) !== norm(rawDels);
}

function finding(
  lang: Lang,
  ruleId: string,
  severity: Severity,
  path: string | null,
  text: { en: string; pt: string; detailEn: string; detailPt: string },
): Finding {
  return {
    ruleId,
    severity,
    path,
    title: L(lang, text.en, text.pt),
    detail: L(lang, text.detailEn, text.detailPt),
  };
}

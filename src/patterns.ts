export interface SecretPattern {
  name: string;
  namePt: string;
  expression: RegExp;
  mask: string;
}

export interface ExecPattern {
  name: string;
  namePt: string;
  expression: RegExp;
  files?: RegExp;
}

const PRIVATE_KEY_BEGIN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const PRIVATE_KEY_END = /-----END [A-Z ]*PRIVATE KEY-----/;

export const SECRET_PATTERNS: readonly SecretPattern[] = [
  { name: "AWS access key id", namePt: "access key id da AWS", expression: /\b(AKIA)[0-9A-Z]{16}\b/, mask: "$1••••••••••••" },
  { name: "private key block", namePt: "bloco de chave privada", expression: PRIVATE_KEY_BEGIN, mask: "-----BEGIN PRIVATE KEY----- ••••" },
  { name: "GitHub token", namePt: "token do GitHub", expression: /\b(gh[pousr]_)[A-Za-z0-9]{20,}\b/, mask: "$1••••" },
  { name: "GitHub fine-grained token", namePt: "token fine-grained do GitHub", expression: /\b(github_pat_)[A-Za-z0-9_]{20,}/, mask: "$1••••" },
  { name: "Slack token", namePt: "token do Slack", expression: /\b(xox)[baprs]-[A-Za-z0-9-]{10,}/, mask: "$1••••" },
  { name: "Stripe live key", namePt: "chave live da Stripe", expression: /\b([sr]k_live_)[A-Za-z0-9]{8,}\b/, mask: "$1••••" },
  { name: "Anthropic API key", namePt: "chave de API da Anthropic", expression: /\b(sk-ant-)[A-Za-z0-9_-]{20,}/, mask: "$1••••" },
  { name: "OpenAI API key", namePt: "chave de API da OpenAI", expression: /\b(sk-(?:proj|svcacct|admin)-)[A-Za-z0-9_-]{20,}/, mask: "$1••••" },
  { name: "Google API key", namePt: "chave de API do Google", expression: /\b(AIza)[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/, mask: "$1••••" },
  { name: "npm token", namePt: "token do npm", expression: /\b(npm_)[A-Za-z0-9]{36}\b/, mask: "$1••••" },
];

const PY = /\.py$/;
const RB = /\.(?:rb|rake)$|(?:^|\/)(?:Rakefile|Gemfile)$/;
const PHP = /\.php$/;

export const CODE_EXEC_PATTERNS: readonly ExecPattern[] = [
  { name: "eval", namePt: "eval", expression: /\beval\s*\(/ },
  { name: "Function constructor", namePt: "construtor Function", expression: /\bnew\s+Function\s*\(/ },
  { name: "pickle.loads", namePt: "pickle.loads", expression: /\bpickle\.loads\s*\(/ },
  { name: "os.system", namePt: "os.system", expression: /\bos\.system\s*\(/ },
  { name: "shell=True", namePt: "shell=True", expression: /\bshell\s*=\s*True\b/ },
  { name: "child_process", namePt: "child_process", expression: /\b(?:child_process|execSync|execFileSync)\b/ },
  { name: "os.popen", namePt: "os.popen", expression: /\bos\.popen\s*\(/, files: PY },
  { name: "exec()", namePt: "exec()", expression: /(?<![\w.])exec\s*\(/, files: PY },
  { name: "marshal.loads", namePt: "marshal.loads", expression: /\bmarshal\.loads\s*\(/, files: PY },
  { name: "Ruby system/exec/spawn", namePt: "system/exec/spawn do Ruby", expression: /(?<![\w.])(?:system|exec|spawn)\s*[("'`]/, files: RB },
  { name: "Ruby backtick or %x with interpolation", namePt: "crase ou %x do Ruby com interpolação", expression: /`[^`]*#\{|%x[({[][^)}\]]*#\{/, files: RB },
  { name: "IO.popen / Open3", namePt: "IO.popen / Open3", expression: /\b(?:IO\.popen|Open3\.\w+)\s*[(\s]/, files: RB },
  { name: "Marshal.load", namePt: "Marshal.load", expression: /\bMarshal\.load\s*\(/, files: RB },
  { name: "exec.Command", namePt: "exec.Command", expression: /\bexec\.Command(?:Context)?\s*\(/, files: /\.go$/ },
  { name: "PHP shell function", namePt: "função de shell do PHP", expression: /(?<![\w>:$])(?:shell_exec|exec|system|passthru|proc_open|popen)\s*\(/, files: PHP },
  { name: "unserialize", namePt: "unserialize", expression: /(?<![\w>:$])unserialize\s*\(/, files: PHP },
  { name: "Runtime.exec / ProcessBuilder", namePt: "Runtime.exec / ProcessBuilder", expression: /\bRuntime\.getRuntime\(\)\.exec\s*\(|\bProcessBuilder\s*\(/, files: /\.(?:java|kt|kts|scala)$/ },
  { name: "Command::new", namePt: "Command::new", expression: /\bCommand::new\s*\(/, files: /\.rs$/ },
  { name: "Process.Start", namePt: "Process.Start", expression: /\bProcess\.Start\s*\(/, files: /\.cs$/ },
];

const MASKS: readonly { expression: RegExp; mask: string }[] = SECRET_PATTERNS
  .filter((pattern) => pattern.expression !== PRIVATE_KEY_BEGIN)
  .map((pattern) => ({ expression: new RegExp(pattern.expression.source, "g"), mask: pattern.mask }));

export function redactText(value: string): string {
  let text = value
    .replace(new RegExp(PRIVATE_KEY_BEGIN.source, "g"), "-----BEGIN PRIVATE KEY----- ••••")
    .replace(new RegExp(PRIVATE_KEY_END.source, "g"), "-----END PRIVATE KEY-----");
  for (const { expression, mask } of MASKS) text = text.replace(expression, mask);
  return text;
}

export function redactLineSequence(lines: readonly string[]): string[] {
  let insideKey = false;
  return lines.map((line) => {
    if (PRIVATE_KEY_BEGIN.test(line)) {
      insideKey = true;
      return "-----BEGIN PRIVATE KEY----- ••••";
    }
    if (insideKey) {
      if (PRIVATE_KEY_END.test(line)) insideKey = false;
      return "••••";
    }
    return redactText(line);
  });
}

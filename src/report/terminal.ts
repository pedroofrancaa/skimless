import { dispositionLabel, footerNote, L, riskLabelText } from "../copy.ts";
import type { ReviewPacket, RiskLabel, Severity } from "../types.ts";

export interface TerminalOptions {
  color?: boolean;
}

export function renderTerminal(packet: ReviewPacket, options: TerminalOptions = {}): string {
  const color = options.color ?? false;
  const paint = (code: string, text: string): string => (color ? `\u001b[${code}m${text}\u001b[0m` : text);
  const { stats } = packet;
  const lines = [
    `${paint("1", "skimless")}  ${packet.headline}`,
    packet.lede,
    "",
    `${paint("2", packet.id)}  ${labelColor(paint, stats.riskLabel, riskLabelText(packet.language, stats.riskLabel))} ${stats.riskScore}   ${stats.files} ${L(packet.language, "files", "arquivos")}   +${stats.additions} −${stats.deletions}   ~${stats.minutes} min`,
    "",
    paint("1", packet.language === "pt" ? "Ordem de leitura" : "Reading order"),
  ];

  packet.readingOrder.forEach((stop, index) => {
    const number = String(index + 1).padStart(2, " ");
    lines.push(
      `${paint("2", number)}  ${stop.path}`,
      `    ${dispositionLabel(packet.language, stop.disposition)} · ${stop.reason}`,
    );
  });

  lines.push("", paint("1", packet.language === "pt" ? "Achados" : "Findings"));
  if (packet.findings.length === 0) {
    lines.push(packet.language === "pt" ? "Nenhum." : "None.");
  } else {
    for (const finding of packet.findings) {
      const where = finding.path ? `  ${finding.path}` : "";
      lines.push(`${severityColor(paint, finding.severity)}  ${finding.title}${where}`);
      lines.push(`    ${finding.detail}`);
    }
  }

  lines.push(
    "",
    packet.language === "pt"
      ? "Pacote HTML: skimless review --format html --out skimless.html"
      : "HTML packet: skimless review --format html --out skimless.html",
    "",
    paint("2", footerNote(packet.language)),
    "",
  );
  return lines.join("\n");
}

function labelColor(paint: (code: string, text: string) => string, label: RiskLabel, text: string): string {
  const code = label === "high" ? "31" : label === "medium" ? "33" : label === "low" ? "32" : "2";
  return paint(code, text);
}

function severityColor(paint: (code: string, text: string) => string, severity: Severity): string {
  const code = severity === "high" ? "31" : severity === "medium" ? "33" : severity === "low" ? "32" : "2";
  return paint(code, severity.padEnd(6, " "));
}

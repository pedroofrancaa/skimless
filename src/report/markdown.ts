import { dispositionLabel, footerNote, L, riskLabelText, roleLabel, severityLabel, statusLabel } from "../copy.ts";
import type { ReviewPacket, Severity } from "../types.ts";

const SUMMARY_STOPS = 50;

export function renderSummary(packet: ReviewPacket): string {
  return renderMarkdown(packet, { files: false });
}

export function renderMarkdown(packet: ReviewPacket, options: { files?: boolean } = {}): string {
  const withFiles = options.files !== false;
  const { stats } = packet;
  const lang = packet.language;
  const count = (severity: Severity): string => `${severityLabel(lang, severity)} ${stats.counts[severity]}`;
  const lines: string[] = [
    `# ${packet.headline}`,
    "",
    packet.lede,
    "",
    `- ${L(lang, "Packet", "Pacote")} \`${packet.id}\``,
    `- ${L(lang, "Risk", "Risco")} ${riskLabelText(lang, stats.riskLabel)} (${stats.riskScore})`,
    `- ${stats.files} ${L(lang, "files", "arquivos")} · +${stats.additions} −${stats.deletions} · ~${stats.minutes} min`,
    `- ${(["high", "medium", "low", "info"] as const).map(count).join(" · ")}`,
    "",
    `## ${L(lang, "Reading order", "Ordem de leitura")}`,
    "",
  ];

  const stops = withFiles ? packet.readingOrder : packet.readingOrder.slice(0, SUMMARY_STOPS);
  stops.forEach((stop, index) => {
    lines.push(
      `${index + 1}. \`${stop.path}\` — ${dispositionLabel(packet.language, stop.disposition)} · ${stop.reason}`,
    );
  });
  const hidden = packet.readingOrder.length - stops.length;
  if (hidden > 0) {
    lines.push("", packet.language === "pt" ? `…e mais ${hidden} arquivos no pacote completo.` : `…and ${hidden} more files in the full packet.`);
  }

  lines.push("", `## ${L(lang, "Findings", "Achados")}`, "");
  if (packet.findings.length === 0) {
    lines.push(packet.language === "pt" ? "Nenhum achado." : "No findings.");
  } else {
    for (const finding of packet.findings) {
      const where = finding.path ? ` \`${finding.path}\`` : "";
      lines.push(`- **${severityLabel(lang, finding.severity)}** ${finding.title}${where} — ${finding.detail}`);
    }
  }

  if (withFiles) lines.push("", `## ${L(lang, "Files", "Arquivos")}`, "");
  for (const file of withFiles ? packet.files : []) {
    lines.push(`### \`${file.path}\``, "");
    lines.push(
      `${statusLabel(lang, file.status)} · ${roleLabel(lang, file.primaryRole)} · +${file.additions} −${file.deletions} · ${riskLabelText(lang, file.riskLabel)} ${file.riskScore}`,
    );
    if (file.previousPath) lines.push("", `${L(lang, "Renamed from", "Renomeado de")} \`${file.previousPath}\`.`);
    for (const finding of file.findings) {
      lines.push("", `- **${severityLabel(lang, finding.severity)}** ${finding.title}. ${finding.detail}`);
    }
    lines.push("", "```diff");
    lines.push(renderDiff(file.hunks, file.isBinary, packet.language));
    lines.push("```", "");
  }

  if (!withFiles) lines.push("");
  lines.push("---", "", footerNote(packet.language), "");
  return lines.join("\n");
}

function renderDiff(hunks: ReviewPacket["files"][number]["hunks"], binary: boolean, lang: ReviewPacket["language"]): string {
  if (binary) return lang === "pt" ? "(arquivo binário)" : "(binary file)";
  const out: string[] = [];
  let shown = 0;
  for (const hunk of hunks) {
    out.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@ ${hunk.section}`.trimEnd());
    for (const line of hunk.lines) {
      if (shown >= 80) return `${out.join("\n")}\n…`;
      const marker = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
      out.push(`${marker}${line.text}`);
      shown += 1;
    }
  }
  return out.join("\n");
}

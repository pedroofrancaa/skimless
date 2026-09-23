import { dispositionLabel, footerNote, riskLabelText, roleLabel, severityLabel, statusLabel } from "../copy.ts";
import { REPORT_CSS } from "./styles.ts";
import type { FileAssessment, ReviewPacket, Severity } from "../types.ts";

export function renderHtml(packet: ReviewPacket): string {
  const { stats } = packet;
  const generated = packet.generatedAt.slice(0, 16).replace("T", " ");
  const title = `Skimless · ${packet.headline}`;
  return `<!DOCTYPE html>
<html lang="${packet.language === "pt" ? "pt-BR" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,640&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
  <style>${REPORT_CSS}</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">Skimless<span>.</span></div>
      <div class="meta">packet ${escapeHtml(packet.id)} · ${escapeHtml(generated)} · ${escapeHtml(packet.order)}</div>
    </div>
    <article class="sheet">
      <header class="hero">
        <p class="eyebrow">${packet.language === "pt" ? "Pacote de revisão" : "Review packet"}</p>
        <h1>${escapeHtml(packet.headline)}</h1>
        <p class="lede">${escapeHtml(packet.lede)}</p>
        <div class="stats">
          ${stat(String(stats.files), packet.language === "pt" ? "arquivos" : "files")}
          ${stat(`+${stats.additions}`, packet.language === "pt" ? "adicionadas" : "added")}
          ${stat(`−${stats.deletions}`, packet.language === "pt" ? "removidas" : "removed")}
          ${stat(String(stats.minutes), "min")}
          ${stat(String(stats.riskScore), riskLabelText(packet.language, stats.riskLabel))}
        </div>
      </header>
      <section class="section">
        <h2>${packet.language === "pt" ? "Ordem de leitura" : "Reading order"}</h2>
        <ol class="order">
          ${packet.readingOrder.map((stop, index) => `
            <li>
              <a href="#file-${index + 1}">
                <span class="num">${String(index + 1).padStart(2, "0")}</span>
                <span>
                  <span class="path">${escapeHtml(stop.path)}</span><br>
                  <span class="reason">${escapeHtml(stop.reason)}</span>
                </span>
                <span class="pill ${stop.disposition}">${escapeHtml(dispositionLabel(packet.language, stop.disposition))}</span>
              </a>
            </li>`).join("")}
        </ol>
      </section>
      <section class="section">
        <h2>${packet.language === "pt" ? "Achados" : "Findings"}</h2>
        <div class="filters">
          <button type="button" class="on" data-sev="all">${packet.language === "pt" ? "Tudo" : "All"}</button>
          ${SEVERITIES.map((severity) => filterButton(packet, severity)).join("\n          ")}
        </div>
        ${packet.findings.length === 0 ? `<p class="note">${packet.language === "pt" ? "Nenhum achado." : "No findings."}</p>` : packet.findings.map((finding) => `
          <div class="finding" data-finding="${finding.severity}">
            <div class="pill ${finding.severity}">${escapeHtml(severityLabel(packet.language, finding.severity))}</div>
            <div>
              <strong>${escapeHtml(finding.title)}</strong>
              ${finding.path ? `<div class="path">${escapeHtml(finding.path)}</div>` : ""}
              <p>${escapeHtml(finding.detail)}</p>
            </div>
          </div>`).join("")}
      </section>
      <section class="section">
        <h2>${packet.language === "pt" ? "Arquivos" : "Files"}</h2>
        ${packet.files.map((file, index) => renderFile(packet, file, index)).join("")}
      </section>
    </article>
    <footer>${escapeHtml(footerNote(packet.language))}</footer>
  </div>
  <script>
    const buttons = document.querySelectorAll("[data-sev]");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((item) => item.classList.remove("on"));
        button.classList.add("on");
        const severity = button.getAttribute("data-sev");
        document.querySelectorAll("[data-finding]").forEach((row) => {
          row.hidden = severity !== "all" && row.getAttribute("data-finding") !== severity;
        });
      });
    });
  </script>
</body>
</html>
`;
}

function renderFile(packet: ReviewPacket, file: FileAssessment, index: number): string {
  const rename = file.previousPath
    ? `<div class="note">${packet.language === "pt" ? "Antes" : "Previously"} ${escapeHtml(file.previousPath)}</div>`
    : "";
  return `<article class="card" id="file-${index + 1}">
    <h3>${escapeHtml(file.path)}</h3>
    <div class="sub">${escapeHtml(statusLabel(packet.language, file.status))} · ${escapeHtml(roleLabel(packet.language, file.primaryRole))} · +${file.additions} −${file.deletions} · ${escapeHtml(riskLabelText(packet.language, file.riskLabel))} ${file.riskScore}</div>
    ${rename}
    ${file.findings.map((finding) => `<p class="file-finding"><span class="pill ${finding.severity}">${escapeHtml(severityLabel(packet.language, finding.severity))}</span> <span><strong>${escapeHtml(finding.title)}.</strong> ${escapeHtml(finding.detail)}</span></p>`).join("")}
    <div class="diff"><div class="diff-body">${renderDiff(file, packet.language)}</div></div>
  </article>`;
}

function renderDiff(file: FileAssessment, lang: ReviewPacket["language"]): string {
  if (file.isBinary) {
    return `<div class="hunk">${lang === "pt" ? "(arquivo binário)" : "(binary file)"}</div>`;
  }
  const rows: string[] = [];
  let shown = 0;
  let truncated = false;
  for (const hunk of file.hunks) {
    rows.push(`<div class="hunk">@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@ ${escapeHtml(hunk.section)}</div>`);
    for (const line of hunk.lines) {
      if (shown >= 80) {
        truncated = true;
        break;
      }
      const kind = line.kind === "context" ? "context" : line.kind;
      const marker = line.kind === "add" ? "+" : line.kind === "del" ? "−" : " ";
      const number = line.kind === "del" ? line.oldLine : line.newLine;
      rows.push(`<div class="${kind}"><span>${number ?? ""}</span><span>${marker}${escapeHtml(line.text)}</span></div>`);
      shown += 1;
    }
    if (truncated) break;
  }
  if (truncated) {
    rows.push(`<div class="hunk">${lang === "pt" ? "Primeiras 80 linhas." : "First 80 lines."}</div>`);
  }
  if (rows.length === 0) rows.push(`<div class="hunk">${lang === "pt" ? "(sem hunks)" : "(no hunks)"}</div>`);
  return rows.join("");
}

const SEVERITIES: readonly Severity[] = ["high", "medium", "low", "info"];

function filterButton(packet: ReviewPacket, severity: Severity): string {
  const count = packet.stats.counts[severity];
  const label = severityLabel(packet.language, severity);
  const text = `${label.charAt(0).toUpperCase()}${label.slice(1)} ${count}`;
  return `<button type="button" data-sev="${severity}"${count === 0 ? " disabled" : ""}>${escapeHtml(text)}</button>`;
}

function stat(value: string, label: string): string {
  return `<div class="stat"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

import { writeFileSync } from "node:fs";

import { dispositionLabel } from "../src/copy.ts";
import { readFixture } from "../src/demo/fixture.ts";
import { redactPacket, reviewDiff } from "../src/review.ts";
import type { Disposition } from "../src/types.ts";

const out = process.argv[2] ?? "docs/packet.svg";
const packet = redactPacket(reviewDiff(readFixture(), { now: new Date("2026-09-23T12:00:00.000Z") }));

const WIDTH = 920;
const CARD_X = 28;
const CARD_Y = 64;
const CARD_W = WIDTH - CARD_X * 2;
const ROW_H = 46;
const ROWS_Y = CARD_Y + 196;
const HEIGHT = ROWS_Y + packet.readingOrder.length * ROW_H + 52;

const SERIF = "Fraunces, 'Iowan Old Style', Palatino, Georgia, serif";
const SANS = "Outfit, 'Avenir Next', 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const PILL: Record<Disposition, { ink: string; bg: string }> = {
  now: { ink: "#8d241c", bg: "#f6ddd8" },
  soon: { ink: "#8a4b12", bg: "#f6e6cf" },
  later: { ink: "#514b43", bg: "#e7e1d6" },
};

const { stats } = packet;
const rows = packet.readingOrder.map((stop, index) => {
  const y = ROWS_Y + index * ROW_H;
  const label = dispositionLabel(packet.language, stop.disposition).toUpperCase();
  const pillW = Math.round(label.length * 6.7 + 18);
  const pillX = CARD_X + CARD_W - 28 - pillW;
  const color = PILL[stop.disposition];
  return [
    `<rect x="${CARD_X + 20}" y="${y}" width="${CARD_W - 40}" height="${ROW_H - 6}" rx="10" fill="#faf7f1"/>`,
    `<text x="${CARD_X + 38}" y="${y + 25}" font-family="${MONO}" font-size="13" fill="#6d655c">${String(index + 1).padStart(2, "0")}</text>`,
    `<text x="${CARD_X + 78}" y="${y + 17}" font-family="${MONO}" font-size="13" fill="#1b1814">${xml(stop.path)}</text>`,
    `<text x="${CARD_X + 78}" y="${y + 33}" font-family="${SANS}" font-size="12.5" fill="#6d655c">${xml(stop.reason)}</text>`,
    `<rect x="${pillX}" y="${y + 10}" width="${pillW}" height="20" rx="10" fill="${color.bg}"/>`,
    `<text x="${pillX + pillW / 2}" y="${y + 24}" text-anchor="middle" font-family="${MONO}" font-size="11" letter-spacing="0.4" fill="${color.ink}">${xml(label)}</text>`,
  ].join("\n  ");
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Skimless review packet: ${xml(packet.headline)}">
  <defs>
    <radialGradient id="glow" cx="12%" cy="-10%" r="70%">
      <stop offset="0" stop-color="#d84a2f" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#d84a2f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="18" fill="#13120f"/>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="18" fill="url(#glow)"/>
  <text x="${CARD_X + 4}" y="42" font-family="${SERIF}" font-size="26" letter-spacing="-1" fill="#f4efe6">Skimless<tspan fill="#d84a2f">.</tspan></text>
  <text x="${WIDTH - CARD_X - 4}" y="40" text-anchor="end" font-family="${MONO}" font-size="12" fill="#b9b1a6">packet ${xml(packet.id)} · ${xml(packet.order)}</text>
  <rect x="${CARD_X}" y="${CARD_Y}" width="${CARD_W}" height="${HEIGHT - CARD_Y - 20}" rx="16" fill="#f4efe6"/>
  <text x="${CARD_X + 28}" y="${CARD_Y + 38}" font-family="${MONO}" font-size="11.5" letter-spacing="1.6" fill="#d84a2f">REVIEW PACKET</text>
  <text x="${CARD_X + 26}" y="${CARD_Y + 88}" font-family="${SERIF}" font-size="46" letter-spacing="-1.8" fill="#1b1814">${xml(packet.headline)}</text>
  <text x="${CARD_X + 28}" y="${CARD_Y + 122}" font-family="${SANS}" font-size="15" fill="#3c3832">${xml(`${stats.files} files · +${stats.additions} −${stats.deletions} · about ${stats.minutes} min · ${stats.counts.high} high-priority findings`)}</text>
  <text x="${CARD_X + 28}" y="${CARD_Y + 166}" font-family="${SERIF}" font-size="22" letter-spacing="-0.6" fill="#1b1814">Reading order</text>
  ${rows.join("\n  ")}
</svg>
`;

writeFileSync(out, svg, "utf8");
process.stdout.write(`${out}\n`);

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

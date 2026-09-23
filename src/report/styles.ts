export const REPORT_CSS = `
:root {
  color-scheme: light;
  --bg: #13120f;
  --bg-2: #1c1a16;
  --paper: #f4efe6;
  --paper-2: #ebe4d6;
  --ink: #1b1814;
  --muted: #6d655c;
  --line: #ddd4c6;
  --accent: #d84a2f;
  --high: #8d241c;
  --high-bg: #f6ddd8;
  --med: #8a4b12;
  --med-bg: #f6e6cf;
  --low: #1e5c3a;
  --low-bg: #dceadf;
  --calm: #514b43;
  --calm-bg: #e7e1d6;
  --add: #e7f3ea;
  --add-ink: #145c32;
  --del: #f8e4e1;
  --del-ink: #8c1d1d;
  --shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
  --serif: "Fraunces", "Iowan Old Style", Palatino, Georgia, serif;
  --sans: "Outfit", "Avenir Next", "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background:
    radial-gradient(1200px 500px at 10% -10%, rgba(216, 74, 47, 0.18), transparent 50%),
    var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.5;
}
a { color: inherit; }
.wrap { max-width: 1080px; margin: 0 auto; padding: 32px 20px 80px; }
.top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: baseline;
  color: #f4efe6;
  margin-bottom: 18px;
}
.brand { font-family: var(--serif); font-size: 28px; letter-spacing: -0.04em; }
.brand span { color: var(--accent); }
.meta { color: #b9b1a6; font-family: var(--mono); font-size: 12px; }
.sheet {
  background: var(--paper);
  border-radius: 18px;
  box-shadow: var(--shadow);
  overflow: hidden;
}
.hero { padding: 36px 36px 28px; border-bottom: 1px solid var(--line); }
.eyebrow {
  margin: 0 0 8px;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-family: var(--serif);
  font-weight: 560;
  font-size: clamp(40px, 6vw, 68px);
  letter-spacing: -0.045em;
  line-height: 0.95;
}
.lede { max-width: 68ch; font-size: 18px; color: #3c3832; }
.stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 22px; }
.stat {
  background: var(--paper-2);
  border-radius: 12px;
  padding: 12px 12px 10px;
}
.stat b { display: block; font-family: var(--serif); font-size: 28px; letter-spacing: -0.04em; line-height: 1; }
.stat span { color: var(--muted); font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
.section { padding: 28px 36px; border-top: 1px solid var(--line); }
h2 { margin: 0 0 14px; font-family: var(--serif); font-size: 28px; letter-spacing: -0.03em; }
.order { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.order a {
  display: grid;
  grid-template-columns: 42px 1fr auto;
  gap: 12px;
  align-items: center;
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 12px;
  background: #faf7f1;
  border: 1px solid transparent;
}
.order a:hover { border-color: #c9bfb0; }
.num { font-family: var(--mono); color: var(--muted); }
.path { font-family: var(--mono); font-size: 13px; }
.reason { grid-column: 2; color: var(--muted); font-size: 14px; }
.filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
button {
  font: inherit;
  border: 1px solid var(--line);
  background: transparent;
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
}
button.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
button:disabled { opacity: 0.4; cursor: default; }
.finding {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 12px;
  align-items: start;
  padding: 14px 0;
  border-top: 1px solid var(--line);
}
.finding .pill { justify-self: start; margin-top: 1px; }
.finding p { margin: 4px 0 0; color: #3f3a34; }
.card { padding: 18px 0 8px; border-top: 1px solid var(--line); }
.card h3 { margin: 0; font-family: var(--mono); font-size: 14px; font-weight: 500; }
.sub { color: var(--muted); font-size: 13px; margin: 4px 0 10px; }
.diff {
  overflow: auto;
  background: #1b1916;
  color: #f3ecdf;
  border-radius: 12px;
  padding: 10px 0;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.55;
}
.diff-body { width: max-content; min-width: 100%; }
.diff-body > div { display: grid; grid-template-columns: 36px 1fr; gap: 14px; padding: 0 14px; white-space: pre; }
.diff-body > div > span:first-child { color: #7d7466; text-align: right; user-select: none; }
.diff .add { background: rgba(90, 154, 110, 0.18); }
.diff .del { background: rgba(196, 92, 84, 0.18); }
.diff .hunk { display: block; color: #b7aa98; padding: 2px 14px 4px; }
.file-finding { display: flex; gap: 10px; align-items: baseline; margin: 0 0 10px; color: #3f3a34; }
.file-finding .pill { flex-shrink: 0; }
.file-finding strong { color: var(--ink); font-weight: 600; }
.pill {
  justify-self: end;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 999px;
}
.high { color: var(--high); background: var(--high-bg); }
.medium { color: var(--med); background: var(--med-bg); }
.low { color: var(--low); background: var(--low-bg); }
.info, .calm, .later { color: var(--calm); background: var(--calm-bg); }
.now { color: var(--high); background: var(--high-bg); }
.soon { color: var(--med); background: var(--med-bg); }
.note { color: var(--muted); font-size: 13px; }
footer { color: #b9b1a6; padding: 18px 4px 0; font-size: 13px; max-width: 70ch; }
@media (max-width: 800px) {
  .hero, .section { padding: 22px 16px; }
  .stats { grid-template-columns: repeat(2, 1fr); }
  .order a, .finding { grid-template-columns: 1fr; }
  .reason { grid-column: auto; }
}
@media print {
  body { background: white; }
  .sheet { box-shadow: none; }
  .top, footer { color: black; }
  button { display: none; }
}
`;

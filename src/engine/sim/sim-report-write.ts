import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SimReportData } from "./sim-report-types";
import { serializeReport } from "./sim-report-serialize";

const VIEWER_PATH = resolve(import.meta.dirname, "sim-report-viewer.html");
const DATA_TAG_RE = /(<script\b[^>]*id="sim-data"[^>]*>)[\s\S]*?(<\/script>)/;

export function writeSimReport(data: SimReportData): void {
  const dir = resolve(process.cwd(), "sim-results");
  mkdirSync(dir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d+Z$/, "Z");
  const json = serializeReport(data);
  const template = readFileSync(VIEWER_PATH, "utf-8");
  const safeJson = json.replace(/<\/script>/gi, "<\\/script>");
  const html = template.replace(DATA_TAG_RE, `$1${safeJson}$2`);

  writeFileSync(resolve(dir, "latest.json"), json, "utf-8");
  writeFileSync(resolve(dir, "latest.html"), html, "utf-8");
  writeFileSync(resolve(dir, `${timestamp}.json`), json, "utf-8");
  writeFileSync(resolve(dir, `${timestamp}.html`), html, "utf-8");

  console.log(`\nSim report → sim-results/${timestamp}.{json,html} (+ latest.*)`);
}

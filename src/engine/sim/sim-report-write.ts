import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SimReportData } from "./sim-report-types";

const VIEWER_PATH = resolve(import.meta.dirname, "sim-report-viewer.html");
const DATA_TAG_RE = /(<script\b[^>]*id="sim-data"[^>]*>)[\s\S]*?(<\/script>)/;

export function writeSimReport(data: SimReportData): void {
  const dir = resolve(process.cwd(), "sim-results");
  mkdirSync(dir, { recursive: true });

  const json = JSON.stringify(data, null, 2);
  writeFileSync(resolve(dir, "latest.json"), json, "utf-8");

  const template = readFileSync(VIEWER_PATH, "utf-8");
  const safeJson = json.replace(/<\/script>/gi, "<\\/script>");
  writeFileSync(
    resolve(dir, "latest.html"),
    template.replace(DATA_TAG_RE, `$1${safeJson}$2`),
    "utf-8",
  );

  console.log(`\nSim report → sim-results/latest.{json,html}`);
}

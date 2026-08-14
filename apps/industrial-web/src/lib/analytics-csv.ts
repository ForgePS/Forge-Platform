/**
 * Client-side CSV helpers for Industrial Analytics domain payloads.
 * Short-term Phase C path; server audit + GAP-RPT-01 PDF/Excel remain deferred.
 */

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(","));
  }
  return `${lines.join("\n")}\n`;
}

type Named = { key?: string; label: string; count: number };
type Trend = { bucket: string; value: number };
type Kpi = { id: string; label: string; value: number | string | null; unit?: string };

function namedSection(title: string, rows: Named[]): string {
  if (!rows.length) return "";
  return (
    `# ${title}\n` +
    rowsToCsv(
      ["key", "label", "count"],
      rows.map((r) => [r.key ?? r.label, r.label, r.count]),
    )
  );
}

function trendSection(title: string, points: Trend[]): string {
  if (!points.length) return "";
  return (
    `# ${title}\n` +
    rowsToCsv(
      ["bucket", "value"],
      points.map((p) => [p.bucket, p.value]),
    )
  );
}

function kpiSection(kpis: Kpi[]): string {
  if (!kpis.length) return "";
  return (
    `# KPIs\n` +
    rowsToCsv(
      ["id", "label", "value", "unit"],
      kpis.map((k) => [k.id, k.label, k.value, k.unit ?? ""]),
    )
  );
}

export type AnalyticsCsvSource = {
  domain: string;
  from: string;
  to: string;
  kpis?: Kpi[];
  tables?: Array<{ title: string; rows: Named[] }>;
  trends?: Array<{ title: string; points: Trend[] }>;
  bodyParts?: Array<{ bodyPart: string; count: number }>;
  findings?: Array<{ id: string; severity: string; summary: string }>;
  warnings?: string[];
};

export function buildAnalyticsCsv(source: AnalyticsCsvSource): string {
  const parts: string[] = [
    `# Forge Industrial Analytics — ${source.domain}`,
    `# window ${source.from} .. ${source.to}`,
    `# generatedAt ${new Date().toISOString()}`,
    "",
    kpiSection(source.kpis ?? []),
  ];

  for (const table of source.tables ?? []) {
    parts.push(namedSection(table.title, table.rows));
  }
  for (const trend of source.trends ?? []) {
    parts.push(trendSection(trend.title, trend.points));
  }
  if (source.bodyParts?.length) {
    parts.push(
      `# Injuries by body part\n` +
        rowsToCsv(
          ["bodyPart", "count"],
          source.bodyParts.map((r) => [r.bodyPart, r.count]),
        ),
    );
  }
  if (source.findings?.length) {
    parts.push(
      `# Evidence findings\n` +
        rowsToCsv(
          ["id", "severity", "summary"],
          source.findings.map((f) => [f.id, f.severity, f.summary]),
        ),
    );
  }
  if (source.warnings?.length) {
    parts.push(`# Warnings\n` + rowsToCsv(["warning"], source.warnings.map((w) => [w])));
  }

  return parts.filter((p) => p.trim().length > 0).join("\n");
}

export function downloadTextFile(filename: string, contents: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

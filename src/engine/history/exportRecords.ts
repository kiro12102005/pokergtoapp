import { cardToDisplayString } from "@/domain/cards/card";
import { HandRecord } from "./handRecord";

/** Full-fidelity backup - every field, as saved. */
export function recordsToJson(records: HandRecord[]): string {
  return JSON.stringify(records, null, 2);
}

function csvCell(value: unknown): string {
  const str = String(value ?? "");
  // Quote (and double any internal quotes) whenever the raw value would otherwise break the
  // format - a comma, a quote, or a newline (external_prompt is always multi-line).
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsvString(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const CSV_HEADERS = [
  "id",
  "created_at",
  "memo",
  "street",
  "hero_position",
  "effective_stack_bb",
  "pot_bb",
  "hero_cards",
  "board",
  "external_prompt",
  "ai_feedback",
  "tags",
];

/** A flat, spreadsheet-friendly summary - one row per saved hand. Deliberately doesn't try to
 *  flatten `results` (per-decision frequencies/rationale/gto) into columns - that's nested,
 *  variable-length data that doesn't fit a CSV row well; recordsToJson() is the full-fidelity
 *  export for anyone who wants that level of detail. */
export function recordsToCsv(records: HandRecord[]): string {
  const rows = records.map((r) => [
    r.id,
    r.createdAt,
    r.memo ?? "",
    r.snapshot.street,
    r.snapshot.heroPosition,
    r.snapshot.effectiveStackBB,
    r.snapshot.potBB,
    r.snapshot.heroCards.map(cardToDisplayString).join(" "),
    r.snapshot.board.map(cardToDisplayString).join(" "),
    r.externalPrompt,
    r.aiFeedback ?? "",
    r.tags.join(" / "),
  ]);
  return toCsvString([CSV_HEADERS, ...rows]);
}

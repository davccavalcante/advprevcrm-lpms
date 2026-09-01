import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ulid } from "ulid";
import { adminSupabase } from "@/lib/supabase/admin";
import { serverSupabase } from "@/lib/supabase/server";
import { PROJECT_VERSION } from "@/lib/trinity/project-identity";

/*
 * Every execution of a scheduled capture leaves a record in the office
 * database, successful or not, with the attempt, the reason of the failure and
 * what it brought back.
 *
 * These rows are what the health panel reads. A capture that stopped silently is
 * how a deadline is missed, so the office has to see the date of the last
 * successful capture per source on the same day it fails, and not on the eve of
 * a deadline.
 */

/* A screen asks as the person signed in. The scheduled capture has nobody
 * behind it, and only then does the office write with its own credential. */
async function runsDb(): Promise<SupabaseClient> {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? (supabase as SupabaseClient) : adminSupabase();
}

type CaptureRunRow = {
  id: string;
  source: string;
  started_at: string;
  finished_at: string;
  ok: boolean;
  attempts: number;
  query: string;
  status: number | null;
  reason: string | null;
  found: number;
  stored: number;
  duplicates: number;
  linked: number;
  suggested: number;
  unlinked: number;
  project_version: string;
};

const RUN_COLUMNS =
  "id, source, started_at, finished_at, ok, attempts, query, status, reason, found, stored, duplicates, linked, suggested, unlinked, project_version";

function runOf(row: CaptureRunRow): CaptureRun {
  return {
    id: row.id,
    source: row.source === "datajud" ? "datajud" : "djen",
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    ok: row.ok,
    attempts: row.attempts,
    query: row.query,
    status: row.status,
    reason: row.reason,
    found: row.found,
    stored: row.stored,
    duplicates: row.duplicates,
    linked: row.linked,
    suggested: row.suggested,
    unlinked: row.unlinked,
    projectVersion: row.project_version,
  };
}

export type CaptureSourceId = "djen" | "datajud";

export type CaptureRun = {
  id: string;
  source: CaptureSourceId;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  /* Which attempt of this execution succeeded or gave up, counting from one. */
  attempts: number;
  /* What the office asked for, so a failure can be reproduced by hand. */
  query: string;
  status: number | null;
  reason: string | null;
  found: number;
  stored: number;
  duplicates: number;
  linked: number;
  suggested: number;
  unlinked: number;
  projectVersion: string;
};

export async function recordRun(
  run: Omit<CaptureRun, "id" | "projectVersion">,
): Promise<CaptureRun> {
  const full: CaptureRun = {
    id: ulid(),
    projectVersion: PROJECT_VERSION,
    ...run,
  };
  const supabase = await runsDb();
  await supabase.from("capture_runs").insert({
    id: full.id,
    source: full.source,
    started_at: full.startedAt,
    finished_at: full.finishedAt,
    ok: full.ok,
    attempts: full.attempts,
    query: full.query,
    status: full.status,
    reason: full.reason,
    found: full.found,
    stored: full.stored,
    duplicates: full.duplicates,
    linked: full.linked,
    suggested: full.suggested,
    unlinked: full.unlinked,
    project_version: full.projectVersion,
  });
  return full;
}

export async function listRuns(): Promise<CaptureRun[]> {
  const supabase = await runsDb();
  const { data } = await supabase
    .from("capture_runs")
    .select(RUN_COLUMNS)
    .order("started_at", { ascending: false })
    .returns<CaptureRunRow[]>();
  return (data ?? []).map(runOf);
}

export type SourceHealth = {
  source: CaptureSourceId;
  label: string;
  role: string;
  /* Null when the office never captured from this source. Null is not an error
   * and is never dressed up as one: it means it has not run yet. */
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastResult: string | null;
  healthy: boolean;
  statusLabel: string;
};

const SOURCE_LABELS: Record<CaptureSourceId, { label: string; role: string }> =
  {
    djen: {
      label: "Diário de Justiça Eletrônico Nacional",
      role: "Fonte oficial da intimação. É daqui que nasce o prazo.",
    },
    datajud: {
      label: "DataJud, base de metadados do CNJ",
      role: "Acompanhamento de movimentação apenas. Jamais é fonte de prazo.",
    },
  };

/*
 * The sentence of the last result, written per source and with agreement. The
 * DJEN brings communications and the DataJud brings processes, so a single
 * sentence for both would say "1 comunicações" on the row of a source that
 * never carried a communication, and a card that writes that is a card the
 * office stops reading.
 */
function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function lastResultOf(run: CaptureRun): string {
  if (!run.ok) {
    return run.reason ?? "falha sem motivo registrado";
  }
  if (run.source === "datajud") {
    return `${counted(run.found, "processo consultado", "processos consultados")} no acompanhamento de movimentação`;
  }
  return `${counted(run.found, "comunicação encontrada", "comunicações encontradas")}, ${counted(run.stored, "nova", "novas")}, ${counted(run.duplicates, "já conhecida", "já conhecidas")}`;
}

/* How long a source may go without a successful capture before the office is
 * told it is late. Configuration, because the office decides its own tolerance. */
function staleAfterHours(): number {
  const raw = process.env.CAPTURE_STALE_AFTER_HOURS?.trim();
  const value = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 30;
}

export async function captureHealth(
  now: Date = new Date(),
): Promise<SourceHealth[]> {
  const runs = await listRuns();
  return (["djen", "datajud"] as CaptureSourceId[]).map((source) => {
    const ofSource = runs.filter((run) => run.source === source);
    const last = ofSource[0] ?? null;
    const lastSuccess = ofSource.find((run) => run.ok) ?? null;
    const labels = SOURCE_LABELS[source];

    if (last === null) {
      return {
        source,
        ...labels,
        lastRunAt: null,
        lastSuccessAt: null,
        lastResult: null,
        healthy: false,
        statusLabel: "Nunca executada",
      };
    }

    const hoursSinceSuccess =
      lastSuccess === null
        ? Number.POSITIVE_INFINITY
        : (now.getTime() - new Date(lastSuccess.startedAt).getTime()) /
          3_600_000;
    const late = hoursSinceSuccess > staleAfterHours();

    return {
      source,
      ...labels,
      lastRunAt: last.startedAt,
      lastSuccessAt: lastSuccess?.startedAt ?? null,
      lastResult: lastResultOf(last),
      healthy: last.ok && !late,
      statusLabel: !last.ok
        ? "Falha na última execução"
        : late
          ? "Captura atrasada"
          : "Em dia",
    };
  });
}

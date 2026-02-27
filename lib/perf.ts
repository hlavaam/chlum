type PerfMetaValue = string | number | boolean | null | undefined;
type PerfMeta = Record<string, PerfMetaValue>;

const perfEnabled = process.env.PERF_LOGGING === "1";

function nowMs() {
  return Date.now();
}

function formatMeta(meta?: PerfMeta) {
  if (!meta) return "";
  const parts = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function asErrorMeta(error: unknown): PerfMeta {
  if (error instanceof Error) {
    return { error_name: error.name, error_message: error.message };
  }
  return { error_message: String(error) };
}

type PerfTrace = {
  step: (name: string, meta?: PerfMeta) => void;
  end: (meta?: PerfMeta) => void;
  fail: (error: unknown, meta?: PerfMeta) => void;
};

const noopPerfTrace: PerfTrace = {
  step: () => {},
  end: () => {},
  fail: () => {},
};

export function startPerfTrace(scope: string, meta?: PerfMeta): PerfTrace {
  if (!perfEnabled) return noopPerfTrace;

  const traceId = Math.random().toString(36).slice(2, 8);
  const startedAt = nowMs();
  let lastStepAt = startedAt;

  console.log(`[perf][${scope}][${traceId}] start${formatMeta(meta)}`);

  return {
    step(name: string, stepMeta?: PerfMeta) {
      const current = nowMs();
      const deltaMs = current - lastStepAt;
      const totalMs = current - startedAt;
      lastStepAt = current;
      console.log(
        `[perf][${scope}][${traceId}] step=${name} delta_ms=${deltaMs} total_ms=${totalMs}${formatMeta(stepMeta)}`,
      );
    },
    end(endMeta?: PerfMeta) {
      const totalMs = nowMs() - startedAt;
      console.log(
        `[perf][${scope}][${traceId}] end total_ms=${totalMs}${formatMeta(endMeta)}`,
      );
    },
    fail(error: unknown, failMeta?: PerfMeta) {
      const totalMs = nowMs() - startedAt;
      console.error(
        `[perf][${scope}][${traceId}] fail total_ms=${totalMs}${formatMeta({
          ...asErrorMeta(error),
          ...failMeta,
        })}`,
      );
    },
  };
}

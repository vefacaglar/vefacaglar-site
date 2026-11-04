export type RuntimeFailure = {
  level: "error" | "warning";
  event: string;
  message: string;
};

type Reporter = (failure: RuntimeFailure, error: unknown, reportedAt: Error) => void;

let reporter: Reporter | undefined;

export function bindRuntimeFailureReporter(next: Reporter) {
  reporter = next;
  return () => {
    if (reporter === next) reporter = undefined;
  };
}

/** Messages are developer-authored. Pass raw errors separately for local logging. */
export function reportRuntimeFailure(event: string, message: string, error?: unknown, level: RuntimeFailure["level"] = "error") {
  if (!reporter) {
    const log = level === "warning" ? console.warn : console.error;
    if (error instanceof Error) log(message, error.message);
    else log(message);
    return;
  }
  const reportedAt = new Error();
  Error.captureStackTrace(reportedAt, reportRuntimeFailure);
  reporter({ level, event, message }, error, reportedAt);
}

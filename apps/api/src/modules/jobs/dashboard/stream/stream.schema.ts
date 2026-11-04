import { Type, Static } from "@sinclair/typebox";

export { JobIdParamsSchema as StreamJobParamsSchema, type JobIdParams as StreamJobParams } from "../../jobs.schema";

export const StreamJobQuerySchema = Type.Object({
  token: Type.Optional(
    Type.String({
      minLength: 1,
      maxLength: 2048,
      description:
        "Short-lived token from `POST .../stream-token` (alternative to the Bearer header, for direct browser connections).",
    })
  ),
  afterLogId: Type.Optional(
    Type.Integer({
      minimum: 0,
      description: "Only stream logs with a greater id. Overridden by the `Last-Event-ID` header.",
    })
  ),
});
export type StreamJobQuery = Static<typeof StreamJobQuerySchema>;

export const StreamJobHeadersSchema = Type.Object({
  "last-event-id": Type.Optional(
    Type.String({ description: "Id of the last received `log` event (set automatically by EventSource on reconnect)." })
  ),
});
export type StreamJobHeaders = Static<typeof StreamJobHeadersSchema>;

/** Documentation only: the body is a `text/event-stream`, not JSON. */
export const StreamJobResponseSchema = Type.String({
  description: [
    "`text/event-stream`. Starts with `retry: 3000`.",
    "`event: snapshot` / `data: JobSummary` — on connect and whenever the job changed.",
    "`event: log` / `id: <logId>` / `data: JobLog` — every log after the cursor, ascending.",
    "`event: done` / `data: {\"status\"}` — job reached succeeded/failed/cancelled and all logs were sent; the stream ends.",
    "`: ping` every 15 s. The server closes the stream after 30 min; reconnect with `Last-Event-ID`.",
  ].join("\n"),
});

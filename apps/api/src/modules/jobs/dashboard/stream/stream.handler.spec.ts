import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FastifyRequest } from "fastify";
import { StreamJobHandler } from "./stream.handler";
import type { IJobsRepository, Job, JobLog } from "../../jobs.repository.interface";
import type { IJobEventsListener } from "../../job-events.listener.interface";
import type { JobStream, SseSink } from "./job-stream";
import { NotFoundError } from "../../../../shared/http-errors";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

function createMockRepo(): Record<keyof IJobsRepository, any> {
  return {
    list: vi.fn(),
    findById: vi.fn(),
    listLogs: vi.fn(),
    findJobWithLogsAfter: vi.fn(),
    findActiveByConcurrencyKey: vi.fn(),
    enqueue: vi.fn(),
    cancelQueued: vi.fn(),
    requestCancel: vi.fn(),
    requeue: vi.fn(),
    listRecurring: vi.fn(),
    listRecurringOverview: vi.fn(),
    findRecurringById: vi.fn(),
    findRecurringByType: vi.fn(),
    updateRecurring: vi.fn(),
    listWorkers: vi.fn(),
  };
}

function createMockListener() {
  const callbacks: Array<() => void> = [];
  const unsubscribe = vi.fn();
  const listener: Record<keyof IJobEventsListener, any> = {
    subscribe: vi.fn((_jobId: string, onChange: () => void) => {
      callbacks.push(onChange);
      return unsubscribe;
    }),
    stop: vi.fn(),
  };
  return { listener, unsubscribe, notify: () => callbacks.forEach((cb) => cb()) };
}

function jobRow(overrides: Partial<Job> = {}): Job {
  return {
    id: JOB_ID,
    type: "search.reindex",
    status: "running",
    payload: {},
    progress: { processed: 0, total: 10 },
    checkpoint: null,
    concurrencyKey: "search.index",
    cancelRequested: false,
    attempts: 1,
    maxAttempts: 3,
    runAt: new Date("2026-01-01T00:00:00.000Z"),
    lockedBy: "worker-1",
    lockedAt: null,
    heartbeatAt: null,
    startedAt: new Date("2026-01-01T00:00:01.000Z"),
    finishedAt: null,
    error: null,
    recurringJobId: "search.reindex",
    createdBy: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function logRow(id: number, message = `log ${id}`): JobLog {
  return { id, jobId: JOB_ID, level: "info", message, createdAt: new Date("2026-01-01T00:00:05.000Z") };
}

const request = (query: Record<string, unknown> = {}, headers: Record<string, string> = {}, id = JOB_ID) =>
  ({ params: { id }, query, headers, log: { warn: vi.fn() } } as unknown as FastifyRequest<{ Params: any; Querystring: any }>);

interface ParsedEvent {
  event?: string;
  id?: string;
  data?: any;
  comment?: string;
  retry?: number;
}

function createSink() {
  const chunks: string[] = [];
  let writable = true;
  const sink: SseSink & { end: ReturnType<typeof vi.fn> } = {
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
      return writable;
    }),
    end: vi.fn(),
  };
  const events = (): ParsedEvent[] =>
    chunks
      .join("")
      .split("\n\n")
      .filter(Boolean)
      .map((block) => {
        const parsed: ParsedEvent = {};
        for (const line of block.split("\n")) {
          if (line.startsWith(": ")) parsed.comment = line.slice(2);
          else if (line.startsWith("retry: ")) parsed.retry = Number(line.slice(7));
          else if (line.startsWith("event: ")) parsed.event = line.slice(7);
          else if (line.startsWith("id: ")) parsed.id = line.slice(4);
          else if (line.startsWith("data: ")) parsed.data = JSON.parse(line.slice(6));
        }
        return parsed;
      });
  return {
    sink,
    events,
    named: (name: string) => events().filter((e) => e.event === name),
    setWritable: (value: boolean) => {
      writable = value;
    },
  };
}

describe("StreamJobHandler", () => {
  let mockRepo: Record<keyof IJobsRepository, any>;
  let mocks: ReturnType<typeof createMockListener>;
  let handler: StreamJobHandler;
  let stream: JobStream | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRepo = createMockRepo();
    mocks = createMockListener();
    handler = new StreamJobHandler(mockRepo as unknown as IJobsRepository, mocks.listener as unknown as IJobEventsListener);
    stream = undefined;
  });

  afterEach(() => {
    stream?.close();
    vi.useRealTimers();
  });

  async function open(initial: { job: Job; logs: JobLog[] }, req = request()) {
    mockRepo.findJobWithLogsAfter.mockResolvedValueOnce(initial);
    stream = await handler.handle(req);
    const sink = createSink();
    const onEnded = vi.fn();
    stream.start(sink.sink, onEnded);
    return { ...sink, onEnded, stream };
  }

  describe("before streaming", () => {
    it("throws NotFoundError for an unknown job without subscribing", async () => {
      mockRepo.findJobWithLogsAfter.mockResolvedValue(null);
      await expect(handler.handle(request())).rejects.toThrow(NotFoundError);
      await expect(handler.handle(request())).rejects.toThrow("err_job_not_found");
      expect(mocks.listener.subscribe).not.toHaveBeenCalled();
    });

    it("loads the last 500 logs (tail) when no cursor is given", async () => {
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [] });
      await handler.handle(request());
      expect(mockRepo.findJobWithLogsAfter).toHaveBeenCalledWith(JOB_ID, null, 500);
    });

    it("uses ?afterLogId as the cursor", async () => {
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [] });
      await handler.handle(request({ afterLogId: 42 }));
      expect(mockRepo.findJobWithLogsAfter).toHaveBeenCalledWith(JOB_ID, 42, 500);
    });

    it("lets the Last-Event-ID header override ?afterLogId", async () => {
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [] });
      await handler.handle(request({ afterLogId: 42 }, { "last-event-id": "100" }));
      expect(mockRepo.findJobWithLogsAfter).toHaveBeenCalledWith(JOB_ID, 100, 500);
    });

    it("does not subscribe or write before start()", async () => {
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [logRow(1)] });
      await handler.handle(request());
      expect(mocks.listener.subscribe).not.toHaveBeenCalled();
    });
  });

  describe("on connect", () => {
    it("writes retry, a snapshot and the backlog in ascending order", async () => {
      const { events, stream } = await open({ job: jobRow(), logs: [logRow(3), logRow(4)] });

      expect(events()).toEqual([
        { retry: 3000 },
        { event: "snapshot", data: expect.objectContaining({ id: JOB_ID, status: "running", progress: { processed: 0, total: 10 } }) },
        { event: "log", id: "3", data: { id: 3, level: "info", message: "log 3", createdAt: "2026-01-01T00:00:05.000Z" } },
        { event: "log", id: "4", data: expect.objectContaining({ id: 4 }) },
      ]);
      expect(mocks.listener.subscribe).toHaveBeenCalledWith(JOB_ID, expect.any(Function));
      expect(stream.logCursor).toBe(4);
    });

    it("continues after the last streamed log id", async () => {
      await open({ job: jobRow(), logs: [logRow(3), logRow(4)] });
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [logRow(5)] });

      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);

      expect(mockRepo.findJobWithLogsAfter).toHaveBeenLastCalledWith(JOB_ID, 4, 500);
    });

    it("continues after the Last-Event-ID cursor when the backlog is empty", async () => {
      await open({ job: jobRow(), logs: [] }, request({}, { "last-event-id": "77" }));
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [] });

      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);

      expect(mockRepo.findJobWithLogsAfter).toHaveBeenLastCalledWith(JOB_ID, 77, 500);
    });

    it("switches from the tail to cursor 0 when the job has no logs yet", async () => {
      await open({ job: jobRow(), logs: [] });
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [] });

      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);

      expect(mockRepo.findJobWithLogsAfter).toHaveBeenLastCalledWith(JOB_ID, 0, 500);
    });
  });

  describe("change detection", () => {
    it("sends a snapshot only when the job changed", async () => {
      const { named } = await open({ job: jobRow(), logs: [] });

      // Only updatedAt changed (e.g. heartbeat) → no snapshot.
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow({ updatedAt: new Date("2026-01-01T00:01:00.000Z") }), logs: [] });
      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);
      expect(named("snapshot")).toHaveLength(1);

      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow({ progress: { processed: 5, total: 10 } }), logs: [] });
      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);
      expect(named("snapshot")).toHaveLength(2);
      expect(named("snapshot")[1].data.progress).toEqual({ processed: 5, total: 10 });

      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow({ progress: { processed: 5, total: 10 }, cancelRequested: true }), logs: [] });
      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);
      expect(named("snapshot")).toHaveLength(3);
      expect(named("snapshot")[2].data.cancelRequested).toBe(true);
    });

    it("coalesces a burst of notifications into one fetch per 250 ms", async () => {
      await open({ job: jobRow(), logs: [] });
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [] });
      mockRepo.findJobWithLogsAfter.mockClear();

      for (let i = 0; i < 20; i++) mocks.notify();
      await vi.advanceTimersByTimeAsync(249);
      expect(mockRepo.findJobWithLogsAfter).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(mockRepo.findJobWithLogsAfter).toHaveBeenCalledTimes(1);
    });

    it("re-checks every 2 s without notifications (safety net)", async () => {
      await open({ job: jobRow(), logs: [] });
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [] });
      mockRepo.findJobWithLogsAfter.mockClear();

      // +1 ms: fake timers run a 0 ms timeout created during a tick 1 ms later.
      await vi.advanceTimersByTimeAsync(2_001);
      expect(mockRepo.findJobWithLogsAfter).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(mockRepo.findJobWithLogsAfter).toHaveBeenCalledTimes(2);
    });

    it("pages through a large backlog without waiting for notifications", async () => {
      handler.withOptions({ batchSize: 2 });
      const { named } = await open({ job: jobRow(), logs: [logRow(1), logRow(2)] });
      mockRepo.findJobWithLogsAfter
        .mockResolvedValueOnce({ job: jobRow(), logs: [logRow(3), logRow(4)] })
        .mockResolvedValueOnce({ job: jobRow(), logs: [logRow(5)] });

      await vi.advanceTimersByTimeAsync(500);

      expect(named("log").map((e) => e.id)).toEqual(["1", "2", "3", "4", "5"]);
    });

    it("keeps streaming after a failed refresh", async () => {
      const { named } = await open({ job: jobRow(), logs: [] });
      mockRepo.findJobWithLogsAfter.mockRejectedValueOnce(new Error("db down"));
      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);

      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [logRow(1)] });
      await vi.advanceTimersByTimeAsync(2_000);
      expect(named("log")).toHaveLength(1);
    });
  });

  describe("done", () => {
    it("sends done and ends right away for an already finished job", async () => {
      const { events, sink, onEnded } = await open({
        job: jobRow({ status: "succeeded", finishedAt: new Date("2026-01-01T00:10:00.000Z") }),
        logs: [logRow(9)],
      });

      expect(events().map((e) => e.event ?? "retry")).toEqual(["retry", "snapshot", "log", "done"]);
      expect(events().at(-1)?.data).toEqual({ status: "succeeded" });
      expect(sink.end).toHaveBeenCalledTimes(1);
      expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
      expect(onEnded).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("sends the terminal snapshot and remaining logs before done", async () => {
      const { events, sink } = await open({ job: jobRow(), logs: [logRow(1)] });
      mockRepo.findJobWithLogsAfter.mockResolvedValue({
        job: jobRow({ status: "failed", error: "boom" }),
        logs: [logRow(2, "error")],
      });

      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);

      const tail = events().slice(-3);
      expect(tail[0]).toMatchObject({ event: "snapshot", data: { status: "failed", error: "boom" } });
      expect(tail[1]).toMatchObject({ event: "log", id: "2" });
      expect(tail[2]).toEqual({ event: "done", data: { status: "failed" } });
      expect(sink.end).toHaveBeenCalledTimes(1);
    });

    it("flushes a full batch of logs before sending done", async () => {
      handler.withOptions({ batchSize: 2 });
      const terminal = jobRow({ status: "cancelled" });
      const { named, sink } = await open({ job: terminal, logs: [logRow(1), logRow(2)] });
      expect(named("done")).toHaveLength(0);

      mockRepo.findJobWithLogsAfter.mockResolvedValueOnce({ job: terminal, logs: [logRow(3)] });
      await vi.advanceTimersByTimeAsync(250);

      expect(named("log").map((e) => e.id)).toEqual(["1", "2", "3"]);
      expect(named("done")).toEqual([{ event: "done", data: { status: "cancelled" } }]);
      expect(sink.end).toHaveBeenCalledTimes(1);
    });

    it("ends without done when the job disappears", async () => {
      const { named, sink } = await open({ job: jobRow(), logs: [] });
      mockRepo.findJobWithLogsAfter.mockResolvedValue(null);
      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);

      expect(named("done")).toHaveLength(0);
      expect(sink.end).toHaveBeenCalledTimes(1);
      expect(mocks.unsubscribe).toHaveBeenCalled();
    });
  });

  describe("lifecycle", () => {
    it("unsubscribes, clears timers and never writes after close", async () => {
      const { sink, onEnded, stream } = await open({ job: jobRow(), logs: [] });
      const writes = (sink.write as ReturnType<typeof vi.fn>).mock.calls.length;
      mockRepo.findJobWithLogsAfter.mockClear();

      stream.close();
      mocks.notify();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
      expect(onEnded).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(mockRepo.findJobWithLogsAfter).not.toHaveBeenCalled();
      expect((sink.write as ReturnType<typeof vi.fn>).mock.calls.length).toBe(writes);
      expect(sink.end).not.toHaveBeenCalled();
    });

    it("does not write the result of a fetch that resolves after close", async () => {
      const { sink, stream } = await open({ job: jobRow(), logs: [] });
      let resolve!: (value: unknown) => void;
      mockRepo.findJobWithLogsAfter.mockReturnValueOnce(new Promise((r) => (resolve = r)));
      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);
      const writes = (sink.write as ReturnType<typeof vi.fn>).mock.calls.length;

      stream.close();
      resolve({ job: jobRow({ status: "succeeded" }), logs: [logRow(1)] });
      await vi.advanceTimersByTimeAsync(0);

      expect((sink.write as ReturnType<typeof vi.fn>).mock.calls.length).toBe(writes);
    });

    it("pings every 15 s", async () => {
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [] });
      const { events } = await open({ job: jobRow(), logs: [] });
      await vi.advanceTimersByTimeAsync(15_000);
      expect(events().filter((e) => e.comment === "ping")).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(events().filter((e) => e.comment === "ping")).toHaveLength(2);
    });

    it("ends after the max lifetime without done (client reconnects with Last-Event-ID)", async () => {
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [] });
      const { named, sink } = await open({ job: jobRow(), logs: [] });

      await vi.advanceTimersByTimeAsync(30 * 60_000);

      expect(sink.end).toHaveBeenCalledTimes(1);
      expect(named("done")).toHaveLength(0);
      expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("backpressure", () => {
    it("stops writing on a full buffer and resumes from the cursor after drain", async () => {
      mockRepo.findJobWithLogsAfter.mockResolvedValueOnce({ job: jobRow(), logs: [logRow(1), logRow(2), logRow(3)] });
      stream = await handler.handle(request());
      const sink = createSink();
      // retry + snapshot fit, then the first log fills the buffer.
      let count = 0;
      (sink.sink.write as ReturnType<typeof vi.fn>).mockImplementation(() => {
        count++;
        return count < 3;
      });
      stream.start(sink.sink);
      expect(stream.logCursor).toBe(1);

      // Paused: notifications and polls do not fetch.
      mockRepo.findJobWithLogsAfter.mockClear();
      mocks.notify();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockRepo.findJobWithLogsAfter).not.toHaveBeenCalled();

      (sink.sink.write as ReturnType<typeof vi.fn>).mockReturnValue(true);
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [logRow(2), logRow(3)] });
      stream.resume();
      await vi.advanceTimersByTimeAsync(250);

      expect(mockRepo.findJobWithLogsAfter).toHaveBeenCalledWith(JOB_ID, 1, 500);
      expect(stream.logCursor).toBe(3);
    });

    it("disconnects a client that does not drain in time", async () => {
      const { sink, setWritable, stream } = await open({ job: jobRow(), logs: [] });
      setWritable(false);
      mockRepo.findJobWithLogsAfter.mockResolvedValue({ job: jobRow(), logs: [logRow(1)] });
      mocks.notify();
      await vi.advanceTimersByTimeAsync(250);

      await vi.advanceTimersByTimeAsync(30_000);

      expect(stream.isClosed).toBe(true);
      expect(sink.end).toHaveBeenCalledTimes(1);
      expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});

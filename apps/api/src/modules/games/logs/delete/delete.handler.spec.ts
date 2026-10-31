import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteGameLogHandler } from "./delete.handler";
import type { IGameLogsRepository } from "../../game-logs.repository.interface";

describe("DeleteGameLogHandler", () => {
  let logsRepo: Record<keyof IGameLogsRepository, any>;
  let handler: DeleteGameLogHandler;

  beforeEach(() => {
    logsRepo = {
      findById: vi.fn().mockResolvedValue({ id: "l-1", userId: "u-1" }),
      delete: vi.fn(),
    } as unknown as Record<keyof IGameLogsRepository, any>;
    handler = new DeleteGameLogHandler(logsRepo);
  });

  it("deletes the owner's log", async () => {
    const result = await handler.handle({ params: { id: "l-1" }, user: { id: "u-1" } } as any);
    expect(logsRepo.delete).toHaveBeenCalledWith("l-1");
    expect(result).toEqual({ success: true });
  });

  it("refuses another user's log", async () => {
    await expect(handler.handle({ params: { id: "l-1" }, user: { id: "u-2" } } as any)).rejects.toThrow("Log not found.");
    expect(logsRepo.delete).not.toHaveBeenCalled();
  });
});

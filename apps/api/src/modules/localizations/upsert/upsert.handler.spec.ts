import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpsertLocalizationHandler } from "./upsert.handler";
import type { ILocalizationsRepository } from "../localizations.repository.interface";
import type { IEventBus } from "../../../shared/events/event-bus";
import { POST_ENTITY_CHANGED } from "../../posts/posts.events";

describe("UpsertLocalizationHandler", () => {
  let mockRepo: Record<keyof ILocalizationsRepository, any>;
  let mockEventBus: Record<keyof IEventBus, any>;
  let handler: UpsertLocalizationHandler;

  beforeEach(() => {
    mockRepo = {
      findOne: vi.fn(),
      upsert: vi.fn(),
      findByEntity: vi.fn(),
      findByEntities: vi.fn(),
    };
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
    };
    handler = new UpsertLocalizationHandler(
      mockRepo as unknown as ILocalizationsRepository,
      mockEventBus as unknown as IEventBus
    );
  });

  it("should pass all fields to repository.upsert and map the result", async () => {
    mockRepo.upsert.mockResolvedValue({
      id: "loc-1",
      entityType: "post",
      entityId: "p-1",
      languageCode: "tr",
      field: "title",
      value: "Yerelleştirilmiş başlık",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const result = await handler.handle({
      entityType: "post",
      entityId: "p-1",
      languageCode: "tr",
      field: "title",
      value: "Yerelleştirilmiş başlık",
    });

    expect(mockRepo.upsert).toHaveBeenCalledWith({
      entityType: "post",
      entityId: "p-1",
      languageCode: "tr",
      field: "title",
      value: "Yerelleştirilmiş başlık",
    });

    expect(result).toEqual({
      id: "loc-1",
      entityType: "post",
      entityId: "p-1",
      languageCode: "tr",
      field: "title",
      value: "Yerelleştirilmiş başlık",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("should publish a postChanged event when a post translation is upserted", async () => {
    mockRepo.upsert.mockResolvedValue({
      id: "loc-1",
      entityType: "post",
      entityId: "p-1",
      languageCode: "tr",
      field: "content",
      value: "Yerelleştirilmiş içerik",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await handler.handle({
      entityType: "post",
      entityId: "p-1",
      languageCode: "tr",
      field: "content",
      value: "Yerelleştirilmiş içerik",
    });

    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: POST_ENTITY_CHANGED,
      id: "p-1",
    });
  });

  it("should not publish any event for non-post entity types", async () => {
    mockRepo.upsert.mockResolvedValue({
      id: "loc-3",
      entityType: "page",
      entityId: "pg-1",
      languageCode: "tr",
      field: "title",
      value: "Başlık",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await handler.handle({
      entityType: "page",
      entityId: "pg-1",
      languageCode: "tr",
      field: "title",
      value: "Başlık",
    });

    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it("should support all entity types", async () => {
    mockRepo.upsert.mockResolvedValue({
      id: "loc-2",
      entityType: "project",
      entityId: "pr-1",
      languageCode: "tr",
      field: "summary",
      value: "Özet",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await handler.handle({
      entityType: "project",
      entityId: "pr-1",
      languageCode: "tr",
      field: "summary",
      value: "Özet",
    });

    expect(result.entityType).toBe("project");
  });

  it("should propagate repository errors", async () => {
    mockRepo.upsert.mockRejectedValue(new Error("db failure"));

    await expect(
      handler.handle({
        entityType: "page",
        entityId: "pg-1",
        languageCode: "tr",
        field: "title",
        value: "Başlık",
      })
    ).rejects.toThrow("db failure");
  });
});

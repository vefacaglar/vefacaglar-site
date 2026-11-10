import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteLocalizationHandler } from "./delete.handler";
import type { ILocalizationsRepository } from "../localizations.repository.interface";
import type { IEventBus } from "../../../shared/events/event-bus";
import { POST_ENTITY_CHANGED } from "../../posts/posts.events";

const ENTITY_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("DeleteLocalizationHandler", () => {
  let mockRepo: Record<keyof ILocalizationsRepository, any>;
  let mockEventBus: Record<keyof IEventBus, any>;
  let handler: DeleteLocalizationHandler;

  beforeEach(() => {
    mockRepo = {
      findOne: vi.fn(),
      upsert: vi.fn(),
      deleteOne: vi.fn(),
      deleteByEntity: vi.fn(),
      findByEntity: vi.fn(),
      findByEntities: vi.fn(),
    };
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
    };
    handler = new DeleteLocalizationHandler(
      mockRepo as unknown as ILocalizationsRepository,
      mockEventBus as unknown as IEventBus
    );
  });

  it("should delete a single field when field is provided", async () => {
    mockRepo.deleteOne.mockResolvedValue(1);

    const result = await handler.handle({
      entityType: "page",
      entityId: ENTITY_ID,
      languageCode: "tr",
      field: "title",
    });

    expect(mockRepo.deleteOne).toHaveBeenCalledWith({
      entityType: "page",
      entityId: ENTITY_ID,
      languageCode: "tr",
      field: "title",
    });
    expect(mockRepo.deleteByEntity).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, deletedCount: 1 });
  });

  it("should delete all fields for the entity when field is omitted", async () => {
    mockRepo.deleteByEntity.mockResolvedValue(3);

    const result = await handler.handle({
      entityType: "page",
      entityId: ENTITY_ID,
      languageCode: "tr",
    });

    expect(mockRepo.deleteByEntity).toHaveBeenCalledWith("page", ENTITY_ID, "tr");
    expect(mockRepo.deleteOne).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, deletedCount: 3 });
  });

  it("should publish postChanged when post localization rows are deleted", async () => {
    mockRepo.deleteByEntity.mockResolvedValue(2);

    const result = await handler.handle({
      entityType: "post",
      entityId: ENTITY_ID,
      languageCode: "tr",
    });

    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: POST_ENTITY_CHANGED,
      id: ENTITY_ID,
    });
    expect(result).toEqual({ success: true, deletedCount: 2 });
  });

  it("should not publish postChanged when zero post rows were deleted", async () => {
    mockRepo.deleteOne.mockResolvedValue(0);

    const result = await handler.handle({
      entityType: "post",
      entityId: ENTITY_ID,
      languageCode: "tr",
      field: "excerpt",
    });

    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, deletedCount: 0 });
  });

  it("should swallow event bus errors as best-effort after deleting post localizations", async () => {
    mockRepo.deleteOne.mockResolvedValue(1);
    mockEventBus.publish.mockRejectedValue(new Error("search down"));

    const result = await handler.handle({
      entityType: "post",
      entityId: ENTITY_ID,
      languageCode: "tr",
      field: "content",
    });

    expect(result).toEqual({ success: true, deletedCount: 1 });
  });

  it("should propagate repository errors", async () => {
    mockRepo.deleteByEntity.mockRejectedValue(new Error("db failure"));

    await expect(
      handler.handle({
        entityType: "project",
        entityId: ENTITY_ID,
        languageCode: "tr",
      })
    ).rejects.toThrow("db failure");
  });
});

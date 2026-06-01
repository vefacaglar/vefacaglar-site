import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetLocalizationHandler } from "./detail.handler";
import type { ILocalizationsRepository } from "../localizations.repository.interface";

describe("GetLocalizationHandler", () => {
  let mockRepo: Record<keyof ILocalizationsRepository, any>;
  let handler: GetLocalizationHandler;

  beforeEach(() => {
    mockRepo = {
      findOne: vi.fn(),
      upsert: vi.fn(),
      findByEntity: vi.fn(),
      findByEntities: vi.fn(),
    };
    handler = new GetLocalizationHandler(mockRepo as unknown as ILocalizationsRepository);
  });

  it("should return mapped row when found", async () => {
    mockRepo.findOne.mockResolvedValue({
      id: "loc-1",
      entityType: "post",
      entityId: "p-1",
      languageCode: "tr",
      field: "title",
      value: "Başlık",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const result = await handler.handle({
      entityType: "post",
      entityId: "p-1",
      languageCode: "tr",
      field: "title",
    });

    expect(mockRepo.findOne).toHaveBeenCalledWith({
      entityType: "post",
      entityId: "p-1",
      languageCode: "tr",
      field: "title",
    });
    expect(result).toEqual({
      id: "loc-1",
      entityType: "post",
      entityId: "p-1",
      languageCode: "tr",
      field: "title",
      value: "Başlık",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("should return null when localization is not found", async () => {
    mockRepo.findOne.mockResolvedValue(null);

    const result = await handler.handle({
      entityType: "post",
      entityId: "missing",
      languageCode: "tr",
      field: "title",
    });

    expect(result).toBeNull();
  });
});

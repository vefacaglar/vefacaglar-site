import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UploadImageHandler } from "./image.handler";
import type { IImageClient } from "./image-client.interface";
import { BadRequestError, HttpError } from "../../../shared/http-errors";
import { FastifyRequest } from "fastify";

vi.mock("file-type", () => ({
  default: {
    fromBuffer: vi.fn(),
  },
}));

import FileType from "file-type";

function makeBuffer(magic: number[]): Buffer {
  const buf = Buffer.alloc(8);
  magic.forEach((byte, i) => {
    buf[i] = byte;
  });
  return buf;
}

describe("UploadImageHandler", () => {
  let mockImageClient: Record<keyof IImageClient, any>;
  let handler: UploadImageHandler;

  beforeEach(() => {
    mockImageClient = { upload: vi.fn() };
    handler = new UploadImageHandler(mockImageClient as unknown as IImageClient);
    vi.clearAllMocks();
  });

  it("should upload a valid PNG file and return the URL", async () => {
    const buffer = makeBuffer([0x89, 0x50, 0x4e, 0x47]);

    const mockRequest = {
      file: async () => ({
        mimetype: "image/png",
        filename: "  My Photo (1).png ",
        toBuffer: async () => buffer,
      }),
      log: { error: vi.fn() },
    } as unknown as FastifyRequest;

    (FileType.fromBuffer as any).mockResolvedValue({ mime: "image/png", ext: "png" });
    mockImageClient.upload.mockResolvedValue("https://cdn.example.com/My-Photo-1.png");

    const result = await handler.handle(mockRequest);

    expect(mockImageClient.upload).toHaveBeenCalledWith(
      buffer,
      "My-Photo-1.png",
      "image/png"
    );
    expect(result).toEqual({ url: "https://cdn.example.com/My-Photo-1.png" });
  });

  it("should throw BadRequestError when no file is uploaded", async () => {
    const mockRequest = {
      file: async () => undefined,
      log: { error: vi.fn() },
    } as unknown as FastifyRequest;

    await expect(handler.handle(mockRequest)).rejects.toThrow(BadRequestError);
    await expect(handler.handle(mockRequest)).rejects.toThrow("No file uploaded.");
  });

  it("should throw BadRequestError when MIME type is not allowed", async () => {
    const mockRequest = {
      file: async () => ({
        mimetype: "application/pdf",
        filename: "doc.pdf",
        toBuffer: async () => Buffer.from("x"),
      }),
      log: { error: vi.fn() },
    } as unknown as FastifyRequest;

    await expect(handler.handle(mockRequest)).rejects.toThrow("Invalid file type.");
  });

  it("should throw BadRequestError when the buffer is empty", async () => {
    const mockRequest = {
      file: async () => ({
        mimetype: "image/png",
        filename: "x.png",
        toBuffer: async () => Buffer.alloc(0),
      }),
      log: { error: vi.fn() },
    } as unknown as FastifyRequest;

    await expect(handler.handle(mockRequest)).rejects.toThrow("Uploaded file is empty.");
  });

  it("should throw BadRequestError when the sniffed MIME does not match the declared one", async () => {
    const buffer = makeBuffer([0x00, 0x00, 0x00, 0x00]);
    const mockRequest = {
      file: async () => ({
        mimetype: "image/png",
        filename: "x.png",
        toBuffer: async () => buffer,
      }),
      log: { error: vi.fn() },
    } as unknown as FastifyRequest;

    (FileType.fromBuffer as any).mockResolvedValue({ mime: "image/jpeg", ext: "jpg" });

    await expect(handler.handle(mockRequest)).rejects.toThrow("Invalid file type.");
  });

  it("should throw BadRequestError when the sniffed type cannot be determined", async () => {
    const buffer = makeBuffer([0x00, 0x00, 0x00, 0x00]);
    const mockRequest = {
      file: async () => ({
        mimetype: "image/png",
        filename: "x.png",
        toBuffer: async () => buffer,
      }),
      log: { error: vi.fn() },
    } as unknown as FastifyRequest;

    (FileType.fromBuffer as any).mockResolvedValue(null);

    await expect(handler.handle(mockRequest)).rejects.toThrow("Invalid file type.");
  });

  it("should sanitize filenames by stripping path, normalizing spaces, removing unsafe chars", async () => {
    const buffer = makeBuffer([0x89, 0x50, 0x4e, 0x47]);

    const mockRequest = {
      file: async () => ({
        mimetype: "image/png",
        filename: "weird/!!name??.png",
        toBuffer: async () => buffer,
      }),
      log: { error: vi.fn() },
    } as unknown as FastifyRequest;

    (FileType.fromBuffer as any).mockResolvedValue({ mime: "image/png", ext: "png" });
    mockImageClient.upload.mockResolvedValue("https://cdn.example.com/name.png");

    await handler.handle(mockRequest);

    const filename = mockImageClient.upload.mock.calls[0][1];
    expect(filename).toBe("name.png");
  });

  it("should fall back to 'upload.<ext>' when filename is missing entirely", async () => {
    const buffer = makeBuffer([0xff, 0xd8, 0xff, 0xe0]);
    const mockRequest = {
      file: async () => ({
        mimetype: "image/jpeg",
        filename: undefined,
        toBuffer: async () => buffer,
      }),
      log: { error: vi.fn() },
    } as unknown as FastifyRequest;

    (FileType.fromBuffer as any).mockResolvedValue({ mime: "image/jpeg", ext: "jpg" });
    mockImageClient.upload.mockResolvedValue("https://cdn.example.com/upload.jpg");

    await handler.handle(mockRequest);

    const filename = mockImageClient.upload.mock.calls[0][1];
    expect(filename).toBe("upload.jpg");
  });

  it("should rethrow HttpError from image client without wrapping", async () => {
    const buffer = makeBuffer([0x89, 0x50, 0x4e, 0x47]);
    const mockRequest = {
      file: async () => ({
        mimetype: "image/png",
        filename: "x.png",
        toBuffer: async () => buffer,
      }),
      log: { error: vi.fn() },
    } as unknown as FastifyRequest;

    (FileType.fromBuffer as any).mockResolvedValue({ mime: "image/png", ext: "png" });
    const httpErr = new HttpError(502, "upstream down");
    mockImageClient.upload.mockRejectedValue(httpErr);

    await expect(handler.handle(mockRequest)).rejects.toBe(httpErr);
  });

  it("should wrap non-HttpError image client failures as a 500 HttpError and log", async () => {
    const buffer = makeBuffer([0x89, 0x50, 0x4e, 0x47]);
    const log = { error: vi.fn() };
    const mockRequest = {
      file: async () => ({
        mimetype: "image/png",
        filename: "x.png",
        toBuffer: async () => buffer,
      }),
      log,
    } as unknown as FastifyRequest;

    (FileType.fromBuffer as any).mockResolvedValue({ mime: "image/png", ext: "png" });
    mockImageClient.upload.mockRejectedValue(new Error("network blip"));

    await expect(handler.handle(mockRequest)).rejects.toThrow(HttpError);
    await expect(handler.handle(mockRequest)).rejects.toMatchObject({
      statusCode: 500,
      message: "An error occurred while uploading image.",
    });
    expect(log.error).toHaveBeenCalled();
  });
});

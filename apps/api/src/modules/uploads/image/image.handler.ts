import { FastifyRequest } from "fastify";
import { injectable, inject } from "tsyringe";
import { UploadImageResponse } from "./image.schema";
import { BadRequestError, HttpError } from "../../../shared/http-errors";
import { IMAGE_CLIENT } from "./image-client.tokens";
import { IImageClient } from "./image-client.interface";
import { sniffImageMime } from "./image-signature";

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function sanitizeFilename(raw: string | undefined, ext: string): string {
  const base = (raw ?? "upload").split(/[\\/]/).pop() ?? "upload";
  const withoutExt = base.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^[.-]+/, "")
    .slice(0, 100) || "upload";
  return `${cleaned}.${ext}`;
}

@injectable()
export class UploadImageHandler {
  constructor(
    @inject(IMAGE_CLIENT) private readonly imageClient: IImageClient
  ) {}

  async handle(request: FastifyRequest): Promise<UploadImageResponse> {
    const fileData = await request.file();
    if (!fileData) {
      throw new BadRequestError("No file uploaded.");
    }

    if (!ALLOWED_MIME_TO_EXT[fileData.mimetype]) {
      throw new BadRequestError("Invalid file type.");
    }

    const buffer = await fileData.toBuffer();
    if (buffer.length === 0) {
      throw new BadRequestError("Uploaded file is empty.");
    }

    const sniffedMime = sniffImageMime(buffer);
    if (!sniffedMime || sniffedMime !== fileData.mimetype) {
      throw new BadRequestError("Invalid file type.");
    }

    const ext = ALLOWED_MIME_TO_EXT[sniffedMime];
    const safeFilename = sanitizeFilename(fileData.filename, ext);

    try {
      const url = await this.imageClient.upload(buffer, safeFilename, sniffedMime);
      return { url };
    } catch (err) {
      request.log.error(err, "Failed to upload image via ImageClient");
      if (err instanceof HttpError) throw err;
      throw new HttpError(500, "An error occurred while uploading image.", undefined, { cause: err });
    }
  }
}

import { FastifyRequest } from "fastify";
import { injectable, inject } from "tsyringe";
import { UploadImageResponse } from "./image.schema";
import { BadRequestError, HttpError } from "../../../shared/http-errors";
import { IMAGE_CLIENT } from "./image-client.tokens";
import { IImageClient } from "./image-client.interface";

@injectable()
export class UploadImageHandler {
  constructor(
    @inject(IMAGE_CLIENT) private readonly imageClient: IImageClient
  ) {}

  async handle(request: FastifyRequest): Promise<UploadImageResponse> {
    // Retrieve multipart file
    const fileData = await request.file();
    if (!fileData) {
      throw new BadRequestError("No file uploaded.");
    }

    const buffer = await fileData.toBuffer();
    if (buffer.length === 0) {
      throw new BadRequestError("Uploaded file is empty.");
    }

    try {
      const url = await this.imageClient.upload(buffer, fileData.filename, fileData.mimetype);
      return { url };
    } catch (err) {
      request.log.error(err, "Failed to upload image via ImageClient");
      if (err instanceof HttpError) throw err;
      throw new HttpError(500, "An error occurred while uploading image.");
    }
  }
}

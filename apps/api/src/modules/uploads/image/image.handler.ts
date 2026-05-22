import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { UploadImageResponse } from "./image.schema";
import { BadRequestError, HttpError } from "../../../shared/http-errors";

@injectable()
export class UploadImageHandler {
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

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const folder = process.env.IMAGEKIT_FOLDER || "/uploads";

    if (!privateKey || !publicKey) {
      request.log.error("ImageKit credentials not configured in environment variables.");
      throw new HttpError(500, "Image upload server configuration error.");
    }

    // Prepare credentials for Basic Auth (Username: Private Key, Password: empty)
    const base64Credentials = Buffer.from(`${privateKey}:`).toString("base64");

    // Construct multipart form for ImageKit API
    const formData = new FormData();
    const fileBlob = new Blob([new Uint8Array(buffer)], { type: fileData.mimetype });
    
    formData.append("file", fileBlob, fileData.filename);
    formData.append("fileName", fileData.filename);
    formData.append("useUniqueFileName", "true");
    formData.append("folder", folder);

    try {
      const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Basic ${base64Credentials}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        request.log.error(`ImageKit API returned error response: ${response.status} - ${errorText}`);
        throw new HttpError(500, "Failed to upload image to ImageKit.");
      }

      const result = await response.json() as { url: string };
      if (!result || !result.url) {
        request.log.error("ImageKit API response did not contain file url.");
        throw new HttpError(500, "Unexpected response from ImageKit API.");
      }

      return {
        url: result.url,
      };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      request.log.error(err, "Error occurred during ImageKit fetch request.");
      throw new HttpError(500, "An error occurred while uploading image.");
    }
  }
}

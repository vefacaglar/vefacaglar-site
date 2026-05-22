import { injectable } from "tsyringe";
import { IImageClient } from "./image-client.interface";
import { HttpError } from "../../../shared/http-errors";

@injectable()
export class ImageKitClient implements IImageClient {
  async upload(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const folder = process.env.IMAGEKIT_FOLDER || "/uploads";

    if (!privateKey || !publicKey) {
      throw new HttpError(500, "Image upload server configuration error (ImageKit credentials missing).");
    }

    // Prepare credentials for Basic Auth (Username: Private Key, Password: empty)
    const base64Credentials = Buffer.from(`${privateKey}:`).toString("base64");

    // Construct multipart form for ImageKit API
    const formData = new FormData();
    const fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    
    formData.append("file", fileBlob, filename);
    formData.append("fileName", filename);
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
        throw new HttpError(500, `ImageKit API returned error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as { url: string };
      if (!result || !result.url) {
        throw new HttpError(500, "Unexpected response from ImageKit API (missing url).");
      }

      return result.url;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(500, "An error occurred while uploading image to ImageKit.");
    }
  }
}

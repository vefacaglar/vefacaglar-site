export interface IImageClient {
  upload(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string>;
}

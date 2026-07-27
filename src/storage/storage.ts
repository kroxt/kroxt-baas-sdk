import { HttpClient } from "../http/client";
import { KroxtOptions } from "../types";

export interface UploadOptions {
  onProgress?: (progressEvent: { loaded: number; total?: number; percentage: number }) => void;
}

export class StorageModule {
  private http: HttpClient;
  private options: KroxtOptions;

  constructor(http: HttpClient, options: KroxtOptions) {
    this.http = http;
    this.options = options;
  }

  /**
   * Uploads a file to the Kroxt BaaS storage server.
   * Supports standard File, Blob, Buffer, or ReadStreams.
   */
  public async upload(
    file: any,
    uploadOptions?: UploadOptions
  ): Promise<{ url: string; key: string; size: number; mimeType: string }> {
    const uploadUrl = `/projects/${this.options.projectId}/storage/upload`;
    
    // Dynamically require FormData to support Node and Browser environments
    let FormDataConstructor: any;
    if (typeof window !== "undefined" && window.FormData) {
      FormDataConstructor = window.FormData;
    } else {
      try {
        FormDataConstructor = require("form-data");
      } catch {
        throw new Error("form-data package must be installed to upload files in non-browser runtimes.");
      }
    }

    const form = new FormDataConstructor();
    form.append("file", file);

    const headers: Record<string, string> = {};
    if (typeof form.getHeaders === "function") {
      Object.assign(headers, form.getHeaders());
    }

    const response = await this.http.post<any>(uploadUrl, form, {
      headers,
      onUploadProgress: (progressEvent) => {
        if (uploadOptions?.onProgress) {
          const total = progressEvent.total;
          const loaded = progressEvent.loaded;
          const percentage = total ? Math.round((loaded * 100) / total) : 0;
          uploadOptions.onProgress({ loaded, total, percentage });
        }
      },
    });

    return response.data || response;
  }

  /**
   * Deletes a file from the storage system by its absolute URL or unique file key.
   */
  public async delete(fileUrlOrKey: string): Promise<boolean> {
    const deleteUrl = `/projects/${this.options.projectId}/storage/files`;
    
    const response = await this.http.delete<any>(deleteUrl, {
      data: { fileUrl: fileUrlOrKey },
    });

    const success = response.success !== undefined ? response.success : true;
    return success;
  }
}

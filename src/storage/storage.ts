import { HttpClient } from "../http/client";
import { KroxtOptions } from "../types";

export interface UploadOptions {
  onProgress?: (progressEvent: { loaded: number; total?: number; percentage: number }) => void;
  folder?: string;
  visibility?: "public" | "private";
  tags?: string[];
  filename?: string;
  contentType?: string;
}

export interface StorageFile {
  _id: string;
  projectId: string;
  originalName: string;
  fileName: string;
  url: string;
  mimeType: string;
  extension: string;
  size: number;
  folder: string;
  bucket: string;
  visibility: "public" | "private";
  type: "image" | "video" | "audio" | "document" | "archive" | "other";
  uploadedBy: string | null;
  uploadedByType: "developer" | "projectUser";
  tags: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface StorageFolder {
  _id: string;
  projectId: string;
  name: string;
  path: string;
  description?: string;
  createdBy: string | null;
  createdByType: "developer" | "projectUser";
  createdAt: string;
  updatedAt: string;
}

export interface ListFilesOptions {
  folder?: string;
  type?: StorageFile["type"];
  uploadedBy?: string;
  visibility?: StorageFile["visibility"];
  search?: string;
  limit?: number;
  skip?: number;
}

export interface CreateFolderOptions {
  name: string;
  path?: string;
  description?: string;
}

export interface UpdateFileOptions {
  originalName?: string;
  folder?: string;
  visibility?: StorageFile["visibility"];
  tags?: string[];
  metadata?: Record<string, any>;
}

export class StorageModule {
  private http: HttpClient;
  private options: KroxtOptions;

  constructor(http: HttpClient, options: KroxtOptions) {
    this.http = http;
    this.options = options;
  }

  /**
   * Creates a project storage folder that uploads can target.
   */
  public async createFolder(options: CreateFolderOptions): Promise<StorageFolder> {
    const response = await this.http.post<any>(
      `/projects/${this.options.projectId}/storage/folders`,
      options
    );
    return response.data || response;
  }

  /**
   * Lists project storage folders.
   */
  public async listFolders(): Promise<StorageFolder[]> {
    const response = await this.http.get<any>(`/projects/${this.options.projectId}/storage/folders`);
    return response.data || response;
  }

  /**
   * Deletes a project storage folder if it has no files in it.
   */
  public async deleteFolder(folderId: string): Promise<boolean> {
    const response = await this.http.delete<any>(
      `/projects/${this.options.projectId}/storage/folders/${folderId}`
    );
    const success = response.success !== undefined ? response.success : true;
    return success;
  }

  /**
   * Updates a project storage folder metadata (renaming or changing file size limit).
   */
  public async updateFolder(
    folderId: string,
    options: Partial<CreateFolderOptions & { maxFileSize?: number | null }>
  ): Promise<StorageFolder> {
    const response = await this.http.patch<any>(
      `/projects/${this.options.projectId}/storage/folders/${folderId}`,
      options
    );
    return response.data || response;
  }

  /**
   * Uploads a file to the Kroxt BaaS storage server.
   * Supports standard File, Blob, Buffer, or ReadStreams.
   */
  public async upload(
    file: any,
    uploadOptions?: UploadOptions
  ): Promise<StorageFile> {
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
    
    // Determine append options (filename, contentType, etc.)
    const appendOptions: Record<string, any> = {};
    if (uploadOptions?.filename) {
      appendOptions.filename = uploadOptions.filename;
    } else if (typeof file === "object" && file !== null) {
      if (file.name) {
        appendOptions.filename = file.name;
      } else if (file.path && typeof file.path === "string") {
        appendOptions.filename = require("path").basename(file.path);
      }
    }
    
    if (uploadOptions?.contentType) {
      appendOptions.contentType = uploadOptions.contentType;
    } else if (typeof file === "object" && file !== null && file.type) {
      appendOptions.contentType = file.type;
    }

    // In Node.js environment, if it is a Buffer, we MUST provide a filename option to form-data, otherwise it won't be sent as a file field.
    const isNode = typeof window === "undefined";
    const isBuffer = typeof Buffer !== "undefined" && Buffer.isBuffer(file);
    if (isNode && isBuffer && !appendOptions.filename) {
      appendOptions.filename = "file.bin";
    }

    if (typeof form.getHeaders === "function") {
      // In Node.js environment, form-data accepts the options object as the third argument
      if (Object.keys(appendOptions).length > 0) {
        form.append("file", file, appendOptions);
      } else {
        form.append("file", file);
      }
    } else {
      // In the browser environment, FormData.append only accepts a string filename as the third argument
      if (appendOptions.filename) {
        form.append("file", file, appendOptions.filename);
      } else {
        form.append("file", file);
      }
    }

    if (uploadOptions?.folder) form.append("folder", uploadOptions.folder);
    if (uploadOptions?.visibility) form.append("visibility", uploadOptions.visibility);
    if (uploadOptions?.tags?.length) form.append("tags", uploadOptions.tags.join(","));

    const headers: Record<string, any> = {};
    if (typeof form.getHeaders === "function") {
      Object.assign(headers, form.getHeaders());
    } else {
      headers["Content-Type"] = undefined;
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
   * Lists uploaded files for the current project.
   */
  public async list(options: ListFilesOptions = {}): Promise<{
    files: StorageFile[];
    total: number;
    limit: number;
    skip: number;
  }> {
    const query = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) query.set(key, String(value));
    });

    const queryString = query.toString();
    const url = `/projects/${this.options.projectId}/storage${queryString ? `?${queryString}` : ""}`;
    const response = await this.http.get<any>(url);
    return response.data || response;
  }

  /**
   * Gets metadata for a single uploaded file.
   */
  public async get(fileId: string): Promise<StorageFile> {
    const response = await this.http.get<any>(`/projects/${this.options.projectId}/storage/${fileId}`);
    return response.data || response;
  }

  /**
   * Updates editable metadata for a stored file.
   */
  public async update(fileId: string, options: UpdateFileOptions): Promise<StorageFile> {
    const response = await this.http.patch<any>(
      `/projects/${this.options.projectId}/storage/${fileId}`,
      options
    );
    return response.data || response;
  }

  /**
   * Deletes a file from the storage system by metadata file ID.
   */
  public async delete(fileId: string): Promise<boolean> {
    const response = await this.http.delete<any>(`/projects/${this.options.projectId}/storage/${fileId}`);

    const success = response.success !== undefined ? response.success : true;
    return success;
  }
}

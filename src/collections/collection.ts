import { HttpClient } from "../http/client";
import { QueryBuilder } from "../query/builder";
import { Document, PaginatedResult, PaginationOptions } from "../types";
import { CollectionMetadataManager } from "./metadata";
import { KroxtError } from "../errors/kroxt-error";

export class Collection<T = Record<string, any>> extends QueryBuilder<T> {
  private collectionName: string;
  private metadataManager: CollectionMetadataManager;
  private http: HttpClient;

  constructor(
    collectionName: string,
    metadataManager: CollectionMetadataManager,
    http: HttpClient
  ) {
    // Pass execution handler to parent QueryBuilder
    super(async (compiledParams) => {
      const collectionId = await metadataManager.resolveId(collectionName);
      const url = `/collections/${collectionId}/documents`;
      
      try {
        const response = await http.get<any>(url, { params: compiledParams });
        const result = response.data || response;
        
        if (result && Array.isArray(result.documents)) {
          return result.documents;
        }
        if (Array.isArray(result)) {
          return result;
        }
        return [];
      } catch (err: any) {
        if (err instanceof KroxtError && err.status === 404) {
          // If metadata mismatch occurred, force refresh and reject
          await metadataManager.forceRefresh();
        }
        throw err;
      }
    });

    this.collectionName = collectionName;
    this.metadataManager = metadataManager;
    this.http = http;
  }

  /**
   * Helper method to execute a raw find query against the documents endpoint
   */
  private async executeFind(params: Record<string, any>): Promise<{ documents: Document<T>[]; total: number }> {
    const collectionId = await this.metadataManager.resolveId(this.collectionName);
    const url = `/collections/${collectionId}/documents`;

    const response = await this.http.get<any>(url, { params });
    const result = response.data || response;

    if (result && Array.isArray(result.documents)) {
      return {
        documents: result.documents,
        total: result.total || result.documents.length,
      };
    }
    if (Array.isArray(result)) {
      return {
        documents: result,
        total: result.length,
      };
    }
    return { documents: [], total: 0 };
  }

  /**
   * Creates a new document inside this collection.
   */
  public async create(data: T): Promise<Document<T>> {
    const collectionId = await this.metadataManager.resolveId(this.collectionName);
    const url = `/collections/${collectionId}/documents`;

    // Wrap in data payload envelope to prevent MongoDB formatting issues
    const body = { data };
    const response = await this.http.post<any>(url, body);
    return response.data || response;
  }

  // Overload signatures to satisfy both CRUD single retrieval and QueryBuilder collection execution
  public override async get(documentId: string): Promise<Document<T>>;
  public override async get(): Promise<Document<T>[]>;
  
  /**
   * Retrieves a single document by its unique Mongo ID, or executes the compiled query.
   */
  public override async get(documentId?: string): Promise<any> {
    if (documentId !== undefined) {
      // Query by ID using the _id filter option supported by the backend
      const { documents } = await this.executeFind({ _id: documentId });
      if (documents.length === 0) {
        throw new KroxtError(`Document with ID "${documentId}" was not found.`, 404, "DOCUMENT_NOT_FOUND");
      }
      return documents[0];
    }
    return super.get();
  }

  /**
   * Fetches all matching documents. Shortcut to builder .get()
   */
  public async find(): Promise<Document<T>[]> {
    return super.get();
  }

  /**
   * Updates an existing document.
   */
  public async update(documentId: string, data: Partial<T>): Promise<Document<T>> {
    const collectionId = await this.metadataManager.resolveId(this.collectionName);
    const url = `/collections/${collectionId}/documents/${documentId}`;

    const response = await this.http.patch<any>(url, data);
    return response.data || response;
  }

  /**
   * Deletes a document.
   */
  public async delete(documentId: string): Promise<boolean> {
    const collectionId = await this.metadataManager.resolveId(this.collectionName);
    const url = `/collections/${collectionId}/documents/${documentId}`;

    const response = await this.http.delete<any>(url);
    const result = response.success !== undefined ? response.success : true;
    return result;
  }

  /**
   * Counts the total number of documents matching the query conditions.
   */
  public async count(): Promise<number> {
    const compiled = this.compile();
    // Fetch only 1 document to read the total field returned from the API
    const params = { ...compiled, limit: "1" };
    const { total } = await this.executeFind(params);
    return total;
  }

  /**
   * Performs a paginated search query.
   */
  public async paginate(options: PaginationOptions): Promise<PaginatedResult<T>> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const skip = (page - 1) * limit;

    const compiled = this.compile();
    const params = {
      ...compiled,
      limit: String(limit),
      skip: String(skip),
    };

    const { documents, total } = await this.executeFind(params);
    const pages = Math.ceil(total / limit);

    return {
      items: documents,
      total,
      page,
      pages,
      hasNext: page < pages,
      hasPrevious: page > 1,
    };
  }
}

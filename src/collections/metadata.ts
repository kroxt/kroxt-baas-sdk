import { HttpClient } from "../http/client";

export class CollectionMetadataManager {
  private http: HttpClient;
  // In-memory cache mapping collection name -> Mongo ObjectId string
  private nameToIdMap = new Map<string, string>();
  private resolvingPromise: Promise<void> | null = null;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Resolves a collection name (e.g. "posts") to its MongoDB ID (e.g. "66a1b2c3...")
   */
  public async resolveId(name: string): Promise<string> {
    const cached = this.nameToIdMap.get(name);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent metadata requests
    if (!this.resolvingPromise) {
      this.resolvingPromise = this.fetchAndCacheMetadata();
    }

    await this.resolvingPromise;
    this.resolvingPromise = null;

    const resolved = this.nameToIdMap.get(name);
    if (!resolved) {
      throw new Error(`Collection name "${name}" could not be resolved inside Kroxt BaaS. Ensure it has been created inside the Dashboard UI.`);
    }

    return resolved;
  }

  /**
   * Force refreshes the collection resolution cache (e.g. after a 404 document error)
   */
  public async forceRefresh(): Promise<void> {
    this.nameToIdMap.clear();
    await this.fetchAndCacheMetadata();
  }

  private async fetchAndCacheMetadata(): Promise<void> {
    try {
      const response = await this.http.get<any>("/collections");
      const list = response.data || response;
      
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.name && item._id) {
            this.nameToIdMap.set(item.name, item._id);
          }
        }
      }
    } catch (err: any) {
      throw new Error(`Failed to resolve collection metadata: ${err.message}`);
    }
  }
}

import { KroxtOptions, KroxtPlugin } from "./types";
import { HttpClient } from "./http/client";
import { AuthModule } from "./auth/auth";
import { Collection } from "./collections/collection";
import { CollectionMetadataManager } from "./collections/metadata";
import { CommunicationModule } from "./communication/communication";
import { FunctionsModule } from "./functions/functions";
import { RealtimeModule } from "./realtime/realtime";
import { StorageModule } from "./storage/storage";
import { PluginManager } from "./core/plugin";
import { OfflineQueue } from "./core/offline";

// Export sub-modules and core types so they can be consumed by developers
export * from "./types";
export { KroxtError } from "./errors/kroxt-error";
export { Collection } from "./collections/collection";
export { QueryBuilder } from "./query/builder";
export { StorageAdapter } from "./types";
export { MemoryStorage, BrowserStorage } from "./auth/storage";

/**
 * Main Kroxt client orchestrator class.
 * Connects and interacts with all backend modules.
 */
export class Kroxt {
  /** Authentication module for user signup, login, and sessions */
  public readonly auth: AuthModule;
  /** Messaging module for email routing, SMS, and WhatsApp triggers */
  public readonly communication: CommunicationModule;
  /** Serverless HTTP functions invocation module */
  public readonly functions: FunctionsModule;
  /** Realtime WebSockets gateway connection and channel subscriptions */
  public readonly realtime: RealtimeModule;
  /** File storage and upload module */
  public readonly storage: StorageModule;
  /** Offline operations storage and background synchronizer */
  public readonly offlineQueue: OfflineQueue;

  public readonly http: HttpClient;
  private metadataManager: CollectionMetadataManager;
  private pluginManager: PluginManager;

  constructor(options: KroxtOptions) {
    if (!options.projectId) {
      throw new Error("[Kroxt SDK] Initialization error: 'projectId' parameter is required.");
    }
    if (!options.apiKey) {
      throw new Error("[Kroxt SDK] Initialization error: 'apiKey' parameter is required.");
    }

    this.http = new HttpClient(options);
    this.metadataManager = new CollectionMetadataManager(this.http);
    this.pluginManager = new PluginManager(this);

    // Initialize modules
    this.auth = new AuthModule(this.http, options);
    this.communication = new CommunicationModule(this.http, options);
    this.functions = new FunctionsModule(this.http, options);
    this.realtime = new RealtimeModule(options, this.metadataManager);
    this.storage = new StorageModule(this.http, options);

    // Initialize offline sync architecture
    this.offlineQueue = new OfflineQueue(async (op) => {
      const col = this.collection(op.collectionName);
      switch (op.operation) {
        case "create":
          return col.create(op.payload);
        case "update":
          if (!op.documentId) throw new Error("Document ID required for offline update sync");
          return col.update(op.documentId, op.payload);
        case "delete":
          if (!op.documentId) throw new Error("Document ID required for offline delete sync");
          return col.delete(op.documentId);
      }
    });

    // Reconnect socket only when a silent token auto-refresh completes.
    // Using onResponse here would fire on every HTTP request (including logout)
    // causing the socket to reconnect immediately after being disconnected.
    this.http.onTokenRefresh(async () => {
      await this.realtime.reconnectWithSession();
    });
  }

  /**
   * Accesses a project document collection by its display name.
   * Internally resolves the name to Mongo ObjectId and caches it.
   */
  public collection<T = Record<string, any>>(name: string): Collection<T> {
    return new Collection<T>(name, this.metadataManager, this.http);
  }

  /**
   * Registers a callback hook executed before every outgoing HTTP request.
   */
  public onRequest(hook: (config: any) => void | Promise<void>): void {
    this.http.onRequest(hook);
  }

  /**
   * Registers a callback hook executed after every successful HTTP response.
   */
  public onResponse(hook: (response: any) => void | Promise<void>): void {
    this.http.onResponse(hook);
  }

  /**
   * Registers a callback hook executed after any failed HTTP transaction.
   */
  public onError(hook: (error: any) => void | Promise<void>): void {
    this.http.onError(hook);
  }

  /**
   * Installs an SDK plugin extension.
   */
  public use(plugin: KroxtPlugin): this {
    this.pluginManager.use(plugin);
    return this;
  }
}
export default Kroxt;

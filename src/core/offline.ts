export interface OfflineOperation {
  id: string;
  collectionName: string;
  operation: "create" | "update" | "delete";
  documentId?: string;
  payload?: any;
  timestamp: number;
}

export class OfflineQueue {
  private queue: OfflineOperation[] = [];
  private isOnline = true;
  private isSyncing = false;
  private syncCallback?: (op: OfflineOperation) => Promise<any>;

  constructor(syncCallback?: (op: OfflineOperation) => Promise<any>) {
    this.syncCallback = syncCallback;
    this.setupNetworkListeners();
  }

  /**
   * Enqueues an operation to be synced later when online.
   */
  public enqueue(op: Omit<OfflineOperation, "id" | "timestamp">): OfflineOperation {
    const operation: OfflineOperation = {
      ...op,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    
    this.queue.push(operation);
    return operation;
  }

  /**
   * Returns the current queue of operations pending sync.
   */
  public getPending(): OfflineOperation[] {
    return [...this.queue];
  }

  /**
   * Clears the pending queue.
   */
  public clear(): void {
    this.queue = [];
  }

  /**
   * Sets the sync execution handler callback.
   */
  public setSyncHandler(cb: (op: OfflineOperation) => Promise<any>): void {
    this.syncCallback = cb;
  }

  /**
   * Automatically executes and flushes the queue of pending requests.
   */
  public async sync(): Promise<void> {
    if (!this.isOnline || !this.syncCallback || this.queue.length === 0 || this.isSyncing) {
      return;
    }

    this.isSyncing = true;
    try {

    const pending = [...this.queue];
    // Sort oldest first
    pending.sort((a, b) => a.timestamp - b.timestamp);

    for (const op of pending) {
      try {
        await this.syncCallback(op);
        // Remove from local queue if successful
        this.queue = this.queue.filter((item) => item.id !== op.id);
      } catch (err) {
        console.error(`[Kroxt Offline] Failed to sync operation ${op.id}:`, err);
        // Stop syncing rest of queue to prevent write order dependency violations
        break;
      }
    }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Simulates network status transitions.
   */
  public setOnlineStatus(online: boolean): void {
    this.isOnline = online;
    if (online) {
      this.sync();
    }
  }

  private setupNetworkListeners(): void {
    if (typeof window !== "undefined" && window.addEventListener) {
      this.isOnline = navigator.onLine;

      window.addEventListener("online", () => this.setOnlineStatus(true));
      window.addEventListener("offline", () => this.setOnlineStatus(false));
    }
  }
}

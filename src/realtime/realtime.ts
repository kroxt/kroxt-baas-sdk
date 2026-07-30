import { io, Socket } from "socket.io-client";
import { KroxtOptions, RealtimeCallback, StorageAdapter } from "../types";
import { CollectionMetadataManager } from "../collections/metadata";
import { getStorageAdapter } from "../auth/storage";
import { CollectionChannel, RealtimeChannel } from "./channel";

export class PresenceModule {
  private socket: Socket;
  private joinCallbacks = new Set<RealtimeCallback>();
  private leaveCallbacks = new Set<RealtimeCallback>();
  private stateCallbacks = new Set<RealtimeCallback>();

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupListeners();
  }

  /**
   * Subscribes to the presence roster.
   */
  public subscribe(): this {
    if (!this.socket.connected) {
      this.socket.connect();
    }
    if (this.socket.connected) {
      this.socket.emit("subscribe", "presence");
    } else {
      this.socket.once("connect", () => {
        this.socket.emit("subscribe", "presence");
      });
    }
    return this;
  }

  /**
   * Unsubscribes from the presence roster.
   */
  public unsubscribe(): this {
    this.socket.emit("unsubscribe", "presence");
    return this;
  }

  /**
   * Registers a callback triggered when another collaborator connects.
   */
  public onJoin(cb: RealtimeCallback): this {
    this.joinCallbacks.add(cb);
    return this;
  }

  /**
   * Removes a previously registered onJoin callback.
   */
  public offJoin(cb: RealtimeCallback): this {
    this.joinCallbacks.delete(cb);
    return this;
  }

  /**
   * Registers a callback triggered when a collaborator disconnects.
   */
  public onLeave(cb: RealtimeCallback): this {
    this.leaveCallbacks.add(cb);
    return this;
  }

  /**
   * Removes a previously registered onLeave callback.
   */
  public offLeave(cb: RealtimeCallback): this {
    this.leaveCallbacks.delete(cb);
    return this;
  }

  /**
   * Registers a callback receiving the initial list of currently online collaborators.
   */
  public onState(cb: RealtimeCallback): this {
    this.stateCallbacks.add(cb);
    return this;
  }

  /**
   * Removes a previously registered onState callback.
   */
  public offState(cb: RealtimeCallback): this {
    this.stateCallbacks.delete(cb);
    return this;
  }

  /**
   * Clears all registered presence callbacks. Call on component unmount.
   */
  public clearCallbacks(): void {
    this.joinCallbacks.clear();
    this.leaveCallbacks.clear();
    this.stateCallbacks.clear();
  }

  /**
   * Emits a typing start indicator to a channel room.
   */
  public startTyping(channel: string): this {
    if (!this.socket.connected) {
      this.socket.connect();
    }
    this.socket.emit("typing.start", { channel });
    return this;
  }

  /**
   * Emits a typing stop indicator to a channel room.
   */
  public stopTyping(channel: string): this {
    if (!this.socket.connected) {
      this.socket.connect();
    }
    this.socket.emit("typing.stop", { channel });
    return this;
  }

  private setupListeners(): void {
    this.socket.on("presence.join", (user) => {
      this.joinCallbacks.forEach((cb) => cb(user));
    });

    this.socket.on("presence.leave", (user) => {
      this.leaveCallbacks.forEach((cb) => cb(user));
    });

    this.socket.on("presence.state", (users) => {
      this.stateCallbacks.forEach((cb) => cb(users));
    });
  }
}

export class RealtimeModule {
  public socket!: Socket;
  private options: KroxtOptions;
  private storage: StorageAdapter;
  private metadataManager: CollectionMetadataManager;
  private shouldConnect: boolean = false;
  
  // Roster sub-module
  public presence!: PresenceModule;
  
  // Tracked active channels for forwarding notifications
  private collectionChannels = new Set<CollectionChannel>();
  private customChannels = new Map<string, RealtimeChannel>();

  constructor(options: KroxtOptions, metadataManager: CollectionMetadataManager) {
    this.options = options;
    this.storage = getStorageAdapter(options.storage);
    this.metadataManager = metadataManager;
    
    this.initSocket();
  }

  /**
   * Establishes the WebSocket Socket.IO connection
   */
  private initSocket(): void {
    const defaultHost = "https://kroxt-baas.onrender.com";

    const connectionUrl = this.options.baseUrl || defaultHost;

    // Load credentials dynamically during connection handshake
    const tokenResult = this.storage.getItem("kroxt_access_token");
    const queryParams: Record<string, string> = {
      projectId: this.options.projectId,
      apiKey: this.options.apiKey,
    };

    if (tokenResult && typeof (tokenResult as any).then === "function") {
      (tokenResult as Promise<string | null>).then((token) => {
        if (token) {
          queryParams.token = token;
          if (this.socket) {
            this.socket.io.opts.query = { ...queryParams };
          }
        }
      });
    } else if (tokenResult) {
      queryParams.token = tokenResult as string;
    }

    this.socket = io(connectionUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
      query: queryParams,
    });

    this.presence = new PresenceModule(this.socket);
    this.setupEventRouting();
  }

  /**
   * Manually establishes the WebSocket connection.
   */
  public connect(): void {
    if (this.socket && !this.socket.connected) {
      this.shouldConnect = true;
      this.socket.connect();
    }
  }

  /**
   * Configures global event routing from Socket.IO client to sub-channels.
   */
  private setupEventRouting(): void {
    this.socket.on("connect", () => {
      this.shouldConnect = true;
      if (this.options.debug) {
        console.log(`[Kroxt Realtime] Connection established. Socket ID: ${this.socket.id}`);
      }
    });

    this.socket.on("disconnect", (reason) => {
      if (this.options.debug) {
        console.warn(`[Kroxt Realtime] Disconnected: ${reason}`);
      }
    });

    // 1. Route document mutations to correct collection channels
    const routeDocumentMutation = (operation: "created" | "updated" | "deleted", eventPayload: any) => {
      if (this.options.debug) {
        console.log(`[Kroxt Realtime] Received mutation: document.${operation}`, eventPayload);
      }

      this.collectionChannels.forEach((chan) => {
        const chanColId = chan.getCollectionId();
        if (chanColId && chanColId === eventPayload.collectionId) {
          // Reconstruct the standard Document envelope structure
          const documentObj = {
            _id: eventPayload.documentId,
            projectId: eventPayload.projectId,
            collectionId: eventPayload.collectionId,
            ownerId: eventPayload.ownerId,
            data: eventPayload.data || {},
            createdAt: eventPayload.createdAt || new Date().toISOString(),
            updatedAt: eventPayload.updatedAt || new Date().toISOString(),
          };
          chan.dispatch(operation, documentObj);
        }
      });
    };

    this.socket.on("document.created", (payload) => routeDocumentMutation("created", payload));
    this.socket.on("document.updated", (payload) => routeDocumentMutation("updated", payload));
    this.socket.on("document.deleted", (payload) => routeDocumentMutation("deleted", payload));

    // 2. Route custom messages to custom channels
    this.socket.on("publish", (event: { channel: string; event: string; payload: any }) => {
      const customChan = this.customChannels.get(event.channel);
      if (customChan) {
        customChan.dispatch(event.event, event.payload);
      }
    });
  }

  /**
   * Generates a collection subscription channel.
   */
  public collection(name: string): CollectionChannel {
    const channel = new CollectionChannel(this.socket, name, this.metadataManager);
    this.collectionChannels.add(channel);
    return channel;
  }

  /**
   * Generates a custom application message room.
   */
  public channel(channelName: string): RealtimeChannel {
    let chan = this.customChannels.get(channelName);
    if (!chan) {
      chan = new RealtimeChannel(this.socket, channelName);
      this.customChannels.set(channelName, chan);
    }
    return chan;
  }

  /**
   * Force reconnects the socket client (e.g. after authentication changes query tokens).
   */
  public async reconnect(): Promise<void> {
    if (this.socket && this.shouldConnect) {
      const token = await this.storage.getItem("kroxt_access_token");
      const queryParams: Record<string, string> = {
        projectId: this.options.projectId,
        apiKey: this.options.apiKey,
      };
      if (token) {
        queryParams.token = token;
      }
      this.socket.io.opts.query = queryParams;
      this.socket.disconnect().connect();
    }
  }

  /**
   * Terminates socket connection and prevents automatic reconnection.
   * Call this on user logout to ensure the socket is fully cleaned up.
   */
  public disconnect(): void {
    if (this.socket) {
      this.shouldConnect = false;
      // Disable reconnection before disconnecting so the singleton socket
      // does not automatically re-establish a new connection after logout.
      this.socket.io.opts.reconnection = false;
      this.socket.disconnect();
    }
  }

  /**
   * Re-enables reconnection and re-establishes the socket.
   * Call this after a new user session is established (e.g. after login).
   */
  public async reconnectWithSession(): Promise<void> {
    if (this.socket && this.shouldConnect) {
      const token = await this.storage.getItem("kroxt_access_token");
      const queryParams: Record<string, string> = {
        projectId: this.options.projectId,
        apiKey: this.options.apiKey,
      };
      if (token) {
        queryParams.token = token;
      }
      this.socket.io.opts.query = queryParams;
      // Re-enable reconnection for the new authenticated session
      this.socket.io.opts.reconnection = true;
      this.socket.io.opts.reconnectionAttempts = 10;
      this.socket.disconnect().connect();
    }
  }
}

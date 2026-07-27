import { Socket } from "socket.io-client";
import { CollectionMetadataManager } from "../collections/metadata";
import { RealtimeCallback } from "../types";

export class RealtimeChannel {
  protected socket: Socket;
  protected channelName: string;
  protected listeners = new Map<string, Set<RealtimeCallback>>();

  constructor(socket: Socket, channelName: string) {
    this.socket = socket;
    this.channelName = channelName;
  }

  /**
   * Subscribes to the websocket channel.
   */
  public subscribe(): this {
    if (this.socket.connected) {
      this.socket.emit("subscribe", this.channelName);
    } else {
      this.socket.once("connect", () => {
        this.socket.emit("subscribe", this.channelName);
      });
    }
    return this;
  }

  /**
   * Unsubscribes from the websocket channel.
   */
  public unsubscribe(): this {
    this.socket.emit("unsubscribe", this.channelName);
    this.listeners.clear();
    return this;
  }

  /**
   * Binds an event listener callback for custom channel events.
   */
  public on(event: string, callback: RealtimeCallback): this {
    let list = this.listeners.get(event);
    if (!list) {
      list = new Set<RealtimeCallback>();
      this.listeners.set(event, list);
    }
    list.add(callback);
    return this;
  }

  /**
   * Emits a message to the custom channel.
   */
  public emit(event: string, payload: any): this {
    this.socket.emit("publish", {
      channel: this.channelName,
      event,
      payload,
    });
    return this;
  }

  /**
   * Dispatches incoming socket events to the registered callback listeners.
   */
  public dispatch(event: string, data: any): void {
    const list = this.listeners.get(event);
    if (list) {
      for (const cb of list) {
        cb(data);
      }
    }
  }
}

/**
 * Specialized channel mapping collections to Mongo collection ID channels.
 */
export class CollectionChannel extends RealtimeChannel {
  private collectionName: string;
  private metadataManager: CollectionMetadataManager;
  private resolvedCollectionId: string | null = null;

  constructor(socket: Socket, collectionName: string, metadataManager: CollectionMetadataManager) {
    // Parent channel initialized with placeholder; resolved upon subscription
    super(socket, `collection:${collectionName}`);
    this.collectionName = collectionName;
    this.metadataManager = metadataManager;
  }

  /**
   * Dynamically resolves the collection ID, joins the collection room, and starts listening.
   */
  public override subscribe(): this {
    const startSubscription = async () => {
      try {
        const id = await this.metadataManager.resolveId(this.collectionName);
        this.resolvedCollectionId = id;
        this.channelName = `collection:${id}`;
        
        if (this.socket.connected) {
          this.socket.emit("subscribe", this.channelName);
        } else {
          this.socket.once("connect", () => {
            this.socket.emit("subscribe", this.channelName);
          });
        }
      } catch (err) {
        console.error(`[Kroxt Realtime] Failed to subscribe to collection ${this.collectionName}:`, err);
      }
    };

    startSubscription();
    return this;
  }

  /**
   * Retrieves the resolved collection ID associated with this channel.
   */
  public getCollectionId(): string | null {
    return this.resolvedCollectionId;
  }
}

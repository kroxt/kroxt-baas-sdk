import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { Kroxt } from "../src/index";
import { KroxtError } from "../src/errors/kroxt-error";
import { MemoryStorage } from "../src/auth/storage";

// Mock axios module directly
vi.mock("axios", () => {
  const mockAxiosInstance = {
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
    request: vi.fn(),
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      post: vi.fn(),
    },
  };
});

describe("Kroxt SDK Core & HTTP Client", () => {
  let baas: Kroxt;
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAxiosInstance = {
      interceptors: {
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() },
      },
      request: vi.fn(),
    };

    (axios.create as any).mockReturnValue(mockAxiosInstance);

    baas = new Kroxt({
      projectId: "proj_123",
      apiKey: "key_abc",
      baseUrl: "https://api.kroxt.local",
    });
  });

  it("should initialize client with correct properties", () => {
    expect(baas.auth).toBeDefined();
    expect(baas.communication).toBeDefined();
    expect(baas.functions).toBeDefined();
    expect(baas.realtime).toBeDefined();
    expect(baas.storage).toBeDefined();
  });

  it("should throw error if projectId or apiKey are missing during creation", () => {
    expect(() => new Kroxt({ projectId: "", apiKey: "key" })).toThrow();
    expect(() => new Kroxt({ projectId: "proj", apiKey: "" })).toThrow();
  });

  describe("Query Builder compilation", () => {
    it("should compile equals queries correctly", () => {
      const posts = baas.collection("posts");
      const builder = posts.where("published", true).limit(10).skip(5).orderBy("createdAt", "desc");
      
      const compiled = builder.compile();
      expect(compiled.published).toBe(true);
      expect(compiled.limit).toBe("10");
      expect(compiled.skip).toBe("5");
      expect(compiled.sort).toBe("-createdAt");
    });

    it("should compile operator queries ($gt, $lt, $ne, $in, $regex)", () => {
      const posts = baas.collection("posts");
      
      const compiled = posts
        .where("views", "greaterThan", 100)
        .where("price", "lessThan", 50)
        .where("status", "notEquals", "draft")
        .where("category", "in", ["tech", "science"])
        .where("title", "startsWith", "hello")
        .compile();

      expect(compiled["views[$gt]"]).toBe(100);
      expect(compiled["price[$lt]"]).toBe(50);
      expect(compiled["status[$ne]"]).toBe("draft");
      expect(compiled["category[$in]"]).toBe("tech,science");
      expect(compiled["title[$regex]"]).toBe("^hello");
      expect(compiled["title[$options]"]).toBe("i");
    });
  });

  describe("Collection ID Cache & Metadata Resolution", () => {
    it("should resolve collection name to Mongo ID and cache it", async () => {
      // Mock GET /collections metadata listing
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: [
          { _id: "col_posts_99", name: "posts" },
          { _id: "col_comments_88", name: "comments" },
        ],
      });

      // Mock documents retrieval
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: {
          documents: [{ _id: "doc_1", data: { title: "Hello" } }],
          total: 1,
        },
      });

      const posts = baas.collection("posts");
      const results = await posts.find();

      expect(results[0]._id).toBe("doc_1");
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);

      // Subsequent call should hit cache and only make 1 call (the query itself, no metadata GET)
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: { documents: [], total: 0 },
      });
      await posts.find();
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
    });
  });

  describe("Offline Queue Support", () => {
    it("should enqueue operations when offline and sync when transitioning to online", async () => {
      const queue = baas.offlineQueue;
      queue.setOnlineStatus(false);

      queue.enqueue({
        collectionName: "posts",
        operation: "create",
        payload: { title: "Offline Post" },
      });

      expect(queue.getPending().length).toBe(1);

      // Define sync handler trigger spy
      const syncSpy = vi.fn().mockResolvedValue({ success: true });
      queue.setSyncHandler(syncSpy);

      // Transition to online status and wait for asynchronous sync completion
      queue.setOnlineStatus(true);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(syncSpy).toHaveBeenCalledTimes(1);
      expect(queue.getPending().length).toBe(0);
    });
  });

  describe("Unified Error Mapping (KroxtError)", () => {
    it("should parse AxiosError into clean KroxtError", () => {
      const mockAxiosError = {
        isAxiosError: true,
        message: "Network Timeout",
        response: {
          status: 403,
          data: {
            message: "Action forbidden due to security rules.",
            code: "RULE_DENIED",
            data: { reason: "owner check failed" },
          },
        },
      };

      const mapped = KroxtError.fromError(mockAxiosError);
      expect(mapped).toBeInstanceOf(KroxtError);
      expect(mapped.status).toBe(403);
      expect(mapped.code).toBe("RULE_DENIED");
      expect(mapped.message).toBe("Action forbidden due to security rules.");
      expect(mapped.details.reason).toBe("owner check failed");
    });
  });

  describe("Plugins Support", () => {
    it("should execute install callback when plugin is registered", () => {
      const pluginSpy = vi.fn();
      const mockPlugin = {
        install: pluginSpy,
      };

      baas.use(mockPlugin);
      expect(pluginSpy).toHaveBeenCalledWith(baas);
    });
  });

  describe("Storage custom adapters persistence", () => {
    it("should read and write values using MemoryStorage adapter", async () => {
      const store = new MemoryStorage();
      store.setItem("test_key", "persisted_value");
      expect(store.getItem("test_key")).toBe("persisted_value");
      
      store.removeItem("test_key");
      expect(store.getItem("test_key")).toBeNull();
    });
  });
});

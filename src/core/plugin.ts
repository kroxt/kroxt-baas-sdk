import { KroxtPlugin } from "../types";

export class PluginManager {
  private client: any;
  private installedPlugins = new Set<KroxtPlugin>();

  constructor(client: any) {
    this.client = client;
  }

  /**
   * Registers and executes a plugin configuration.
   */
  public use(plugin: KroxtPlugin): void {
    if (this.installedPlugins.has(plugin)) {
      return;
    }
    
    try {
      plugin.install(this.client);
      this.installedPlugins.add(plugin);
    } catch (err: any) {
      throw new Error(`Failed to install plugin: ${err.message}`);
    }
  }
}

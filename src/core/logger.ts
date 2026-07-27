export class DebugLogger {
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  public log(message: string, ...args: any[]): void {
    if (this.debug) {
      console.log(`[Kroxt SDK] ${message}`, ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.debug) {
      console.warn(`[Kroxt SDK] [WARN] ${message}`, ...args);
    }
  }

  public error(message: string, ...args: any[]): void {
    // Errors are logged regardless of debug mode
    console.error(`[Kroxt SDK] [ERROR] ${message}`, ...args);
  }
}

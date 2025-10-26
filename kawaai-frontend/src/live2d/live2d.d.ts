/**
 * Type declarations for Live2D Cubism Core
 */

declare namespace Live2DCubismCore {
  export interface Live2DCubismCore {
    Logging: {
      csmGetLogFunction(): void;
      csmSetLogFunction(handler: (message: string) => void): void;
    };
    Memory: {
      initializeAmountOfMemory(size: number): void;
    };
    Moc: {
      fromArrayBuffer(buffer: ArrayBuffer): any;
    };
    Model: {
      fromMoc(moc: any): any;
    };
    Version: {
      csmGetLatestMocVersion(): number;
      csmGetMocVersion(moc: any, size: number): number;
    };
  }
}

declare global {
  interface Window {
    Live2DCubismCore?: any;
  }
}

export {};


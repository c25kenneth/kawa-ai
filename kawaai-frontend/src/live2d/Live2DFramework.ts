/**
 * Global Live2D Framework Manager - Singleton
 * Prevents multiple initializations and premature disposal
 */

import { CubismFramework, Option } from '../live2d-framework/live2dcubismframework';

class Live2DFrameworkManager {
  private static instance: Live2DFrameworkManager | null = null;
  private initialized: boolean = false;
  private refCount: number = 0;

  private constructor() {}

  public static getInstance(): Live2DFrameworkManager {
    if (!Live2DFrameworkManager.instance) {
      Live2DFrameworkManager.instance = new Live2DFrameworkManager();
    }
    return Live2DFrameworkManager.instance;
  }

  public async initialize(): Promise<void> {
    this.refCount++;

    if (this.initialized) {
      console.log('CubismFramework already initialized, ref count:', this.refCount);
      return;
    }

    // Check if Live2D Core is loaded
    if (!window.Live2DCubismCore) {
      throw new Error('Live2D Cubism Core not loaded');
    }

    // Initialize Cubism Framework
    const cubismOption = new Option();
    cubismOption.logFunction = console.log;
    cubismOption.loggingLevel = 2; // LogLevel_Verbose

    CubismFramework.startUp(cubismOption);
    CubismFramework.initialize();

    this.initialized = true;
    console.log('CubismFramework initialized globally');
  }

  public release(): void {
    this.refCount--;
    console.log('Framework release called, ref count:', this.refCount);

    // Only dispose when no components are using it
    if (this.refCount <= 0 && this.initialized) {
      CubismFramework.dispose();
      this.initialized = false;
      this.refCount = 0;
      console.log('CubismFramework disposed');
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export default Live2DFrameworkManager;


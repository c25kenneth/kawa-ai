/**
 * WebGL Manager for Live2D
 */

export class LAppGlManager {
  private _gl: WebGLRenderingContext | null = null;
  private _canvas: HTMLCanvasElement | null = null;

  /**
   * Initialize WebGL
   */
  public initialize(canvas: HTMLCanvasElement): boolean {
    this._canvas = canvas;

    // Set canvas size
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    // Get WebGL context
    const contextOptions = {
      alpha: true,
      premultipliedAlpha: true,
    };

    this._gl = canvas.getContext('webgl', contextOptions) || 
               canvas.getContext('experimental-webgl', contextOptions) as WebGLRenderingContext;

    if (!this._gl) {
      console.error('Failed to create WebGL context');
      return false;
    }

    // Enable transparency
    this._gl.enable(this._gl.BLEND);
    this._gl.blendFunc(this._gl.SRC_ALPHA, this._gl.ONE_MINUS_SRC_ALPHA);

    return true;
  }

  /**
   * Get WebGL context
   */
  public getGL(): WebGLRenderingContext | null {
    return this._gl;
  }

  /**
   * Get canvas
   */
  public getCanvas(): HTMLCanvasElement | null {
    return this._canvas;
  }

  /**
   * Release resources
   */
  public release(): void {
    this._gl = null;
    this._canvas = null;
  }
}


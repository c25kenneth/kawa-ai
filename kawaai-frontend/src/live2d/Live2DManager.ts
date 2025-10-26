/**
 * Live2D Manager - Handles model loading and management
 */

import { Live2DModel } from './Live2DModel';
import { CubismMatrix44 } from '../live2d-framework/math/cubismmatrix44';
import { CubismViewMatrix } from '../live2d-framework/math/cubismviewmatrix';
import * as Live2DDefine from './Live2DDefine';

export class Live2DManager {
  private _models: Live2DModel[] = [];
  private _viewMatrix: CubismViewMatrix;
  private _sceneIndex: number = 0;
  private _gl: WebGLRenderingContext | null = null;
  private _currentModelDir: string = '';

  constructor() {
    this._viewMatrix = new CubismViewMatrix();
    this._setupViewMatrix();
  }

  /**
   * Set WebGL context
   */
  public setGL(gl: WebGLRenderingContext): void {
    this._gl = gl;
  }

  /**
   * Setup view matrix
   */
  private _setupViewMatrix(): void {
    // Set screen bounds with more space to prevent clipping
    this._viewMatrix.setScreenRect(-2.0, 2.0, -2.0, 2.0);
    
    // Character-specific adjustments
    let scale = 2.8;
    let translateX = 0.5; // Move all characters much further right
    let translateY = 0.5;
    
    // Adjust for specific characters that are positioned differently
    switch (this._currentModelDir) {
      case 'Wanko':
        scale = 2.8;
        translateX = 0.95; // Wanko way further right
        translateY = 1.15; // Wanko even higher up
        break;
      case 'Mark':
        scale = 2.8;
        translateX = 0.95; // Mark way further right
        translateY = 0.95; // Mark way up
        break;
      case 'Hiyori':
        scale = 2.8;
        translateX = 0.5;
        translateY = 0.45;
        break;
      case 'Mao':
        scale = 2.8;
        translateX = 0.5;
        translateY = 0.5;
        break;
      case 'Natori':
        scale = 2.8;
        translateX = 0.5;
        translateY = 0.5;
        break;
      default: // Haru and others
        scale = 2.8;
        translateX = 0.5;
        translateY = 0.5;
        break;
    }
    
    // Apply transformations
    this._viewMatrix.scale(scale, scale);
    this._viewMatrix.translateX(translateX);
    this._viewMatrix.translateY(translateY);
    
    // Set maximum bounds with extra space
    this._viewMatrix.setMaxScreenRect(
      Live2DDefine.ViewLogicalMaxLeft,
      Live2DDefine.ViewLogicalMaxRight,
      Live2DDefine.ViewLogicalMaxBottom,
      Live2DDefine.ViewLogicalMaxTop
    );

    this._viewMatrix.setMaxScale(Live2DDefine.ViewMaxScale);
    this._viewMatrix.setMinScale(Live2DDefine.ViewMinScale);
  }

  /**
   * Load model
   */
  public async loadModel(modelDir: string, modelFileName: string): Promise<Live2DModel> {
    const model = new Live2DModel();
    const modelPath = `${Live2DDefine.ResourcesPath}${modelDir}/`;

    // Store current model directory for positioning adjustments
    this._currentModelDir = modelDir;
    
    // Re-setup view matrix with character-specific positioning
    this._setupViewMatrix();

    // Set GL context if available
    if (this._gl) {
      model.setGL(this._gl);
    }

    await model.loadAssets(modelPath, modelFileName);
    this._models.push(model);

    return model;
  }

  /**
   * Get model by index
   */
  public getModel(index: number = 0): Live2DModel | null {
    if (index < 0 || index >= this._models.length) {
      return null;
    }
    return this._models[index];
  }

  /**
   * Get current scene model
   */
  public getCurrentModel(): Live2DModel | null {
    return this.getModel(this._sceneIndex);
  }

  /**
   * Get view matrix
   */
  public getViewMatrix(): CubismViewMatrix {
    return this._viewMatrix;
  }

  /**
   * Update all models
   */
  public update(deltaTimeSeconds: number): void {
    for (const model of this._models) {
      model.update(deltaTimeSeconds);
    }
  }

  /**
   * Draw all models
   */
  public draw(): void {
    const model = this.getCurrentModel();
    if (!model) return;

    const matrix = new CubismMatrix44();
    matrix.multiplyByMatrix(this._viewMatrix);

    model.draw(matrix);
  }

  /**
   * Release all models
   */
  public release(): void {
    for (const model of this._models) {
      model.release();
    }
    this._models = [];
  }

  /**
   * Resize canvas
   */
  public onResize(width: number, height: number): void {
    this._setupViewMatrix();
  }
}


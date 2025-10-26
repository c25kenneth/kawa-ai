/**
 * Live2D Model Manager
 */

import { CubismUserModel } from '../live2d-framework/model/cubismusermodel';
import { CubismModelSettingJson } from '../live2d-framework/cubismmodelsettingjson';
import { ICubismModelSetting } from '../live2d-framework/icubismmodelsetting';
import { CubismIdHandle } from '../live2d-framework/id/cubismid';
import { CubismModelMatrix } from '../live2d-framework/math/cubismmodelmatrix';
import { CubismMatrix44 } from '../live2d-framework/math/cubismmatrix44';
import { CubismDefaultParameterId } from '../live2d-framework/cubismdefaultparameterid';
import { CubismFramework } from '../live2d-framework/live2dcubismframework';
import { csmMap } from '../live2d-framework/type/csmmap';
import { csmVector } from '../live2d-framework/type/csmvector';
import { ACubismMotion } from '../live2d-framework/motion/acubismmotion';
import { CubismBreath, BreathParameterData } from '../live2d-framework/effect/cubismbreath';
import { CubismEyeBlink } from '../live2d-framework/effect/cubismeyeblink';
import * as Live2DDefine from './Live2DDefine';

export class Live2DModel extends CubismUserModel {
  private _modelSetting?: ICubismModelSetting;
  private _modelHomeDir: string = '';
  private _userTimeSeconds: number = 0;
  private _idParamAngleX?: CubismIdHandle;
  private _idParamAngleY?: CubismIdHandle;
  private _idParamAngleZ?: CubismIdHandle;
  private _idParamBodyAngleX?: CubismIdHandle;
  private _idParamEyeBallX?: CubismIdHandle;
  private _idParamEyeBallY?: CubismIdHandle;
  private _idParamMouthOpenY?: CubismIdHandle;
  protected _expressions: csmMap<string, ACubismMotion>;
  protected _motions: csmMap<string, ACubismMotion>;
  private _gl: WebGLRenderingContext | null = null;
  private _eyeBlinkIds: csmVector<CubismIdHandle>;
  private _lipSyncIds: csmVector<CubismIdHandle>;

  constructor() {
    super();
    this._expressions = new csmMap<string, ACubismMotion>();
    this._motions = new csmMap<string, ACubismMotion>();
    this._eyeBlinkIds = new csmVector<CubismIdHandle>();
    this._lipSyncIds = new csmVector<CubismIdHandle>();
  }

  /**
   * Set WebGL context
   */
  public setGL(gl: WebGLRenderingContext): void {
    this._gl = gl;
  }

  /**
   * Load model data
   */
  public async loadAssets(dir: string, fileName: string): Promise<void> {
    this._modelHomeDir = dir;

    const modelJsonPath = `${this._modelHomeDir}${fileName}`;

    try {
      // Load model3.json
      const response = await fetch(modelJsonPath);
      const arrayBuffer = await response.arrayBuffer();
      const setting = new CubismModelSettingJson(arrayBuffer, arrayBuffer.byteLength);
      this._modelSetting = setting;

      // Load .moc3
      await this._loadModel();

      // Create renderer BEFORE loading textures
      this.createRenderer();

      // Initialize the renderer with the WebGL context
      if (this._gl && this.getRenderer()) {
        this.getRenderer().startUp(this._gl);
        console.log('Renderer initialized with WebGL context');
      } else {
        console.error('Failed to initialize renderer: GL context or renderer not available');
      }

      // Load textures
      await this._loadTextures();

      // Load expressions
      await this._loadExpressions();

      // Load physics
      await this._loadPhysics();

      // Load pose
      await this._loadPose();

      // Load motions
      await this._loadMotions();

      this._model?.saveParameters();

      // Initialize parameter IDs
      this._idParamAngleX = CubismFramework.getIdManager().getId(
        CubismDefaultParameterId.ParamAngleX
      );
      this._idParamAngleY = CubismFramework.getIdManager().getId(
        CubismDefaultParameterId.ParamAngleY
      );
      this._idParamAngleZ = CubismFramework.getIdManager().getId(
        CubismDefaultParameterId.ParamAngleZ
      );
      this._idParamBodyAngleX = CubismFramework.getIdManager().getId(
        CubismDefaultParameterId.ParamBodyAngleX
      );
      this._idParamEyeBallX = CubismFramework.getIdManager().getId(
        CubismDefaultParameterId.ParamEyeBallX
      );
      this._idParamEyeBallY = CubismFramework.getIdManager().getId(
        CubismDefaultParameterId.ParamEyeBallY
      );
      this._idParamMouthOpenY = CubismFramework.getIdManager().getId(
        CubismDefaultParameterId.ParamMouthOpenY
      );

      // Setup breathing
      this._breath = CubismBreath.create();
      const breathParameters = new csmVector<BreathParameterData>();
      breathParameters.pushBack(
        new BreathParameterData(
          this._idParamAngleX,
          0.0,
          15.0,
          6.5345,
          0.5
        )
      );
      breathParameters.pushBack(
        new BreathParameterData(
          this._idParamAngleY,
          0.0,
          8.0,
          3.5345,
          0.5
        )
      );
      breathParameters.pushBack(
        new BreathParameterData(
          this._idParamAngleZ,
          0.0,
          10.0,
          5.5345,
          0.5
        )
      );
      breathParameters.pushBack(
        new BreathParameterData(
          this._idParamBodyAngleX,
          0.0,
          4.0,
          15.5345,
          0.5
        )
      );
      breathParameters.pushBack(
        new BreathParameterData(
          CubismFramework.getIdManager().getId(
            CubismDefaultParameterId.ParamBreath
          ),
          0.5,
          0.5,
          3.2345,
          1.0
        )
      );
      this._breath.setParameters(breathParameters);

      // Setup eye blink IDs
      const eyeBlinkIdCount = this._modelSetting.getEyeBlinkParameterCount();
      for (let i = 0; i < eyeBlinkIdCount; i++) {
        this._eyeBlinkIds.pushBack(this._modelSetting.getEyeBlinkParameterId(i));
      }

      // Setup lip sync IDs
      const lipSyncIdCount = this._modelSetting.getLipSyncParameterCount();
      for (let i = 0; i < lipSyncIdCount; i++) {
        this._lipSyncIds.pushBack(this._modelSetting.getLipSyncParameterId(i));
      }

      // Setup eye blink
      this._eyeBlink = CubismEyeBlink.create(this._modelSetting);

      // Setup model matrix - center the model
      const modelWidth = this._model.getCanvasWidth();
      this._modelMatrix.setWidth(modelWidth);
      this._modelMatrix.setHeight(modelWidth);
      this._modelMatrix.setCenterPosition(0.0, 0.0);

      // Start idle motion (after everything is loaded) - with delay to ensure everything is ready
      console.log('Model setup complete. Motions loaded:', this._motions.getSize());
      
      if (this._motions.getSize() > 0) {
        setTimeout(() => {
          console.log('Starting idle motion...');
          console.log('Total motions available:', this._motions.getSize());
          const motionResult = this.startRandomMotion(
            Live2DDefine.MotionGroupIdle,
            Live2DDefine.PriorityIdle
          );
          console.log('Motion started:', motionResult !== -1 ? 'Success' : 'Failed');
          
          // Check if motion manager is working
          if (this._motionManager) {
            console.log('Motion manager status:', {
              currentPriority: this._motionManager.getCurrentPriority(),
              isFinished: this._motionManager.isFinished()
            });
          }
        }, 100);
      } else {
        console.warn('No motions loaded, character will be static');
      }
    } catch (error) {
      console.error('Failed to load model:', error);
      throw error;
    }
  }

  /**
   * Load .moc3 file
   */
  private async _loadModel(): Promise<void> {
    if (!this._modelSetting) return;

    const modelFileName = this._modelSetting.getModelFileName();
    if (modelFileName === '') {
      console.error('Model file not found');
      return;
    }

    const modelPath = `${this._modelHomeDir}${modelFileName}`;
    const response = await fetch(modelPath);
    const arrayBuffer = await response.arrayBuffer();

    this.loadModel(arrayBuffer, false);
  }

  /**
   * Load textures
   */
  private async _loadTextures(): Promise<void> {
    if (!this._modelSetting) return;

    const renderer = this.getRenderer();
    if (!renderer) {
      console.error('Renderer not initialized');
      return;
    }

    const textureCount = this._modelSetting.getTextureCount();
    console.log(`Loading ${textureCount} textures...`);

    for (let i = 0; i < textureCount; i++) {
      const textureFileName = this._modelSetting.getTextureFileName(i);
      if (textureFileName === '') continue;

      const texturePath = `${this._modelHomeDir}${textureFileName}`;

      // Create texture
      const img = new Image();
      // Don't set crossOrigin for local files
      // img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get 2D context'));
              return;
            }

            ctx.drawImage(img, 0, 0);

            // Access the GL context from the renderer (public property)
            const gl = (renderer as any).gl as WebGLRenderingContext;
            if (!gl) {
              reject(new Error('WebGL context not available'));
              return;
            }

            const texture = gl.createTexture();
            if (!texture) {
              reject(new Error('Failed to create WebGL texture'));
              return;
            }

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.bindTexture(gl.TEXTURE_2D, null);

            renderer.bindTexture(i, texture);
            console.log(`Texture ${i + 1}/${textureCount} loaded: ${texturePath}`);
            resolve();
          } catch (error) {
            console.error(`Failed to load texture ${i}:`, error);
            reject(error);
          }
        };

        img.onerror = () => reject(new Error(`Failed to load texture: ${texturePath}`));
        img.src = texturePath;
      });
    }

    renderer.setIsPremultipliedAlpha(true);
    console.log(`All ${textureCount} textures loaded and bound successfully`);
  }

  /**
   * Load expressions
   */
  private async _loadExpressions(): Promise<void> {
    if (!this._modelSetting) return;

    const expressionCount = this._modelSetting.getExpressionCount();
    console.log(`Loading ${expressionCount} expressions...`);

    for (let i = 0; i < expressionCount; i++) {
      const expressionName = this._modelSetting.getExpressionName(i);
      const expressionFileName = this._modelSetting.getExpressionFileName(i);

      if (expressionFileName === '') continue;

      const expressionPath = `${this._modelHomeDir}${expressionFileName}`;

      try {
        const response = await fetch(expressionPath);
        const arrayBuffer = await response.arrayBuffer();

        const motion = this.loadExpression(arrayBuffer, arrayBuffer.byteLength, expressionName);

        if (motion) {
          if (this._expressions.getValue(expressionName) != null) {
            this._expressions.getValue(expressionName)!.release();
            this._expressions.setValue(expressionName, null);
          }

          this._expressions.setValue(expressionName, motion);
          console.log(`Loaded expression: ${expressionName}`);
        }
      } catch (error) {
        console.error(`Failed to load expression ${expressionPath}:`, error);
      }
    }
    
    console.log(`Total expressions loaded: ${this._expressions.getSize()}`);
  }

  /**
   * Load physics
   */
  private async _loadPhysics(): Promise<void> {
    if (!this._modelSetting) return;

    const physicsFileName = this._modelSetting.getPhysicsFileName();
    if (physicsFileName === '') return;

    const physicsPath = `${this._modelHomeDir}${physicsFileName}`;

    const response = await fetch(physicsPath);
    const arrayBuffer = await response.arrayBuffer();

    this.loadPhysics(arrayBuffer, arrayBuffer.byteLength);
  }

  /**
   * Load pose
   */
  private async _loadPose(): Promise<void> {
    if (!this._modelSetting) return;

    const poseFileName = this._modelSetting.getPoseFileName();
    if (poseFileName === '') return;

    const posePath = `${this._modelHomeDir}${poseFileName}`;

    const response = await fetch(posePath);
    const arrayBuffer = await response.arrayBuffer();

    this.loadPose(arrayBuffer, arrayBuffer.byteLength);
  }

  /**
   * Load motions
   */
  private async _loadMotions(): Promise<void> {
    if (!this._modelSetting) return;

    const motionGroupCount = this._modelSetting.getMotionGroupCount();
    console.log(`Loading motions from ${motionGroupCount} groups...`);

    for (let i = 0; i < motionGroupCount; i++) {
      const groupName = this._modelSetting.getMotionGroupName(i);
      const motionCount = this._modelSetting.getMotionCount(groupName);
      console.log(`Group "${groupName}": ${motionCount} motions`);

      for (let j = 0; j < motionCount; j++) {
        const motionFileName = this._modelSetting.getMotionFileName(groupName, j);
        if (motionFileName === '') continue;

        const motionPath = `${this._modelHomeDir}${motionFileName}`;

        try {
          const response = await fetch(motionPath);
          const arrayBuffer = await response.arrayBuffer();

          const motion = this.loadMotion(
            arrayBuffer,
            arrayBuffer.byteLength,
            `${groupName}_${j}`,
            undefined,  // onFinishedMotionHandler
            undefined,  // onBeganMotionHandler
            this._modelSetting,
            groupName,
            j,
            false  // shouldCheckMotionConsistency
          );

          if (motion) {
            const fadeInTime = this._modelSetting.getMotionFadeInTimeValue(groupName, j);
            const fadeOutTime = this._modelSetting.getMotionFadeOutTimeValue(groupName, j);

            if (fadeInTime !== -1.0) {
              motion.setFadeInTime(fadeInTime);
            }

            if (fadeOutTime !== -1.0) {
              motion.setFadeOutTime(fadeOutTime);
            }

            // Set effect IDs for eye blink and lip sync
            motion.setEffectIds(this._eyeBlinkIds, this._lipSyncIds);

            const motionKey = `${groupName}_${j}`;
            this._motions.setValue(motionKey, motion);
            console.log(`Loaded motion: ${motionKey} from ${motionFileName}`);
          } else {
            console.warn(`Failed to create motion for ${motionPath}`);
          }
        } catch (error) {
          console.error(`Failed to load motion ${motionPath}:`, error);
        }
      }
    }
    console.log(`Total motions loaded: ${this._motions.getSize()}`);
  }

  /**
   * Get model matrix
   */
  public getModelMatrix(): CubismModelMatrix {
    return this._modelMatrix;
  }

  /**
   * Update model
   */
  public update(deltaTimeSeconds: number): void {
    if (!this._model) return;

    this._userTimeSeconds += deltaTimeSeconds;

    this._dragManager.update(deltaTimeSeconds);
    this._dragX = this._dragManager.getX();
    this._dragY = this._dragManager.getY();

    // Save model state before motion
    this._model.saveParameters();

    // Update motion (only if motions are loaded)
    let motionUpdated = false;
    if (this._motionManager != null && this._motions.getSize() > 0) {
      try {
        motionUpdated = this._motionManager.updateMotion(
          this._model,
          deltaTimeSeconds
        );
        
        // Restart motion if it finished
        if (this._motionManager.isFinished()) {
          this.startRandomMotion(
            Live2DDefine.MotionGroupIdle,
            Live2DDefine.PriorityIdle
          );
        }
      } catch (error) {
        console.error('Error updating motion:', error);
      }
    }
    
    // If no motion is playing, load saved parameters
    if (!motionUpdated) {
      this._model.loadParameters();
    }

    // Update expression
    if (this._expressionManager != null) {
      this._expressionManager.updateMotion(this._model, deltaTimeSeconds);
    }

    // Apply drag to model parameters
    if (this._idParamAngleX) {
      this._model.addParameterValueById(this._idParamAngleX, this._dragX * 30);
    }
    if (this._idParamAngleY) {
      this._model.addParameterValueById(this._idParamAngleY, this._dragY * 30);
    }
    if (this._idParamAngleZ) {
      this._model.addParameterValueById(
        this._idParamAngleZ,
        this._dragX * this._dragY * -30
      );
    }
    if (this._idParamBodyAngleX) {
      this._model.addParameterValueById(this._idParamBodyAngleX, this._dragX * 10);
    }
    if (this._idParamEyeBallX) {
      this._model.addParameterValueById(this._idParamEyeBallX, this._dragX);
    }
    if (this._idParamEyeBallY) {
      this._model.addParameterValueById(this._idParamEyeBallY, this._dragY);
    }

    // Breathing
    if (this._breath != null) {
      this._breath.updateParameters(this._model, deltaTimeSeconds);
    }

    // Physics
    if (this._physics != null) {
      this._physics.evaluate(this._model, deltaTimeSeconds);
    }

    // Lip sync
    if (this._lipsync && this._idParamMouthOpenY) {
      const value = 0; // Real lipsync value should be provided
      this._model.addParameterValueById(this._idParamMouthOpenY, value, 0.8);
    }

    // Eye blink
    if (this._eyeBlink != null) {
      this._eyeBlink.updateParameters(this._model, deltaTimeSeconds);
    }

    // Pose
    if (this._pose != null) {
      this._pose.updateParameters(this._model, deltaTimeSeconds);
    }

    this._model.update();
  }

  /**
   * Draw model
   */
  public draw(matrix: CubismMatrix44): void {
    if (this._model == null) return;

    const renderer = this.getRenderer();
    if (!renderer) return;

    const viewMatrix = new CubismMatrix44();
    viewMatrix.setMatrix(matrix.getArray());
    viewMatrix.multiplyByMatrix(this._modelMatrix);

    renderer.setMvpMatrix(viewMatrix);
    renderer.drawModel();
  }

  /**
   * Start motion
   */
  public startMotion(
    group: string,
    no: number,
    priority: number
  ): number {
    if (!this._modelSetting) {
      console.warn('Cannot start motion: model setting not loaded');
      return -1;
    }

    if (!this._motionManager) {
      console.warn('Cannot start motion: motion manager not initialized');
      return -1;
    }

    const motionKey = `${group}_${no}`;
    const motion = this._motions.getValue(motionKey);

    if (!motion) {
      console.warn(`Motion not found: ${motionKey}`);
      console.log('Total motions available:', this._motions.getSize());
      return -1;
    }

    console.log(`Starting motion: ${motionKey} with priority ${priority}`);

    if (priority === Live2DDefine.PriorityForce) {
      this._motionManager.setReservePriority(priority);
    } else if (!this._motionManager.reserveMotion(priority)) {
      console.warn('Failed to reserve motion priority');
      return -1;
    }

    try {
      const handle = this._motionManager.startMotionPriority(
        motion,
        false,
        priority
      );

      if (handle) {
        console.log('Motion started successfully');
        return 0;
      } else {
        console.warn('Failed to get motion handle');
        return -1;
      }
    } catch (error) {
      console.error('Error starting motion:', error);
      return -1;
    }
  }

  /**
   * Start random motion
   */
  public startRandomMotion(
    group: string,
    priority: number
  ): number {
    if (!this._modelSetting) {
      console.warn('Cannot start motion: model setting not loaded');
      return -1;
    }

    const motionCount = this._modelSetting.getMotionCount(group);
    if (motionCount === 0) {
      console.warn(`No motions found in group: ${group}`);
      return -1;
    }

    const no = Math.floor(Math.random() * motionCount);
    console.log(`Starting random motion from group "${group}", index ${no} (of ${motionCount})`);
    return this.startMotion(group, no, priority);
  }

  /**
   * Set a random expression
   */
  public setRandomExpression(): void {
    console.log('setRandomExpression called');
    console.log('Expressions loaded:', this._expressions.getSize());
    
    if (!this._modelSetting || this._expressions.getSize() === 0) {
      console.log('No expressions available - trying random motion instead');
      this.startRandomMotion(Live2DDefine.MotionGroupTapBody, Live2DDefine.PriorityNormal);
      return;
    }

    const expressionCount = this._modelSetting.getExpressionCount();
    if (expressionCount === 0) {
      console.log('Expression count is 0 - trying random motion instead');
      this.startRandomMotion(Live2DDefine.MotionGroupTapBody, Live2DDefine.PriorityNormal);
      return;
    }

    const no = Math.floor(Math.random() * expressionCount);
    const expressionName = this._modelSetting.getExpressionName(no);
    const expression = this._expressions.getValue(expressionName);

    console.log(`Attempting to play expression: ${expressionName} (${no + 1}/${expressionCount})`);

    if (expression && this._expressionManager) {
      console.log(`✓ Playing expression: ${expressionName}`);
      this._expressionManager.startMotionPriority(expression, false, Live2DDefine.PriorityForce);
    } else {
      console.warn(`Expression not available: ${expressionName}`);
      // Try a TapBody motion as fallback
      this.startRandomMotion(Live2DDefine.MotionGroupTapBody, Live2DDefine.PriorityNormal);
    }
  }

  /**
   * Set expression by name
   */
  public setExpression(expressionName: string): void {
    const expression = this._expressions.getValue(expressionName);
    
    if (expression && this._expressionManager) {
      console.log(`Playing expression: ${expressionName}`);
      this._expressionManager.startMotionPriority(expression, false, Live2DDefine.PriorityForce);
    } else {
      console.warn(`Expression not found: ${expressionName}`);
    }
  }

  /**
   * Release model
   */
  public release(): void {
    if (this._modelSetting) {
      this._modelSetting.release();
      this._modelSetting = undefined;
    }

    super.release();
  }
}


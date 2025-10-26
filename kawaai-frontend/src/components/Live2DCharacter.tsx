/**
 * Live2D Character React Component
 */

import React, { useEffect, useRef, useState } from 'react';
import { Live2DManager } from '../live2d/Live2DManager';
import { LAppGlManager } from '../live2d/LAppGlManager';
import Live2DFrameworkManager from '../live2d/Live2DFramework';

interface Live2DCharacterProps {
  modelDir?: string;
  modelFileName?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export const Live2DCharacter: React.FC<Live2DCharacterProps> = ({
  modelDir = 'Haru',
  modelFileName = 'Haru.model3.json',
  width = '100%',
  height = '100%',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<Live2DManager | null>(null);
  const glManagerRef = useRef<LAppGlManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  
  // Audio analysis for lip sync
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioLevelRef = useRef<number>(0);

  // Audio analysis removed - Live2D works without it
  // Lip sync can be added back later if needed

  useEffect(() => {
    const initializeLive2D = async () => {
      if (!canvasRef.current) return;

      try {
        // Initialize GL Manager
        const glManager = new LAppGlManager();
        if (!glManager.initialize(canvasRef.current)) {
          throw new Error('Failed to initialize WebGL');
        }
        glManagerRef.current = glManager;

        // Initialize Cubism Framework (globally managed)
        await Live2DFrameworkManager.getInstance().initialize();

        // Create Live2D Manager
        const manager = new Live2DManager();
        managerRef.current = manager;

        // Set the WebGL context
        const gl = glManager.getGL();
        if (gl) {
          manager.setGL(gl);
        }

        // Load model
        await manager.loadModel(modelDir, modelFileName);

        setIsInitialized(true);
        startRendering();
      } catch (err) {
        console.error('Failed to initialize Live2D:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    initializeLive2D();

    return () => {
      cleanup();
    };
  }, [modelDir, modelFileName]);

  const startRendering = () => {
    const render = (time: number) => {
      if (!canvasRef.current || !managerRef.current || !glManagerRef.current) {
        return;
      }

      // Calculate delta time
      const deltaTime = lastFrameTimeRef.current === 0 
        ? 0 
        : (time - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = time;

      // Clear canvas
      const gl = glManagerRef.current.getGL();
      const canvas = canvasRef.current;
      
      if (gl && canvas) {
        // Set viewport
        const viewport = [0, 0, canvas.width, canvas.height];
        
        gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
        gl.clearColor(1.0, 1.0, 1.0, 0.0); // White background to see the model
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.clearDepth(1.0);
        
        // Proper blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        // Set render state for the renderer
        const model = managerRef.current.getCurrentModel();
        if (model && model.getRenderer()) {
          model.getRenderer().setRenderState(gl.getParameter(gl.FRAMEBUFFER_BINDING), viewport);
        }
      }

      // Update and draw model
      // Note: Audio-based lip sync removed for now
      managerRef.current.update(deltaTime);
      managerRef.current.draw();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
  };

  const cleanup = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (managerRef.current) {
      managerRef.current.release();
      managerRef.current = null;
    }

    if (glManagerRef.current) {
      glManagerRef.current.release();
      glManagerRef.current = null;
    }

    // Release framework reference (only disposes when no components are using it)
    Live2DFrameworkManager.getInstance().release();
  };

  const handleResize = () => {
    if (canvasRef.current && managerRef.current && glManagerRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      
      // Force square aspect ratio to prevent distortion
      // Take the larger dimension to maintain quality
      const size = Math.max(rect.width || 600, rect.height || 600);
      
      // Set canvas internal resolution
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = size * pixelRatio;
      canvas.height = size * pixelRatio;
      
      // Set canvas CSS size (must match internal size / pixelRatio)
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      console.log(`Canvas resized to square: ${size}x${size} (internal: ${canvas.width}x${canvas.height})`);

      const gl = glManagerRef.current.getGL();
      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      managerRef.current.onResize(canvas.width, canvas.height);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !managerRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Convert mouse position to canvas coordinates (0 to 1)
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    
    // Convert to model coordinates (-1 to 1, Y inverted)
    const modelX = (x * 2.0 - 1.0);
    const modelY = -(y * 2.0 - 1.0); // Invert Y
    
    mousePositionRef.current = { x: modelX, y: modelY };
    
    // Apply to model
    const model = managerRef.current.getCurrentModel();
    if (model) {
      model.setDragging(modelX, modelY);
    }
  };

  const handleMouseLeave = () => {
    // Reset to center when mouse leaves
    mousePositionRef.current = { x: 0, y: 0 };
    const model = managerRef.current?.getCurrentModel();
    if (model) {
      model.setDragging(0, 0);
    }
  };

  const handleClick = () => {
    console.log('Character clicked!');
    const model = managerRef.current?.getCurrentModel();
    if (model) {
      console.log('Model found, calling setRandomExpression...');
      // Play a random expression or motion
      model.setRandomExpression();
    } else {
      console.warn('No model available to play expression');
    }
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isInitialized]);

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="text-red-500 text-center p-4">
          <p className="font-bold mb-2">Failed to load Live2D character</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <canvas
        ref={canvasRef}
        style={{ 
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          overflow: 'visible',
          objectFit: 'contain'
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
            <p>Loading Live2D Character...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Live2DCharacter;


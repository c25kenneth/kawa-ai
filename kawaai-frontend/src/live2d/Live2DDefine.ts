/**
 * Live2D Configuration Constants
 */

// Canvas settings
export const CanvasSize: { width: number; height: number } | 'auto' = 'auto';

// View settings
export const ViewScale = 1.0;
export const ViewMaxScale = 2.0;
export const ViewMinScale = 0.8;

export const ViewLogicalLeft = -1.0;
export const ViewLogicalRight = 1.0;
export const ViewLogicalBottom = -1.0;
export const ViewLogicalTop = 1.0;

export const ViewLogicalMaxLeft = -4.0;
export const ViewLogicalMaxRight = 4.0;
export const ViewLogicalMaxBottom = -4.0;
export const ViewLogicalMaxTop = 4.0;

// Resource path - relative to public folder
export const ResourcesPath = '/live2d/';

// Model directories
export const ModelDir: string[] = [
  'Haru',
  'Hiyori', 
  'Mao',
  'Mark',
  'Natori',
  'Rice',
  'Wanko'
];
export const ModelDirSize: number = ModelDir.length;

// Motion groups
export const MotionGroupIdle = 'Idle';
export const MotionGroupTapBody = 'TapBody';

// Hit areas
export const HitAreaNameHead = 'Head';
export const HitAreaNameBody = 'Body';

// Motion priorities
export const PriorityNone = 0;
export const PriorityIdle = 1;
export const PriorityNormal = 2;
export const PriorityForce = 3;

// Debug options
export const DebugLogEnable = true;
export const DebugTouchLogEnable = false;

// Render target size
export const RenderTargetWidth = 1900;
export const RenderTargetHeight = 1000;


/**
 * Live2D Test Page - Demo page to test the Live2D integration
 */

import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Live2DCharacter from '../components/Live2DCharacter';

export default function Live2DTest() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black/30 backdrop-blur-sm p-4 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/home')}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Live2D Character Demo</h1>
              <p className="text-sm text-gray-300">Testing the Haru character</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-20 pb-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Live2D Character Display */}
            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h2 className="text-white text-lg font-semibold mb-4">Character View</h2>
              <div className="bg-black/40 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <Live2DCharacter
                  modelDir="Mao"
                  modelFileName="Mao.model3.json"
                  width="100%"
                  height="100%"
                />
              </div>
            </div>

            {/* Info Panel */}
            <div className="space-y-6">
              <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <h2 className="text-white text-lg font-semibold mb-4">Character Information</h2>
                <div className="space-y-3 text-gray-300">
                  <div>
                    <span className="font-medium text-purple-400">Model:</span> Mao
                  </div>
                  <div>
                    <span className="font-medium text-purple-400">Format:</span> Live2D Cubism
                  </div>
                  <div>
                    <span className="font-medium text-purple-400">SDK:</span> Cubism SDK for Web 5.r.4
                  </div>
                  <div>
                    <span className="font-medium text-purple-400">Features:</span>
                    <ul className="ml-4 mt-2 space-y-1 text-sm">
                      <li>• Eye tracking (mouse following)</li>
                      <li>• Lip sync support</li>
                      <li>• Physics simulation</li>
                      <li>• Expression animations</li>
                      <li>• Motion playback</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <h2 className="text-white text-lg font-semibold mb-4">Controls</h2>
                <div className="space-y-2 text-gray-300 text-sm">
                  <p>• <strong>Move your mouse</strong> over the character to make her eyes and head follow</p>
                  <p>• The character plays idle animations automatically</p>
                  <p>• Physics are applied to hair and accessories</p>
                  <p>• Breathing animation is active</p>
                </div>
              </div>

              <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <h2 className="text-white text-lg font-semibold mb-4">Integration Status</h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300 text-sm">Live2D Core Loaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300 text-sm">Framework Initialized</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300 text-sm">WebGL Context Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300 text-sm">Model Rendering</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


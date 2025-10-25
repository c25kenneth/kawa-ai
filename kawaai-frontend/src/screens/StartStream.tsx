import { useState } from 'react';
import { Upload, User, FileText, Sparkles, Tag, Globe, Lock, Radio, X } from 'lucide-react';

export default function StartStreamPage() {
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    backstory: '',
    persona: '',
    category: '',
    tags: '',
    language: 'English',
    privacy: 'public',
    streamTitle: '',
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleStartStream = () => {
    console.log('Stream data:', { ...formData, avatar: avatarPreview });
    alert('Stream started successfully!');
  };

  const categories = [
    'Gaming',
    'Just Chatting',
    'Music',
    'Art',
    'Cooking',
    'Fitness',
    'Technology',
    'Education',
    'Sports',
    'Other',
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-2xl font-bold text-indigo-500">StreamHub</div>
            <span className="text-gray-400">/ Start Stream</span>
          </div>
          <button
            onClick={handleStartStream}
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg font-semibold transition flex items-center space-x-2"
          >
            <Radio className="w-5 h-5" />
            <span>Go Live</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Set Up Your Stream</h1>
          <p className="text-gray-400">Configure your avatar and stream details before going live</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Avatar Upload Section */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                <User className="w-5 h-5 text-indigo-400" />
                <span>Avatar</span>
              </h2>

              <div className="space-y-4">
                {/* Avatar Preview */}
                <div className="relative">
                  {avatarPreview ? (
                    <div className="relative">
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-full aspect-square object-cover rounded-xl"
                      />
                      <button
                        onClick={() => setAvatarPreview('')}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 p-2 rounded-full transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="block w-full aspect-square border-2 border-dashed border-gray-600 rounded-xl hover:border-indigo-500 transition cursor-pointer group">
                      <div className="h-full flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center group-hover:bg-indigo-600 transition">
                          <Upload className="w-8 h-8 text-gray-400 group-hover:text-white transition" />
                        </div>
                        <div className="text-center px-4">
                          <p className="text-sm font-medium text-gray-300">Upload Avatar</p>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Quick Tips */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span>Tips</span>
                  </h3>
                  <ul className="text-xs text-gray-300 space-y-1">
                    <li>• Use a clear, high-quality image</li>
                    <li>• Square format works best</li>
                    <li>• Show your personality!</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stream Title */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <label className="block mb-2 text-sm font-medium">
                Stream Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.streamTitle}
                onChange={(e) => handleChange('streamTitle', e.target.value)}
                placeholder="What are you streaming today?"
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
              />
            </div>

            {/* Avatar Details */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Avatar Details</span>
              </h2>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block mb-2 text-sm font-medium">
                    Avatar Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Enter your avatar's name"
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                  />
                </div>

                {/* Persona */}
                <div>
                  <label className="block mb-2 text-sm font-medium">Persona</label>
                  <input
                    type="text"
                    value={formData.persona}
                    onChange={(e) => handleChange('persona', e.target.value)}
                    placeholder="e.g., Energetic gamer, Chill artist, Friendly teacher"
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                  />
                  <p className="text-xs text-gray-400 mt-1">Describe your avatar's personality</p>
                </div>

                {/* Backstory */}
                <div>
                  <label className="block mb-2 text-sm font-medium">Backstory</label>
                  <textarea
                    value={formData.backstory}
                    onChange={(e) => handleChange('backstory', e.target.value)}
                    placeholder="Tell viewers about your avatar's story and background..."
                    rows={4}
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Share your avatar's origin and journey</p>
                </div>
              </div>
            </div>

            {/* Stream Settings */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                <Tag className="w-5 h-5 text-indigo-400" />
                <span>Stream Settings</span>
              </h2>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block mb-2 text-sm font-medium">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block mb-2 text-sm font-medium">Tags</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => handleChange('tags', e.target.value)}
                    placeholder="e.g., english, beginner-friendly, chill"
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                  />
                  <p className="text-xs text-gray-400 mt-1">Separate tags with commas</p>
                </div>

                {/* Language & Privacy */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium flex items-center space-x-2">
                      <Globe className="w-4 h-4" />
                      <span>Language</span>
                    </label>
                    <select
                      value={formData.language}
                      onChange={(e) => handleChange('language', e.target.value)}
                      className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                    >
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                      <option>Japanese</option>
                      <option>Korean</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium flex items-center space-x-2">
                      <Lock className="w-4 h-4" />
                      <span>Privacy</span>
                    </label>
                    <select
                      value={formData.privacy}
                      onChange={(e) => handleChange('privacy', e.target.value)}
                      className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-4">
              <button className="px-6 py-3 border border-gray-600 rounded-lg hover:bg-gray-700 transition font-medium">
                Save Draft
              </button>
              <button
                onClick={handleStartStream}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition font-semibold flex items-center space-x-2"
              >
                <Radio className="w-5 h-5" />
                <span>Go Live</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
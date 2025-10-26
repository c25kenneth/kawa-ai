/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseConfig";
import { Video, Sparkles, Loader2, Check, Gamepad2, Music, Palette, Cpu, Heart } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

interface Avatar {
  id: string;
  avatar_name: string;
  avatar_url: string;
  persona: string;
  backstory: string;
  category: string;
  tags: string[];
  icon: any;
}

// Hardcoded avatars
const AVAILABLE_AVATARS: Avatar[] = [
  {
    id: "avatar-gamer-kai",
    avatar_name: "Kai",
    avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop",
    persona: "Energetic Pro Gamer",
    backstory: "Kai is a competitive gamer who loves fast-paced action games and teaching strategies. Always hyped and ready to clutch the game!",
    category: "Gaming",
    tags: ["FPS", "Strategy", "Competitive"],
    icon: Gamepad2
  },
  {
    id: "avatar-musician-luna",
    avatar_name: "Luna",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
    persona: "Chill Music Producer",
    backstory: "Luna creates lo-fi beats and ambient music. She loves talking about music theory, production techniques, and discovering new sounds.",
    category: "Music",
    tags: ["Lo-fi", "Ambient", "Production"],
    icon: Music
  },
  {
    id: "avatar-artist-zen",
    avatar_name: "Zen",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    persona: "Creative Digital Artist",
    backstory: "Zen is a digital artist specializing in character design and concept art. Patient teacher who loves sharing tips and techniques.",
    category: "Art",
    tags: ["Digital Art", "Character Design", "Illustration"],
    icon: Palette
  },
  {
    id: "avatar-tech-nova",
    avatar_name: "Nova",
    avatar_url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
    persona: "Tech Enthusiast & Coder",
    backstory: "Nova is passionate about coding, AI, and emerging tech. She breaks down complex topics into simple explanations and loves live coding sessions.",
    category: "Technology",
    tags: ["Coding", "AI", "Web Dev"],
    icon: Cpu
  },
  {
    id: "avatar-fitness-max",
    avatar_name: "Max",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    persona: "Motivational Fitness Coach",
    backstory: "Max is all about gains and positive vibes. He shares workout routines, nutrition tips, and motivates everyone to reach their fitness goals.",
    category: "Fitness",
    tags: ["Workouts", "Nutrition", "Motivation"],
    icon: Heart
  },
  {
    id: "avatar-streamer-alex",
    avatar_name: "Alex",
    avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
    persona: "Just Chatting Vibes",
    backstory: "Alex loves hanging out and talking about anything and everything. From deep conversations to silly memes, it's all good vibes here.",
    category: "Just Chatting",
    tags: ["Casual", "Chat", "Community"],
    icon: Sparkles
  }
];

export default function CreateStream() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [game, setGame] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract YouTube video ID from URL
  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  };

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!title || !game || !selectedAvatar) {
        setError("Please fill in Stream Title, Game/Topic, and select an Avatar");
        setLoading(false);
        return;
      }

      // Validate YouTube URL if provided
      if (youtubeUrl) {
        const videoId = extractYouTubeId(youtubeUrl);
        if (!videoId) {
          setError("Please enter a valid YouTube URL");
          setLoading(false);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("You must be logged in.");
        setLoading(false);
        return;
      }

      const user = session.user;
    //   const streamerName = user.user_metadata?.username || user.email;

      // Extract YouTube video ID
      const youtubeVideoId = youtubeUrl ? extractYouTubeId(youtubeUrl) : null;

      // Create room via backend
      const response = await fetch(`${BACKEND_URL}/api/rooms/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title,
          game,
          streamerName: selectedAvatar.avatar_name,
          userId: user.id,
          youtubeVideoId: youtubeVideoId,
          avatarId: selectedAvatar.id,
          avatarUrl: selectedAvatar.avatar_url,
          avatarName: selectedAvatar.avatar_name,
          avatarPersona: selectedAvatar.persona,
          avatarBackstory: selectedAvatar.backstory,
          tags: selectedAvatar.tags,
          category: selectedAvatar.category
        })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Failed to create stream");

      // Redirect to the livestream page
      navigate(`/stream/${result.roomId}`);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-gray-900 text-white py-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Your Stream</h1>
        <p className="text-gray-400">Set up your stream details and choose an AI avatar host</p>
      </div>

      <form onSubmit={handleCreateStream} className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Avatar Selection Preview */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 sticky top-8">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Selected Avatar
              </h2>

              {selectedAvatar ? (
                <div className="space-y-4">
                  {/* Avatar Preview */}
                  <img
                    src={selectedAvatar.avatar_url}
                    alt={selectedAvatar.avatar_name}
                    className="w-full aspect-square object-cover rounded-xl"
                  />
                  
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {selectedAvatar.avatar_name}
                    </h3>
                    
                    <p className="text-sm text-indigo-400 mt-1">
                      {selectedAvatar.persona}
                    </p>
                    
                    <p className="text-sm text-gray-400 mt-2">
                      {selectedAvatar.backstory}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {selectedAvatar.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-700 text-xs rounded-full text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAvatar(null)}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-sm"
                  >
                    Change Avatar
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400 text-sm">
                    Select an avatar from the list below
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stream Details */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4">Stream Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium">
                    Stream Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What are you streaming today?"
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium">
                    Category / Game <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium flex items-center gap-2">
                    <Video className="w-4 h-4 text-red-500" />
                    YouTube Video URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Add a YouTube video to play during your stream
                  </p>
                </div>
              </div>
            </div>

            {/* Avatar Selection Grid */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4">Choose Your AI Avatar</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {AVAILABLE_AVATARS.map((avatar) => {
                  const IconComponent = avatar.icon;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`relative p-4 rounded-xl border-2 transition text-left ${
                        selectedAvatar?.id === avatar.id
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                      }`}
                    >
                      {selectedAvatar?.id === avatar.id && (
                        <div className="absolute top-2 right-2 bg-indigo-500 rounded-full p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <div className="flex gap-3">
                        <img
                          src={avatar.avatar_url}
                          alt={avatar.avatar_name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate flex items-center gap-2">
                            <IconComponent className="w-4 h-4 text-indigo-400" />
                            {avatar.avatar_name}
                          </h3>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {avatar.persona}
                          </p>
                          <span className="inline-block mt-2 px-2 py-0.5 bg-gray-600 text-xs rounded text-gray-300">
                            {avatar.category}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-6 py-3 border border-gray-600 rounded-lg hover:bg-gray-700 transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedAvatar}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition font-semibold flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Start Stream</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
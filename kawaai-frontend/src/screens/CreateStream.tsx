/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseConfig";
import { Video, Sparkles, Loader2, Check, Gamepad2, Music, Palette, Cpu, Heart, Star } from "lucide-react";
import Live2DCharacter from '../components/Live2DCharacter';

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

interface Live2DCharacterData {
  id: string;
  name: string;
  modelDir: string;
  modelFileName: string;
  personality: string;
  description: string;
  traits: string[];
  category: string;
}

// Live2D Characters
const LIVE2D_CHARACTERS: Live2DCharacterData[] = [
  {
    id: "char-haru",
    name: "Haru",
    modelDir: "Haru",
    modelFileName: "Haru.model3.json",
    personality: "Cheerful & Energetic",
    description: "A bright and bubbly girl who loves making people smile. She's always full of energy and brings positive vibes to every stream!",
    traits: ["Friendly", "Optimistic", "Playful"],
    category: "Wholesome"
  },
  {
    id: "char-mao",
    name: "Mao",
    modelDir: "Mao",
    modelFileName: "Mao.model3.json",
    personality: "Cool & Confident",
    description: "A confident and stylish character with a cool demeanor. Mao knows how to keep things interesting with her smooth personality.",
    traits: ["Confident", "Stylish", "Charismatic"],
    category: "Cool"
  },
  {
    id: "char-hiyori",
    name: "Hiyori",
    modelDir: "Hiyori",
    modelFileName: "Hiyori.model3.json",
    personality: "Sweet & Gentle",
    description: "A kind and gentle soul who creates a warm, welcoming atmosphere. Perfect for cozy, relaxed streams.",
    traits: ["Kind", "Gentle", "Caring"],
    category: "Wholesome"
  },
  {
    id: "char-natori",
    name: "Natori",
    modelDir: "Natori",
    modelFileName: "Natori.model3.json",
    personality: "Elegant & Sophisticated",
    description: "An elegant and refined character with a sophisticated charm. She's expressive and knows how to capture attention.",
    traits: ["Elegant", "Expressive", "Refined"],
    category: "Elegant"
  },
  {
    id: "char-mark",
    name: "Mark",
    modelDir: "Mark",
    modelFileName: "Mark.model3.json",
    personality: "Laid-back & Cool Guy",
    description: "A chill and easygoing guy who's great for casual streams. Relaxed vibes and friendly banter are his specialty.",
    traits: ["Relaxed", "Friendly", "Casual"],
    category: "Chill"
  },
  {
    id: "char-wanko",
    name: "Wanko",
    modelDir: "Wanko",
    modelFileName: "Wanko.model3.json",
    personality: "Playful & Fun",
    description: "A playful character with lots of energy and fun animations. Great for keeping the stream lively and entertaining!",
    traits: ["Playful", "Energetic", "Fun"],
    category: "Fun"
  }
];

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
  const [selectedCharacter, setSelectedCharacter] = useState<Live2DCharacterData | null>(null);
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
      if (!title || !game || !selectedCharacter) {
        setError("Please fill in Stream Title, Game/Topic, and select a Character");
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
          streamerName: selectedCharacter.name,
          userId: user.id,
          youtubeVideoId: youtubeVideoId,
          avatarId: selectedCharacter.id,
          avatarUrl: '', // Live2D characters don't have URLs
          avatarName: selectedCharacter.name,
          avatarPersona: selectedCharacter.personality,
          avatarBackstory: selectedCharacter.description,
          tags: selectedCharacter.traits,
          category: selectedCharacter.category,
          live2dModel: {
            modelDir: selectedCharacter.modelDir,
            modelFileName: selectedCharacter.modelFileName
          }
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
          {/* Character Selection Preview */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 sticky top-8">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-indigo-400" />
                Selected Character
              </h2>

              {selectedCharacter ? (
                <div className="space-y-4">
                  {/* Live2D Character Preview */}
                  <div className="w-full aspect-square bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl overflow-hidden">
                    <Live2DCharacter
                      modelDir={selectedCharacter.modelDir}
                      modelFileName={selectedCharacter.modelFileName}
                      width="100%"
                      height="100%"
                    />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {selectedCharacter.name}
                    </h3>
                    
                    <p className="text-sm text-indigo-400 mt-1">
                      {selectedCharacter.personality}
                    </p>
                    
                    <p className="text-sm text-gray-400 mt-2">
                      {selectedCharacter.description}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {selectedCharacter.traits.map((trait, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-purple-700/30 text-xs rounded-full text-purple-300 border border-purple-500/30"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCharacter(null)}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-sm"
                  >
                    Change Character
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Star className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400 text-sm">
                    Select a Live2D character from the list below
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

            {/* Live2D Character Selection Grid */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-purple-400" />
                Choose Your Live2D Character
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {LIVE2D_CHARACTERS.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => setSelectedCharacter(character)}
                    className={`relative p-4 rounded-xl border-2 transition text-left ${
                      selectedCharacter?.id === character.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-600 bg-gray-700/50 hover:border-purple-500/50'
                    }`}
                  >
                    {selectedCharacter?.id === character.id && (
                      <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div className="flex gap-3">
                      {/* Live2D Character Mini Preview */}
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex-shrink-0">
                        <Live2DCharacter
                          modelDir={character.modelDir}
                          modelFileName={character.modelFileName}
                          width="100%"
                          height="100%"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                          <Star className="w-4 h-4 text-purple-400" />
                          {character.name}
                        </h3>
                        <p className="text-xs text-purple-300 mt-1">
                          {character.personality}
                        </p>
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                          {character.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {character.traits.slice(0, 2).map((trait, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-purple-700/30 text-xs rounded-full text-purple-300"
                            >
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
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
                disabled={loading || !selectedCharacter}
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
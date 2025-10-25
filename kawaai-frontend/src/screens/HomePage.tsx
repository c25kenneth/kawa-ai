import { useState } from 'react';
import { Search, Menu, Bell, User, Eye, Users, Radio } from 'lucide-react';

interface Stream {
  id: number;
  streamer: string;
  avatar: string;
  game: string;
  title: string;
  viewers: string;
  thumbnail: string;
  isLive: boolean;
}

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState('For You');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['For You', 'Following', 'Games', 'IRL', 'Music', 'Esports'];

  const streams: Stream[] = [
    {
      id: 1,
      streamer: 'ProGamer123',
      avatar: '🎮',
      game: 'League of Legends',
      title: 'Challenger Gameplay | Road to Rank 1',
      viewers: '12.5K',
      thumbnail: '#9333EA',
      isLive: true,
    },
    {
      id: 2,
      streamer: 'CasualCoder',
      avatar: '💻',
      game: 'Software Development',
      title: 'Building a Full-Stack App | React + Node.js',
      viewers: '3.2K',
      thumbnail: '#3B82F6',
      isLive: true,
    },
    {
      id: 3,
      streamer: 'ArtistVibes',
      avatar: '🎨',
      game: 'Art',
      title: 'Digital Painting Session | Character Design',
      viewers: '5.8K',
      thumbnail: '#EC4899',
      isLive: true,
    },
    {
      id: 4,
      streamer: 'SpeedRunner99',
      avatar: '⚡',
      game: 'Super Mario 64',
      title: 'World Record Attempts | 16 Star Run',
      viewers: '8.9K',
      thumbnail: '#EF4444',
      isLive: true,
    },
    {
      id: 5,
      streamer: 'MusicMaestro',
      avatar: '🎵',
      game: 'Music',
      title: 'Live Guitar Performance | Taking Requests',
      viewers: '2.1K',
      thumbnail: '#10B981',
      isLive: true,
    },
    {
      id: 6,
      streamer: 'ChefStream',
      avatar: '👨‍🍳',
      game: 'Cooking',
      title: 'Making Authentic Italian Pasta from Scratch',
      viewers: '4.3K',
      thumbnail: '#F59E0B',
      isLive: true,
    },
    {
      id: 7,
      streamer: 'FitnessFreak',
      avatar: '💪',
      game: 'Fitness',
      title: 'Morning Workout Routine | Join Me!',
      viewers: '1.9K',
      thumbnail: '#06B6D4',
      isLive: true,
    },
    {
      id: 8,
      streamer: 'TechReviewer',
      avatar: '📱',
      game: 'Science & Technology',
      title: 'Latest Tech Gadgets Review & Unboxing',
      viewers: '6.7K',
      thumbnail: '#8B5CF6',
      isLive: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation Bar */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Menu className="w-6 h-6 cursor-pointer hover:text-indigo-400 transition" />
              <div className="text-2xl font-bold text-indigo-500 cursor-pointer">StreamHub</div>
            </div>
            
            <div className="hidden md:flex items-center space-x-6">
              {categories.slice(0, 3).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-sm font-medium transition ${
                    activeCategory === cat
                      ? 'text-indigo-400'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <Bell className="w-6 h-6 cursor-pointer hover:text-indigo-400 transition" />
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition">
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-4 py-3 flex items-center space-x-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Live Channels</h2>
          <p className="text-gray-400">Channels we think you'll like</p>
        </div>

        {/* Stream Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {streams.map((stream) => (
            <div
              key={stream.id}
              className="group cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video rounded-lg overflow-hidden mb-2">
                <div
                  className="w-full h-full flex items-center justify-center text-6xl"
                  style={{ backgroundColor: stream.thumbnail }}
                >
                  {stream.avatar}
                </div>
                
                {stream.isLive && (
                  <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold flex items-center space-x-1">
                    <Radio className="w-3 h-3" />
                    <span>LIVE</span>
                  </div>
                )}
                
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-0.5 rounded text-xs flex items-center space-x-1">
                  <Eye className="w-3 h-3" />
                  <span>{stream.viewers}</span>
                </div>

                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200"></div>
              </div>

              {/* Stream Info */}
              <div className="flex space-x-2">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0 text-lg">
                  {stream.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate group-hover:text-indigo-400 transition">
                    {stream.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{stream.streamer}</p>
                  <p className="text-gray-500 text-xs">{stream.game}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recommended Categories */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Popular Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'League of Legends', viewers: '234K', color: '#9333EA' },
              { name: 'Valorant', viewers: '156K', color: '#EF4444' },
              { name: 'Minecraft', viewers: '189K', color: '#10B981' },
              { name: 'Fortnite', viewers: '145K', color: '#3B82F6' },
              { name: 'Just Chatting', viewers: '312K', color: '#EC4899' },
              { name: 'CS:GO', viewers: '98K', color: '#F59E0B' },
            ].map((category, i) => (
              <div
                key={i}
                className="cursor-pointer group"
              >
                <div
                  className="aspect-[3/4] rounded-lg mb-2 flex items-center justify-center text-4xl group-hover:opacity-90 transition"
                  style={{ backgroundColor: category.color }}
                >
                  🎮
                </div>
                <h3 className="font-semibold text-sm group-hover:text-indigo-400 transition">
                  {category.name}
                </h3>
                <p className="text-gray-400 text-xs flex items-center space-x-1">
                  <Users className="w-3 h-3" />
                  <span>{category.viewers} viewers</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
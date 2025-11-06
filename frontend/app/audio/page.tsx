'use client';

import { useState } from 'react';
import AudioReviewer from '../components/audio/AudioReviewer';
import Link from 'next/link';

export default function AudioPage() {
  const [mode, setMode] = useState<'menu' | 'review'>('menu');

  if (mode === 'review') {
    return (
      <div>
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => setMode('menu')}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
          >
            ← Back to Menu
          </button>
        </div>
        <AudioReviewer onComplete={() => setMode('menu')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">🎵 Audio Review System</h1>
          <p className="text-gray-400 text-lg">
            Review and rate 20,000+ audio submissions
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setMode('review')}
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-6 px-8 rounded-xl transition-all transform hover:scale-105 shadow-lg"
          >
            <div className="text-3xl mb-2">🎧</div>
            <div className="text-xl mb-1">Start Reviewing</div>
            <div className="text-sm text-gray-200">
              Listen and vote on unwatched audio clips
            </div>
          </button>

          <Link href="/audio/reviewed">
            <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-6 px-8 rounded-xl transition-all transform hover:scale-105 shadow-lg">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-xl mb-1">View Reviewed</div>
              <div className="text-sm text-gray-200">
                Browse upvoted and downvoted clips
              </div>
            </button>
          </Link>

          <div className="bg-gray-800 rounded-xl p-6 mt-8">
            <h2 className="text-xl font-bold mb-4">How it works:</h2>
            <ul className="space-y-2 text-gray-300">
              <li>✅ Audio auto-plays when loaded</li>
              <li>👍 Upvote clips you like (↑ key or U)</li>
              <li>👎 Downvote clips you don't like (↓ key or D)</li>
              <li>⏭️ Skip clips (→ key or S)</li>
              <li>⏸️ Play/Pause (Space bar)</li>
              <li>🔄 Clips auto-advance when finished</li>
              <li>💾 All ratings are saved automatically</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

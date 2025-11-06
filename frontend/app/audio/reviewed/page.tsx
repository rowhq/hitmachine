'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface AudioFile {
  url: string;
  filename: string;
  uploadedAt: string;
  size: number;
  status: {
    watched: boolean;
    vote: 'up' | 'down' | null;
    timestamp: number;
  };
}

export default function ReviewedAudioPage() {
  const [filter, setFilter] = useState<'upvoted' | 'downvoted'>('upvoted');
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRefs = useRef<{ [key: number]: HTMLAudioElement | null }>({});

  useEffect(() => {
    loadFiles();
  }, [filter]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/audio-list?filter=${filter}&limit=100`);
      const data = await response.json();
      setAudioFiles(data.blobs);
    } catch (error) {
      console.error('Error loading audio files:', error);
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (index: number) => {
    // Pause all other audio
    Object.entries(audioRefs.current).forEach(([key, audio]) => {
      if (parseInt(key) !== index && audio) {
        audio.pause();
      }
    });

    // Play selected audio
    const audio = audioRefs.current[index];
    if (audio) {
      audio.play();
      setPlayingIndex(index);
    }
  };

  const deleteVote = async (file: AudioFile) => {
    try {
      await fetch('/api/audio-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.filename,
          vote: null,
          watched: true,
        }),
      });
      // Reload the list
      loadFiles();
    } catch (error) {
      console.error('Error removing vote:', error);
    }
  };

  const downloadAudio = async (file: AudioFile) => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename.replace('audio/', '');
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading audio:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Reviewed Audio</h1>
            <p className="text-gray-400">
              Browse and manage your rated audio clips
            </p>
          </div>
          <Link href="/audio">
            <button className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg">
              ← Back
            </button>
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setFilter('upvoted')}
            className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all ${
              filter === 'upvoted'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <div className="text-2xl mb-1">👍</div>
            <div>Upvoted</div>
          </button>
          <button
            onClick={() => setFilter('downvoted')}
            className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all ${
              filter === 'downvoted'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <div className="text-2xl mb-1">👎</div>
            <div>Downvoted</div>
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <div>Loading...</div>
          </div>
        )}

        {/* Audio list */}
        {!loading && audioFiles.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">🎵</div>
            <div className="text-xl">
              No {filter} clips yet
            </div>
            <div className="mt-4">
              <Link href="/audio">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
                  Start Reviewing
                </button>
              </Link>
            </div>
          </div>
        )}

        {!loading && audioFiles.length > 0 && (
          <div>
            <div className="mb-4 text-gray-400">
              {audioFiles.length} clip{audioFiles.length !== 1 ? 's' : ''} found
            </div>
            <div className="grid gap-4">
              {audioFiles.map((file, index) => (
                <div
                  key={file.filename}
                  className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition-all"
                >
                  <div className="flex items-center gap-4">
                    {/* Play button */}
                    <button
                      onClick={() => playAudio(index)}
                      className={`text-4xl transition-transform hover:scale-110 ${
                        playingIndex === index ? 'animate-pulse' : ''
                      }`}
                    >
                      {playingIndex === index ? '⏸️' : '▶️'}
                    </button>

                    {/* Audio player (hidden) */}
                    <audio
                      ref={(el) => {
                        audioRefs.current[index] = el;
                      }}
                      src={file.url}
                      onEnded={() => setPlayingIndex(null)}
                      onPause={() => {
                        if (playingIndex === index) setPlayingIndex(null);
                      }}
                      onPlay={() => setPlayingIndex(index)}
                    />

                    {/* File info */}
                    <div className="flex-1">
                      <div className="font-mono text-sm mb-1">
                        {file.filename.replace('audio/', '')}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(file.uploadedAt).toLocaleString()} •{' '}
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>

                    {/* Vote indicator */}
                    <div className="text-3xl">
                      {file.status.vote === 'up' ? '👍' : '👎'}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadAudio(file)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                        title="Download"
                      >
                        ⬇️
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(file.url);
                          alert('URL copied!');
                        }}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
                        title="Copy URL"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => deleteVote(file)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                        title="Remove vote"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Waveform placeholder / visual player */}
                  {playingIndex === index && (
                    <div className="mt-4">
                      <audio
                        controls
                        src={file.url}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

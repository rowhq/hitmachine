'use client';

import { useState, useEffect, useRef } from 'react';

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

interface AudioReviewerProps {
  onComplete?: () => void;
}

export default function AudioReviewer({ onComplete }: AudioReviewerProps) {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stats, setStats] = useState({ upvoted: 0, downvoted: 0, total: 0 });

  const currentFile = audioFiles[currentIndex];

  // Load initial audio files
  useEffect(() => {
    loadMoreFiles();
  }, []);

  // Auto-play when current file changes
  useEffect(() => {
    if (currentFile && audioRef.current) {
      audioRef.current.src = currentFile.url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [currentFile]);

  // Fisher-Yates shuffle algorithm
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Get audio duration from URL
  const getAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });
      audio.addEventListener('error', () => {
        reject(new Error('Failed to load audio metadata'));
      });
      audio.src = url;
    });
  };

  const loadMoreFiles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '50',
        filter: 'unwatched',
      });
      if (cursor) {
        params.append('cursor', cursor);
      }

      const response = await fetch(`/api/audio-list?${params}`);
      const data = await response.json();

      // Filter files by duration (only keep files > 5 seconds)
      const filesWithDuration = await Promise.all(
        data.blobs.map(async (file: AudioFile) => {
          try {
            const duration = await getAudioDuration(file.url);
            return { file, duration };
          } catch (error) {
            console.warn(`Failed to get duration for ${file.filename}:`, error);
            return { file, duration: 0 };
          }
        })
      );

      const filteredFiles = filesWithDuration
        .filter(({ duration }) => duration > 5)
        .map(({ file }) => file);

      // Shuffle the filtered files before adding them
      const shuffledNewFiles = shuffleArray(filteredFiles);
      setAudioFiles(prev => [...prev, ...shuffledNewFiles]);
      setCursor(data.cursor);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Error loading audio files:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (vote: 'up' | 'down' | null, watched = true) => {
    if (!currentFile) return;

    try {
      await fetch('/api/audio-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: currentFile.filename,
          vote,
          watched,
        }),
      });

      // Update local state
      const newFiles = [...audioFiles];
      newFiles[currentIndex] = {
        ...currentFile,
        status: { watched, vote, timestamp: Date.now() },
      };
      setAudioFiles(newFiles);

      // Update stats
      if (vote === 'up') {
        setStats(prev => ({ ...prev, upvoted: prev.upvoted + 1 }));
      } else if (vote === 'down') {
        setStats(prev => ({ ...prev, downvoted: prev.downvoted + 1 }));
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleVote = async (vote: 'up' | 'down') => {
    await updateStatus(vote);
    moveToNext();
  };

  const handleSkip = async () => {
    await updateStatus(null, true);
    moveToNext();
  };

  const moveToNext = () => {
    if (currentIndex < audioFiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (hasMore) {
      loadMoreFiles();
      setCurrentIndex(currentIndex + 1);
    } else {
      // No more files
      onComplete?.();
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'u') {
      handleVote('up');
    } else if (e.key === 'ArrowDown' || e.key === 'd') {
      handleVote('down');
    } else if (e.key === 'ArrowRight' || e.key === 's') {
      handleSkip();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, audioFiles]);

  if (loading && audioFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <div className="text-2xl mb-4">Loading audio files...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <div className="text-3xl mb-4">🎉 All done!</div>
          <div className="text-xl mb-8">You've reviewed all available audio files</div>
          <div className="space-y-2">
            <div>Upvoted: {stats.upvoted}</div>
            <div>Downvoted: {stats.downvoted}</div>
          </div>
        </div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / audioFiles.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-4">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-800">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="fixed top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-sm space-y-1">
        <div className="flex gap-4">
          <span>👍 {stats.upvoted}</span>
          <span>👎 {stats.downvoted}</span>
        </div>
        <div className="text-gray-400">
          {currentIndex + 1} / {audioFiles.length}
        </div>
      </div>

      {/* Main content */}
      <div className="w-full max-w-2xl">
        {/* Audio player */}
        <div className="bg-gray-800 rounded-2xl p-8 mb-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">
              {isPlaying ? '🔊' : '🔇'}
            </div>
            <div className="text-sm text-gray-400 mb-2">
              {currentFile.filename.replace('audio/', '')}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(currentFile.uploadedAt).toLocaleString()}
            </div>
          </div>

          <audio
            ref={audioRef}
            onEnded={moveToNext}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            controls
            className="w-full"
          />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <button
            onClick={() => handleVote('down')}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-6 px-8 rounded-xl transition-all transform hover:scale-105 active:scale-95"
          >
            <div className="text-4xl mb-2">👎</div>
            <div className="text-sm">Downvote</div>
            <div className="text-xs text-gray-300">(↓ or D)</div>
          </button>

          <button
            onClick={handleSkip}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-6 px-8 rounded-xl transition-all transform hover:scale-105 active:scale-95"
          >
            <div className="text-4xl mb-2">⏭️</div>
            <div className="text-sm">Skip</div>
            <div className="text-xs text-gray-300">(→ or S)</div>
          </button>

          <button
            onClick={() => handleVote('up')}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-8 rounded-xl transition-all transform hover:scale-105 active:scale-95"
          >
            <div className="text-4xl mb-2">👍</div>
            <div className="text-sm">Upvote</div>
            <div className="text-xs text-gray-300">(↑ or U)</div>
          </button>
        </div>

        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all"
        >
          {isPlaying ? '⏸️ Pause' : '▶️ Play'} (Space)
        </button>

        {/* Help text */}
        <div className="text-center text-gray-500 text-sm mt-8">
          Use keyboard shortcuts for faster reviewing: ↑/U for upvote, ↓/D for downvote, →/S to skip, Space to play/pause
        </div>
      </div>
    </div>
  );
}

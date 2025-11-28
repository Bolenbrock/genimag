import React, { useState, useEffect } from 'react';
import { Play, Pause, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface AnimationPlayerProps {
  frames: string[]; // Array of base64 image strings
  fps?: number;
}

export const AnimationPlayer: React.FC<AnimationPlayerProps> = ({ frames, fps = 2 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Reset when frames change
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [frames]);

  useEffect(() => {
    let interval: number;
    if (isPlaying && frames.length > 1) {
      interval = window.setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % frames.length);
      }, 1000 / fps);
    }
    return () => clearInterval(interval);
  }, [isPlaying, frames, fps]);

  if (frames.length === 0) return null;

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % frames.length);
  };

  const handlePrev = () => {
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + frames.length) % frames.length);
  };

  const handleThumbnailClick = (index: number) => {
    setIsPlaying(false);
    setCurrentIndex(index);
  };

  return (
    <div className="flex flex-col items-center space-y-6 w-full">
      {/* Main Viewer */}
      <div className="relative w-full aspect-square md:aspect-video bg-black/50 rounded-xl overflow-hidden border border-gray-700 flex items-center justify-center group select-none">
        <img
          src={frames[currentIndex]}
          alt={`Frame ${currentIndex + 1}`}
          className="max-h-full max-w-full object-contain"
        />
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-mono text-white backdrop-blur-sm">
          Frame {currentIndex + 1} / {frames.length}
        </div>

        {/* Hover Navigation Arrows (Desktop) */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 pointer-events-auto transition-colors transform active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 pointer-events-auto transition-colors transform active:scale-95"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 bg-gray-800 p-2 rounded-lg border border-gray-700 shadow-lg">
        <button
          onClick={handlePrev}
          className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Previous Frame"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-3 rounded-full transition-all ${
            isPlaying 
            ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' 
            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20'
          }`}
          title={isPlaying ? "Pause" : "Play Animation"}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>
        
        <button
          onClick={handleNext}
          className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Next Frame"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1"></div>

        <button
          onClick={() => {
            setIsPlaying(false);
            setCurrentIndex(0);
          }}
          className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Reset"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Thumbnails Strip */}
      <div className="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <div className="flex gap-2 min-w-min px-1">
          {frames.map((frame, idx) => (
            <button 
              key={idx}
              onClick={() => handleThumbnailClick(idx)}
              className={`
                relative flex-shrink-0 w-20 sm:w-24 aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200
                ${idx === currentIndex 
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 scale-105 z-10 opacity-100' 
                  : 'border-gray-700 hover:border-gray-500 opacity-60 hover:opacity-100'
                }
              `}
            >
              <img 
                src={frame} 
                alt={`Thumb ${idx}`} 
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-center text-white py-0.5 font-medium">
                {idx === 0 ? "ORIGINAL" : `FRAME ${idx}`}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
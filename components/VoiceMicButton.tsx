'use client';

import { Mic, MicOff } from 'lucide-react';

interface VoiceMicButtonProps {
  isActive: boolean;
  onClick: () => void;
}

/**
 * Microphone toggle button for voice chat
 */
export function VoiceMicButton({ isActive, onClick }: VoiceMicButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-16 h-16 rounded-full flex items-center justify-center
        transition-all duration-200 shadow-lg
        ${isActive
          ? 'bg-green-500 hover:bg-green-600 text-white'
          : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
        }
      `}
      aria-label={isActive ? 'Mute microphone' : 'Unmute microphone'}
    >
      {isActive ? (
        <Mic className="w-8 h-8" />
      ) : (
        <MicOff className="w-8 h-8" />
      )}
    </button>
  );
}

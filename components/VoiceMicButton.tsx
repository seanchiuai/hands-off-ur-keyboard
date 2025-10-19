'use client';

import { useCallback, useEffect, useState } from 'react';
import { DailyProvider, useDaily, useLocalParticipant, useParticipantIds } from '@daily-co/daily-react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

/**
 * Inner component that uses Daily hooks
 */
function VoiceMicButtonInner() {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const participantIds = useParticipantIds();

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<Id<'voiceSessions'> | null>(null);

  const createSessionMutation = useMutation(api.voiceSessions.createSession);
  const endSessionMutation = useMutation(api.voiceSessions.endSession);

  const isJoined = daily?.meetingState() === 'joined-meeting';
  const isMicActive = !!localParticipant?.audioTrack;
  const isAgentConnected = participantIds.length > 1;

  /**
   * Start voice session
   */
  const startVoice = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create Daily room via API
      const response = await fetch('/api/daily-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create voice chat room');
      }

      const { roomUrl, token, roomName } = await response.json();

      // Create session record in Convex
      const result = await createSessionMutation({
        roomUrl,
        roomName,
      });

      setCurrentSessionId(result.sessionId);

      // Join Daily room
      if (daily) {
        await daily.join({
          url: roomUrl,
          token,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start voice session';
      setError(errorMessage);
      console.error('Voice session error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [daily, createSessionMutation]);

  /**
   * End voice session
   */
  const endVoice = useCallback(async () => {
    try {
      // Leave Daily room
      if (daily) {
        await daily.leave();
      }

      // End session in Convex
      if (currentSessionId) {
        await endSessionMutation({ sessionId: currentSessionId });
        setCurrentSessionId(null);
      }
    } catch (err) {
      console.error('Failed to end voice session:', err);
    }
  }, [daily, endSessionMutation, currentSessionId]);

  /**
   * Toggle microphone
   */
  const toggleMic = useCallback(async () => {
    if (!daily) return;

    try {
      await daily.setLocalAudio(!isMicActive);
    } catch (err) {
      console.error('Error toggling microphone:', err);
    }
  }, [daily, isMicActive]);

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      if (daily && isJoined && currentSessionId) {
        daily.leave().catch(console.error);
        endSessionMutation({ sessionId: currentSessionId }).catch(console.error);
      }
    };
  }, [daily, isJoined, currentSessionId, endSessionMutation]);

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Main Microphone Button */}
      {!isJoined ? (
        <button
          onClick={startVoice}
          disabled={isConnecting}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-200 shadow-lg
            ${isConnecting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-br from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700'
            }
            text-white
          `}
          aria-label="Start voice chat"
        >
          {isConnecting ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </button>
      ) : (
        <>
          {/* Status Indicators */}
          <div className="flex items-center space-x-3 text-sm">
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isMicActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
              <span className="text-gray-700 dark:text-gray-300">
                {isMicActive ? 'Mic On' : 'Mic Off'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isAgentConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
              <span className="text-gray-700 dark:text-gray-300">
                {isAgentConnected ? 'Agent Ready' : 'Connecting...'}
              </span>
            </div>
          </div>

          {/* Active Mic Button */}
          <button
            onClick={toggleMic}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center
              transition-all duration-200 shadow-lg
              ${isMicActive
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-red-500 hover:bg-red-600'
              }
              text-white
            `}
            aria-label={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isMicActive ? (
              <Mic className="w-10 h-10" />
            ) : (
              <MicOff className="w-10 h-10" />
            )}
          </button>

          {/* End Chat Button */}
          <button
            onClick={endVoice}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            End Chat
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Microphone button for voice chat with integrated Daily.co functionality
 * This is a standalone component that manages its own voice session
 */
export default function VoiceMicButton() {
  return (
    <DailyProvider>
      <VoiceMicButtonInner />
    </DailyProvider>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDaily, useLocalParticipant, useParticipantIds } from '@daily-co/daily-react';

export interface DailyCallState {
  isJoined: boolean;
  isConnecting: boolean;
  error: string | null;
  participants: string[];
  isAgentConnected: boolean;
  isMicActive: boolean;
}

export function useDailyCall() {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const participantIds = useParticipantIds();

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if agent is in the room (more than just local user)
  const isAgentConnected = participantIds.length > 1;
  const isJoined = daily?.meetingState() === 'joined-meeting';
  const isMicActive = !!localParticipant?.audioTrack;

  /**
   * Join a Daily room
   */
  const joinCall = useCallback(
    async (roomUrl: string, token: string) => {
      if (!daily) {
        throw new Error('Daily client not initialized');
      }

      setIsConnecting(true);
      setError(null);

      try {
        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Join the room
        await daily.join({
          url: roomUrl,
          token,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to join call';
        setError(errorMessage);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [daily]
  );

  /**
   * Leave the Daily room
   */
  const leaveCall = useCallback(async () => {
    if (!daily) {
      return;
    }

    try {
      await daily.leave();
    } catch (err) {
      console.error('Error leaving call:', err);
    }
  }, [daily]);

  /**
   * Toggle microphone
   */
  const toggleMic = useCallback(async () => {
    if (!daily) {
      return;
    }

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
      if (daily && isJoined) {
        daily.leave().catch(console.error);
      }
    };
  }, [daily, isJoined]);

  return {
    joinCall,
    leaveCall,
    toggleMic,
    state: {
      isJoined,
      isConnecting,
      error,
      participants: participantIds,
      isAgentConnected,
      isMicActive,
    },
  };
}

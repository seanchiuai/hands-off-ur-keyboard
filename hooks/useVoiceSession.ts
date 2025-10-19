'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export interface VoiceSession {
  sessionId: Id<'voiceSessions'>;
  roomUrl: string;
  roomName: string;
  token?: string;
}

export function useVoiceSession() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSessionMutation = useMutation(api.voiceSessions.createSession);
  const endSessionMutation = useMutation(api.voiceSessions.endSession);
  const markErrorMutation = useMutation(api.voiceSessions.markSessionError);

  const activeSession = useQuery(api.voiceSessions.getActiveSession);
  const sessionHistory = useQuery(api.voiceSessions.getSessionHistory, { limit: 10 });

  /**
   * Start a new voice session
   * Creates a Daily room and session record in Convex
   */
  const startSession = useCallback(async (): Promise<VoiceSession | null> => {
    setIsCreating(true);
    setError(null);

    try {
      // Call Next.js API to create Daily room
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

      return {
        sessionId: result.sessionId,
        roomUrl: result.roomUrl,
        roomName: result.roomName,
        token,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start voice session';
      setError(errorMessage);
      console.error('Voice session error:', err);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [createSessionMutation]);

  /**
   * End the current voice session
   */
  const endSession = useCallback(
    async (sessionId: Id<'voiceSessions'>) => {
      try {
        await endSessionMutation({ sessionId });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to end voice session';
        setError(errorMessage);
        console.error('End session error:', err);
      }
    },
    [endSessionMutation]
  );

  /**
   * Mark session as error state
   */
  const markSessionError = useCallback(
    async (sessionId: Id<'voiceSessions'>, errorMessage: string) => {
      try {
        await markErrorMutation({ sessionId, errorMessage });
      } catch (err) {
        console.error('Mark session error:', err);
      }
    },
    [markErrorMutation]
  );

  return {
    startSession,
    endSession,
    markSessionError,
    activeSession,
    sessionHistory,
    isCreating,
    error,
  };
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { DailyProvider } from '@daily-co/daily-react';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import { useDailyCall } from '@/hooks/useDailyCall';
import { VoiceMicButton } from './VoiceMicButton';
import { VoiceTranscriptPanel } from './VoiceTranscriptPanel';
import { Id } from '@/convex/_generated/dataModel';

function VoiceChatInner() {
  const { startSession, endSession, isCreating, error: sessionError } = useVoiceSession();
  const { joinCall, leaveCall, toggleMic, state } = useDailyCall();
  const [currentSessionId, setCurrentSessionId] = useState<Id<'voiceSessions'> | null>(null);

  /**
   * Start voice chat session
   */
  const handleStartVoiceChat = useCallback(async () => {
    try {
      // Create session and get room credentials
      const session = await startSession();
      if (!session) {
        throw new Error('Failed to create session');
      }

      setCurrentSessionId(session.sessionId);

      // Join Daily room
      await joinCall(session.roomUrl, session.token || '');
    } catch (err) {
      console.error('Failed to start voice chat:', err);
    }
  }, [startSession, joinCall]);

  /**
   * End voice chat session
   */
  const handleEndVoiceChat = useCallback(async () => {
    try {
      // Leave Daily room
      await leaveCall();

      // End session in Convex
      if (currentSessionId) {
        await endSession(currentSessionId);
        setCurrentSessionId(null);
      }
    } catch (err) {
      console.error('Failed to end voice chat:', err);
    }
  }, [leaveCall, endSession, currentSessionId]);

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      if (state.isJoined && currentSessionId) {
        leaveCall();
        endSession(currentSessionId);
      }
    };
  }, [state.isJoined, currentSessionId, leaveCall, endSession]);

  return (
    <div className="voice-chat-container max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Voice Shopping Assistant
        </h2>

        {/* Error Display */}
        {(sessionError || state.error) && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">
              {sessionError || state.error}
            </p>
          </div>
        )}

        {/* Voice Control */}
        <div className="flex flex-col items-center space-y-4 mb-6">
          {!state.isJoined ? (
            <button
              onClick={handleStartVoiceChat}
              disabled={isCreating || state.isConnecting}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating || state.isConnecting ? 'Connecting...' : 'Start Voice Chat'}
            </button>
          ) : (
            <>
              {/* Status Indicators */}
              <div className="flex space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${state.isMicActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {state.isMicActive ? 'Microphone Active' : 'Microphone Off'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${state.isAgentConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {state.isAgentConnected ? 'Agent Connected' : 'Waiting for agent...'}
                  </span>
                </div>
              </div>

              {/* Microphone Button */}
              <VoiceMicButton
                isActive={state.isMicActive}
                onClick={toggleMic}
              />

              {/* End Chat Button */}
              <button
                onClick={handleEndVoiceChat}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                End Chat
              </button>
            </>
          )}
        </div>

        {/* Transcript Panel */}
        {currentSessionId && state.isJoined && (
          <VoiceTranscriptPanel sessionId={currentSessionId} />
        )}

        {/* Instructions */}
        {!state.isJoined && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              How to use Voice Shopping
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>1. Click &quot;Start Voice Chat&quot; to begin</li>
              <li>2. Allow microphone access when prompted</li>
              <li>3. Describe the product you&apos;re looking for</li>
              <li>4. The AI assistant will help you find and save products</li>
              <li>5. Click &quot;End Chat&quot; when you&apos;re done</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main VoiceChat component with DailyProvider wrapper
 */
export function VoiceChat() {
  return (
    <DailyProvider>
      <VoiceChatInner />
    </DailyProvider>
  );
}

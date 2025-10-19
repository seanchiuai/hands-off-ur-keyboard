'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { User, Bot, MessageSquare } from 'lucide-react';
import { PreferenceExtractor } from './PreferenceExtractor';

/**
 * Live transcript display for voice conversations
 * Automatically displays transcripts from the active voice session
 * Includes automatic preference extraction from user speech
 */
export default function VoiceTranscriptPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get active session
  const activeSession = useQuery(api.voiceSessions.getActiveSession);

  // Get transcripts for active session
  const transcripts = useQuery(
    api.voiceTranscripts.getSessionTranscripts,
    activeSession ? { sessionId: activeSession._id } : "skip"
  );

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Empty state when no active session
  if (!activeSession) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <MessageSquare className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Conversation
          </h3>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Start a voice chat to see the conversation here
          </p>
        </div>
      </div>
    );
  }

  // Waiting for transcripts
  if (!transcripts || transcripts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <MessageSquare className="w-5 h-5 text-purple-500 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Conversation
          </h3>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <MessageSquare className="w-8 h-8 text-purple-500 dark:text-purple-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Waiting for conversation to start...
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Speak into your microphone
          </p>
        </div>
      </div>
    );
  }

  // Active conversation with transcripts
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      {/* Background preference extractor */}
      <PreferenceExtractor sessionId={activeSession._id} />

      <div className="flex items-center space-x-2 mb-4">
        <MessageSquare className="w-5 h-5 text-purple-500 dark:text-purple-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Conversation
        </h3>
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          {transcripts.length} {transcripts.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 max-h-[500px] overflow-y-auto space-y-4"
      >
        {transcripts.map((transcript) => (
          <div
            key={transcript._id}
            className="flex items-start space-x-3"
          >
            {/* Speaker Icon */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                transcript.speaker === 'user'
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                  : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
              }`}
            >
              {transcript.speaker === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Message Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline space-x-2 mb-1">
                <span
                  className={`text-sm font-medium ${
                    transcript.speaker === 'user'
                      ? 'text-blue-900 dark:text-blue-200'
                      : 'text-purple-900 dark:text-purple-200'
                  }`}
                >
                  {transcript.speaker === 'user' ? 'You' : 'AI'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(transcript.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 break-words leading-relaxed">
                {transcript.text}
              </p>
              {transcript.confidence && (
                <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 inline-block">
                  {(transcript.confidence * 100).toFixed(0)}% confident
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

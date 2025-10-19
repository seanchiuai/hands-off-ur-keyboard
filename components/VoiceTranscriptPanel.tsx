'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { User, Bot } from 'lucide-react';

interface VoiceTranscriptPanelProps {
  sessionId: Id<'voiceSessions'>;
}

/**
 * Live transcript display for voice conversations
 */
export function VoiceTranscriptPanel({ sessionId }: VoiceTranscriptPanelProps) {
  const transcripts = useQuery(api.voiceTranscripts.getSessionTranscripts, { sessionId });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  if (!transcripts || transcripts.length === 0) {
    return (
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Waiting for conversation to start...
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
        Conversation Transcript
      </h3>
      <div
        ref={scrollRef}
        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto space-y-3"
      >
        {transcripts.map((transcript) => (
          <div
            key={transcript._id}
            className={`flex items-start space-x-3 ${
              transcript.speaker === 'user' ? 'justify-start' : 'justify-start'
            }`}
          >
            {/* Speaker Icon */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                transcript.speaker === 'user'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                  : 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
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
                  {transcript.speaker === 'user' ? 'You' : 'AI Assistant'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(transcript.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 break-words">
                {transcript.text}
              </p>
              {transcript.confidence && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Confidence: {(transcript.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

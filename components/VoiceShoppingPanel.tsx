"use client";

import { Id } from "@/convex/_generated/dataModel";
import VoiceTranscriptPanel from "./VoiceTranscriptPanel";
import { PreferenceExtractor } from "./PreferenceExtractor";
import PreferenceList from "./PreferenceList";

interface VoiceShoppingPanelProps {
  sessionId: Id<"voiceSessions">;
}

/**
 * Integrated voice shopping panel that combines:
 * - Live transcript display
 * - Automatic preference extraction
 * - Preference tag display
 *
 * This is the main component for the voice shopping experience
 */
export function VoiceShoppingPanel({ sessionId }: VoiceShoppingPanelProps) {
  return (
    <div className="space-y-4">
      {/* Background preference extractor */}
      <PreferenceExtractor sessionId={sessionId} />

      {/* Preference display */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <PreferenceList />
      </div>

      {/* Transcript panel */}
      <VoiceTranscriptPanel />
    </div>
  );
}

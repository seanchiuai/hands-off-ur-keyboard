"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { usePreferences } from "@/hooks/usePreferences";

interface PreferenceExtractorProps {
  sessionId: Id<"voiceSessions">;
}

/**
 * Background component that monitors voice transcripts and automatically
 * extracts user preferences without blocking the UI.
 *
 * This component:
 * - Watches for new user transcripts in real-time
 * - Extracts preferences using Gemini API
 * - Saves preferences to database
 * - Shows subtle toast notifications
 */
export function PreferenceExtractor({ sessionId }: PreferenceExtractorProps) {
  const transcripts = useQuery(api.voiceTranscripts.getSessionTranscripts, {
    sessionId,
  });
  const { extractFromVoice, addPreferences } = usePreferences();
  const processedTranscriptsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!transcripts || transcripts.length === 0) return;

    // Only process new user transcripts (not agent responses)
    const userTranscripts = transcripts.filter(
      (t) => t.speaker === "user" && !processedTranscriptsRef.current.has(t._id)
    );

    if (userTranscripts.length === 0) return;

    // Process transcripts asynchronously
    const processTranscripts = async () => {
      for (const transcript of userTranscripts) {
        // Mark as processed immediately to avoid duplicates
        processedTranscriptsRef.current.add(transcript._id);

        // Skip very short transcripts (likely not containing preferences)
        if (transcript.text.length < 10) continue;

        try {
          // Build conversation history for context
          const conversationHistory = transcripts
            .slice(0, -1) // Exclude current transcript
            .slice(-5) // Last 5 messages for context
            .map((t) => `${t.speaker}: ${t.text}`)
            .join("\n");

          // Extract preferences from voice
          const extractedPrefs = await extractFromVoice(
            transcript.text,
            conversationHistory
          );

          // Only save if we found preferences
          if (extractedPrefs.length > 0) {
            await addPreferences(extractedPrefs, transcript.text);
          }
        } catch (error) {
          console.error("Error processing transcript for preferences:", error);
          // Don't show error to user - this is background processing
        }
      }
    };

    processTranscripts();
  }, [transcripts, extractFromVoice, addPreferences]);

  // This component doesn't render anything
  return null;
}

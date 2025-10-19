"use client";

import { useState, useCallback, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";

interface VoiceSearchState {
  isSearching: boolean;
  searchId: Id<"productSearches"> | null;
  error: string | null;
  lastTranscript: string | null;
}

/**
 * Hook for triggering product searches from voice transcripts
 * Monitors voice transcripts and automatically triggers searches when search intent is detected
 */
export function useVoiceTriggeredSearch(sessionId?: Id<"voiceSessions">) {
  const { user } = useUser();
  const [state, setState] = useState<VoiceSearchState>({
    isSearching: false,
    searchId: null,
    error: null,
    lastTranscript: null,
  });

  // Actions
  const triggerSearch = useAction(api.voiceSearch.triggerSearchFromVoice);
  const detectIntent = useAction(api.voiceSearch.detectSearchIntent);

  // Queries
  const activeSearch = useQuery(
    api.voiceSearch.getActiveSearch,
    user && sessionId
      ? { userId: user.id, sessionId }
      : "skip"
  );

  const searchProducts = useQuery(
    api.voiceSearch.getActiveSearchProducts,
    user && sessionId
      ? { userId: user.id, sessionId }
      : "skip"
  );

  /**
   * Trigger a search from a voice transcript
   */
  const performSearch = useCallback(
    async (transcript: string) => {
      if (!user || !sessionId) {
        setState((prev) => ({
          ...prev,
          error: "User or session not available",
        }));
        return;
      }

      // Skip if already searching
      if (state.isSearching) {
        console.log("Search already in progress, skipping");
        return;
      }

      // Skip if transcript is empty or too short
      if (!transcript || transcript.trim().length < 3) {
        return;
      }

      // Skip if this is the same transcript we just processed
      if (transcript === state.lastTranscript) {
        return;
      }

      try {
        setState((prev) => ({
          ...prev,
          isSearching: true,
          error: null,
          lastTranscript: transcript,
        }));

        // Check if transcript has search intent
        const hasIntent = await detectIntent({ transcript });

        if (!hasIntent) {
          console.log("No search intent detected in transcript");
          setState((prev) => ({
            ...prev,
            isSearching: false,
          }));
          return;
        }

        // Trigger the search
        const result = await triggerSearch({
          userId: user.id,
          sessionId,
          transcript,
        });

        setState((prev) => ({
          ...prev,
          isSearching: false,
          searchId: result.searchId,
        }));
      } catch (error) {
        console.error("Error performing voice search:", error);
        setState((prev) => ({
          ...prev,
          isSearching: false,
          error: error instanceof Error ? error.message : "Search failed",
        }));
      }
    },
    [user, sessionId, state.isSearching, state.lastTranscript, triggerSearch, detectIntent]
  );

  /**
   * Clear the current search error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Reset search state
   */
  const resetSearch = useCallback(() => {
    setState({
      isSearching: false,
      searchId: null,
      error: null,
      lastTranscript: null,
    });
  }, []);

  return {
    // State
    isSearching: state.isSearching,
    searchId: state.searchId || activeSearch?._id || null,
    error: state.error,
    lastTranscript: state.lastTranscript,

    // Data
    activeSearch,
    searchProducts,
    productCount: searchProducts?.length || 0,

    // Actions
    performSearch,
    clearError,
    resetSearch,
  };
}

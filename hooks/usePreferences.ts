"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

interface ExtractedPreference {
  category: string;
  tag: string;
  value?: string | number;
  priority: number;
  productContext?: string;
}

export function usePreferences() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Query preferences
  const preferencesData = useQuery(api.userPreferences.getUserPreferences, {});
  const preferencesByCategory = useQuery(
    api.userPreferences.getPreferencesByCategory,
    {}
  );

  // Mutations
  const savePreferencesMutation = useMutation(
    api.userPreferences.savePreferences
  );
  const deletePreferenceMutation = useMutation(
    api.userPreferences.deletePreference
  );
  const incrementUseCountMutation = useMutation(
    api.userPreferences.incrementUseCount
  );
  const cleanupExpiredMutation = useMutation(
    api.userPreferences.cleanupExpiredPreferences
  );

  // Extract preferences from voice transcript
  const extractFromVoice = useCallback(
    async (
      transcript: string,
      conversationHistory?: string
    ): Promise<ExtractedPreference[]> => {
      setIsExtracting(true);
      setExtractionError(null);

      try {
        const response = await fetch("/api/extract-preferences", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcript,
            conversationHistory,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to extract preferences");
        }

        const data = await response.json();
        return data.preferences;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Extraction failed";
        setExtractionError(message);
        console.error("Preference extraction error:", error);
        return [];
      } finally {
        setIsExtracting(false);
      }
    },
    []
  );

  // Add preferences from extracted data
  const addPreferences = useCallback(
    async (preferences: ExtractedPreference[], extractedFrom: string) => {
      try {
        const prefsWithSource = preferences.map((pref) => ({
          ...pref,
          extractedFrom,
        }));

        const result = await savePreferencesMutation({
          preferences: prefsWithSource,
        });

        if (result.success && result.preferenceIds.length > 0) {
          toast.success(
            `Saved ${result.preferenceIds.length} preference${
              result.preferenceIds.length > 1 ? "s" : ""
            }`
          );
        }

        return result;
      } catch (error) {
        console.error("Error adding preferences:", error);
        toast.error("Failed to save preferences");
        throw error;
      }
    },
    [savePreferencesMutation]
  );

  // Remove a single preference
  const removePreference = useCallback(
    async (preferenceId: Id<"userPreferences">) => {
      try {
        await deletePreferenceMutation({ preferenceId });
        toast.success("Preference removed");
      } catch (error) {
        console.error("Error removing preference:", error);
        toast.error("Failed to remove preference");
        throw error;
      }
    },
    [deletePreferenceMutation]
  );

  // Track preference usage in a search
  const trackPreferenceUsage = useCallback(
    async (preferenceId: Id<"userPreferences">, searchId: string) => {
      try {
        await incrementUseCountMutation({ preferenceId, searchId });
      } catch (error) {
        console.error("Error tracking preference usage:", error);
        // Don't show error to user - this is background tracking
      }
    },
    [incrementUseCountMutation]
  );

  // Clean up expired preferences
  const cleanupExpired = useCallback(async () => {
    try {
      const result = await cleanupExpiredMutation({});
      if (result.deletedCount > 0) {
        toast.success(`Removed ${result.deletedCount} expired preferences`);
      }
      return result;
    } catch (error) {
      console.error("Error cleaning up preferences:", error);
      toast.error("Failed to clean up expired preferences");
      throw error;
    }
  }, [cleanupExpiredMutation]);

  return {
    // Data
    preferences: preferencesData?.preferences || [],
    grouped: preferencesData?.grouped || {},
    preferencesByCategory: preferencesByCategory || {},

    // States
    isExtracting,
    extractionError,

    // Actions
    extractFromVoice,
    addPreferences,
    removePreference,
    trackPreferenceUsage,
    cleanupExpired,
  };
}

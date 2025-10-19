"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useCallback } from "react";
import { toast } from "sonner";

interface RefinementIntent {
  isRefinement: boolean;
  refinement?: {
    type: string;
    value: string;
    targetPercentage?: number;
    extractedPreferences: string[];
  };
  message?: string;
}

interface SearchContext {
  searchId?: string;
  currentQuery?: string;
  currentFilters?: Record<string, unknown>;
  currentProducts?: unknown[];
}

export function useSearchRefinement() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [pendingRefinement, setPendingRefinement] =
    useState<RefinementIntent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mutations
  const recordRefinementMutation = useMutation(
    api.searchRefinements.recordRefinement
  );

  // Queries
  const getRefinementHistory = useCallback(
    (searchId: string) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useQuery(api.searchRefinements.getRefinementHistory, {
        searchId,
      });
    },
    []
  );

  // Detect refinement intent from voice command
  const detectRefinementIntent = useCallback(
    async (
      voiceCommand: string,
      currentSearchContext?: SearchContext
    ): Promise<RefinementIntent> => {
      setIsAnalyzing(true);
      setError(null);

      try {
        const response = await fetch("/api/analyze-refinement", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            voiceCommand,
            currentSearchContext,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to analyze refinement");
        }

        const result: RefinementIntent = await response.json();
        setPendingRefinement(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Analysis failed";
        setError(message);
        console.error("Refinement analysis error:", err);
        return { isRefinement: false, message: "Analysis failed" };
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  // Execute a refinement search
  const refineSearch = useCallback(
    async (
      originalSearchId: string,
      voiceCommand: string,
      refinementIntent: RefinementIntent["refinement"],
      newSearchId: string,
      resultCount?: number
    ) => {
      if (!refinementIntent) {
        throw new Error("No refinement intent provided");
      }

      setIsRefining(true);
      setError(null);

      try {
        const result = await recordRefinementMutation({
          originalSearchId,
          refinementType: refinementIntent.type as
            | "cheaper"
            | "price_lower"
            | "price_higher"
            | "feature"
            | "add_feature"
            | "remove_feature"
            | "price_range"
            | "change_size"
            | "custom",
          voiceCommand,
          extractedPreferences: refinementIntent.extractedPreferences,
          refinementValue: refinementIntent.value,
          targetPercentage: refinementIntent.targetPercentage,
          newSearchId,
          resultCount,
        });

        toast.success("Search refined successfully");
        setPendingRefinement(null);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Refinement failed";
        setError(message);
        console.error("Refinement execution error:", err);
        toast.error(message);
        throw err;
      } finally {
        setIsRefining(false);
      }
    },
    [recordRefinementMutation]
  );

  // Clear pending refinement
  const clearPendingRefinement = useCallback(() => {
    setPendingRefinement(null);
  }, []);

  return {
    // States
    isAnalyzing,
    isRefining,
    pendingRefinement,
    error,

    // Actions
    detectRefinementIntent,
    refineSearch,
    clearPendingRefinement,
    getRefinementHistory,
  };
}

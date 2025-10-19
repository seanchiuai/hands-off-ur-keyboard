"use client";

import { useState, useCallback } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";

interface SearchState {
  searchId: Id<"productSearches"> | null;
  status: "idle" | "extracting" | "searching" | "completed" | "error";
  error: string | null;
}

export function useProductSearch() {
  const { user } = useUser();
  const [searchState, setSearchState] = useState<SearchState>({
    searchId: null,
    status: "idle",
    error: null,
  });

  // Mutations and actions
  const createSearch = useMutation(api.productSearch.createSearch);
  const extractParams = useAction(api.productSearch.extractSearchParams);
  const searchProducts = useAction(api.brightdata.searchProducts);

  // Query current search
  const currentSearch = useQuery(
    api.productSearch.getSearch,
    searchState.searchId ? { searchId: searchState.searchId } : "skip"
  );

  // Query search results
  const searchResults = useQuery(
    api.searchProducts.getSearchResults,
    searchState.searchId ? { searchId: searchState.searchId } : "skip"
  );

  // Main search function
  const performSearch = useCallback(
    async (voiceTranscript: string, sessionId?: Id<"voiceSessions">) => {
      if (!user) {
        setSearchState({
          searchId: null,
          status: "error",
          error: "User not authenticated",
        });
        return null;
      }

      try {
        setSearchState({
          searchId: null,
          status: "extracting",
          error: null,
        });

        // Step 1: Create search
        const searchId = await createSearch({
          userId: user.id,
          sessionId,
          query: voiceTranscript,
        });

        setSearchState((prev) => ({
          ...prev,
          searchId,
        }));

        // Step 2: Extract parameters using Gemini
        const parameters = await extractParams({
          searchId,
          voiceTranscript,
          userId: user.id,
        });

        setSearchState((prev) => ({
          ...prev,
          status: "searching",
        }));

        // Step 3: Search products using BrightData
        const result = await searchProducts({
          searchId,
          userId: user.id,
          parameters,
        });

        setSearchState((prev) => ({
          ...prev,
          status: "completed",
        }));

        return searchId;
      } catch (error) {
        console.error("Search error:", error);
        setSearchState((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Search failed",
        }));
        return null;
      }
    },
    [user, createSearch, extractParams, searchProducts]
  );

  // Reset search state
  const resetSearch = useCallback(() => {
    setSearchState({
      searchId: null,
      status: "idle",
      error: null,
    });
  }, []);

  return {
    // State
    searchId: searchState.searchId,
    status: searchState.status,
    error: searchState.error,
    isSearching: searchState.status === "extracting" || searchState.status === "searching",

    // Data
    currentSearch,
    searchResults,

    // Actions
    performSearch,
    resetSearch,
  };
}

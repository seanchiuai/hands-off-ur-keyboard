"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useProductSearch } from "@/hooks/useProductSearch";
import SearchProductGrid from "@/components/SearchProductGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Mic, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function SearchPage() {
  const { user, isLoaded } = useUser();
  const [query, setQuery] = useState("");
  const {
    searchId,
    status,
    error,
    isSearching,
    currentSearch,
    searchResults,
    performSearch,
    resetSearch,
  } = useProductSearch();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    const searchId = await performSearch(query);

    if (searchId) {
      toast.success("Search completed!");
    } else if (error) {
      toast.error(error);
    }
  };

  const handleNewSearch = () => {
    resetSearch();
    setQuery("");
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to use the product search feature.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Product Search</h1>
          <p className="text-muted-foreground">
            Search for products using natural language. Tell us what you're looking for!
          </p>
        </div>

        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>What are you looking for?</CardTitle>
            <CardDescription>
              Try something like "wooden desk under $200" or "wireless headphones with noise cancellation"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="e.g., wooden desk under $200"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isSearching}
                    className="pl-10"
                  />
                </div>
                <Button type="submit" disabled={isSearching || !query.trim()}>
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>

              {/* Voice input hint */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mic className="w-4 h-4" />
                <span>
                  Tip: This feature works great with voice commands too!
                </span>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Status Indicator */}
        {status !== "idle" && (
          <div className="mb-6">
            {status === "extracting" && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        Understanding your request...
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        AI is analyzing your search query
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {status === "searching" && (
              <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                    <div>
                      <p className="font-medium text-purple-900 dark:text-purple-100">
                        Searching products...
                      </p>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        Finding the best matches for you
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {status === "completed" && searchResults && (
              <Card className="border-green-200 bg-green-50 dark:bg-green-950">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Found {searchResults.length} products
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Results are numbered for easy voice reference
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleNewSearch} variant="outline" size="sm">
                      New Search
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {status === "error" && error && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-950">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-900 dark:text-red-100">
                        Search failed
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {error}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Search Results */}
        {searchId && status === "completed" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Search Results</h2>
              {currentSearch && (
                <Badge variant="secondary">
                  Query: {currentSearch.query}
                </Badge>
              )}
            </div>
            <SearchProductGrid searchId={searchId} />
          </div>
        )}

        {/* Empty State */}
        {status === "idle" && (
          <Card className="py-12">
            <CardContent className="text-center">
              <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">
                Start Your Product Search
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Enter a search query above to find products. Our AI will understand your requirements and find the best matches.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

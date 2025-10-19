"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import ProductGrid from "@/components/ProductGrid";

export default function ShopPage() {
  const { isLoaded, isSignedIn } = useUser();
  const activeSession = useQuery(api.sessions.getActiveSession);
  const createSession = useMutation(api.sessions.createSession);

  // Auto-create session if none exists
  useEffect(() => {
    if (isLoaded && isSignedIn && activeSession === null) {
      createSession();
    }
  }, [isLoaded, isSignedIn, activeSession, createSession]);

  if (!isLoaded) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Please sign in to start shopping</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Voice Shopping</h1>
          <p className="mt-2 text-gray-600">Speak to find products</p>
        </header>

        {/* Voice interface component will be added here when voice feature is implemented */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-center">
            Voice interface coming soon. Products will appear below as they are discovered.
          </p>
        </div>

        {/* Product grid with real-time updates */}
        {activeSession && <ProductGrid sessionId={activeSession._id} />}
      </div>
    </div>
  );
}

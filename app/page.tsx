"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { SignUpButton, SignInButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import VoiceMicButton from "@/components/VoiceMicButton";
import ProductGrid from "@/components/ProductGrid";
import PreferenceList from "@/components/PreferenceList";
import VoiceTranscriptPanel from "@/components/VoiceTranscriptPanel";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Package } from "lucide-react";

export default function Home() {
  return (
    <>
      <Authenticated>
        <VoiceShoppingDashboard />
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </>
  );
}

function VoiceShoppingDashboard() {
  const { user } = useUser();
  const activeSession = useQuery(api.sessions.getActiveSession);
  const preferences = useQuery(api.userPreferences.getUserPreferences,
    user ? { userId: user.id } : "skip"
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-mona-bold text-gray-900 dark:text-gray-100">
                Hands Off Ur Keyboard
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Voice-powered shopping
              </p>
            </div>
            <Link href="/saved">
              <Button variant="outline" className="gap-2">
                <Package className="w-4 h-4" />
                Saved Products
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Column - Voice & Products */}
          <div className="lg:col-span-3 space-y-6">
            {/* Preference Tags */}
            {preferences && preferences.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Your Preferences
                </h2>
                <PreferenceList />
              </div>
            )}

            {/* Voice Microphone Button */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-xl border border-purple-200 dark:border-purple-800 p-8">
              <div className="text-center space-y-4">
                <VoiceMicButton />
                <div className="max-w-md mx-auto">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Click the microphone and describe what you're looking for
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Try: "Find wireless headphones under $100" or "wooden desk at least 3 feet"
                  </p>
                </div>
              </div>
            </div>

            {/* Product Grid */}
            {activeSession && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Products
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Say "save product 3" to save items
                  </p>
                </div>
                <ProductGrid sessionId={activeSession._id} />
              </div>
            )}

            {/* Empty State */}
            {!activeSession && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
                <div className="text-center max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Start Voice Shopping
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Click the microphone above and tell me what you're looking for. Products will appear here as I find them.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Transcript */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <VoiceTranscriptPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-gray-50 dark:from-gray-900 dark:via-purple-950/20 dark:to-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center space-y-8">
          {/* Logo/Title */}
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h1 className="text-5xl font-mona-bold text-gray-900 dark:text-gray-100">
              Hands Off Ur Keyboard
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Shop completely hands-free with voice. Just speak, and products appear.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 mx-auto bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Voice-Only
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No typing required. Just speak naturally to search and save products.
              </p>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 mx-auto bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Real-Time
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Products appear instantly as you describe what you want.
              </p>
            </div>

            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Smart Tags
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your preferences are automatically saved as searchable tags.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <SignInButton mode="modal">
                <button className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-lg">
                  Sign In to Start
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-8 py-3 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors font-medium">
                  Create Account
                </button>
              </SignUpButton>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              No credit card required. Start shopping with your voice in seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

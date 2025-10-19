"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { VoiceProductManager } from "@/components/VoiceProductManager";
import { SavedProductsList } from "@/components/SavedProductsList";

export default function VoiceDemoPage() {
  return (
    <>
      <Authenticated>
        <VoiceDemo />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt />
      </Unauthenticated>
    </>
  );
}

function VoiceDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Voice-Controlled Product Management
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Save and manage products using natural voice commands powered by Gemini AI
          </p>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Voice Manager */}
          <div>
            <VoiceProductManager />
          </div>

          {/* Right Column: Saved Products List */}
          <div>
            <SavedProductsList />
          </div>
        </div>

        {/* Demo Products Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Demo Products
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Try voice commands to save these products. Reference them by number (1-6).
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { num: 1, name: "Wireless Headphones", price: 89 },
              { num: 2, name: "Smart Watch", price: 299 },
              { num: 3, name: "Laptop Stand", price: 49 },
              { num: 4, name: "USB-C Hub", price: 59 },
              { num: 5, name: "Mechanical Keyboard", price: 129 },
              { num: 6, name: "Webcam HD", price: 79 },
            ].map((product) => (
              <div
                key={product.num}
                className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="aspect-square bg-gradient-to-br from-purple-400 to-blue-500 rounded-md mb-3 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">{product.num}</span>
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {product.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">${product.price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Key Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white/50 dark:bg-gray-900/50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Natural Language Processing
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Gemini AI understands various phrasings like &quot;save product 3&quot; or &quot;add item 5&quot;
              </p>
            </div>
            <div className="p-4 bg-white/50 dark:bg-gray-900/50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Batch Operations
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Save or remove multiple products at once: &quot;save 1, 2, and 3&quot;
              </p>
            </div>
            <div className="p-4 bg-white/50 dark:bg-gray-900/50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Real-time Sync
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Instant updates with Convex real-time database and optimistic UI
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Voice Product Management Demo
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Sign in to try voice-controlled product management powered by Gemini AI
        </p>
        <SignInButton mode="modal">
          <button className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
            Sign in to continue
          </button>
        </SignInButton>
      </div>
    </div>
  );
}

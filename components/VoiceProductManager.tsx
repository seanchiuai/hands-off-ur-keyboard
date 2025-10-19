"use client";

import { useVoiceProductCommands } from "@/hooks/useVoiceProductCommands";
import { useEffect, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

export const VoiceProductManager = () => {
  const {
    isListening,
    isProcessing,
    transcript,
    error,
    commandResult,
    executeVoiceCommand,
    executeTextCommand,
    cancelListening,
    clearResult,
  } = useVoiceProductCommands();

  const [testMode, setTestMode] = useState(false);
  const [testInput, setTestInput] = useState("");

  // Auto-dismiss success/error messages after 5 seconds
  useEffect(() => {
    if (commandResult) {
      const timer = setTimeout(() => {
        clearResult();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [commandResult, clearResult]);

  // Auto-dismiss error messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        // Error will be cleared when user interacts again
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testInput.trim()) {
      await executeTextCommand(testInput);
      setTestInput("");
    }
  };

  return (
    <div className="voice-manager-container">
      {/* Voice Control Section */}
      <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Voice Product Commands
        </h2>

        {/* Voice Button */}
        <button
          onClick={executeVoiceCommand}
          disabled={isProcessing}
          className={`
            relative flex items-center justify-center
            w-24 h-24 rounded-full
            transition-all duration-300 ease-in-out
            ${
              isListening
                ? "bg-red-500 hover:bg-red-600 scale-110 animate-pulse"
                : "bg-purple-600 hover:bg-purple-700 scale-100"
            }
            ${isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            shadow-lg hover:shadow-xl
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          aria-label={isListening ? "Stop listening" : "Start voice command"}
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : isListening ? (
            <MicOff className="w-10 h-10 text-white" />
          ) : (
            <Mic className="w-10 h-10 text-white" />
          )}

          {isListening && (
            <span className="absolute -inset-2 rounded-full bg-red-500 opacity-30 animate-ping" />
          )}
        </button>

        {/* Status Text */}
        <div className="text-center min-h-[60px]">
          {isListening && (
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 animate-pulse">
              Listening... Speak your command
            </p>
          )}
          {isProcessing && (
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Processing command...
            </p>
          )}
          {!isListening && !isProcessing && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click the microphone to start
            </p>
          )}
        </div>

        {/* Cancel Button */}
        {isListening && (
          <button
            onClick={cancelListening}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        )}

        {/* Transcript */}
        {transcript && (
          <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
              You said:
            </p>
            <p className="text-sm text-gray-900 dark:text-gray-100">{transcript}</p>
          </div>
        )}

        {/* Command Result */}
        {commandResult && (
          <div
            className={`
              w-full p-4 rounded-lg shadow-sm border
              ${
                commandResult.success
                  ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
              }
            `}
          >
            <p
              className={`
                text-sm font-medium
                ${
                  commandResult.success
                    ? "text-green-900 dark:text-green-100"
                    : "text-red-900 dark:text-red-100"
                }
              `}
            >
              {commandResult.message}
            </p>
            {commandResult.affectedProducts.length > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Products: {commandResult.affectedProducts.join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="w-full p-4 bg-red-50 dark:bg-red-950/20 rounded-lg shadow-sm border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-900 dark:text-red-100">{error}</p>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="w-full p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Voice Commands:
          </p>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
            <li>• &quot;Save product 3&quot; - Save a single product</li>
            <li>• &quot;Remove item 5&quot; - Remove a saved product</li>
            <li>• &quot;Save 1, 2, and 3&quot; - Save multiple products</li>
            <li>• &quot;Remove products 4 and 5&quot; - Remove multiple products</li>
          </ul>
        </div>

        {/* Test Mode Toggle */}
        <button
          onClick={() => setTestMode(!testMode)}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
        >
          {testMode ? "Hide" : "Show"} Test Mode
        </button>

        {/* Test Mode Input */}
        {testMode && (
          <form onSubmit={handleTestSubmit} className="w-full flex gap-2">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Type command (e.g., save product 3)"
              className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!testInput.trim() || isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Test
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

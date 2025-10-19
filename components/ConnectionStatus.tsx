"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Wifi, Mic, Key } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatusItem {
  name: string;
  status: "checking" | "connected" | "error";
  message?: string;
  icon: React.ReactNode;
}

export function ConnectionStatus() {
  const [micStatus, setMicStatus] = useState<"checking" | "connected" | "error">("checking");
  const [apiKeyStatuses, setApiKeyStatuses] = useState<{
    gemini: "checking" | "connected" | "error";
    daily: "checking" | "connected" | "error";
    brightdata: "checking" | "connected" | "error";
  }>({
    gemini: "checking",
    daily: "checking",
    brightdata: "checking",
  });
  const [isVisible, setIsVisible] = useState(true);

  // Check microphone permissions
  useEffect(() => {
    const checkMicrophone = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop()); // Stop the stream immediately
        setMicStatus("connected");
      } catch (error) {
        console.error("Microphone error:", error);
        setMicStatus("error");
      }
    };

    checkMicrophone();
  }, []);

  // Check API keys via server-side endpoint (secure)
  useEffect(() => {
    const checkApiKeys = async () => {
      try {
        const response = await fetch('/api/check-config');
        if (response.ok) {
          const config = await response.json();
          setApiKeyStatuses({
            gemini: config.gemini ? "connected" : "error",
            daily: config.daily ? "connected" : "error",
            brightdata: config.brightdata ? "connected" : "error",
          });
        } else {
          // If check fails, mark all as error
          setApiKeyStatuses({
            gemini: "error",
            daily: "error",
            brightdata: "error",
          });
        }
      } catch (error) {
        console.error("Failed to check API configuration:", error);
        setApiKeyStatuses({
          gemini: "error",
          daily: "error",
          brightdata: "error",
        });
      }
    };

    checkApiKeys();
  }, []);

  const statuses: StatusItem[] = [
    {
      name: "Microphone",
      status: micStatus,
      message: micStatus === "error" ? "Permission denied" : "Ready",
      icon: <Mic className="w-4 h-4" />,
    },
    {
      name: "Gemini AI",
      status: apiKeyStatuses.gemini,
      message: apiKeyStatuses.gemini === "error" ? "Key missing or invalid" : "Connected",
      icon: <Key className="w-4 h-4" />,
    },
    {
      name: "Daily.co",
      status: apiKeyStatuses.daily,
      message: apiKeyStatuses.daily === "error" ? "Key missing or invalid" : "Connected",
      icon: <Wifi className="w-4 h-4" />,
    },
    {
      name: "BrightData",
      status: apiKeyStatuses.brightdata,
      message: apiKeyStatuses.brightdata === "error" ? "Key missing or invalid" : "Connected",
      icon: <Key className="w-4 h-4" />,
    },
  ];

  const allConnected = micStatus === "connected" &&
    apiKeyStatuses.gemini === "connected" &&
    apiKeyStatuses.daily === "connected" &&
    apiKeyStatuses.brightdata === "connected";

  const hasErrors = micStatus === "error" ||
    apiKeyStatuses.gemini === "error" ||
    apiKeyStatuses.daily === "error" ||
    apiKeyStatuses.brightdata === "error";

  const StatusIcon = ({ status }: { status: "checking" | "connected" | "error" }) => {
    if (status === "checking") {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }
    if (status === "connected") {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  // Auto-hide after 10 seconds if all connected
  useEffect(() => {
    if (allConnected) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [allConnected]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all z-50"
        aria-label="Show connection status"
      >
        {allConnected ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : hasErrors ? (
          <XCircle className="w-5 h-5 text-red-500" />
        ) : (
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        )}
      </button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 p-4 w-80 shadow-lg z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Connection Status
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
        >
          Hide
        </button>
      </div>

      <div className="space-y-2">
        {statuses.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
          >
            <div className="flex items-center gap-2">
              <div className="text-gray-500 dark:text-gray-400">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {item.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.message}
                </p>
              </div>
            </div>
            <StatusIcon status={item.status} />
          </div>
        ))}
      </div>

      {allConnected && (
        <div className="mt-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-700 dark:text-green-400 text-center">
            All systems ready for voice shopping
          </p>
        </div>
      )}

      {hasErrors && (
        <div className="mt-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-700 dark:text-red-400 text-center">
            Some services need attention
          </p>
        </div>
      )}
    </Card>
  );
}

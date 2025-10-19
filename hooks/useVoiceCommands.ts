"use client";

import { useState, useCallback, useRef } from "react";
import { processVoiceCommand, processTextCommand } from "@/lib/gemini";

interface VoiceCommandResult {
  action: "save" | "remove";
  productNumbers: number[];
  confidence: number;
  transcript: string;
}

export const useVoiceCommands = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startListening = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setError(null);
      setTranscript("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Microphone access denied";
      setError(errorMessage);
      console.error("Error accessing microphone:", err);
    }
  }, []);

  const stopListening = useCallback(async (): Promise<VoiceCommandResult | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      setIsProcessing(true);

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        try {
          // Process with Gemini
          const result = await processVoiceCommand(audioBlob);
          setTranscript(result.transcript);

          // Validate confidence threshold (70%)
          if (result.confidence < 0.7) {
            setError("Low confidence - please repeat command more clearly");
            resolve(null);
            return;
          }

          setError(null);
          resolve(result);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Failed to process voice command";
          setError(errorMessage);
          console.error("Voice processing error:", err);
          resolve(null);
        } finally {
          setIsListening(false);
          setIsProcessing(false);
          // Clean up stream
          mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
          // Clear audio data from memory
          audioChunksRef.current = [];
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const cancelListening = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsListening(false);
      setIsProcessing(false);
      audioChunksRef.current = [];
      setError(null);
    }
  }, [isListening]);

  // For testing: process text command without audio
  const processText = useCallback(async (text: string): Promise<VoiceCommandResult | null> => {
    setIsProcessing(true);
    setTranscript("");
    setError(null);

    try {
      const result = await processTextCommand(text);
      setTranscript(result.transcript);

      // Validate confidence threshold
      if (result.confidence < 0.7) {
        setError("Low confidence - command not clear");
        setIsProcessing(false);
        return null;
      }

      setIsProcessing(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process text command";
      setError(errorMessage);
      setIsProcessing(false);
      return null;
    }
  }, []);

  return {
    isListening,
    isProcessing,
    transcript,
    error,
    startListening,
    stopListening,
    cancelListening,
    processText,
  };
};

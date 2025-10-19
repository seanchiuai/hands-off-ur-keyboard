"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useVoiceCommands } from "./useVoiceCommands";
import { useSavedProducts } from "./useSavedProducts";

interface CommandResult {
  success: boolean;
  message: string;
  affectedProducts: number[];
}

export const useVoiceProductCommands = () => {
  const {
    isListening,
    isProcessing,
    transcript,
    error: voiceError,
    startListening,
    stopListening,
    cancelListening,
    processText,
  } = useVoiceCommands();

  const { saveProduct, removeProductByNumber, saveBatch, removeBatch } = useSavedProducts();
  const recordCommand = useMutation(api.voiceCommands.recordCommand);

  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);
  const [sessionId] = useState(() => `session-${Date.now()}`);

  // Execute voice command and update database
  const executeVoiceCommand = useCallback(async () => {
    if (isListening) {
      // Stop listening and process
      const result = await stopListening();

      if (!result) {
        setCommandResult({
          success: false,
          message: voiceError || "Could not understand command",
          affectedProducts: [],
        });
        return;
      }

      try {
        const { action, productNumbers, confidence } = result;

        // Determine intent based on action and number of products
        const intent =
          productNumbers.length === 1
            ? action === "save"
              ? "save_product"
              : "remove_product"
            : action === "save"
            ? "save_multiple"
            : "remove_multiple";

        let response;
        let message = "";

        if (action === "save") {
          if (productNumbers.length === 1) {
            // Single save
            response = await saveProduct({
              productId: `product-${productNumbers[0]}`,
              productNumber: productNumbers[0],
              savedVia: "voice",
              voiceCommand: transcript,
            });
            message = `Product ${productNumbers[0]} saved!`;
          } else {
            // Batch save
            const products = productNumbers.map((num) => ({
              productId: `product-${num}`,
              productNumber: num,
            }));
            response = await saveBatch({
              products,
              voiceCommand: transcript,
            });
            const { successCount, failedNumbers } = response;
            if (failedNumbers.length === 0) {
              message = `Saved ${successCount} products!`;
            } else {
              message = `Saved ${successCount} products. Failed: ${failedNumbers.join(", ")}`;
            }
          }
        } else {
          // Remove
          if (productNumbers.length === 1) {
            // Single remove
            response = await removeProductByNumber(productNumbers[0]);
            message = `${response.productName} removed!`;
          } else {
            // Batch remove
            response = await removeBatch(productNumbers);
            const { successCount, failedNumbers } = response;
            if (failedNumbers.length === 0) {
              message = `Removed ${successCount} products!`;
            } else {
              message = `Removed ${successCount} products. Not found: ${failedNumbers.join(", ")}`;
            }
          }
        }

        // Record command in analytics
        await recordCommand({
          sessionId,
          command: transcript,
          intent,
          parameters: {
            numbers: productNumbers,
            action,
          },
          successful: true,
        });

        setCommandResult({
          success: true,
          message,
          affectedProducts: productNumbers,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Record failed command
        await recordCommand({
          sessionId,
          command: transcript,
          intent: "unknown",
          parameters: {
            numbers: [],
            action: "save",
          },
          successful: false,
          errorMessage,
        });

        setCommandResult({
          success: false,
          message: `Error: ${errorMessage}`,
          affectedProducts: [],
        });
      }
    } else {
      // Start listening
      await startListening();
      setCommandResult(null);
    }
  }, [
    isListening,
    stopListening,
    startListening,
    voiceError,
    transcript,
    saveProduct,
    removeProductByNumber,
    saveBatch,
    removeBatch,
    recordCommand,
    sessionId,
  ]);

  // Execute text command (for testing)
  const executeTextCommand = useCallback(
    async (text: string) => {
      const result = await processText(text);

      if (!result) {
        setCommandResult({
          success: false,
          message: "Could not understand command",
          affectedProducts: [],
        });
        return;
      }

      try {
        const { action, productNumbers } = result;

        let response;
        let message = "";

        if (action === "save") {
          if (productNumbers.length === 1) {
            response = await saveProduct({
              productId: `product-${productNumbers[0]}`,
              productNumber: productNumbers[0],
              savedVia: "voice",
              voiceCommand: text,
            });
            message = `Product ${productNumbers[0]} saved!`;
          } else {
            const products = productNumbers.map((num) => ({
              productId: `product-${num}`,
              productNumber: num,
            }));
            response = await saveBatch({
              products,
              voiceCommand: text,
            });
            const { successCount } = response;
            message = `Saved ${successCount} products!`;
          }
        } else {
          if (productNumbers.length === 1) {
            response = await removeProductByNumber(productNumbers[0]);
            message = `${response.productName} removed!`;
          } else {
            response = await removeBatch(productNumbers);
            const { successCount } = response;
            message = `Removed ${successCount} products!`;
          }
        }

        setCommandResult({
          success: true,
          message,
          affectedProducts: productNumbers,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setCommandResult({
          success: false,
          message: `Error: ${errorMessage}`,
          affectedProducts: [],
        });
      }
    },
    [processText, saveProduct, removeProductByNumber, saveBatch, removeBatch]
  );

  const clearResult = useCallback(() => {
    setCommandResult(null);
  }, []);

  return {
    isListening,
    isProcessing,
    transcript,
    error: voiceError,
    commandResult,
    executeVoiceCommand,
    executeTextCommand,
    cancelListening,
    clearResult,
  };
};

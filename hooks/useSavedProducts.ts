"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback } from "react";

export const useSavedProducts = () => {
  // Query all saved products
  const savedProducts = useQuery(api.products.getUserSavedProducts);

  // Mutations
  const saveProductMutation = useMutation(api.products.saveProduct);
  const removeProductByNumberMutation = useMutation(api.products.removeProductByNumber);
  const removeProductByIdMutation = useMutation(api.products.removeProductById);
  const saveBatchMutation = useMutation(api.products.saveBatch);
  const removeBatchMutation = useMutation(api.products.removeBatch);

  // Save single product
  const saveProduct = useCallback(
    async (args: {
      productId: string;
      productNumber: number;
      savedVia?: "voice" | "click";
      voiceCommand?: string;
    }) => {
      try {
        const result = await saveProductMutation(args);
        return result;
      } catch (error) {
        console.error("Error saving product:", error);
        throw error;
      }
    },
    [saveProductMutation]
  );

  // Remove product by number (for voice commands)
  const removeProductByNumber = useCallback(
    async (productNumber: number) => {
      try {
        const result = await removeProductByNumberMutation({ productNumber });
        return result;
      } catch (error) {
        console.error("Error removing product:", error);
        throw error;
      }
    },
    [removeProductByNumberMutation]
  );

  // Remove product by ID (for click interface)
  const removeProductById = useCallback(
    async (productId: string) => {
      try {
        const result = await removeProductByIdMutation({ productId });
        return result;
      } catch (error) {
        console.error("Error removing product:", error);
        throw error;
      }
    },
    [removeProductByIdMutation]
  );

  // Batch save products
  const saveBatch = useCallback(
    async (args: {
      products: Array<{ productId: string; productNumber: number }>;
      voiceCommand?: string;
    }) => {
      try {
        const result = await saveBatchMutation(args);
        return result;
      } catch (error) {
        console.error("Error batch saving products:", error);
        throw error;
      }
    },
    [saveBatchMutation]
  );

  // Batch remove products
  const removeBatch = useCallback(
    async (productNumbers: number[]) => {
      try {
        const result = await removeBatchMutation({ productNumbers });
        return result;
      } catch (error) {
        console.error("Error batch removing products:", error);
        throw error;
      }
    },
    [removeBatchMutation]
  );

  // Check if a product is saved
  const isSaved = useCallback(
    (productId: string) => {
      return savedProducts?.some((p) => p.productId === productId) || false;
    },
    [savedProducts]
  );

  return {
    savedProducts: savedProducts || [],
    saveProduct,
    removeProductByNumber,
    removeProductById,
    saveBatch,
    removeBatch,
    isSaved,
  };
};

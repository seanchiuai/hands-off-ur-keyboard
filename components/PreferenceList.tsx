"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PreferenceTag } from "./PreferenceTag";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export function PreferenceList() {
  const preferencesData = useQuery(api.userPreferences.getUserPreferences, {});
  const deletePreference = useMutation(api.userPreferences.deletePreference);

  const handleRemove = async (preferenceId: Id<"userPreferences">, tag: string) => {
    try {
      await deletePreference({ preferenceId });
      toast.success(`Removed preference: ${tag}`);
    } catch (error) {
      console.error("Error removing preference:", error);
      toast.error("Failed to remove preference");
    }
  };

  if (preferencesData === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { preferences, grouped } = preferencesData;

  if (preferences.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No preferences saved yet</p>
        <p className="text-xs mt-1">
          Your preferences will appear here as you shop
        </p>
      </div>
    );
  }

  // Category display names
  const categoryNames: Record<string, string> = {
    material: "Material",
    price: "Price",
    size: "Size",
    feature: "Features",
    color: "Color",
    style: "Style",
    other: "Other",
  };

  // Sort categories by priority
  const categoryOrder = [
    "price",
    "material",
    "size",
    "feature",
    "color",
    "style",
    "other",
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Your Preferences</h3>
        <Badge variant="secondary" className="text-xs">
          {preferences.length}
        </Badge>
      </div>

      {/* Grouped preferences */}
      <div className="space-y-3">
        {categoryOrder.map((category) => {
          const categoryPrefs = grouped[category];
          if (!categoryPrefs || categoryPrefs.length === 0) return null;

          return (
            <div key={category}>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {categoryNames[category]}
              </p>
              <div className="flex flex-wrap gap-2">
                {categoryPrefs.map((pref) => (
                  <PreferenceTag
                    key={pref._id}
                    preference={pref}
                    onRemove={() => handleRemove(pref._id, pref.tag)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

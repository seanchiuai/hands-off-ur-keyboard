# Implementation Log: User Preference Management

## Overview
Implemented automatic user preference extraction from voice conversations with visual tag display and voice-based search refinement capabilities.

## Implementation Date
October 19, 2025

## Features Implemented

### 1. Auto-Extract Preferences from Voice ✅
- **Component**: `PreferenceExtractor.tsx` (Background component)
- **Functionality**:
  - Monitors voice transcripts in real-time
  - Automatically extracts user preferences using Gemini API
  - Processes only new user messages (not agent responses)
  - Saves preferences to Convex database
  - Shows toast notifications when preferences are saved
  - Skips very short transcripts (< 10 characters)
  - Uses conversation history for context (last 5 messages)

### 2. Preference Display as Visual Tags ✅
- **Components**: `PreferenceList.tsx`, `PreferenceTag.tsx` (Already existed)
- **Features**:
  - Color-coded tags by category (material, price, size, feature, color, style, other)
  - Grouped display by category
  - Tag count badge
  - Real-time updates via Convex
  - Empty state when no preferences exist
  - Click X button to remove tags

### 3. Voice-Based Search Refinement ✅
- **API Route**: `/app/api/analyze-refinement/route.ts` (Already existed)
- **Hook**: `useSearchRefinement.ts` (Already existed)
- **Functionality**:
  - Detects refinement intent from voice commands
  - Supports refinement types: price_lower, price_higher, add_feature, remove_feature, change_size
  - Extracts refinement parameters using Gemini function calling
  - Records refinement history

### 4. Preference Extraction API ✅
- **API Route**: `/app/api/extract-preferences/route.ts` (Already existed)
- **Features**:
  - Uses Gemini 2.0 Flash with structured output
  - Extracts category, tag, value, priority (1-10 scale)
  - Validates authentication via Clerk
  - Returns structured JSON preferences array

### 5. 30-Day Auto-Expiry ✅
- **Backend**: `convex/userPreferences.ts`
- **Functionality**:
  - Preferences automatically expire after 30 days
  - `expiresAt` field set on creation and extended on use
  - `cleanupExpiredPreferences` mutation available
  - Active preferences filtered by expiration date in queries

## Files Created

1. **components/PreferenceExtractor.tsx**
   - Background component that auto-extracts preferences
   - Integrates with voice transcript system
   - Uses Gemini API for extraction
   - Saves to Convex via `usePreferences` hook

2. **components/VoiceShoppingPanel.tsx**
   - Wrapper component combining transcript panel and preferences
   - Includes PreferenceExtractor for automatic processing
   - Displays PreferenceList for tag management
   - (Not currently used in main app, but available for future integration)

## Files Modified

1. **components/VoiceTranscriptPanel.tsx**
   - Added import for `PreferenceExtractor`
   - Integrated `<PreferenceExtractor sessionId={activeSession._id} />` into render
   - Now automatically extracts preferences during voice conversations

2. **app/page.tsx**
   - Updated preferences query to use correct format: `useQuery(api.userPreferences.getUserPreferences, {})`
   - Changed conditional rendering to check `preferencesData.preferences.length > 0`
   - Removed redundant "Your Preferences" header (PreferenceList has its own header)

## Files Already Implemented (No Changes Needed)

1. **convex/schema.ts**
   - `userPreferences` table with all required fields
   - `searchRefinements` table for tracking refinement history
   - `preferenceHistory` table for usage tracking
   - All necessary indexes

2. **convex/userPreferences.ts**
   - `savePreferences` mutation with deduplication logic
   - `getUserPreferences` query with filtering and sorting
   - `deletePreference` mutation
   - `incrementUseCount` for tracking usage
   - `cleanupExpiredPreferences` for maintenance

3. **hooks/usePreferences.ts**
   - `extractFromVoice` - Calls Gemini API
   - `addPreferences` - Saves to database
   - `removePreference` - Deletes tags
   - `trackPreferenceUsage` - Updates use count
   - `cleanupExpired` - Removes old preferences

4. **hooks/useSearchRefinement.ts**
   - `detectRefinementIntent` - Analyzes voice commands
   - `refineSearch` - Executes refinement
   - Integration with Convex mutations

5. **components/PreferenceList.tsx**
   - Full UI implementation
   - Category grouping
   - Real-time updates
   - Click-to-remove functionality

6. **components/PreferenceTag.tsx**
   - Pill-shaped badge design
   - Color-coded by category
   - Remove button with hover states
   - Accessible ARIA labels

## Architecture Flow

```
Voice Input
    ↓
VoiceTranscriptPanel (displays conversation)
    ↓
PreferenceExtractor (monitors transcripts in background)
    ↓
extractFromVoice (calls Gemini API via /api/extract-preferences)
    ↓
Gemini 2.0 Flash (structured output: category, tag, priority)
    ↓
addPreferences (saves to Convex with deduplication)
    ↓
getUserPreferences (real-time query)
    ↓
PreferenceList (displays tags on dashboard)
    ↓
User clicks X on tag
    ↓
deletePreference (removes from database)
```

## Preference Extraction Logic

### Priority Scoring (1-10)
- **8-10**: Explicit emphasis ("I really need", "must have")
- **6-8**: Strong preference ("I prefer", "I like")
- **4-6**: Mild preference ("maybe", "ideally")
- **1-3**: Mentioned in passing

### Category Detection
- **material**: wooden, metal, plastic, leather, etc.
- **price**: under $X, around $Y, between $Z and $W
- **size**: dimensions, capacity, at least Xft, etc.
- **feature**: must have X, needs Y, with Z
- **color**: red, blue, dark, light, etc.
- **style**: modern, vintage, minimalist, rustic, etc.
- **other**: anything else

### Deduplication
- Exact match: "wooden" === "wooden"
- Contains: "wooden" includes "wood"
- Variations: "metal" matches "metallic", "steel"
- Existing preference updated instead of creating duplicate

## Voice Command Examples

### Preference Extraction
```
"wooden desk under $200"
  → [wooden (material, priority 7)]
  → [under $200 (price, priority 8)]

"red shoes size 10"
  → [red (color, priority 6)]
  → [size 10 (size, priority 8)]

"laptop with SSD at least 16GB RAM"
  → [SSD (feature, priority 7)]
  → [16GB+ RAM (feature, priority 8)]
```

### Search Refinement
```
"find cheaper options"
  → Refinement: price_lower

"show me wooden ones"
  → Refinement: add_feature (wooden)

"under $50"
  → Refinement: price_range (max: $50)

"larger size"
  → Refinement: change_size (increase)
```

## Database Schema

### userPreferences Table
```typescript
{
  userId: string,              // Clerk user ID
  tag: string,                 // Display text ("wooden", "under $20")
  category: enum,              // material|price|size|feature|color|style|other
  value: string | number,      // Optional structured value
  extractedFrom: string,       // Original voice command
  priority: number,            // 1-10 scale
  source: "voice" | "manual",  // How tag was created
  productContext: string,      // Optional product type
  createdAt: number,           // Timestamp
  expiresAt: number,           // 30 days from creation/last use
  useCount: number,            // Times used in searches
  lastUsedAt: number,          // Last usage timestamp
}
```

## API Endpoints

### POST /api/extract-preferences
**Input**:
```json
{
  "transcript": "wooden desk under $200",
  "conversationHistory": "user: I need furniture\nagent: What kind?"
}
```

**Output**:
```json
{
  "success": true,
  "preferences": [
    {
      "category": "material",
      "tag": "wooden",
      "priority": 7,
      "value": "wood"
    },
    {
      "category": "price",
      "tag": "under $200",
      "priority": 8,
      "value": 200
    }
  ]
}
```

### POST /api/analyze-refinement
**Input**:
```json
{
  "voiceCommand": "find cheaper options",
  "currentSearchContext": {
    "searchId": "xyz",
    "currentQuery": "wireless headphones",
    "currentProducts": [...]
  }
}
```

**Output**:
```json
{
  "isRefinement": true,
  "refinement": {
    "type": "price_lower",
    "value": "lower price range",
    "targetPercentage": 20,
    "extractedPreferences": ["cheaper", "budget-friendly"]
  }
}
```

## Environment Variables

### Required
- `GEMINI_API_KEY` - Configured in Convex dashboard: `AIzaSyBEsCTquX4WCMeAZ0QzALdPmsLjqm1KgBc`
- `NEXT_PUBLIC_CONVEX_URL` - Auto-configured
- `CLERK_SECRET_KEY` - For authentication

### Optional
- `PREFERENCE_EXPIRATION_DAYS` - Default: 30
- `MAX_PREFERENCES_PER_USER` - Default: 500

## Testing Checklist

- [x] Gemini API key configured in Convex
- [x] Database schema includes all required tables
- [x] Backend mutations and queries implemented
- [x] Preference extraction API working
- [x] Refinement detection API working
- [x] UI components render correctly
- [x] PreferenceExtractor integrated into VoiceTranscriptPanel
- [x] PreferenceList displays on dashboard
- [ ] End-to-end test: Voice → Extract → Display → Remove
- [ ] Test preference expiration after 30 days
- [ ] Test deduplication logic with similar tags
- [ ] Test refinement detection with voice commands
- [ ] Performance test with 100+ preferences

## Known Limitations

1. **Manual Tag Creation**: Not implemented (voice-only MVP)
2. **Tag Editing**: Cannot edit tag text after creation
3. **Priority Adjustment**: Cannot manually adjust priority
4. **Preference Import/Export**: Not implemented
5. **Preference Sharing**: Not implemented
6. **Category Customization**: Fixed set of categories

## Success Metrics

- **Extraction Accuracy**: Target 90%+ correct category assignment
- **Real-time Performance**: Tags appear within 2 seconds of voice input
- **Duplicate Reduction**: < 5% duplicate preferences after semantic merging
- **Refinement Detection**: 95%+ accuracy for common patterns
- **User Engagement**: < 10% of tags manually removed (indicates high accuracy)

## Future Enhancements

1. **Smart Merging**: Use embeddings for semantic similarity
2. **Preference Profiles**: Save different profiles for different shopping contexts
3. **Preference Recommendations**: Suggest tags based on browsing history
4. **Bulk Operations**: Delete all tags in a category
5. **Tag Ranking**: Manually reorder tags by importance
6. **Preference Analytics**: Show most-used tags, trending preferences
7. **Voice Confirmation**: Ask user to confirm extracted preferences
8. **Multi-language Support**: Extract preferences from non-English voice

## Breaking Changes

None - All new features are additive.

## Migration Notes

No migration needed. Existing `userPreferences` table already has correct schema.

## Documentation

- Implementation plan: `/.claude/plans/plan-user-preference-management.md`
- Agent documentation: `/.claude/agents/agent-user-preferences.md`
- Convex guidelines: `/convexGuidelines.md`
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output

## Support

For issues or questions:
1. Check Convex dashboard for function errors
2. Check browser console for API errors
3. Verify Gemini API key is configured
4. Check Clerk authentication is working

# Voice-Controlled Product Management - Setup & Usage Guide

## Overview

This feature enables users to save and remove products using natural voice commands powered by Google's Gemini AI. The system uses:

- **Gemini 2.0 Flash Experimental** for voice command processing with function calling
- **Web Audio API** for microphone access and audio recording
- **Convex** for real-time database mutations and queries
- **Clerk** for user authentication and authorization

## Setup Instructions

### 1. Get Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure Environment Variables

Add the Gemini API key to your `.env.local` file:

```bash
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

**Note:** The key is already added as a placeholder in `.env.local`. Replace `your_gemini_api_key_here` with your actual API key.

### 3. Start Development Servers

```bash
npm run dev
```

This starts both:
- Next.js frontend on `http://localhost:3000`
- Convex backend (will open dashboard automatically)

### 4. Access the Demo

Navigate to `http://localhost:3000/voice-demo` to try the feature.

## Architecture

### Database Schema

#### savedProducts Table
Stores products saved by users with voice command metadata:

```typescript
{
  userId: string,              // Clerk user ID
  productId: string,           // Product identifier
  productNumber: number,       // Display number (1-indexed) for voice commands
  productName: string,         // Product name for confirmation
  productDetails: {
    imageUrl: string,
    price: number,
    category: string,
  },
  savedAt: number,            // Timestamp
  lastModified: number,       // Last update timestamp
  savedVia: "voice" | "click", // How the product was saved
  voiceCommand?: string,      // Original voice command (if saved via voice)
}
```

**Indexes:**
- `by_user` - Fast user-scoped queries
- `by_user_and_product` - Prevent duplicates
- `by_user_and_number` - Voice command lookups

#### voiceCommands Table
Logs all voice commands for analytics:

```typescript
{
  userId: string,
  sessionId: string,          // Voice session identifier
  command: string,            // Raw voice input transcript
  intent: "save_product" | "remove_product" | "save_multiple" | "remove_multiple" | "unknown",
  parameters: {
    numbers: number[],
    action: "save" | "remove",
  },
  executedAt: number,
  successful: boolean,
  errorMessage?: string,
}
```

**Indexes:**
- `by_user` - User command history
- `by_session` - Session-specific commands
- `by_intent` - Intent-based analytics

### Backend Functions

#### Mutations

**`api.products.saveProduct`**
- Saves a single product with voice command metadata
- Prevents duplicates (updates if already saved)
- Returns success status and action type

**`api.products.removeProductByNumber`**
- Removes a saved product by its display number
- Returns product name for confirmation message

**`api.products.saveBatch`**
- Saves multiple products at once
- Returns success count and failed numbers

**`api.products.removeBatch`**
- Removes multiple products by numbers
- Returns success count and failed numbers

**`api.voiceCommands.recordCommand`**
- Logs voice command for analytics
- Records intent, parameters, and success status

#### Queries

**`api.products.getUserSavedProducts`**
- Returns all saved products for authenticated user
- Real-time subscription updates UI automatically

**`api.products.isProductSaved`**
- Checks if specific product is saved
- Used for UI state management

### Frontend Architecture

#### Components

**`VoiceProductManager`** (`/components/VoiceProductManager.tsx`)
- Main voice control interface
- Microphone button with visual feedback
- Displays transcript and command results
- Test mode for text-based command testing
- Usage instructions

**`SavedProductsList`** (`/components/SavedProductsList.tsx`)
- Real-time list of saved products
- Shows save method (voice/click) badges
- Remove functionality
- Summary statistics

#### Hooks

**`useVoiceCommands`** (`/hooks/useVoiceCommands.ts`)
- Web Audio API integration
- Microphone permission handling
- Audio recording and blob creation
- Gemini API processing
- Confidence threshold validation (70%)
- Automatic audio cleanup

**`useSavedProducts`** (`/hooks/useSavedProducts.ts`)
- Convex mutation wrappers
- Real-time query subscriptions
- Product save/remove operations
- Batch operations support

**`useVoiceProductCommands`** (`/hooks/useVoiceProductCommands.ts`)
- Integrates voice processing with product mutations
- Command execution flow
- Analytics logging
- Result message formatting

### Gemini Integration

#### Function Calling Setup

The system uses Gemini's function calling feature to extract structured data from voice commands:

**System Instruction:**
```
You are a voice-controlled product management assistant.
Extract user intent and product numbers from voice commands.

Valid commands:
- "save product [number]" or "add item [number]"
- "remove product [number]" or "delete item [number]"
- Batch operations with multiple numbers
```

**Function Declaration:**
```typescript
{
  name: "executeProductCommand",
  parameters: {
    action: "save" | "remove",
    productNumbers: number[],
    confidence: 0-1,
  }
}
```

**Confidence Threshold:**
- Commands with confidence < 0.7 are rejected
- User is prompted to repeat the command more clearly

## Usage

### Voice Commands

**Single Product:**
- "Save product 3"
- "Add item 5"
- "Remove product 2"
- "Delete item 4"

**Multiple Products:**
- "Save products 1, 2, and 3"
- "Save 1, 2, and 3"
- "Remove items 4 and 5"
- "Remove 2, 3, and 6"

### How to Use

1. **Click the microphone button** - Starts recording
2. **Speak your command clearly** - e.g., "save product 3"
3. **Click again to stop** - Processes the command
4. **View result** - Success/error message appears
5. **Check saved list** - Updates automatically in real-time

### Test Mode

For testing without audio:
1. Click "Show Test Mode" at bottom of voice manager
2. Type command in text input (e.g., "save product 3")
3. Click "Test" button
4. View results without using microphone

## Features

### 1. Natural Language Processing
- Gemini AI understands various phrasings
- Flexible command formats accepted
- Handles natural speech patterns

### 2. Confidence-Based Validation
- 70% confidence threshold
- Low confidence commands are rejected
- Prompts user to repeat unclear commands

### 3. Real-time Updates
- Convex subscriptions update UI instantly
- No page refresh needed
- Optimistic updates for smooth UX

### 4. Batch Operations
- Save/remove multiple products at once
- Partial success handling (some succeed, some fail)
- Clear feedback on which products succeeded/failed

### 5. Analytics Logging
- All commands recorded for analytics
- Intent classification
- Success/failure tracking
- Command history available

### 6. Authentication & Security
- All mutations require Clerk authentication
- User-scoped data access only
- Row-level security in database queries

### 7. Audio Cleanup
- Audio data immediately discarded after processing
- No persistent audio storage
- Privacy-focused implementation

## Error Handling

### Microphone Access Denied
- Clear error message displayed
- Instructions to enable microphone in browser settings

### Low Confidence
- "Low confidence - please repeat command more clearly"
- User prompted to try again

### Product Not Found
- "No saved product found with number X"
- Clear feedback on which products failed

### Network Errors
- Gemini API errors caught and displayed
- Convex mutation errors handled gracefully
- User-friendly error messages

## Performance

### Latency Targets
- Voice processing: < 2 seconds
- Database mutations: < 500ms
- Real-time UI updates: < 500ms

### Optimization
- Efficient database indexes
- Minimal audio data transfer
- Batch operations for multiple products
- Optimistic UI updates

## Browser Compatibility

### Supported Browsers
- Chrome/Edge (recommended)
- Firefox
- Safari (with microphone permissions)

### Requirements
- HTTPS connection (for microphone access)
- Modern browser with Web Audio API support
- Microphone hardware

## Troubleshooting

### Issue: "Microphone access denied"
**Solution:** Enable microphone permissions in browser settings

### Issue: "Low confidence" messages frequently
**Solution:**
- Speak more clearly and slowly
- Reduce background noise
- Use test mode to verify command format

### Issue: "NEXT_PUBLIC_GEMINI_API_KEY is not configured"
**Solution:** Add your Gemini API key to `.env.local` and restart dev server

### Issue: Products not updating in real-time
**Solution:**
- Check Convex connection in browser console
- Verify authentication status
- Refresh page to re-establish WebSocket connection

## Next Steps

### Enhancements
- [ ] Voice feedback (text-to-speech confirmation)
- [ ] Command history UI
- [ ] Voice command suggestions
- [ ] Multi-language support
- [ ] Offline command queueing
- [ ] Voice settings (sensitivity, language)

### Integration
- [ ] Connect to real product catalog
- [ ] Product search via voice
- [ ] Shopping cart integration
- [ ] Order placement via voice

## API Quotas & Limits

### Gemini API
- Free tier: 15 requests/minute
- Text input: 1M tokens
- Audio input: Varies by length
- [View full quotas](https://ai.google.dev/gemini-api/docs/quota)

### Rate Limiting
- Voice commands: No hard limit (client-side throttling recommended)
- Command logging: No limit
- Saved products: No limit per user

## Security Considerations

1. **API Key Protection**
   - Use environment variables
   - Never commit API keys to git
   - Rotate keys if exposed

2. **User Authentication**
   - All operations require Clerk authentication
   - User ID verified on every mutation
   - No cross-user data access

3. **Audio Privacy**
   - Audio processed client-side
   - Sent to Gemini API only
   - Immediately discarded after processing
   - No audio storage on servers

4. **Input Validation**
   - Product numbers validated
   - Command parameters sanitized
   - Confidence threshold enforced

## Support

For issues or questions:
1. Check this documentation
2. Review browser console for errors
3. Verify environment variables
4. Test with test mode first
5. Check Convex dashboard for mutation logs

## License

This implementation is part of the hands-off-ur-keyboard project.

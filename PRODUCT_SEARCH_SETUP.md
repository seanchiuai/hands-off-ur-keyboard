# Product Search Integration Setup Guide

This guide explains how to configure and use the Product Search Integration feature.

## Overview

The Product Search Integration allows users to search for products using natural language queries. The system uses:
- **Gemini API** for intelligent parameter extraction from voice/text commands
- **BrightData API** (optional) for real product data from e-commerce sites
- **Convex** for data storage and caching
- **Real-time updates** for displaying search results as they arrive

## Features

- Natural language product search (e.g., "wooden desk under $200")
- AI-powered parameter extraction (category, price range, features, brand)
- Numbered results (1-5) optimized for voice navigation
- Smart caching to reduce API costs
- Real-time result updates
- Mock data fallback for development/testing

## Setup Instructions

### 1. Install Dependencies (Already Done)

The following packages have been installed:
- `@google/generative-ai` - Gemini API client
- `axios` - HTTP client for API calls
- `cheerio` - HTML parsing (for future scraping features)

### 2. Configure Environment Variables

#### Frontend Environment Variables (.env.local)

The frontend environment variables are already configured. No changes needed.

#### Convex Environment Variables (REQUIRED)

You **MUST** configure the following in the Convex Dashboard:

1. Go to https://dashboard.convex.dev
2. Select your project: `hands-off-ur-keyboard`
3. Navigate to **Settings** → **Environment Variables**
4. Add the following variables:

**Required:**
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your Gemini API key from: https://aistudio.google.com/app/apikey

**Optional (for production):**
```bash
BRIGHTDATA_API_KEY=your_brightdata_api_key_here
BRIGHTDATA_MCP_ENDPOINT=https://api.brightdata.com/mcp/v1/search
```

Get BrightData credentials from: https://brightdata.com

**Note:** If BrightData is not configured, the system will automatically use mock product data for development and testing.

### 3. Database Schema

The database schema has been updated with the following tables:
- `productSearches` - Stores search queries and parameters
- `searchProducts` - Stores product results (numbered 1-5)
- `searchCache` - Caches search results to reduce API costs
- `searchHistory` - Logs search queries for analytics

These tables will be automatically created when you run the Convex backend.

### 4. Deploy Schema Changes

Run the following command to push schema changes to Convex:

```bash
npx convex dev
```

This will sync the new schema to your Convex deployment.

## Usage

### Accessing the Search Page

Navigate to: `http://localhost:3000/search`

### How to Search

1. **Text Search:**
   - Enter a natural language query in the search box
   - Examples:
     - "wooden desk under $200"
     - "wireless headphones with noise cancellation"
     - "gaming laptop under $1500 with RTX 4070"
   - Click "Search" button

2. **Voice Search:**
   - Use the voice input feature (if integrated)
   - Speak your search query naturally
   - The system will extract parameters and search

### Search Flow

1. **Parameter Extraction** - Gemini AI analyzes your query and extracts:
   - Main search terms
   - Category
   - Price range (min/max)
   - Brand preferences
   - Features/specifications
   - Quality indicators (ratings)

2. **Product Search** - The system:
   - Checks cache for recent identical searches
   - If not cached, queries BrightData API (or uses mock data)
   - Limits results to top 5 products

3. **Results Display** - Products are shown with:
   - Numbered badges (1-5) for voice reference
   - Product image
   - Title and price
   - Rating and reviews
   - Source/retailer
   - Expandable features list
   - "View Product" link

### Caching System

- Search results are cached for 1 hour
- Identical searches return cached results instantly
- Reduces API costs and improves performance
- Cache automatically expires and cleans up

## API Integration Details

### Gemini API

- **Model:** gemini-2.0-flash-exp
- **Feature:** Function calling for structured parameter extraction
- **Rate Limit:** 60 requests/minute
- **Fallback:** Basic keyword extraction if API fails

### BrightData API (Optional)

- **Endpoint:** Configurable via `BRIGHTDATA_MCP_ENDPOINT`
- **Features:** E-commerce product scraping
- **Rate Limiting:** Handled automatically with exponential backoff
- **Fallback:** Mock data generation if not configured

### Mock Data

When BrightData is not configured, the system generates realistic mock products:
- 5 products per search
- Price ranges based on your query
- Realistic ratings and reviews
- Placeholder images
- All features work identically

## File Structure

```
convex/
├── productSearch.ts       # Search creation and parameter extraction
├── searchProducts.ts      # Product CRUD operations
├── searchCache.ts         # Caching logic
├── brightdata.ts          # BrightData API integration
└── schema.ts             # Database schema

app/
└── search/
    └── page.tsx          # Search page UI

components/
├── SearchProductCard.tsx  # Individual product card
└── SearchProductGrid.tsx  # Product grid with animations

hooks/
└── useProductSearch.ts   # Search state management hook
```

## Troubleshooting

### "GEMINI_API_KEY not configured" Error

**Solution:** Add the `GEMINI_API_KEY` to Convex environment variables (not .env.local)

### "Unauthorized" Error

**Solution:** Make sure you're signed in with Clerk authentication

### No Products Appearing

**Possible causes:**
1. BrightData API error (will fall back to mock data)
2. Network issues
3. Check browser console for errors

**Solution:** Check that mock data is being generated. If BrightData fails, you should still see 5 mock products.

### Products Not Loading in Real-time

**Solution:** The SearchProductGrid uses Convex's real-time subscriptions. Check that:
1. Convex is running (`npx convex dev`)
2. NEXT_PUBLIC_CONVEX_URL is set correctly
3. Network connection is stable

## Future Enhancements

### Planned Features:
- [ ] Voice-activated search integration
- [ ] Search history with recent searches
- [ ] Saved product comparisons
- [ ] Price tracking and alerts
- [ ] Multi-source product aggregation
- [ ] Advanced filters (color, size, etc.)
- [ ] Product recommendations based on search history

## Performance Optimization

### Current Optimizations:
- ✅ Query result caching (1 hour TTL)
- ✅ Limited to 5 results for voice-friendly navigation
- ✅ Image lazy loading and error handling
- ✅ Staggered animations for smooth UX
- ✅ Real-time subscription optimizations

### Monitoring:
- Cache hit rate tracking
- Search query analytics
- API usage monitoring
- Error rate tracking

## Security Considerations

- ✅ API keys stored in Convex environment (server-side only)
- ✅ User authentication required for all searches
- ✅ User-scoped queries (users can only see their own searches)
- ✅ Input validation on all queries
- ✅ Rate limiting to prevent abuse

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Convex logs in the dashboard
3. Check browser console for client-side errors
4. Verify all environment variables are set correctly

## Testing

### Manual Testing Checklist:
- [ ] Search with text input works
- [ ] Results appear with numbers 1-5
- [ ] Product cards display correctly
- [ ] Cache works (search same query twice)
- [ ] Error handling shows appropriate messages
- [ ] Loading states display properly
- [ ] Authentication check works
- [ ] Mock data generates when BrightData not configured

### Test Queries:
```
"laptop under $1000"
"wireless headphones"
"wooden desk under $500 with drawers"
"gaming chair ergonomic"
"4K monitor 27 inch"
```

## Credits

Built with:
- Next.js 15
- Convex
- Gemini AI
- BrightData (optional)
- shadcn/ui
- Tailwind CSS

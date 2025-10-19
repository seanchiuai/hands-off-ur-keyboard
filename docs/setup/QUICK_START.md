# Quick Start Guide

## 🔑 Get Your API Keys

Before starting, you'll need to obtain API keys from these services:

### Required Services

1. **Gemini API** (Required for AI)
   - Go to: https://aistudio.google.com/app/apikey
   - Create a new API key
   - Copy the key

2. **Daily.co API** (Required for voice)
   - Go to: https://dashboard.daily.co/developers
   - Create a new API key
   - Copy the key

3. **Clerk** (Already configured)
   - Authentication is already set up
   - Keys are in .env.local

### Optional Services

4. **BrightData API** (Optional - for real product data)
   - Go to: https://brightdata.com/cp/zones
   - Create account and get API key
   - Falls back to mock data if not configured

---

## 🔧 Configure Environment Variables

### Step 1: Frontend (.env.local)

The `.env.local` file should already exist. Add your keys:

```bash
# Clerk (already configured)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Convex (already configured)
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment

# Add your new API keys here
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_key_here
NEXT_PUBLIC_DAILY_API_KEY=your_daily_key_here
NEXT_PUBLIC_BRIGHTDATA_API_KEY=your_brightdata_key_here  # Optional
```

### Step 2: Convex Dashboard (REQUIRED)

The following environment variables **MUST** be added to your Convex dashboard:

1. Go to: https://dashboard.convex.dev
2. Select project: **hands-off-ur-keyboard**
3. Navigate to: **Settings** → **Environment Variables**
4. Add these keys:

```bash
GEMINI_API_KEY=your_gemini_key_here
DAILY_API_KEY=your_daily_key_here
BRIGHTDATA_API_KEY=your_brightdata_key_here  # Optional
BRIGHTDATA_MCP_ENDPOINT=https://api.brightdata.com/mcp/v1/search
```

5. Click "Save" for each variable
6. Wait ~30 seconds for auto-deployment

---

## 🚀 Start the Application

```bash
# Install dependencies
npm install

# Start both frontend and backend
npm run dev
```

This starts:
- **Frontend**: http://localhost:3000
- **Backend**: Convex dev server

---

## 🧪 Test the Features

### 1. Main Dashboard
1. Navigate to: http://localhost:3000
2. Sign in with Clerk
3. Click the microphone button
4. Say: "Find wireless headphones under $100"
5. Watch products appear numbered 1-20

### 2. Voice Commands
- "save product 3" - Saves item
- "remove product 5" - Removes saved item
- "find cheaper options" - Refines search

### 3. Saved Products
1. Click "Saved Products" button
2. View all saved items
3. Say "remove product 2" to remove

---

## ⚠️ Configuration Required

### Daily.co Domain Allowlist
1. Go to: https://dashboard.daily.co
2. Navigate to: **Settings** → **Domains**
3. Add allowlist:
   - Development: `localhost:3000`
   - Production: `your-domain.com`

### PipeCat Agent Server
The voice agent requires a separate deployment:
- **Cannot run on Vercel** (WebSocket requirements)
- Deploy to: Railway, Render, or VPS
- Python 3.10+ required

---

## 🔒 Security Best Practices

1. **NEVER commit API keys to git**
2. Use `.env.local` for local development (in .gitignore)
3. Use Convex dashboard for production keys
4. Rotate keys if accidentally exposed
5. Use different keys for dev/prod

### If You Accidentally Expose Keys:

1. **Immediately revoke** the exposed keys:
   - Gemini: https://console.cloud.google.com/apis/credentials
   - Daily: https://dashboard.daily.co/developers
   - BrightData: https://brightdata.com/cp/zones

2. **Generate new keys** from the same dashboards

3. **Remove from git history**:
   ```bash
   # Use git filter-branch or BFG Repo Cleaner
   # Force push to rewrite history
   ```

4. **Update all environments** with new keys

---

## 📚 Next Steps

1. ✅ Configure all API keys
2. ✅ Start dev server: `npm run dev`
3. ✅ Test voice shopping flow
4. ✅ Review `/docs/MVP_ARCHITECTURE.md`
5. ⚠️ Deploy PipeCat agent (for full voice)
6. ⚠️ Deploy to production (Vercel + Convex)

---

**Status:** Ready for testing after API configuration
**Documentation:** See `/docs/MVP_ARCHITECTURE.md` for details

# Security Checklist - API Key Rotation

## ✅ Completed

- [x] Removed exposed keys from git history
- [x] Force-pushed sanitized code to GitHub
- [x] Updated `.env.local` with new Gemini API key
- [x] Verified `.env.local` is in `.gitignore`

## ⚠️ CRITICAL: Action Required

### 1. Update Convex Dashboard with New Gemini Key

**IMPORTANT:** Your backend won't work until you update this!

1. Go to: https://dashboard.convex.dev
2. Select project: **hands-off-ur-keyboard**
3. Navigate to: **Settings** → **Environment Variables**
4. Find: `GEMINI_API_KEY`
5. Update with your new Gemini API key (from https://aistudio.google.com/app/apikey)
6. Click **Save**
7. Wait ~30 seconds for deployment

### 2. Rotate Daily.co API Key (Still Exposed)

The Daily.co API key is still the old exposed one. You should rotate it:

1. Go to: https://dashboard.daily.co/developers
2. **Revoke** old key: `2252a02a11a444f5d5ed2ac4ac9a4dae...`
3. **Generate** new key
4. Update in `.env.local`:
   ```bash
   NEXT_PUBLIC_DAILY_API_KEY=your_new_daily_key
   ```
5. Update in Convex dashboard:
   ```bash
   DAILY_API_KEY=your_new_daily_key
   ```

### 3. Rotate BrightData API Key (Still Exposed)

The BrightData API key is still the old exposed one:

1. Go to: https://brightdata.com/cp/zones
2. Delete old zone or regenerate key
3. Update in `.env.local`:
   ```bash
   NEXT_PUBLIC_BRIGHTDATA_API_KEY=your_new_brightdata_key
   ```
4. Update in Convex dashboard:
   ```bash
   BRIGHTDATA_API_KEY=your_new_brightdata_key
   ```

### 4. Monitor for Suspicious Activity

Check your API usage dashboards for any unauthorized usage:
- **Gemini:** https://console.cloud.google.com/apis/dashboard
- **Daily:** https://dashboard.daily.co/usage
- **BrightData:** https://brightdata.com/cp/usage

Look for:
- Unusual spikes in API calls
- Calls from unknown IP addresses
- Calls during times you weren't using the app

### 5. Security Best Practices Going Forward

✅ **DO:**
- Keep API keys in `.env.local` (already in `.gitignore`)
- Use Convex dashboard for backend keys
- Use different keys for dev/prod environments
- Rotate keys regularly
- Monitor API usage

❌ **DON'T:**
- Commit `.env.local` to git
- Include real keys in documentation
- Share keys in chat/email
- Use production keys in development

## Current Status

| Service | Frontend (.env.local) | Backend (Convex) | Status |
|---------|----------------------|------------------|--------|
| Gemini | ✅ Updated | ⚠️ **Update Required** | New key set locally |
| Daily.co | ⚠️ Old exposed key | ⚠️ Old exposed key | **Needs rotation** |
| BrightData | ⚠️ Old exposed key | ⚠️ Old exposed key | **Needs rotation** |

## Next Steps

1. **RIGHT NOW:** Update Gemini key in Convex dashboard
2. **TODAY:** Rotate Daily.co and BrightData keys
3. **THIS WEEK:** Monitor API usage for suspicious activity
4. **ONGOING:** Review this checklist before any git commits

---

**⚠️ Remember:** `.env.local` is protected by `.gitignore` and will NEVER be committed to git. This file is safe to delete after you've completed all steps.

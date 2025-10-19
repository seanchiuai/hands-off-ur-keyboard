import { NextResponse } from 'next/server';

/**
 * Check if required API keys are configured (server-side only)
 * Does NOT expose the actual keys to the client
 */
export async function GET() {
  return NextResponse.json({
    gemini: !!process.env.NEXT_PUBLIC_GEMINI_API_KEY &&
            process.env.NEXT_PUBLIC_GEMINI_API_KEY !== 'your_gemini_api_key_here',
    daily: !!process.env.DAILY_API_KEY &&
           process.env.DAILY_API_KEY !== 'your_daily_api_key_here',
    brightdata: !!process.env.NEXT_PUBLIC_BRIGHTDATA_API_KEY &&
                process.env.NEXT_PUBLIC_BRIGHTDATA_API_KEY !== 'your_brightdata_api_key_here',
  });
}

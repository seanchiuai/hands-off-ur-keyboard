import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// CORS headers for Daily room creation
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle OPTIONS request for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * Create a Daily room for voice chat
 */
export async function POST() {
  try {
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Check for Daily API key
    const dailyApiKey = process.env.DAILY_API_KEY;
    if (!dailyApiKey) {
      console.error('DAILY_API_KEY not configured');
      return NextResponse.json(
        { error: 'Voice chat not configured' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // Create Daily room
    const roomResponse = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dailyApiKey}`,
      },
      body: JSON.stringify({
        properties: {
          // Room expires after 10 minutes of inactivity
          exp: Math.floor(Date.now() / 1000) + 600,
          // Enable audio-only for voice agents
          enable_chat: false,
          enable_screenshare: false,
          enable_recording: 'cloud', // For conversation logging
          // Optimize for low latency
          enable_prejoin_ui: false,
        },
      }),
    });

    if (!roomResponse.ok) {
      const errorData = await roomResponse.text();
      console.error('Daily room creation failed:', errorData);
      throw new Error('Failed to create Daily room');
    }

    const room = await roomResponse.json();

    // Create meeting token for authenticated user
    const tokenResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dailyApiKey}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: room.name,
          // Associate token with Clerk user ID
          user_name: userId,
          // Token valid for 1 hour
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Daily token creation failed:', errorData);
      throw new Error('Failed to create meeting token');
    }

    const { token } = await tokenResponse.json();

    // Return room URL and token
    return NextResponse.json(
      {
        roomUrl: room.url,
        token,
        roomName: room.name,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Daily room creation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

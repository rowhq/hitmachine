import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const runtime = 'edge';

interface AudioStatus {
  watched: boolean;
  vote: 'up' | 'down' | null;
  timestamp: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, vote, watched } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Get current status
    const currentStatus = await kv.get<AudioStatus>(`audio:${filename}`) || {
      watched: false,
      vote: null,
      timestamp: 0,
    };

    // Update status
    const newStatus: AudioStatus = {
      watched: watched !== undefined ? watched : currentStatus.watched,
      vote: vote !== undefined ? vote : currentStatus.vote,
      timestamp: Date.now(),
    };

    // Save to KV
    await kv.set(`audio:${filename}`, newStatus);

    return NextResponse.json({
      success: true,
      status: newStatus,
    });
  } catch (error) {
    console.error('Error updating audio status:', error);
    return NextResponse.json(
      { error: 'Failed to update audio status' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    const status = await kv.get<AudioStatus>(`audio:${filename}`) || {
      watched: false,
      vote: null,
      timestamp: 0,
    };

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error getting audio status:', error);
    return NextResponse.json(
      { error: 'Failed to get audio status' },
      { status: 500 }
    );
  }
}

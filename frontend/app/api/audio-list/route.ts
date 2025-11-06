import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { kv } from '@vercel/kv';

export const runtime = 'edge';

interface AudioStatus {
  watched: boolean;
  vote: 'up' | 'down' | null;
  timestamp: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const filter = searchParams.get('filter'); // 'unwatched', 'upvoted', 'downvoted', 'all'

    // List files from Vercel Blob
    const { blobs, cursor: nextCursor, hasMore } = await list({
      prefix: 'audio/',
      limit,
      cursor,
    });

    // Get status for each file from KV
    const blobsWithStatus = await Promise.all(
      blobs.map(async (blob) => {
        const filename = blob.pathname;
        const status = await kv.get<AudioStatus>(`audio:${filename}`);

        return {
          url: blob.url,
          filename: blob.pathname,
          uploadedAt: blob.uploadedAt,
          size: blob.size,
          status: status || { watched: false, vote: null, timestamp: 0 },
        };
      })
    );

    // Apply filters
    let filteredBlobs = blobsWithStatus;
    if (filter === 'unwatched') {
      filteredBlobs = blobsWithStatus.filter(b => !b.status.watched);
    } else if (filter === 'upvoted') {
      filteredBlobs = blobsWithStatus.filter(b => b.status.vote === 'up');
    } else if (filter === 'downvoted') {
      filteredBlobs = blobsWithStatus.filter(b => b.status.vote === 'down');
    }

    return NextResponse.json({
      blobs: filteredBlobs,
      cursor: nextCursor,
      hasMore,
      total: filteredBlobs.length,
    });
  } catch (error) {
    console.error('Error listing audio files:', error);
    return NextResponse.json(
      { error: 'Failed to list audio files' },
      { status: 500 }
    );
  }
}

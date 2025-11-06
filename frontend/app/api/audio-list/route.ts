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
    let cursor = searchParams.get('cursor') || undefined;
    const requestedLimit = parseInt(searchParams.get('limit') || '50');
    const filter = searchParams.get('filter'); // 'unwatched', 'upvoted', 'downvoted', 'all'

    // Keep fetching until we have enough upload files or run out of files
    let allUploadFiles: any[] = [];
    let hasMore = true;
    let finalCursor = cursor;
    const maxIterations = 100; // Increased to allow going through all files (100k files = 100 iterations of 1000)
    let iterations = 0;

    // Fetch larger batches to get more upload files (1000 at a time)
    while (allUploadFiles.length < requestedLimit && hasMore && iterations < maxIterations) {
      iterations++;

      const { blobs, cursor: nextCursor, hasMore: moreAvailable } = await list({
        prefix: 'audio/',
        limit: 1000, // Fetch 1000 at a time
        cursor: finalCursor,
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

      // Filter to only show upload type files (exclude record type)
      // Files with 'upload' in the name
      const uploadFiles = blobsWithStatus.filter(b =>
        b.filename.toLowerCase().includes('upload')
      );

      allUploadFiles = [...allUploadFiles, ...uploadFiles];
      finalCursor = nextCursor;
      hasMore = moreAvailable;

      // If we have no more files from the blob storage, break
      if (!moreAvailable) {
        break;
      }
    }

    // Apply filters on upload files only
    let filteredBlobs = allUploadFiles;
    if (filter === 'unwatched') {
      filteredBlobs = allUploadFiles.filter(b => !b.status.watched);
    } else if (filter === 'upvoted') {
      filteredBlobs = allUploadFiles.filter(b => b.status.vote === 'up');
    } else if (filter === 'downvoted') {
      filteredBlobs = allUploadFiles.filter(b => b.status.vote === 'down');
    }

    // Limit to requested amount
    const limitedBlobs = filteredBlobs.slice(0, requestedLimit);

    return NextResponse.json({
      blobs: limitedBlobs,
      cursor: finalCursor,
      hasMore: hasMore && iterations < maxIterations,
      total: limitedBlobs.length,
    });
  } catch (error) {
    console.error('Error listing audio files:', error);
    return NextResponse.json(
      { error: 'Failed to list audio files' },
      { status: 500 }
    );
  }
}

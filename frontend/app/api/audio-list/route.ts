import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { kv } from '@vercel/kv';

export const runtime = 'edge';

interface AudioStatus {
  watched: boolean;
  vote: 'up' | 'down' | null;
  timestamp: number;
  comment?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const blobCursor = searchParams.get('cursor') || undefined;
    const requestedLimit = parseInt(searchParams.get('limit') || '50');
    const filter = searchParams.get('filter'); // 'unwatched', 'upvoted', 'downvoted', 'all'

    console.log(`Fetching from blob storage, cursor: ${blobCursor || 'start'}`);

    // Fetch batches until we have enough upload files to return
    let uploadFiles: any[] = [];
    let currentCursor: string | undefined = blobCursor;
    let hasMoreBlobs = true;
    let iterations = 0;
    const maxIterations = 20; // Safety limit

    // Keep fetching until we have enough unwatched upload files OR we run out of blobs
    while (uploadFiles.length < requestedLimit * 2 && hasMoreBlobs && iterations < maxIterations) {
      iterations++;
      console.log(`Fetching batch ${iterations}, current uploads: ${uploadFiles.length}`);

      // @ts-ignore - type issue with destructuring
      const { blobs, cursor: nextCursor, hasMore: moreAvailable } = await list({
        prefix: 'audio/',
        limit: 1000, // Fetch 1000 at a time from blob
        cursor: currentCursor,
      });

      // Filter for upload files immediately
      const batchUploadFiles = blobs.filter(b =>
        b.pathname.toLowerCase().includes('upload')
      );

      console.log(`Batch ${iterations}: ${blobs.length} total, ${batchUploadFiles.length} uploads`);

      uploadFiles = [...uploadFiles, ...batchUploadFiles];
      currentCursor = nextCursor;
      hasMoreBlobs = moreAvailable;
    }

    console.log(`Found ${uploadFiles.length} upload files after ${iterations} iterations`);

    // Sort by uploadedAt (oldest first) for systematic review
    uploadFiles.sort((a, b) =>
      new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    );

    // Get status for files from KV
    const filesWithStatus = await Promise.all(
      uploadFiles.map(async (blob) => {
        try {
          const filename = blob.pathname;
          const status = await kv.get<AudioStatus>(`audio:${filename}`);

          return {
            url: blob.url,
            filename: blob.pathname,
            uploadedAt: blob.uploadedAt,
            size: blob.size,
            status: status || { watched: false, vote: null, timestamp: 0 },
          };
        } catch (error) {
          console.error(`Error getting status for ${blob.pathname}:`, error);
          return {
            url: blob.url,
            filename: blob.pathname,
            uploadedAt: blob.uploadedAt,
            size: blob.size,
            status: { watched: false, vote: null, timestamp: 0 },
          };
        }
      })
    );

    console.log(`KV lookups completed for ${filesWithStatus.length} files`);

    // Apply filters
    let filteredBlobs = filesWithStatus;
    if (filter === 'unwatched') {
      filteredBlobs = filesWithStatus.filter(b => !b.status.watched);
    } else if (filter === 'upvoted') {
      filteredBlobs = filesWithStatus.filter(b => b.status.vote === 'up');
    } else if (filter === 'downvoted') {
      filteredBlobs = filesWithStatus.filter(b => b.status.vote === 'down');
    }

    console.log(`Filtered files (${filter}): ${filteredBlobs.length}`);

    // Return up to requestedLimit
    const paginatedBlobs = filteredBlobs.slice(0, requestedLimit);

    console.log(`Returning ${paginatedBlobs.length} files, nextCursor: ${currentCursor || 'end'}`);

    return NextResponse.json({
      blobs: paginatedBlobs,
      cursor: currentCursor, // Blob cursor for next batch
      hasMore: hasMoreBlobs || filteredBlobs.length > requestedLimit,
      total: uploadFiles.length, // Uploads found in this batch
    });
  } catch (error) {
    console.error('Error listing audio files:', error);
    return NextResponse.json(
      { error: 'Failed to list audio files' },
      { status: 500 }
    );
  }
}

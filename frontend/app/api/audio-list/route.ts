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
    const offset = parseInt(searchParams.get('offset') || '0');
    const requestedLimit = parseInt(searchParams.get('limit') || '50');
    const filter = searchParams.get('filter'); // 'unwatched', 'upvoted', 'downvoted', 'all'

    // Fetch ALL files from blob storage (no limit)
    console.log('Fetching all audio files from blob storage...');
    let allFiles: any[] = [];
    let hasMore = true;
    let blobCursor: string | undefined = undefined;
    let iterations = 0;

    // Fetch ALL files in batches of 1000
    while (hasMore) {
      iterations++;
      console.log(`Fetching batch ${iterations}...`);

      // @ts-ignore - type issue with destructuring
      const { blobs, cursor: nextCursor, hasMore: moreAvailable } = await list({
        prefix: 'audio/',
        limit: 1000,
        cursor: blobCursor,
      });

      allFiles = [...allFiles, ...blobs];
      blobCursor = nextCursor;
      hasMore = moreAvailable;

      // Safety limit to prevent infinite loops (max 30k files)
      if (iterations >= 30) {
        console.log('Hit max iterations limit');
        break;
      }
    }

    console.log(`Total files fetched: ${allFiles.length}`);

    // Filter to only upload files
    const uploadFiles = allFiles.filter(b =>
      b.pathname.toLowerCase().includes('upload')
    );

    console.log(`Upload files found: ${uploadFiles.length}`);

    // Get status for upload files from KV
    const uploadFilesWithStatus = await Promise.all(
      uploadFiles.map(async (blob) => {
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

    // Apply filters on upload files only
    let filteredBlobs = uploadFilesWithStatus;
    if (filter === 'unwatched') {
      filteredBlobs = uploadFilesWithStatus.filter(b => !b.status.watched);
    } else if (filter === 'upvoted') {
      filteredBlobs = uploadFilesWithStatus.filter(b => b.status.vote === 'up');
    } else if (filter === 'downvoted') {
      filteredBlobs = uploadFilesWithStatus.filter(b => b.status.vote === 'down');
    }

    console.log(`Filtered files (${filter}): ${filteredBlobs.length}`);

    // Paginate using offset
    const paginatedBlobs = filteredBlobs.slice(offset, offset + requestedLimit);
    const hasMoreResults = offset + requestedLimit < filteredBlobs.length;

    console.log(`Returning ${paginatedBlobs.length} files, hasMore: ${hasMoreResults}`);

    return NextResponse.json({
      blobs: paginatedBlobs,
      offset: offset + paginatedBlobs.length,
      hasMore: hasMoreResults,
      total: filteredBlobs.length,
      totalUploadFiles: uploadFiles.length,
    });
  } catch (error) {
    console.error('Error listing audio files:', error);
    return NextResponse.json(
      { error: 'Failed to list audio files' },
      { status: 500 }
    );
  }
}

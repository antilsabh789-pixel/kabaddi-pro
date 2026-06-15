import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileData, fileName, fileType, userId, folder } = body as {
      fileData: string;
      fileName: string;
      fileType: string;
      userId: string;
      folder?: string; // 'avatars' | 'teams' | etc.
    };

    if (!fileData || !fileName || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (fileType && !allowedTypes.includes(fileType)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, WebP, GIF allowed.' }, { status: 400 });
    }

    // Extract base64 data from data URL
    const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: 'Invalid file data format' }, { status: 400 });
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Determine upload folder
    const uploadFolder = folder || 'avatars';
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', uploadFolder);

    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = fileName.split('.').pop() || 'png';
    const timestamp = Date.now();
    const safeUserId = userId.replace(/[^a-zA-Z0-9]/g, '_');
    const uniqueFileName = `${safeUserId}_${timestamp}.${ext}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    // Write file
    await writeFile(filePath, buffer);

    // Construct URL — use the API route for serving files
    const url = `/api/uploads/${uploadFolder}/${uniqueFileName}`;

    // Update user avatar in DB if it's an avatar upload
    if (uploadFolder === 'avatars' && userId) {
      try {
        await db.user.update({
          where: { id: userId },
          data: { avatar: url },
        });
      } catch (dbError) {
        console.error('Failed to update user avatar in DB:', dbError);
        // Still return success — the file was saved
      }
    }

    return NextResponse.json({
      success: true,
      url,
      fileName: uniqueFileName,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 }
    );
  }
}

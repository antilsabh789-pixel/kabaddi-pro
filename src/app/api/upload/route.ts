import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let fileData: string;
    let fileName: string;
    let fileType: string;
    let folder = 'avatars';

    if (contentType.includes('multipart/form-data')) {
      // FormData upload (e.g., from MatchPhotoGalleryScreen)
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      fileName = file.name;
      fileType = file.type;

      // Convert File to base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fileData = `data:${fileType};base64,${buffer.toString('base64')}`;

      // Check for folder in formData
      const folderValue = formData.get('folder');
      if (folderValue && typeof folderValue === 'string') {
        folder = folderValue;
      }
    } else {
      // JSON upload (e.g., from ProfileTab, TeamManagementScreen)
      const body = await request.json();
      fileData = body.fileData;
      fileName = body.fileName;
      fileType = body.fileType;
      if (body.folder) folder = body.folder;
    }

    if (!fileData || !fileName) {
      return NextResponse.json({ error: 'Missing file data or filename' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, WebP, GIF allowed.' }, { status: 400 });
    }

    // Extract base64 data
    const base64Match = fileData.match(/^data:image\/[a-z]+;base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json({ error: 'Invalid base64 data' }, { status: 400 });
    }

    const base64Data = base64Match[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size (5MB max)
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB allowed.' }, { status: 400 });
    }

    // Generate unique filename
    const ext = fileType.split('/')[1] || 'jpg';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const uniqueFileName = `${timestamp}-${randomSuffix}.${ext}`;

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
    await mkdir(uploadDir, { recursive: true });

    // Write file
    const filePath = path.join(uploadDir, uniqueFileName);
    await writeFile(filePath, buffer);

    // Return the URL that matches the GET route pattern
    const url = `/api/uploads/${folder}/${uniqueFileName}`;

    return NextResponse.json({ url, fileName: uniqueFileName });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

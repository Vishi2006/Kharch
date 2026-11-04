import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const localApkPath = path.join(process.cwd(), 'public', 'companion', 'KharchCompanion.apk');
  const altApkPath = path.join(process.cwd(), 'public', 'KharchCompanion.apk');

  const finalPath = fs.existsSync(localApkPath)
    ? localApkPath
    : fs.existsSync(altApkPath)
    ? altApkPath
    : null;

  if (finalPath) {
    const fileBuffer = fs.readFileSync(finalPath);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="KharchCompanion.apk"',
      },
    });
  }

  // Fallback: redirect to GitHub release
  return NextResponse.redirect(
    'https://github.com/Vishi2006/Kharch/releases/latest/download/KharchCompanion.apk',
    { status: 302 }
  );
}

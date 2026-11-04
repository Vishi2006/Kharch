import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Prefer the signed release build; fall back to legacy name for compatibility.
  const candidates = [
    path.join(process.cwd(), 'public', 'companion', 'app-release.apk'),
    path.join(process.cwd(), 'public', 'companion', 'KharchCompanion.apk'),
    path.join(process.cwd(), 'public', 'app-release.apk'),
    path.join(process.cwd(), 'public', 'KharchCompanion.apk'),
  ];

  const finalPath = candidates.find((p) => fs.existsSync(p)) ?? null;

  if (finalPath) {
    const fileBuffer = fs.readFileSync(finalPath);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        // Always delivered as KharchCompanion.apk to the user regardless of source filename.
        'Content-Disposition': 'attachment; filename="KharchCompanion.apk"',
      },
    });
  }

  // Fallback: redirect to GitHub release (serves app-release.apk from CI)
  return NextResponse.redirect(
    'https://github.com/Vishi2006/Kharch/releases/latest/download/KharchCompanion.apk',
    { status: 302 }
  );
}

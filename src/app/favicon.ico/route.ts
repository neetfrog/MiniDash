import { NextResponse } from 'next/server';

export async function GET() {
  // Provide a minimal non-404 response for browsers requesting favicon.ico.
  return new NextResponse(null, { status: 204 });
}

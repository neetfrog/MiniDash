import { NextResponse } from 'next/server';
import type { QuoteOfTheDay, ApiResponse } from '@/types/api';

export async function GET() {
  try {
    // Use Type.fit API for quotes and avoid caching the external response to keep quotes fresh.
    const response = await fetch('https://type.fit/api/quotes', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error('Quote service unavailable');
    }

    const quotes = await response.json();
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    const result: ApiResponse<QuoteOfTheDay> = {
      data: {
        text: randomQuote.text,
        author: randomQuote.author,
      },
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Quote API error:', error);

    const result: ApiResponse<QuoteOfTheDay> = {
      data: null,
      error: 'Unable to fetch quote. Please try again later.',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result, { status: 500 });
  }
}

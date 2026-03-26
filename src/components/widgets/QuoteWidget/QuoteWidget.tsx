'use client';

import { useState, useEffect } from 'react';
import type { QuoteOfTheDay, ApiResponse } from '@/types/api';
import styles from './QuoteWidget.module.css';

export default function QuoteWidget() {
  const [quote, setQuote] = useState<QuoteOfTheDay | null>(null);

  useEffect(() => {
    fetchQuote();
  }, []);

  async function fetchQuote() {
    try {
      // Fetch directly from public API instead of backend
      // Bypasses potential Vercel IP blocking
      const response = await fetch('https://type.fit/api/quotes', {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Quote service unavailable');
      }

      const quotes = await response.json();
      if (Array.isArray(quotes) && quotes.length > 0) {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        setQuote({
          text: randomQuote.text,
          author: randomQuote.author || 'Unknown',
        });
      }
    } catch (err) {
      console.error('Failed to fetch quote:', err);
    }
  }

  if (!quote) return null;

  const copyQuote = async () => {
    try {
      await navigator.clipboard.writeText(`${quote.text} — ${quote.author}`);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.quote}>
        {quote.text}
      </div>
      <div className={styles.authorRow}>
        <span className={styles.author}>— {quote.author}</span>
        <div className={styles.authorActions}>
          <button onClick={fetchQuote} className={styles.iconButton} aria-label="New Quote">
            ↻
          </button>
          <button onClick={copyQuote} className={styles.iconButton} aria-label="Copy Quote">
            📋
          </button>
        </div>
      </div>
    </div>
  );
}

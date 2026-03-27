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
      const response = await fetch('/api/quote');

      if (!response.ok) {
        throw new Error('Quote service unavailable');
      }

      const result = await response.json();
      if (!result || result.error || !result.data) {
        throw new Error(result?.error || 'Invalid quote payload');
      }

      setQuote({
        text: result.data.text,
        author: result.data.author || 'Unknown',
      });
    } catch (err) {
      console.error('Failed to fetch quote:', err);
      setQuote({
        text: 'Stay positive, work hard, make it happen.',
        author: 'Unknown',
      });
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

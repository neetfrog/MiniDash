'use client';

import { useState, useEffect } from 'react';
import type { HackerNewsItem } from '@/types/api';
import TerminalBox from '@/components/ui/TerminalBox';
import styles from './HackerNewsWidget.module.css';

const STORY_TYPES = ['top', 'new', 'best', 'ask', 'show'];

function formatScore(score: number): string {
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}k`;
  }
  return score.toString();
}

function timeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const seconds = now - timestamp;

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function getDomain(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain.length > 25 ? domain.substring(0, 22) + '...' : domain;
  } catch {
    return 'news.ycombinator.com';
  }
}

export default function HackerNewsWidget() {
  const [storyType, setStoryType] = useState('top');
  const [stories, setStories] = useState<HackerNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStories();
  }, [storyType]);

  async function fetchStories() {
    setLoading(true);
    setError(null);
    setStories([]);

    try {
      // Fetch directly from HackerNews Firebase API (no Vercel backend needed)
      const storiesUrl = `https://hacker-news.firebaseio.com/v0/${storyType}stories.json`;
      const storiesResponse = await fetch(storiesUrl);

      if (!storiesResponse.ok) {
        throw new Error('HackerNews API unavailable');
      }

      const storyIds: number[] = await storiesResponse.json();
      const topIds = storyIds.slice(0, 10);

      // Fetch individual stories in parallel
      const storyPromises = topIds.map(async (id) => {
        try {
          const itemUrl = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
          const itemResponse = await fetch(itemUrl);
          return itemResponse.json();
        } catch (err) {
          return null;
        }
      });

      const storyData = await Promise.all(storyPromises);
      const hnItems: HackerNewsItem[] = storyData
        .filter((item) => item && item.title)
        .map((item) => ({
          id: item.id,
          title: item.title,
          url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
          score: item.score || 0,
          by: item.by || 'unknown',
          time: item.time,
          descendants: item.descendants || 0,
          type: item.type,
        }));

      if (hnItems.length > 0) {
        setStories(hnItems);
      } else {
        throw new Error('No HackerNews items available');
      }
    } catch (err) {
      setError('Unable to fetch HackerNews data');
    } finally {
      setLoading(false);
    }
  }

  return (
    <TerminalBox
      title="hackernews --stories"
      icon="🔶"
      status={`${stories?.length || 0} stories`}
      loading={loading}
      error={loading ? null : error}
    >
      <div className={styles.container}>
        <div className={styles.tabs}>
          {STORY_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setStoryType(type)}
              className={`${styles.tab} ${storyType === type ? styles.active : ''}`}
            >
              [{type}]
            </button>
          ))}
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thRank}>#</th>
              <th className={styles.thScore}>pts</th>
              <th className={styles.thTitle}>title</th>
              <th className={styles.thMeta}>meta</th>
            </tr>
          </thead>
          <tbody>
            {(stories || []).map((story, index) => (
              <tr key={story.id} className={styles.row}>
                <td className={styles.rank}>{index + 1}</td>
                <td className={styles.score}>{formatScore(story.score)}</td>
                <td className={styles.title}>
                  <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                  >
                    {story.title}
                  </a>
                  <span className={styles.domain}>({getDomain(story.url)})</span>
                </td>
                <td className={styles.meta}>
                  <span className={styles.by}>{story.by}</span>
                  <a
                    href={`https://news.ycombinator.com/item?id=${story.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.comments}
                  >
                    {story.descendants}c
                  </a>
                  <span className={styles.time}>{timeAgo(story.time)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TerminalBox>
  );
}

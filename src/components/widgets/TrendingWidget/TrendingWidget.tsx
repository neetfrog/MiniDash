'use client';

import { useState, useEffect } from 'react';
import type { SocialTrending, ApiResponse } from '@/types/api';
import TerminalBox from '@/components/ui/TerminalBox';
import { TrendingUp } from 'lucide-react';
import styles from './TrendingWidget.module.css';

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}

function normalizeHashtag(name: string): string {
  const normalized = name.replace(/^#+/, '');
  return `#${normalized}`;
}

function normalizeTopicUrl(topic: { url?: string; name: string }) {
  if (topic.url) return topic.url;
  const tag = topic.name.replace(/^#+/, '');
  return `https://x.com/hashtag/${encodeURIComponent(tag)}`;
}

export default function TrendingWidget() {
  const [trending, setTrending] = useState<SocialTrending | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'github' | 'twitter'>('github');

  useEffect(() => {
    fetchTrending();
  }, []);

  async function fetchTrending() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/trending');
      const result: ApiResponse<SocialTrending> = await response.json();

      if (result.data) {
        setTrending(result.data);
      }
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch trending data');
    } finally {
      setLoading(false);
    }
  }

  return (
    <TerminalBox
      title="trending --social"
      icon={<TrendingUp size={18} />}
      status="live"
      loading={loading}
      error={loading ? null : error}
    >
      <div className={styles.container}>
        <div className={styles.tabs}>
          <button
            onClick={() => setActiveTab('github')}
            className={`${styles.tab} ${activeTab === 'github' ? styles.active : ''}`}
          >
            [github]
          </button>
          <button
            onClick={() => setActiveTab('twitter')}
            className={`${styles.tab} ${activeTab === 'twitter' ? styles.active : ''}`}
          >
            [twitter/X]
          </button>
        </div>

        {trending && activeTab === 'github' && (
          <ul className={styles.list}>
            {trending.github.map((repo) => (
              <li key={repo.name} className={styles.item}>
                <div className={styles.score}>
                  <span className={styles.scoreValue}>★</span>
                  <span className={styles.scoreMeta}>{formatNumber(repo.stars)}</span>
                </div>
                <div className={styles.repoContent}>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.repoName}
                  >
                    {repo.name}
                  </a>
                  <span className={styles.repoDesc}>{repo.description}</span>
                  <div className={styles.repoMeta}>
                    <span className={styles.language}>{repo.language}</span>
                    <span>{formatNumber(repo.stars)} stars</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {trending && activeTab === 'twitter' && (
          <ul className={styles.list}>
            {trending.twitter.map((topic) => (
              <li key={topic.id} className={styles.item}>
                <div className={styles.score}>
                  <span className={styles.scoreValue}>•</span>
                  <span className={styles.scoreMeta}>
                    {typeof topic.volume === 'number' ? formatNumber(topic.volume) : ''}
                  </span>
                </div>
                <div className={styles.content}>
                  <a
                    href={normalizeTopicUrl(topic)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.hashtag}
                  >
                    {normalizeHashtag(topic.name)}
                  </a>
                  <span className={styles.topicDesc}>{topic.description}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TerminalBox>
  );
}

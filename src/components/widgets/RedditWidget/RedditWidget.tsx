'use client';

import { useState, useEffect } from 'react';
import type { RedditPost, ApiResponse } from '@/types/api';
import TerminalBox from '@/components/ui/TerminalBox';
import { MessageCircle } from 'lucide-react';
import styles from './RedditWidget.module.css';

const SUBREDDITS = ['all', 'programming', 'technology', 'science', 'worldnews', 'todayilearned'];
const SORT_OPTIONS = ['hot', 'top', 'new', 'rising'];

interface RedditWidgetProps {
  subreddit?: string;
}

function formatScore(score: number): string {
  if (score >= 10000) {
    return `${(score / 1000).toFixed(1)}k`;
  }
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}k`;
  }
  return score.toString();
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function RedditWidget({ subreddit: initialSubreddit = 'all' }: RedditWidgetProps) {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subreddit, setSubreddit] = useState(initialSubreddit);
  const [sort, setSort] = useState('hot');

  useEffect(() => {
    setSubreddit(initialSubreddit);
  }, [initialSubreddit]);

  useEffect(() => {
    fetchPosts();
  }, [subreddit, sort]);

  async function fetchPostsDirectly(redditUrl: string) {
    try {
      const response = await fetch(redditUrl, {
        headers: {
          'User-Agent': 'minidash/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data?.data?.children) {
        return data.data.children
          .filter((child: any) => child?.kind === 't3' && child?.data)
          .map((child: any) => {
            const post = child.data;
            return {
              id: post.id,
              title: post.title,
              subreddit: post.subreddit,
              score: post.score,
              numComments: post.num_comments,
              url: post.url,
              permalink: `https://reddit.com${post.permalink}`,
              author: post.author,
              createdAt: new Date(post.created_utc * 1000).toISOString(),
            };
          });
      }
    } catch (err) {
      return null;
    }
  }

  async function fetchPosts() {
    setLoading(true);
    setError(null);
    setPosts([]);

    const query = `/r/${subreddit}/${sort}.json?limit=10&raw_json=1`;
    
    // Try multiple Reddit domains (different IPs, user's browser can reach some)
    const redditUrls = [
      `https://api.reddit.com${query}`,
      `https://www.reddit.com${query}`,
      `https://reddit.com${query}`,
      `https://old.reddit.com${query}`,
    ];

    let posts: RedditPost[] | null = null;

    // Try each URL in sequence
    for (const url of redditUrls) {
      posts = await fetchPostsDirectly(url);
      if (posts && posts.length > 0) {
        setPosts(posts);
        setLoading(false);
        return;
      }
    }

    // If all direct URLs fail, try CORS proxy
    const corsProxyUrl = `https://api.cors.sh/?url=${encodeURIComponent(`https://api.reddit.com${query}`)}`;
    posts = await fetchPostsDirectly(corsProxyUrl);
    
    if (posts && posts.length > 0) {
      setPosts(posts);
      setLoading(false);
      return;
    }

    // All methods failed
    setError('Unable to fetch Reddit posts. Please check your connection or try again.');
    setLoading(false);
  }

  return (
    <TerminalBox
      title={`reddit --r/${subreddit}`}
      icon={<MessageCircle size={14} />}
      status={`${posts.length} posts`}
      loading={loading}
      error={loading ? null : error}
    >
      <div className={styles.container}>
        <div className={styles.controls}>
          <div className={styles.subreddits}>
            <span className={styles.label}>r/</span>
            {SUBREDDITS.map((sub) => (
              <button
                key={sub}
                onClick={() => setSubreddit(sub)}
                className={`${styles.btn} ${subreddit === sub ? styles.active : ''}`}
              >
                {sub}
              </button>
            ))}
          </div>
          <div className={styles.sortOptions}>
            {SORT_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`${styles.sortBtn} ${sort === s ? styles.active : ''}`}
              >
                [{s}]
              </button>
            ))}
          </div>
        </div>

        <ul className={styles.list}>
          {posts.map((post, index) => (
            <li key={post.id} className={styles.item}>
              <div className={styles.score}>
                <span className={styles.scoreValue}>{formatScore(post.score)}</span>
                <span className={styles.scoreArrow}>▲</span>
              </div>
              <div className={styles.content}>
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.title}
                >
                  {post.title}
                </a>
                <div className={styles.meta}>
                  <span className={styles.subredditName}>r/{post.subreddit}</span>
                  <span>•</span>
                  <span>u/{post.author}</span>
                  <span>•</span>
                  <span>{post.numComments} comments</span>
                  <span>•</span>
                  <span>{timeAgo(post.createdAt)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </TerminalBox>
  );
}

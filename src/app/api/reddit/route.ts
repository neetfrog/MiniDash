import { NextResponse } from 'next/server';
import type { RedditPost, ApiResponse } from '@/types/api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subreddit = searchParams.get('subreddit') || 'all';
  const sort = searchParams.get('sort') || 'hot'; // hot, new, top, rising
  const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10), 25);

  // prefer the official api.reddit.com endpoint (less likely to be blocked by hosting policies)
  const redditHosts = ['https://api.reddit.com', 'https://www.reddit.com'];
  const query = `/r/${subreddit}/${sort}.json?limit=${limit}&raw_json=1`;

  // if direct fetch fails on Vercel, fall back to public proxies (best-effort)
  const envProxy = process.env.REDDIT_PROXY_URL;
  const proxyPrefixes = [
    envProxy ? { prefix: envProxy, encode: true, name: 'env proxy' } : null,
    { prefix: 'https://thingproxy.freeboard.io/fetch/', encode: true, name: 'thingproxy' },
    { prefix: 'https://api.allorigins.win/raw?url=', encode: true, name: 'allorigins' },
  ].filter(Boolean) as Array<{ prefix: string; encode: boolean; name: string }>;

  if (process.env.ALLOW_UNTRUSTED_REDDIT_PROXY === 'true') {
    proxyPrefixes.push({ prefix: 'https://cors.bridged.cc/', encode: false, name: 'cors.bridged' });
  }

  function getUserAgent() {
    return (
      process.env.REDDIT_USER_AGENT ||
      'minimal-news/1.0 (by u/minimal-news-app) - contact: https://github.com/your-user/minimalNews'
    );
  }

  type ValidateJsonResponseResult =
    | { ok: true; text: string }
    | { ok: false; reason: string; body: string };

  async function validateJsonResponse(resp: Response): Promise<ValidateJsonResponseResult> {
    const contentType = resp.headers.get('content-type') || '';
    const text = await resp.text().catch(() => '');
    const isHtml = /<html|<body|<!doctype html/i.test(text);

    if (!resp.ok) {
      return {
        ok: false,
        reason: `HTTP ${resp.status} ${resp.statusText}`,
        body: text,
      };
    }

    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        reason: `Invalid content-type: ${contentType}`,
        body: text,
      };
    }

    if (isHtml) {
      return {
        ok: false,
        reason: 'Received HTML body (likely blocked page)',
        body: text,
      };
    }

    return {
      ok: true,
      text,
    };
  }

  async function fetchFromHost(host: string) {
    const redditUrl = `${host}${query}`;
    const response = await fetch(redditUrl, {
      headers: {
        'User-Agent': getUserAgent(),
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    return response;
  }

  try {
    let response: Response | null = null;
    let lastError: string | null = null;
    let redditBody: string | null = null;

    for (const host of redditHosts) {
      try {
        response = await fetchFromHost(host);
        const validation = await validateJsonResponse(response);

        if (validation.ok) {
          redditBody = validation.text;
          break;
        }

        lastError = `Reddit API unavailable from ${host}: ${validation.reason} - ${validation.body?.slice(0, 512)}`;

        if (response.status !== 403 && response.status !== 429) {
          // If non-rate-limited error (e.g. 404), no need to keep retrying
          break;
        }
      } catch (subError) {
        lastError = `Fetch failed for ${host}: ${(subError as Error).message}`;
      }
    }

    // If both official hosts fail, attempt public HTTP proxy to bypass Vercel network blocks
    if (!redditBody) {
      const targetUrl = `https://api.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&raw_json=1`;
      for (const proxy of proxyPrefixes) {
        try {
          const proxyUrl = proxy.encode
            ? `${proxy.prefix}${encodeURIComponent(targetUrl)}`
            : `${proxy.prefix}${targetUrl}`;

          response = await fetch(proxyUrl, {
            headers: {
              'User-Agent': getUserAgent(),
              'Accept': 'application/json',
            },
            next: { revalidate: 300 },
          });

          const validation = await validateJsonResponse(response);
          if (!validation.ok) {
            lastError = `Proxy API unavailable from ${proxyUrl}: ${validation.reason} - ${validation.body?.slice(0, 512)}`;
            continue;
          }

          redditBody = validation.text;
          break;
        } catch (proxyError) {
          lastError = `Proxy fetch failed for ${proxy.prefix}: ${(proxyError as Error).message}`;
          continue;
        }
      }
    }

    if (!redditBody) {
      throw new Error(
        `${lastError || 'Unknown Reddit fetch failure'}. ` +
        'Public proxies may be rate-limited on Vercel. Set REDDIT_PROXY_URL to your own proxy (recommended) and/or ALLOW_UNTRUSTED_REDDIT_PROXY=true if you need cors.bridged. ' +
        'For a production-grade fix, use authenticated Reddit API credentials and avoid anonymous proxy routes.'
      );
    }

    let data;
    try {
      data = JSON.parse(redditBody);
    } catch (parseError) {
      throw new Error(`Failed to parse Reddit JSON response: ${(parseError as Error).message}`);
    }

    const children = data?.data?.children ?? [];
    const posts: RedditPost[] = Array.isArray(children)
      ? children
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
          })
      : [];

    if (posts.length === 0) {
      throw new Error('No Reddit posts available');
    }

    const result: ApiResponse<RedditPost[]> = {
      data: posts,
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Reddit API error:', error);

    const result: ApiResponse<RedditPost[]> = {
      data: null,
      error: `Unable to fetch Reddit data: ${(error as Error).message}`,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result, { status: 502 });
  }
}

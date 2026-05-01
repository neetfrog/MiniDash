import { NextResponse } from 'next/server';
import type { SocialTrending, ApiResponse } from '@/types/api';
import * as cheerio from 'cheerio';

async function fetchGitHubTrending(): Promise<SocialTrending['github']> {
  try {
    const response = await fetch('https://github.com/trending', {
      headers: {
        'User-Agent': 'MiniDash/1.0',
      },
    });

    if (!response.ok) {
      throw new Error('GitHub trending fetch error');
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const repos: SocialTrending['github'] = [];

    $('article.Box-row').each((index, element) => {
      if (index >= 10) return false; // Limit to 10 repos

      const $article = $(element);
      const title = $article.find('h2 a').text().trim().replace(/\s+/g, ' ');
      const description = $article.find('p').text().trim();
      const language = $article.find('[itemprop="programmingLanguage"]').text().trim();
      const starsText = $article.find('a[href*="stargazers"]').text().trim();
      const stars = parseInt(starsText.replace(/,/g, '')) || 0;
      const url = 'https://github.com' + $article.find('h2 a').attr('href');

      repos.push({
        name: title,
        description: description || 'No description',
        language: language || 'Unknown',
        stars,
        url,
      });
    });

    return repos;
  } catch (error) {
    console.error('GitHub trending error:', error);
    throw error;
  }
}

async function fetchTwitterTrending(): Promise<SocialTrending['twitter']> {
  try {
    const response = await fetch('https://trends24.in/united-states/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      console.error('Twitter trends fetch error:', response.status, response.statusText);
      throw new Error('Twitter trends fetch error');
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const trends: SocialTrending['twitter'] = [];

    $('ol li a').each((index, element) => {
      if (index >= 10) return false;

      const $a = $(element);
      const text = $a.text().trim();
      const trendName = text ? '#' + text : '';

      if (trendName && trendName.length > 1) {
        trends.push({
          id: trendName,
          name: trendName,
          category: 'Trending',
          url: `https://twitter.com/search?q=${encodeURIComponent(trendName)}`,
        });
      }
    });

    return trends;
  } catch (error) {
    console.error('Twitter trending error:', error);
    throw error;
  }
}

export async function GET() {
  try {
    const [github, twitter] = await Promise.all([
      fetchGitHubTrending(),
      fetchTwitterTrending(),
    ]);

    if (github.length === 0 || twitter.length === 0) {
      throw new Error('No trending data available');
    }

    const result: ApiResponse<SocialTrending> = {
      data: {
        github,
        twitter,
      },
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Trending API error:', error);

    const result: ApiResponse<SocialTrending> = {
      data: null,
      error: 'Unable to fetch trending data. Please try again later.',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result, { status: 500 });
  }
}

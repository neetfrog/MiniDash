import { apiFetch } from '@/utils/api';
import type { ApiResponse, WeatherData, NewsItem, HackerNewsItem, TrendingTopic, QuoteOfTheDay } from '@/types/api';

const WEATHER_ASCII: Record<string, string> = {
  Clear: `
    \\   /
     .-.
  ― (   ) ―
     \'-'
    /   \\
`,
  Sunny: `
    \\   /
     .-.
  ― (   ) ―
     \'-'
    /   \\
`,
  'Partly cloudy': `
   \\  /
 _ /"".-.
   \\_(   ).
   /(___(__) 
`,
  Cloudy: `
     .--.
  .-(    ).
 (___.__)__)
`,
  Overcast: `
     .--.
  .-(    ).
 (___.__)__)
`,
  Rain: `
     .--.
  .-(    ).
 (___.__)__)
  ' ' ' '
 ' ' ' '
`,
  'Light rain': `
     .--.
  .-(    ).
 (___.__)__)
    ' ' '
`,
  Snow: `
     .--.
  .-(    ).
 (___.__)__)
   * * * *
  * * * *
`,
  'Light snow': `
     .--.
  .-(    ).
 (___.__)__)
    * * *
`,
  Thunderstorm: `
     .--.
  .-(    ).
 (___.__)__)
    ⚡⚡
   ' ' ' '
`,
  Mist: `
  _ - _ - _
   _ - _ -
  _ - _ - _
`,
  Fog: `
  _ - _ - _
   _ - _ -
  _ - _ - _
`,
};

function getWeatherAscii(condition: string): string {
  for (const [key, art] of Object.entries(WEATHER_ASCII)) {
    if (condition.toLowerCase().includes(key.toLowerCase())) {
      return art;
    }
  }
  return WEATHER_ASCII['Cloudy'];
}

const CLI_START_TIME = typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now();

function formatUptime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function getBrowserName(userAgent: string) {
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/OPR\//.test(userAgent) || /Opera/.test(userAgent)) return 'Opera';
  if (/Chrome\//.test(userAgent) && !/Chromium/.test(userAgent)) return 'Chrome';
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  return 'Unknown';
}

function getPlatformInfo() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      os: 'Unknown',
      browser: 'Unknown',
      screen: '0x0',
      viewport: '0x0',
      platform: 'Unknown',
      cpuCores: 'Unavailable',
      deviceMemory: 'Unavailable',
      languages: 'Unknown',
      timeZone: 'Unknown',
      userAgent: 'Unknown',
    };
  }

  const ua = navigator.userAgent || 'Unknown';
  const platform = navigator.platform || 'Unknown';
  const screen = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  const viewport = `${window.innerWidth || 0}x${window.innerHeight || 0}`;

  let os = 'Unknown';
  if (platform.includes('Win')) os = 'Windows';
  else if (platform.includes('Mac')) os = 'macOS';
  else if (platform.includes('Linux')) os = 'Linux';

  return {
    os,
    browser: getBrowserName(ua),
    screen,
    viewport,
    platform,
    cpuCores: (navigator as any).hardwareConcurrency || 'Unavailable',
    deviceMemory: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'Unavailable',
    languages: (navigator.languages && navigator.languages.length) ? navigator.languages.join(', ') : navigator.language || 'Unknown',
    timeZone: Intl?.DateTimeFormat?.().resolvedOptions()?.timeZone || 'Unknown',
    userAgent: ua,
  };
}

async function getBatteryStatus() {
  if (typeof navigator === 'undefined' || !(navigator as any).getBattery) {
    return 'Unavailable';
  }

  try {
    const battery = await (navigator as any).getBattery();
    const level = Math.round(battery.level * 100);
    const charging = battery.charging ? ' (charging)' : '';
    return `${level}%${charging}`;
  } catch {
    return 'Unavailable';
  }
}

async function getStorageStatus() {
  if (typeof navigator === 'undefined' || !(navigator as any).storage?.estimate) {
    return 'Unavailable';
  }

  try {
    const estimate = await (navigator as any).storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const usedMb = Math.round(used / 1024 / 1024);
    const quotaMb = Math.round(quota / 1024 / 1024);
    const percent = quota ? Math.round((used / quota) * 100) : 0;
    return `${usedMb}MB / ${quotaMb}MB (${percent}%)`;
  } catch {
    return 'Unavailable';
  }
}

const TODO_STORAGE_KEY = 'minimalstuff-todos';
const CLOCKS_STORAGE_KEY = 'minidash-world-clocks';
const DEFAULT_CLOCK_ZONES = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];

async function getConnectionInfo() {
  if (typeof navigator === 'undefined') return 'Unavailable';
  const conn = (navigator as any).connection;
  if (!conn) return 'Unavailable';
  const parts: string[] = [];
  if (conn.effectiveType) parts.push(conn.effectiveType);
  if (conn.downlink) parts.push(`${conn.downlink}Mb/s`);
  if (conn.rtt) parts.push(`${conn.rtt}ms RTT`);
  return parts.join(' | ') || 'Unknown';
}

function getTodoList() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const payload = localStorage.getItem(TODO_STORAGE_KEY);
    return payload ? JSON.parse(payload) as { id: string; text: string; completed: boolean }[] : [];
  } catch {
    return [];
  }
}

function saveTodoList(todos: { id: string; text: string; completed: boolean }[]) {
  if (typeof localStorage === 'undefined') return todos;
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // ignore
  }
  return todos;
}

function getClockZones() {
  if (typeof localStorage === 'undefined') return DEFAULT_CLOCK_ZONES;
  try {
    const payload = localStorage.getItem(CLOCKS_STORAGE_KEY);
    if (!payload) return DEFAULT_CLOCK_ZONES;
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed) && parsed.every((zone) => typeof zone === 'string')) {
      return parsed.length > 0 ? parsed : DEFAULT_CLOCK_ZONES;
    }
  } catch {
    // ignore invalid storage data
  }
  return DEFAULT_CLOCK_ZONES;
}

function normalizeClockTimeZone(timeZone: string) {
  const cleaned = timeZone.trim().replace(/\s+/g, '_');
  if (!cleaned) return null;
  const zones = getClockZones();
  const lower = cleaned.toLowerCase();

  const exact = zones.find((zone) => zone.toLowerCase() === lower);
  if (exact) return exact;

  const suffix = zones.find((zone) => zone.toLowerCase().endsWith(`/${lower}`));
  if (suffix) return suffix;

  const fuzzy = zones.find((zone) => zone.toLowerCase().replace(/[_/]+/g, ' ').includes(lower.replace(/[_/]+/g, ' ')));
  if (fuzzy) return fuzzy;

  return cleaned;
}

function formatZoneTime(date: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone,
    }).format(date);
  } catch {
    return date.toLocaleTimeString('en-US', { hour12: false });
  }
}

// Utility functions for CLI commands
export const commandUtils = {
  async fetchWeather(location: string) {
    const res: ApiResponse<WeatherData> = await apiFetch(`/api/weather?location=${encodeURIComponent(location)}`);
    if (res.data) {
      const weather = res.data;
      const forecastLines = weather.forecast.slice(0, 3).map((day) => {
        const date = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
        return `${date}: ${day.high}°/${day.low}° ${day.condition}`;
      }).join('\n');
      return `${getWeatherAscii(weather.current.condition)}\nLocation: ${weather.location}\n${weather.current.temp}°C (feels like ${weather.current.feels_like}°C)\n${weather.current.condition}\nHumidity: ${weather.current.humidity}%\nWind: ${weather.current.wind_speed} km/h ${weather.current.wind_direction}\nVisibility: ${weather.current.visibility} km\n\n3-day forecast:\n${forecastLines}\n\nLast updated: ${new Date(weather.lastUpdated).toLocaleString()}`;
    }
    throw new Error('No weather data available');
  },

  async fetchCrypto(symbols: string = 'BTC,ETH,SOL,DOGE') {
    const ids = symbols.split(/[\s,]+/).filter(Boolean).join(',');
    const res: ApiResponse<Record<string, any>> = await apiFetch(`/api/crypto?ids=${encodeURIComponent(ids)}`);
    if (res.data) {
      const lines = Object.values(res.data).map((item: any) => {
        const symbol = (item.id || item.symbol || '').toUpperCase();
        const usd = typeof item.usd === 'number' ? item.usd.toFixed(2) : 'N/A';
        const change24Value = Number(item.usd_24h_change);
        const change24 = !Number.isNaN(change24Value)
          ? `${change24Value < 0 ? '[[red]]' : change24Value > 0 ? '[[green]]' : ''}${change24Value.toFixed(2)}%${change24Value < 0 ? '[[/red]]' : change24Value > 0 ? '[[/green]]' : ''}`
          : 'N/A';
        const change7Value = Number(item.change1w);
        const change7 = !Number.isNaN(change7Value)
          ? `${change7Value < 0 ? '[[red]]' : change7Value > 0 ? '[[green]]' : ''}${change7Value.toFixed(2)}%${change7Value < 0 ? '[[/red]]' : change7Value > 0 ? '[[/green]]' : ''}`
          : null;
        const change30Value = Number(item.change1m);
        const change30 = !Number.isNaN(change30Value)
          ? `${change30Value < 0 ? '[[red]]' : change30Value > 0 ? '[[green]]' : ''}${change30Value.toFixed(2)}%${change30Value < 0 ? '[[/red]]' : change30Value > 0 ? '[[/green]]' : ''}`
          : null;
        const extras = [change7 ? `7d ${change7}` : null, change30 ? `30d ${change30}` : null].filter(Boolean).join(', ');
        return `${symbol}: $${usd} (24h ${change24}${extras ? `, ${extras}` : ''})`;
      }).join('\n');
      return `Crypto prices:\n${lines}`;
    }
    throw new Error(res.error || 'No crypto data available');
  },

  async fetchStocks(symbols: string = 'AAPL') {
    const query = symbols.split(/[\s,]+/).filter(Boolean).join(',');
    const res: ApiResponse<any[]> = await apiFetch(`/api/stocks?symbols=${encodeURIComponent(query)}`);
    if (res.data) {
      const lines = res.data.map((item: any) => {
        const symbol = item.symbol || 'UNKNOWN';
        const price = typeof item.price === 'number' ? item.price.toFixed(2) : 'N/A';
        const changeValue = Number(item.changePercent);
        const change = !Number.isNaN(changeValue)
          ? `${changeValue < 0 ? '[[red]]' : changeValue > 0 ? '[[green]]' : ''}${changeValue.toFixed(2)}%${changeValue < 0 ? '[[/red]]' : changeValue > 0 ? '[[/green]]' : ''}`
          : 'N/A';
        const change1wValue = Number(item.changePercent1w);
        const change1w = !Number.isNaN(change1wValue)
          ? `${change1wValue < 0 ? '[[red]]' : change1wValue > 0 ? '[[green]]' : ''}${change1wValue.toFixed(2)}%${change1wValue < 0 ? '[[/red]]' : change1wValue > 0 ? '[[/green]]' : ''}`
          : null;
        const change1mValue = Number(item.changePercent1m);
        const change1m = !Number.isNaN(change1mValue)
          ? `${change1mValue < 0 ? '[[red]]' : change1mValue > 0 ? '[[green]]' : ''}${change1mValue.toFixed(2)}%${change1mValue < 0 ? '[[/red]]' : change1mValue > 0 ? '[[/green]]' : ''}`
          : null;
        const extras = [change1w ? `7d ${change1w}` : null, change1m ? `30d ${change1m}` : null].filter(Boolean).join(', ');
        return `${symbol}: $${price} (${change}${extras ? `, ${extras}` : ''})`;
      }).join('\n');
      return `Stock quotes:\n${lines}`;
    }
    throw new Error(res.error || 'No stock data available');
  },

  async fetchNews(category: string, limit = 5) {
    const res: ApiResponse<NewsItem[]> = await apiFetch(`/api/news?category=${encodeURIComponent(category)}&limit=${limit}`);
    const items = res.data || [];
    if (items.length) {
      const out = items.map((it, idx: number) => `${idx + 1}. ${it.title}`).join('\n');
      return `Top ${items.length} ${category} headlines:\n${out}`;
    }
    return `No ${category} news available`;
  },

  async fetchHackerNews(limit = 5) {
    const res: ApiResponse<HackerNewsItem[]> = await apiFetch(`/api/hackernews?limit=${limit}`);
    const items = res.data || [];
    if (items.length) {
      const out = items.slice(0, limit).map((it: any, idx: number) => `${idx + 1}. ${it.title}`).join('\n');
      return `Top Hacker News:\n${out}`;
    }
    return 'No hackernews data';
  },

  async fetchTrending() {
    const res: ApiResponse<{ github: any[], twitter: TrendingTopic[] }> = await apiFetch('/api/trending');
    const data = res.data;
    if (data && data.github && data.github.length) {
      const out = data.github.slice(0, 5).map((g: any, idx: number) => `${idx + 1}. ${g.name} (${g.stars} ★)`).join('\n');
      return `Trending repos:\n${out}`;
    }
    return 'No trending data';
  },

  async fetchQuote() {
    const res: ApiResponse<QuoteOfTheDay> = await apiFetch('/api/quote');
    const q = res.data;
    if (q) {
      return `${q.text}\n— ${q.author || 'Unknown'}`;
    }
    return 'No quote available';
  },

  async fetchNeofetch() {
    const info = getPlatformInfo();
    const battery = await getBatteryStatus();
    const storage = await getStorageStatus();
    const connection = await getConnectionInfo();
    const uptime = formatUptime((typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()) - CLI_START_TIME);

    return [
      `OS: ${info.os}`,
      `Browser: ${info.browser}`,
      `Platform: ${info.platform}`,
      `Resolution: ${info.screen}`,
      `Viewport: ${info.viewport}`,
      `CPU cores: ${info.cpuCores}`,
      `Memory: ${info.deviceMemory}`,
      `Battery: ${battery}`,
      `Connection: ${connection}`,
      `Storage: ${storage}`,
      `Locale: ${info.languages}`,
      `Time zone: ${info.timeZone}`,
      `Uptime: ${uptime}`,
      `User agent: ${info.userAgent}`,
    ].join('\n');
  },

  async fetchTodo() {
    const todos = getTodoList();
    if (!todos) {
      return 'Unable to read todo list';
    }
    if (todos.length === 0) {
      return 'Your todo list is empty.';
    }
    const lines = todos.map((todo, index) => `${index + 1}. [${todo.completed ? 'x' : ' '}] ${todo.text}`);
    return `Your todo list:\n${lines.join('\n')}`;
  },

  async addTodo(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return 'Usage: todo add [task]';
    }
    const todos = getTodoList();
    const newTodo = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      completed: false,
    };
    saveTodoList([...todos, newTodo]);
    return `Added todo: ${trimmed}`;
  },

  async completeTodo(index: number) {
    const todos = getTodoList();
    if (todos.length === 0) {
      return 'Your todo list is empty.';
    }
    if (Number.isNaN(index) || index < 1 || index > todos.length) {
      return `Invalid todo index. Use a number between 1 and ${todos.length}.`;
    }
    todos[index - 1].completed = true;
    saveTodoList(todos);
    return `Marked todo #${index} as done: ${todos[index - 1].text}`;
  },

  async removeTodo(index: number) {
    const todos = getTodoList();
    if (todos.length === 0) {
      return 'Your todo list is empty.';
    }
    if (Number.isNaN(index) || index < 1 || index > todos.length) {
      return `Invalid todo index. Use a number between 1 and ${todos.length}.`;
    }
    const [removed] = todos.splice(index - 1, 1);
    saveTodoList(todos);
    return `Removed todo #${index}: ${removed.text}`;
  },

  async clearTodo() {
    saveTodoList([]);
    return 'Cleared all todos.';
  },

  async fetchClocks(location?: string) {
    const zones = getClockZones();
    const now = new Date();
    if (location) {
      const zone = normalizeClockTimeZone(location);
      if (!zone) {
        return `Timezone not found: ${location}`;
      }
      return `Time in ${zone}: ${formatZoneTime(now, zone)}`;
    }
    const lines = zones.map((zone) => `${zone}: ${formatZoneTime(now, zone)}`);
    return `World clocks:\n${lines.join('\n')}`;
  },

  async fetchReddit(subreddit: string, limit = 5) {
    const res: ApiResponse<any[]> = await apiFetch(`/api/reddit?subreddit=${encodeURIComponent(subreddit)}&limit=${limit}`);
    const items = res.data || [];
    if (items.length) {
      const out = items.map((it: any, idx: number) => `${idx + 1}. ${it.title}`).join('\n');
      return `Top posts from r/${subreddit}:\n${out}`;
    }
    return `No posts from r/${subreddit}`;
  },
};
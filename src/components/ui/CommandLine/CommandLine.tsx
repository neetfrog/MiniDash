'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { commandUtils } from '@/utils/commands';
import TypingAnimation from '@/components/ui/TypingAnimation';
import styles from './CommandLine.module.css';

interface CommandLineProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (command: string, args: string[]) => void;
}

interface CommandHistory {
  command: string;
  output: string;
  timestamp: Date;
}

interface CommandLineHistoryItem extends CommandHistory {
  id: string;
  type?: 'info' | 'success' | 'error' | 'loading' | 'command';
  isTypingComplete?: boolean;
  speed?: number;
  delay?: number;
  pendingCommand?: string;
  pendingArgs?: string[];
  pending?: boolean;
}

const COMMANDS = [
  'help - Show available commands',
  'weather [location] - Get weather for location',
  'news [category] - Get news (tech, business, sports, etc.)',
  'reddit [subreddit] - Get posts from subreddit',
  'hackernews - Get Hacker News top stories',
  'trending - Get trending topics',
  'quote - Get random quote',
  'neofetch - Show browser system info',
  'todo - Show your todo list',
  'crypto [symbols] - Get crypto prices for symbols (default BTC,ETH,SOL,DOGE)',
  'stocks [symbols] - Get stock quotes for symbols (default AAPL)',
  'theme [name] - Change theme (dark, light)',
  'clear - Clear terminal',
  'exit - Close CLI',
  'enable [widget] - Enable/hide the widget section',
  'disable [widget] - Disable/hide the widget section',
  'toggle [widget] - Toggle widget section visibility',
  'list - List available widgets',
];

const COMMAND_ALIASES: Record<string, string> = {
  q: 'quote',
  w: 'weather',
  n: 'news',
  r: 'reddit',
  h: 'help',
  ls: 'list',
  t: 'trending',
  hn: 'hackernews',
  c: 'crypto',
  s: 'stocks',
  nf: 'neofetch',
  td: 'todo',
  e: 'exit',
};

const COMMAND_NAMES = ['help', 'weather', 'news', 'reddit', 'hackernews', 'trending', 'quote', 'neofetch', 'todo', 'crypto', 'stocks', 'theme', 'clear', 'exit', 'enable', 'disable', 'toggle', 'list'];
const WIDGET_NAMES = ['weather', 'news', 'reddit', 'hackernews', 'trending', 'quote', 'crypto', 'clocks', 'todo', 'systeminfo'];

export default function CommandLine({ isOpen, onClose, onCommand }: CommandLineProps) {
  const { theme, setTheme, availableThemes } = useTheme();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandLineHistoryItem[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentLine, setCurrentLine] = useState(0);
  const [hideInput, setHideInput] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHideInput(true);
      setShowPlaceholder(true);
      setHistory([]);
      setCurrentLine(0);
      addToHistory('', 'MiniDash CLI v1.0.0\nType "help" for available commands.\n');
    }
  }, [isOpen]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    const hasIncomplete = history.some(item => item.isTypingComplete === false || item.pending);
    setHideInput(hasIncomplete);
  }, [history]);

  const addToHistory = useCallback((command: string, output: string, type: CommandLineHistoryItem['type'] = 'info', extra: Partial<CommandLineHistoryItem> = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setHistory(prev => [...prev, {
      id,
      command,
      output,
      timestamp: new Date(),
      type,
      isTypingComplete: false,
      ...extra,
    }]);
    return id;
  }, []);

  const updateHistory = useCallback((id: string, output: string, type?: CommandLineHistoryItem['type']) => {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, output, type: type ?? h.type } : h));
  }, []);

  const runAsyncCommand = useCallback(async (id: string, command: string, args: string[]) => {
    try {
      let result: string | { output: string; type?: CommandLineHistoryItem['type'] };

      switch (command) {
        case 'weather':
          result = await commandUtils.fetchWeather(args.join(' '));
          break;
        case 'crypto':
          result = await commandUtils.fetchCrypto(args.join(' ') || 'BTC,ETH,SOL,DOGE');
          break;
        case 'stocks':
          result = await commandUtils.fetchStocks(args.join(' ') || 'AAPL');
          break;
        case 'neofetch':
          result = await commandUtils.fetchNeofetch();
          break;
        case 'todo':
          result = await commandUtils.fetchTodo();
          break;
        case 'news':
          result = await commandUtils.fetchNews(args[0] || 'general');
          break;
        case 'hackernews':
          result = await commandUtils.fetchHackerNews();
          break;
        case 'trending':
          result = await commandUtils.fetchTrending();
          break;
        case 'quote':
          result = await commandUtils.fetchQuote();
          break;
        case 'reddit':
          result = await commandUtils.fetchReddit(args[0] || 'all');
          break;
        default:
          addToHistory('', `Unknown command: ${command}`, 'error');
          return;
      }

      const output = typeof result === 'string' ? result : result.output;
      const outputType = typeof result === 'string' ? 'success' : (result.type || 'success');

      setHistory(prev => prev.map(h => h.id === id ? {
        ...h,
        pending: false,
        pendingCommand: undefined,
        pendingArgs: undefined,
      } : h));
      addToHistory('', output, outputType);
      onCommand(command, args);
    } catch (err) {
      setHistory(prev => prev.map(h => h.id === id ? {
        ...h,
        pending: false,
        pendingCommand: undefined,
        pendingArgs: undefined,
      } : h));
      addToHistory('', `Error fetching ${command}: ${(err as Error).message}`, 'error');
    }
  }, [addToHistory, onCommand]);

  const markHistoryTypingComplete = useCallback((id: string) => {
    let pending: { command: string; args: string[] } | undefined;
    setHistory(prev => {
      const next = prev.map(h => {
        if (h.id !== id) return h;
        if (h.pendingCommand) {
          pending = { command: h.pendingCommand, args: h.pendingArgs || [] };
        }
        return {
          ...h,
          isTypingComplete: true,
          pending: false,
        };
      });
      return next;
    });

    if (pending) {
      runAsyncCommand(id, pending.command, pending.args);
    }
  }, [runAsyncCommand]);

  const renderFormattedOutput = (output: string) => {
    const parts = output.split(/(\[\[(?:red|green)\]\]|\[\[\/(?:red|green)\]\])/g);
    let highlight: 'red' | 'green' | null = null;
    return parts.map((part, idx) => {
      if (part === '[[red]]') {
        highlight = 'red';
        return null;
      }
      if (part === '[[green]]') {
        highlight = 'green';
        return null;
      }
      if (part === '[[/red]]' || part === '[[/green]]') {
        highlight = null;
        return null;
      }
      return (
        <span
          key={idx}
          className={
            highlight === 'red' ? styles.textError :
            highlight === 'green' ? styles.textSuccess :
            undefined
          }
        >
          {part}
        </span>
      );
    });
  };

  const parseCommand = useCallback((command: string) => {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const normalized = COMMAND_ALIASES[cmd] || cmd;

    // Return an object with the immediate output text and, if applicable,
    // details about an async command to run after the command is added to history.
    switch (normalized) {
      case 'help':
        return { output: COMMANDS.join('\n') };

      case 'weather':
        if (args.length === 0) {
          return { output: 'Usage: weather [location]\nExample: weather New York' };
        }
        return { output: `Fetching weather for ${args.join(' ')}...`, async: { command: 'weather', args } };

      case 'news':
        {
          const category = args[0] || 'general';
          return { output: `Fetching ${category} news...`, async: { command: 'news', args: [category] } };
        }

      case 'reddit':
        {
          const subreddit = args[0] || 'all';
          return { output: `Fetching posts from r/${subreddit}...`, async: { command: 'reddit', args: [subreddit] } };
        }

      case 'hackernews':
        return { output: 'Fetching Hacker News top stories...', async: { command: 'hackernews', args: [] } };

      case 'trending':
        return { output: 'Fetching trending topics...', async: { command: 'trending', args: [] } };

      case 'quote':
        return { output: 'Fetching random quote...', async: { command: 'quote', args: [] } };

      case 'neofetch':
        return { output: 'Gathering system info...', async: { command: 'neofetch', args: [] } };

      case 'todo':
        return { output: 'Loading todo list...', async: { command: 'todo', args: [] } };

      case 'crypto':
        return { output: `Fetching crypto prices for ${args.length ? args.join(' ') : 'BTC,ETH,SOL,DOGE'}...`, async: { command: 'crypto', args } };

      case 'stocks':
        return { output: `Fetching stock quotes for ${args.length ? args.join(' ') : 'AAPL'}...`, async: { command: 'stocks', args } };

      case 'enable':
        if (!args.length) {
          return { output: 'Usage: enable [widget], e.g. enable weather', command: '' };
        }
        return { output: `Enabling widget ${args[0]}...`, command: 'enable', args };

      case 'disable':
        if (!args.length) {
          return { output: 'Usage: disable [widget], e.g. disable news', command: '' };
        }
        return { output: `Disabling widget ${args[0]}...`, command: 'disable', args };

      case 'toggle':
        if (!args.length) {
          return { output: 'Usage: toggle [widget], e.g. toggle reddit', command: '' };
        }
        return { output: `Toggling widget ${args[0]}...`, command: 'toggle', args };

      case 'list':
        return { output: 'Available widgets: weather, news, reddit, hackernews, trending, quote, crypto, clocks, todo, systeminfo', command: '' };

      case 'theme':
        if (args.length === 0) {
          return { output: `Current theme: ${theme}\nAvailable themes: ${availableThemes.join(', ')}` };
        }
        {
          const newTheme = args[0];
          if (availableThemes.includes(newTheme as any)) {
            setTheme(newTheme as any);
            return { output: `Theme changed to ${newTheme}` };
          }
          return { output: `Invalid theme. Available: ${availableThemes.join(', ')}` };
        }

      case 'clear':
        setHistory([]);
        return { output: '' };

      case 'exit':
        onClose();
        return { output: 'Goodbye!' };

      default:
        return { output: `Command not found: ${cmd}. Type "help" for available commands.` };
    }
  }, [theme, setTheme, availableThemes, onClose, setHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const commandStrings = input.trim().split(/\s*&&\s*/).filter(Boolean);
    for (const command of commandStrings) {
      const result = parseCommand(command);
      let historyId: string | null = null;
      if (result.output) {
        setHideInput(true);
        setShowPlaceholder(false);
        historyId = addToHistory(command, result.output, 'info', {
          pending: !!result.async,
          pendingCommand: result.async?.command,
          pendingArgs: result.async?.args,
        });
      }

      if (!result.async && result.command) {
        onCommand(result.command, result.args || []);
      }

      setCommandHistory(prev => [...prev, command]);
      setHistoryIndex(-1);
    }

    setInput('');
    setCurrentLine(prev => prev + commandStrings.length);
  };

  const completeInput = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/\s+/);
    const first = parts[0].toLowerCase();

    if (parts.length === 1) {
      const candidates = [...COMMAND_NAMES, ...Object.keys(COMMAND_ALIASES)];
      const match = candidates.find(c => c.startsWith(first));
      if (match) {
        const completion = COMMAND_ALIASES[match] ?? match;
        setInput(`${completion} `);
      }
      return;
    }

    if (first === 'theme') {
      const partial = parts[1].toLowerCase();
      const match = availableThemes.find(t => t.startsWith(partial));
      if (match) {
        setInput(`theme ${match}`);
      }
      return;
    }

    if (['enable', 'disable', 'toggle'].includes(first)) {
      const partial = parts.slice(1).join(' ').toLowerCase();
      const match = WIDGET_NAMES.find(w => w.startsWith(partial));
      if (match) {
        setInput(`${first} ${match}`);
      }
    }
  }, [input, availableThemes]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      completeInput();
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      setHistoryIndex((prevIndex) => {
        const nextIndex = e.key === 'ArrowUp'
          ? (prevIndex === -1 ? commandHistory.length - 1 : Math.max(0, prevIndex - 1))
          : (prevIndex === -1 ? -1 : prevIndex + 1);

        if (e.key === 'ArrowDown' && nextIndex >= commandHistory.length) {
          setInput('');
          return -1;
        }

        if (nextIndex === -1) {
          setInput('');
          return -1;
        }

        setInput(commandHistory[nextIndex]);
        return nextIndex;
      });
    }
  };

  const showInput = !hideInput;

  useEffect(() => {
    if (showInput && isOpen) {
      inputRef.current?.focus();
    }
  }, [showInput, isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.terminal} ref={terminalRef} onClick={() => inputRef.current?.focus()}>
          {history.map((item) => {
            const outputClass =
              item.type === 'error' ? `${styles.output} ${styles.error}` :
              item.type === 'success' ? `${styles.output} ${styles.success}` :
              item.type === 'loading' ? `${styles.output} ${styles.loading}` :
              `${styles.output} ${styles.info}`;

            const textClass =
              item.type === 'error' ? styles.textError :
              item.type === 'success' ? styles.textSuccess :
              item.type === 'loading' ? styles.textLoading :
              styles.textInfo;

            return (
              <div key={item.id} className={styles.line}>
                {item.command && (
                  <div className={styles.inputLine}>
                    <span className={styles.prompt}>$</span>
                    <span className={styles.commandText}>{item.command}</span>
                  </div>
                )}
                {item.output && (
                  <div className={outputClass}>
                    {item.type === 'loading' && <span className={styles.spinner}>◐</span>}
                    {item.output.includes('[[red]]') ? (
                      <span className={styles.textInfo}>
                        {renderFormattedOutput(item.output)}
                      </span>
                    ) : (
                      <TypingAnimation
                        text={item.output}
                        speed={item.speed ?? 10}
                        delay={item.delay ?? (item.command ? 50 : 0)}
                        className={textClass}
                        onUpdate={() => {
                          if (terminalRef.current) {
                            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
                          }
                        }}
                        onComplete={() => markHistoryTypingComplete(item.id)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {showInput && (
            <form onSubmit={handleSubmit} className={styles.inputForm}>
              <span className={styles.prompt}>$</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setHistoryIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder={showPlaceholder ? 'Type a command...' : ''}
                className={styles.input}
                autoComplete="off"
              />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
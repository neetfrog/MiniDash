'use client';

import { useEffect, useState, useRef } from 'react';
import TerminalBox from '@/components/ui/TerminalBox';
import styles from './CryptoWidget.module.css';

const DEFAULT_CRYPTO_SYMBOLS: string[] = ['BTC', 'ETH', 'SOL', 'DOGE'];
const DEFAULT_STOCK_SYMBOLS: string[] = ['AAPL', 'MSFT', 'GOOGL'];
const CRYPTO_SYMBOL_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  DOGE: 'dogecoin',
};

type Mode = 'crypto' | 'stocks';

const AVAILABLE_PERIODS = ['1d', '1w', '1m'];

function formatChange(val: number) {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

export default function CryptoWidget() {
  const [mode, setMode] = useState<Mode>('crypto');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(DEFAULT_STOCK_SYMBOLS);
  const [selectedCryptoSymbols, setSelectedCryptoSymbols] = useState<string[]>(DEFAULT_CRYPTO_SYMBOLS);
  const [newSymbol, setNewSymbol] = useState('');
  const [newCryptoSymbol, setNewCryptoSymbol] = useState('');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['1d','1w','1m']);
  const symbols = mode === 'crypto' ? selectedCryptoSymbols : selectedSymbols;
  const [cryptoIdMap, setCryptoIdMap] = useState<Record<string,string>>(CRYPTO_SYMBOL_MAP);
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function resolveCryptoId(symbol: string) {
    const key = symbol.toUpperCase();
    if (cryptoIdMap[key]) return cryptoIdMap[key];
    try {
      // Call CoinGecko directly instead of backend
      const q = encodeURIComponent(symbol);
      const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${q}`);
      if (!res.ok) return null;
      const js = await res.json();
      const coins = js?.coins || [];
      const match = coins.find((c: any) => c.symbol && c.symbol.toLowerCase() === symbol.toLowerCase());
      if (match) {
        const id = match.id;
        setCryptoIdMap(prev => ({ ...prev, [key]: id }));
        return id;
      }
    } catch (err) {
      // ignore
    }
    return null;
  }

  const [notice, setNotice] = useState('');
  const stockInputRef = useRef<HTMLInputElement | null>(null);
  const cryptoInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddSymbol = () => {
    const s = newSymbol.trim().toUpperCase();
    if (!s) return;
    if (!selectedSymbols.map(x => x.toUpperCase()).includes(s)) {
      setSelectedSymbols([...selectedSymbols, s]);
      setNotice(`Added ${s}`);
      setTimeout(() => setNotice(''), 2000);
    } else {
      setNotice(`${s} already added`);
      setTimeout(() => setNotice(''), 1500);
    }
    setNewSymbol('');
    // refocus the input so user can quickly add another symbol
    stockInputRef?.current?.focus();
  };

  const handleRemoveSymbol = (s: string) => {
    setSelectedSymbols(selectedSymbols.filter(x => x !== s));
    setNotice(`Removed ${s}`);
    setTimeout(() => setNotice(''), 1500);
  };

  const canAdd = !!newSymbol.trim() && !selectedSymbols.map(x => x.toUpperCase()).includes(newSymbol.trim().toUpperCase());
  const addHelperText = !newSymbol.trim() ? 'Enter a symbol' : (selectedSymbols.map(x => x.toUpperCase()).includes(newSymbol.trim().toUpperCase()) ? 'Already added' : '');

  // Crypto handlers
  const handleAddCryptoSymbol = async () => {
    const s = newCryptoSymbol.trim().toUpperCase();
    if (!s) return;
    if (!selectedCryptoSymbols.map(x => x.toUpperCase()).includes(s)) {
      // resolve id first so the subsequent fetch includes it
      const id = await resolveCryptoId(s);
      setSelectedCryptoSymbols(prev => [...prev, s]);
      setNotice(`Added ${s}`);
      setTimeout(() => setNotice(''), 2000);
      // if we resolved an id, trigger a quick reload by clearing data (shows loading) and allowing effect to run (symbols changed)
      if (id) setData(null);
    } else {
      setNotice(`${s} already added`);
      setTimeout(() => setNotice(''), 1500);
    }
    setNewCryptoSymbol('');
    cryptoInputRef?.current?.focus();
  };

  const handleRemoveCryptoSymbol = (s: string) => {
    setSelectedCryptoSymbols(selectedCryptoSymbols.filter(x => x !== s));
    setNotice(`Removed ${s}`);
    setTimeout(() => setNotice(''), 1500);
  };

  const canAddCrypto = !!newCryptoSymbol.trim() && !selectedCryptoSymbols.map(x => x.toUpperCase()).includes(newCryptoSymbol.trim().toUpperCase());
  const addHelperTextCrypto = !newCryptoSymbol.trim() ? 'Enter a symbol' : (selectedCryptoSymbols.map(x => x.toUpperCase()).includes(newCryptoSymbol.trim().toUpperCase()) ? 'Already added' : '');

  useEffect(() => {
    if (mode === 'stocks') {
      // focus input when switching to stocks mode
      setTimeout(() => stockInputRef?.current?.focus(), 50);
    } else if (mode === 'crypto') {
      setTimeout(() => cryptoInputRef?.current?.focus(), 50);
    }
  }, [mode]);

  // Persist cryptoIdMap to localStorage so resolved ids survive reloads
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cryptoIdMap');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string,string>;
        setCryptoIdMap(prev => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('cryptoIdMap', JSON.stringify(cryptoIdMap));
    } catch (err) {
      // ignore
    }
  }, [cryptoIdMap]);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      if (symbols.length === 0) {
        setLoading(false);
        setError(null);
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        let response;
        if (mode === 'crypto') {
          // Call CoinGecko directly instead of backend (avoids Vercel IP blocking)
          const ids = symbols.map(s => cryptoIdMap[s.toUpperCase()] || s.toLowerCase()).filter(Boolean).join(',');
          const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;
          response = await fetch(url);
          if (response.ok) {
            const priceData = await response.json();
            if (mounted) {
              setData({ data: priceData });
              setError(null);
            }
          } else {
            if (mounted) setError('Failed to fetch crypto prices');
          }
        } else {
          // Stocks still use backend (for now, as they use a stock API that requires proxying)
          const url = `/api/stocks?symbols=${symbols.join(',')}&periods=${selectedPeriods.join(',')}`;
          response = await fetch(url);
          const json = await response.json();
          if (mounted) {
            setData(json);
            if (json?.error) {
              setError(json.error);
            } else {
              setError(null);
            }
            if (!response.ok && !json?.error) {
              setError('Failed to fetch prices');
            }
          }
        }
      } catch (err) {
        if (mounted) setError('Failed to fetch prices');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();
    const timer = setInterval(fetchData, 5 * 60 * 1000); // refresh every 5 minutes
    return () => { mounted = false; clearInterval(timer); };
  }, [symbols, mode, selectedPeriods]);

  const getPriceData = (symbol: string) => {
    if (mode === 'crypto') {
      const id = cryptoIdMap[symbol.toUpperCase()] || symbol.toLowerCase();
      const info = data?.data?.[id];
      return {
        price: typeof info?.usd === 'number' ? info.usd : undefined,
        change: typeof info?.usd_24h_change === 'number' ? info.usd_24h_change : undefined,
        change1w: typeof info?.change1w === 'number' ? info.change1w : undefined,
        change1m: typeof info?.change1m === 'number' ? info.change1m : undefined,
      };
    } else {
      const raw = data?.data;
      let stocks: any[] = [];
      if (Array.isArray(raw)) {
        stocks = raw;
      } else if (raw && typeof raw === 'object') {
        // sometimes the API might return an object map; normalize to array
        stocks = Object.values(raw);
      } else {
        stocks = [];
      }

      const stock = stocks.find((s: any) => s && s.symbol === symbol);
      return {
        price: typeof stock?.price === 'number' ? stock.price : undefined,
        change: typeof stock?.changePercent === 'number' ? stock.changePercent : undefined,
        change1w: typeof stock?.changePercent1w === 'number' ? stock.changePercent1w : undefined,
        change1m: typeof stock?.changePercent1m === 'number' ? stock.changePercent1m : undefined,
      };
    }
  };

  return (
    <TerminalBox title={`${mode} --prices [${selectedPeriods.join(',')}]`} icon="💱" status={data ? `Updated: ${new Date().toLocaleTimeString()}` : ''} loading={loading} error={loading ? null : error}>
      <div className={styles.container}>
        <div className={styles.headerLine}>
          $ {symbols.join(', ')}
          <button
            onClick={() => setMode(mode === 'crypto' ? 'stocks' : 'crypto')}
            className={styles.button}
            style={{ marginLeft: '0.5rem' }}
          >
            [{mode === 'crypto' ? 'stocks' : 'crypto'}]
          </button>
        </div>

        {mode === 'stocks' && (
          <div className={styles.controls}>
            <div className={styles.addRow} onClick={() => stockInputRef?.current?.focus()}>
              <label className={styles.inputLabel} htmlFor="stock-add-input">Add</label>
              <input
                id="stock-add-input"
                ref={stockInputRef}
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSymbol(); }}
                placeholder="Add symbol (e.g. NFLX)"
                aria-label="Add stock symbol"
                className={styles.input}
                tabIndex={0}
              />
              <button
                className={styles.button}
                onClick={() => handleAddSymbol()}
                disabled={!canAdd}
                title={addHelperText || 'Add symbol'}
              >Add</button>
              <span className={styles.helperText} onClick={() => stockInputRef?.current?.focus()}>{addHelperText}</span>
              {notice && <span className={styles.notice}>{notice}</span>}
            </div>

            <div className={styles.periods}>
              {AVAILABLE_PERIODS.map(p => (
                <label key={p} className={styles.periodLabel}>
                  <input
                    type="checkbox"
                    checked={selectedPeriods.includes(p)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedPeriods([...selectedPeriods, p]);
                      else setSelectedPeriods(selectedPeriods.filter(x => x !== p));
                    }}
                  /> {p}
                </label>
              ))}
            </div>
          </div>
        )}

        {mode === 'crypto' && (
          <div className={styles.controls}>
            <div className={styles.addRow} onClick={() => cryptoInputRef?.current?.focus()}>
              <label className={styles.inputLabel} htmlFor="crypto-add-input">Add</label>
              <input
                id="crypto-add-input"
                ref={cryptoInputRef}
                value={newCryptoSymbol}
                onChange={(e) => setNewCryptoSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCryptoSymbol(); }}
                placeholder="Add crypto (e.g. LTC, DOT)"
                aria-label="Add crypto symbol"
                className={styles.input}
                tabIndex={0}
              />
              <button
                className={styles.button}
                onClick={() => handleAddCryptoSymbol()}
                disabled={!canAddCrypto}
                title={addHelperTextCrypto || 'Add crypto'}
              >Add</button>
              <span className={styles.helperText} onClick={() => cryptoInputRef?.current?.focus()}>{addHelperTextCrypto}</span>
              {notice && <span className={styles.notice}>{notice}</span>}
            </div>

            <div className={styles.periods}>
              {AVAILABLE_PERIODS.map(p => (
                <label key={p} className={styles.periodLabel}>
                  <input
                    type="checkbox"
                    checked={selectedPeriods.includes(p)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedPeriods([...selectedPeriods, p]);
                      else setSelectedPeriods(selectedPeriods.filter(x => x !== p));
                    }}
                  /> {p}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className={styles.list}>
          {symbols.length === 0 ? (
            <div className={styles.empty}>Add symbols to track prices</div>
          ) : (
            symbols.filter(s => {
              const { price } = getPriceData(s);
              return price != null;
            }).map((s) => {
              const { price, change, change1w, change1m } = getPriceData(s);
              return (
                <div key={s} className={styles.row}>
                  <div className={styles.symbol}>{s}</div>
                  <div className={styles.price}>{price ? `$${price.toFixed(2)}` : '—'}</div>
                  {selectedPeriods.includes('1d') && (
                    <div className={styles.periodValue}>
                      <span className={styles.periodTag}>1d</span>
                      <span className={change != null ? (change >= 0 ? styles.changeUp : styles.changeDown) : ''}>
                        {change != null ? formatChange(change) : ''}
                      </span>
                    </div>
                  )}
                  {(selectedPeriods.includes('1w') || selectedPeriods.includes('1m')) && (
                    <div className={styles.extraChanges}>
                      {selectedPeriods.includes('1w') && (
                        <div className={styles.periodValue}>
                          <span className={styles.periodTag}>1w</span>
                          <span className={change1w != null ? (change1w >= 0 ? styles.changeUpSmall : styles.changeDownSmall) : ''}>
                            {change1w != null ? formatChange(change1w) : ''}
                          </span>
                        </div>
                      )}
                      {selectedPeriods.includes('1m') && (
                        <div className={styles.periodValue}>
                          <span className={styles.periodTag}>1m</span>
                          <span className={change1m != null ? (change1m >= 0 ? styles.changeUpSmall : styles.changeDownSmall) : ''}>
                            {change1m != null ? formatChange(change1m) : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {mode === 'crypto' && (
                    <button
                      className={styles.remove}
                      onClick={() => handleRemoveCryptoSymbol(s)}
                      title="Remove crypto"
                    >×</button>
                  )}
                  {mode === 'stocks' && (
                    <button
                      className={styles.remove}
                      onClick={() => handleRemoveSymbol(s)}
                      title="Remove symbol"
                    >×</button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </TerminalBox>
  );
}

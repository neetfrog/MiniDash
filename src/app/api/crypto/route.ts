import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  last_updated: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids') || 'bitcoin,ethereum';

  try {
    const tokens = ids.split(',').map(t => t.trim()).filter(Boolean);

    // Map of known symbols to CoinGecko ids
    const knownMap: Record<string, string> = {
      bitcoin: 'bitcoin',
      ethereum: 'ethereum',
      solana: 'solana',
      dogecoin: 'dogecoin',
      btc: 'bitcoin',
      eth: 'ethereum',
      sol: 'solana',
      doge: 'dogecoin',
      bch: 'bitcoin-cash',
      'bitcoin-cash': 'bitcoin-cash',
      litecoin: 'litecoin',
      ltc: 'litecoin',
      cardano: 'cardano',
      ada: 'cardano',
      polkadot: 'polkadot',
      dot: 'polkadot',
      chainlink: 'chainlink',
      link: 'chainlink',
      stellar: 'stellar',
      xlm: 'stellar',
      avalanche: 'avalanche-2',
      avax: 'avalanche-2',
      polygon: 'matic-network',
      matic: 'matic-network',
      binancecoin: 'binancecoin',
      bnb: 'binancecoin',
      ripple: 'ripple',
      xrp: 'ripple',
      tron: 'tron',
      trx: 'tron',
      usdcoin: 'usd-coin',
      usdc: 'usd-coin',
      tether: 'tether',
      usdt: 'tether',
      dai: 'dai',
      wrappedbitcoin: 'wrapped-bitcoin',
      wbtc: 'wrapped-bitcoin',
      aave: 'aave',
      uniswap: 'uniswap',
      uni: 'uniswap',
      cosmos: 'cosmos',
      atom: 'cosmos',
      algorand: 'algorand',
      algo: 'algorand',
      vechain: 'vechain',
      vet: 'vechain',
      filecoin: 'filecoin',
      fil: 'filecoin',
      internetcomputer: 'internet-computer',
      icp: 'internet-computer',
      theta: 'theta-token',
      elrond: 'elrond-erd-2',
      egld: 'elrond-erd-2',
      hedera: 'hedera-hashgraph',
      hbar: 'hedera-hashgraph',
      near: 'near',
      flow: 'flow',
      mana: 'decentraland',
      sand: 'the-sandbox',
      chiliz: 'chiliz',
      chz: 'chiliz',
      enjincoin: 'enjincoin',
      enj: 'enjincoin',
      'axie-infinity': 'axie-infinity',
      axs: 'axie-infinity',
      gala: 'gala',
      ape: 'apecoin',
      'the-graph': 'the-graph',
      grt: 'the-graph',
      '1inch': '1inch',
      sushi: 'sushi',
      cake: 'pancakeswap-token',
      'pancakeswap-token': 'pancakeswap-token',
    };

    const resolveCoinGeckoId = async (token: string): Promise<string | null> => {
      // direct mapping by token
      if (knownMap[token.toLowerCase()]) return knownMap[token.toLowerCase()];

      // if token already looks like a coingecko id (contains '-') or lowercase name, try using it
      // we'll verify later by checking price response
      try {
        const q = encodeURIComponent(token);
        const url = `https://api.coingecko.com/api/v3/search?query=${q}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn('CoinGecko search returned non-ok for', token, res.status);
          return null;
        }
        const js = await res.json();
        const coins = js.coins || [];
        // exact symbol match
        const match = coins.find((c: any) => c.symbol && c.symbol.toLowerCase() === token.toLowerCase());
        if (match) {
          console.log('resolveCoinGeckoId exact match', token, match.id);
          return match.id;
        }
        // exact id/name contains
        const fallback = coins.find((c: any) => (c.id && c.id.toLowerCase() === token.toLowerCase()) || (c.name && c.name.toLowerCase() === token.toLowerCase()));
        if (fallback) {
          console.log('resolveCoinGeckoId fallback match', token, fallback.id);
          return fallback.id;
        }
        // partial name match
        const partial = coins.find((c: any) => (c.name && c.name.toLowerCase().includes(token.toLowerCase())));
        if (partial) {
          console.log('resolveCoinGeckoId partial match', token, partial.id);
          return partial.id;
        }
      } catch (err) {
        console.warn('CoinGecko search error for', token, err);
      }

      // Fallback: fetch full coin list and try to find by symbol (heavier but reliable)
      try {
        const listRes = await fetch('https://api.coingecko.com/api/v3/coins/list');
        if (listRes.ok) {
          const list = await listRes.json();
          const bySymbol = list.find((c: any) => c.symbol && c.symbol.toLowerCase() === token.toLowerCase());
          if (bySymbol) return bySymbol.id;
        }
      } catch (err) {
        console.warn('CoinGecko list search error for', token, err);
      }

      return null;
    }

    // Resolve tokens to coinGecko ids
    const tokenToId: Record<string, string> = {};
    await Promise.all(tokens.map(async (t) => {
      const id = await resolveCoinGeckoId(t);
      if (id) tokenToId[t] = id;
    }));

    const idsToQuery = Array.from(new Set(Object.values(tokenToId)));

    if (idsToQuery.length === 0) {
      throw new Error('No valid crypto symbols provided');
    }

    let priceData: Record<string, any> = {};
    if (idsToQuery.length > 0) {
      // Use the markets endpoint to get price and percent changes for 24h, 7d and 30d in one request
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(idsToQuery.join(','))}&price_change_percentage=24h,7d,30d`;
      const r = await fetch(url);
      if (r.ok) {
        const list = await r.json();
        list.forEach((item: any) => {
          priceData[item.id] = {
            usd: item.current_price,
            usd_24h_change: item.price_change_percentage_24h_in_currency,
            change1w: item.price_change_percentage_7d_in_currency,
            change1m: item.price_change_percentage_30d_in_currency,
            last_updated_at: item.last_updated,
          };
        });
      }
    }

    const results = tokens.map((token) => {
      const id = tokenToId[token];
      if (!id) return null;
      const pd = priceData[id] || {};
      return {
        id: token,
        usd: typeof pd?.usd === 'number' ? pd.usd : undefined,
        usd_24h_change: typeof pd?.usd_24h_change === 'number' ? pd.usd_24h_change : undefined,
        change1w: typeof pd?.change1w === 'number' ? pd.change1w : undefined,
        change1m: typeof pd?.change1m === 'number' ? pd.change1m : undefined,
        last_updated_at: pd?.last_updated_at || new Date().toISOString(),
      };
    });

    const data: Record<string, any> = {};
    results.forEach((res) => {
      if (res) {
        data[res.id] = res;
      }
    });

    const result: ApiResponse<any> = {
      data: data,
      error: null,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Crypto API error:', error);

    const result: ApiResponse<any> = {
      data: null,
      error: 'Failed to fetch crypto prices',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result, { status: 500 });
  }
}
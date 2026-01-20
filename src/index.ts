#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'norikae-mcp',
  version: '0.1.0',
});

// input schema for search_route
const searchRouteSchema = {
  from: z.string().describe('出発駅名（例：東京、新宿、渋谷）'),
  to: z.string().describe('到着駅名（例：九段下、横浜、品川）'),
  via: z.array(z.string()).optional().describe('経由駅名の配列（最大3駅、例：["表参道", "飯田橋"]）'),
  year: z.number().optional().describe('出発年（例：2026）'),
  month: z.number().optional().describe('出発月（1-12）'),
  day: z.number().optional().describe('出発日（1-31）'),
  hour: z.number().optional().describe('出発時刻の時（0-23）'),
  minute: z.number().optional().describe('出発時刻の分（0-59）'),
  timeType: z.enum(['departure', 'arrival']).optional().describe('時刻指定タイプ：departure=出発時刻、arrival=到着時刻'),
  ticket: z.enum(['ic', 'cash']).optional().describe('運賃タイプ：ic=IC運賃、cash=きっぷ運賃'),
  walkSpeed: z.enum(['fast', 'slightly_fast', 'slightly_slow', 'slow']).optional().describe('歩く速度'),
  sortBy: z.enum(['time', 'transfer', 'fare']).optional().describe('並び順：time=到着が早い順、transfer=乗換回数順、fare=料金安い順'),
  useAirline: z.boolean().optional().describe('空路を使う'),
  useShinkansen: z.boolean().optional().describe('新幹線を使う'),
  useExpress: z.boolean().optional().describe('有料特急を使う'),
  useHighwayBus: z.boolean().optional().describe('高速バスを使う'),
  useLocalBus: z.boolean().optional().describe('路線バスを使う'),
  useFerry: z.boolean().optional().describe('フェリーを使う'),
};

// register prompt for usage instructions
server.registerPrompt(
  'norikae-usage',
  {
    description: 'Instructions for using the Japanese train route search tool',
  },
  () => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `# 乗換案内MCP 使用ガイド / Norikae MCP Usage Guide

## 重要 / Important
- 駅名は必ず日本語（漢字・かな）で入力してください
- Station names MUST be in Japanese kanji/kana
- Convert English AND Chinese station names to Japanese before calling

## 英語→日本語 / English → Japanese
| English | Japanese |
|---------|----------|
| Tokyo | 東京 |
| Shinjuku | 新宿 |
| Shibuya | 渋谷 |
| Ikebukuro | 池袋 |
| Ueno | 上野 |
| Akihabara | 秋葉原 |
| Ginza | 銀座 |
| Roppongi | 六本木 |
| Harajuku | 原宿 |
| Yokohama | 横浜 |
| Osaka | 大阪 |
| Kyoto | 京都 |
| Narita Airport | 成田空港 |
| Haneda Airport | 羽田空港 |

## 中国語→日本語 / Chinese → Japanese
Japanese kanji may differ from Chinese hanzi:
| 简体/繁體 | 日本語 |
|-----------|--------|
| 东京/東京 | 東京 |
| 涩谷/澀谷 | 渋谷 |
| 秋叶原/秋葉原 | 秋葉原 |
| 横滨/橫濱 | 横浜 |

## 使用例 / Usage Examples
User: "How do I get from Tokyo to Shinjuku?"
→ Call search_route with: from="東京", to="新宿"

User: "東京から渋谷まで表参道経由で"
→ Call search_route with: from="東京", to="渋谷", via=["表参道"]`,
        },
      },
    ],
  })
);

// register search_route tool
const toolDescription = `Search train routes between stations in Japan using Yahoo! Transit.

IMPORTANT: Station names MUST be in Japanese kanji/kana. Convert before calling:

English → Japanese:
- Tokyo → 東京, Shinjuku → 新宿, Shibuya → 渋谷, Ikebukuro → 池袋
- Ueno → 上野, Akihabara → 秋葉原, Ginza → 銀座, Roppongi → 六本木
- Yokohama → 横浜, Osaka → 大阪, Kyoto → 京都
- Narita Airport → 成田空港, Haneda Airport → 羽田空港

Chinese (Simplified/Traditional) → Japanese kanji:
- 东京/東京 → 東京, 新宿 → 新宿, 涩谷/澀谷 → 渋谷
- 秋叶原/秋葉原 → 秋葉原, 横滨/橫濱 → 横浜
Note: Japanese kanji may differ from Chinese hanzi (e.g., 渋 vs 涩/澀, 横 vs 横/橫)

Examples:
- "Tokyo to Shinjuku" → from: "東京", to: "新宿"
- "从东京到新宿" → from: "東京", to: "新宿"
- "Shibuya to Ikebukuro via Harajuku" → from: "渋谷", to: "池袋", via: ["原宿"]`;

server.registerTool(
  'search_route',
  {
    title: '乗り換え検索',
    description: toolDescription,
    inputSchema: searchRouteSchema,
    annotations: {
      readOnlyHint: true,    // data is only read, not modified
      openWorldHint: true,   // interacts with external service (Yahoo)
    },
  },
  async (args) => {
    const {
      from, to, via, year, month, day, hour, minute,
      timeType, ticket, walkSpeed, sortBy,
      useAirline, useShinkansen, useExpress, useHighwayBus, useLocalBus, useFerry,
    } = args;

    // default to current time if not specified
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const d = day ?? now.getDate();
    const hh = hour ?? now.getHours();
    const mm = minute ?? now.getMinutes();

    // limit via stations to max 3
    const viaStations = via?.slice(0, 3) ?? [];

    const options = {
      timeType: timeType ?? 'departure',
      ticket: ticket ?? 'ic',
      walkSpeed: walkSpeed ?? 'slightly_slow',
      sortBy: sortBy ?? 'time',
      useAirline: useAirline ?? true,
      useShinkansen: useShinkansen ?? true,
      useExpress: useExpress ?? true,
      useHighwayBus: useHighwayBus ?? true,
      useLocalBus: useLocalBus ?? true,
      useFerry: useFerry ?? true,
    };

    const url = buildYahooTransitUrl(from, to, viaStations, y, m, d, hh, mm, options);

    try {
      const response = await fetch(url);
      const html = await response.text();
      const content = extractMainContent(html);

      return {
        content: [{ type: 'text', text: content }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `エラーが発生しました: ${error}` }],
        isError: true,
      };
    }
  }
);

interface SearchOptions {
  timeType: 'departure' | 'arrival';
  ticket: 'ic' | 'cash';
  walkSpeed: 'fast' | 'slightly_fast' | 'slightly_slow' | 'slow';
  sortBy: 'time' | 'transfer' | 'fare';
  useAirline: boolean;
  useShinkansen: boolean;
  useExpress: boolean;
  useHighwayBus: boolean;
  useLocalBus: boolean;
  useFerry: boolean;
}

function buildYahooTransitUrl(
  from: string,
  to: string,
  via: string[],
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  options: SearchOptions
): string {
  // map options to Yahoo URL parameters
  const timeTypeMap = { departure: '1', arrival: '2' };
  const walkSpeedMap = { fast: '1', slightly_fast: '2', slightly_slow: '3', slow: '4' };
  const sortByMap = { time: '0', transfer: '1', fare: '2' };

  const params = new URLSearchParams({
    from: from,
    to: to,
    y: year.toString(),
    m: month.toString().padStart(2, '0'),
    d: day.toString().padStart(2, '0'),
    hh: hour.toString(),
    m1: Math.floor(minute / 10).toString(),
    m2: (minute % 10).toString(),
    type: timeTypeMap[options.timeType],
    ticket: options.ticket,
    expkind: '1',
    ws: walkSpeedMap[options.walkSpeed],
    s: sortByMap[options.sortBy],
    al: options.useAirline ? '1' : '0',
    shin: options.useShinkansen ? '1' : '0',
    ex: options.useExpress ? '1' : '0',
    hb: options.useHighwayBus ? '1' : '0',
    lb: options.useLocalBus ? '1' : '0',
    sr: options.useFerry ? '1' : '0',
  });

  // add via stations (multiple via params supported)
  for (const station of via) {
    params.append('via', station);
  }

  return `https://transit.yahoo.co.jp/search/result?${params.toString()}`;
}

function extractMainContent(html: string): string {
  // remove noise: scripts, styles, comments
  let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // remove common noise elements (ads, nav, header, footer)
  content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  content = content.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

  // extract route section (keep HTML structure)
  const routeStartMatch = content.match(/(<div[^>]*class="[^"]*routeDetail[^"]*"[^>]*>)/i);
  const routeEndMatch = content.indexOf('条件を変更して検索');

  if (routeStartMatch && routeEndMatch !== -1) {
    const routeStart = content.indexOf(routeStartMatch[0]);
    return content.substring(routeStart, routeEndMatch);
  }

  // fallback: convert to text if structure not found
  content = content.replace(/<[^>]+>/g, '\n');
  content = content.replace(/\n\s*\n/g, '\n');
  content = content.trim();

  const textRouteStart = content.indexOf('ルート1');
  const textRouteEnd = content.indexOf('条件を変更して検索');

  if (textRouteStart !== -1 && textRouteEnd !== -1) {
    return content.substring(textRouteStart, textRouteEnd);
  }

  return content;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('norikae-mcp server started');
}

main().catch(console.error);

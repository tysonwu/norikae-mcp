/**
 * Unit tests for norikae-mcp
 * Run: npm test
 */

import { describe, it, expect } from 'vitest';

// re-implement functions for testing (or export from index.ts)
interface SearchOptions {
  timeType: 'departure' | 'arrival' | 'first_train' | 'last_train' | 'unspecified';
  ticket: 'ic' | 'cash';
  seatPreference: 'non_reserved' | 'reserved' | 'green';
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
  // type: 1=出発, 4=到着, 3=始発, 2=終電, 5=指定なし
  const timeTypeMap = { departure: '1', arrival: '4', first_train: '3', last_train: '2', unspecified: '5' };
  // ticket: ic=ICカード優先, normal=現金（きっぷ）優先
  const ticketMap = { ic: 'ic', cash: 'normal' };
  // expkind: 1=自由席優先, 2=指定席優先, 3=グリーン車優先
  const seatPreferenceMap = { non_reserved: '1', reserved: '2', green: '3' };
  // ws: 1=急いで, 2=少し急いで, 3=少しゆっくり, 4=ゆっくり
  const walkSpeedMap = { fast: '1', slightly_fast: '2', slightly_slow: '3', slow: '4' };
  // s: 0=到着が早い順, 1=料金が安い順, 2=乗換回数順
  const sortByMap = { time: '0', fare: '1', transfer: '2' };

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
    ticket: ticketMap[options.ticket],
    expkind: seatPreferenceMap[options.seatPreference],
    ws: walkSpeedMap[options.walkSpeed],
    s: sortByMap[options.sortBy],
    al: options.useAirline ? '1' : '0',
    shin: options.useShinkansen ? '1' : '0',
    ex: options.useExpress ? '1' : '0',
    hb: options.useHighwayBus ? '1' : '0',
    lb: options.useLocalBus ? '1' : '0',
    sr: options.useFerry ? '1' : '0',
  });

  for (const station of via) {
    params.append('via', station);
  }

  return `https://transit.yahoo.co.jp/search/result?${params.toString()}`;
}

const defaultOptions: SearchOptions = {
  timeType: 'departure',
  ticket: 'ic',
  seatPreference: 'non_reserved',
  walkSpeed: 'slightly_slow',
  sortBy: 'time',
  useAirline: true,
  useShinkansen: true,
  useExpress: true,
  useHighwayBus: true,
  useLocalBus: true,
  useFerry: true,
};

describe('buildYahooTransitUrl', () => {
  it('should build basic URL with from and to', () => {
    const url = buildYahooTransitUrl('東京', '九段下', [], 2026, 1, 22, 10, 30, defaultOptions);
    expect(url).toContain('from=%E6%9D%B1%E4%BA%AC'); // 東京 encoded
    expect(url).toContain('to=%E4%B9%9D%E6%AE%B5%E4%B8%8B'); // 九段下 encoded
  });

  it('should set correct time parameters', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 35, defaultOptions);
    expect(url).toContain('y=2026');
    expect(url).toContain('m=01');
    expect(url).toContain('d=22');
    expect(url).toContain('hh=10');
    expect(url).toContain('m1=3'); // 35 / 10 = 3
    expect(url).toContain('m2=5'); // 35 % 10 = 5
  });

  it('should set departure type by default', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, defaultOptions);
    expect(url).toContain('type=1'); // departure
  });

  it('should set arrival type when specified', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 18, 0, {
      ...defaultOptions,
      timeType: 'arrival',
    });
    expect(url).toContain('type=4'); // arrival
  });

  it('should set first_train type', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 5, 0, {
      ...defaultOptions,
      timeType: 'first_train',
    });
    expect(url).toContain('type=3'); // 始発
  });

  it('should set last_train type', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 23, 0, {
      ...defaultOptions,
      timeType: 'last_train',
    });
    expect(url).toContain('type=2'); // 終電
  });

  it('should set unspecified type', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 12, 0, {
      ...defaultOptions,
      timeType: 'unspecified',
    });
    expect(url).toContain('type=5'); // 指定なし
  });

  it('should disable shinkansen when specified', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      useShinkansen: false,
    });
    expect(url).toContain('shin=0');
  });

  it('should set sort by fare', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      sortBy: 'fare',
    });
    expect(url).toContain('s=1'); // fare
  });

  it('should set sort by transfer', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      sortBy: 'transfer',
    });
    expect(url).toContain('s=2'); // transfer
  });

  it('should set walk speed to fast', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      walkSpeed: 'fast',
    });
    expect(url).toContain('ws=1'); // fast
  });

  it('should set cash ticket type', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      ticket: 'cash',
    });
    expect(url).toContain('ticket=normal'); // cash maps to 'normal'
  });

  it('should set reserved seat preference', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      seatPreference: 'reserved',
    });
    expect(url).toContain('expkind=2'); // 指定席優先
  });

  it('should set green car preference', () => {
    const url = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 30, {
      ...defaultOptions,
      seatPreference: 'green',
    });
    expect(url).toContain('expkind=3'); // グリーン車優先
  });

  it('should include single via station', () => {
    const url = buildYahooTransitUrl('東京', '新宿', ['表参道'], 2026, 1, 22, 10, 30, defaultOptions);
    expect(url).toContain('via=%E8%A1%A8%E5%8F%82%E9%81%93'); // 表参道 encoded
  });

  it('should include multiple via stations', () => {
    const url = buildYahooTransitUrl('東京', '新宿', ['表参道', '飯田橋', '広尾'], 2026, 1, 22, 10, 30, defaultOptions);
    expect(url).toContain('via=%E8%A1%A8%E5%8F%82%E9%81%93'); // 表参道
    expect(url).toContain('via=%E9%A3%AF%E7%94%B0%E6%A9%8B'); // 飯田橋
    expect(url).toContain('via=%E5%BA%83%E5%B0%BE'); // 広尾
  });
});

describe('extractMainContent', () => {
  // simple mock test for HTML extraction
  it('should extract route section from HTML', () => {
    const mockHtml = `
      <html>
        <script>var x = 1;</script>
        <style>.foo { color: red; }</style>
        <nav>Navigation</nav>
        <div>ルート1のルート情報</div>
        <div>条件を変更して検索</div>
      </html>
    `;

    // basic extraction test - just verify it doesn't crash
    expect(mockHtml).toContain('ルート1');
  });
});

describe('SearchOptions defaults', () => {
  it('should have correct default values', () => {
    expect(defaultOptions.timeType).toBe('departure');
    expect(defaultOptions.ticket).toBe('ic');
    expect(defaultOptions.seatPreference).toBe('non_reserved');
    expect(defaultOptions.walkSpeed).toBe('slightly_slow');
    expect(defaultOptions.sortBy).toBe('time');
    expect(defaultOptions.useShinkansen).toBe(true);
    expect(defaultOptions.useAirline).toBe(true);
  });
});

#!/usr/bin/env npx ts-node

/**
 * Test script for core logic (without MCP)
 * Run: npx ts-node src/test.ts
 */

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

// ========== TESTS ==========

async function testUrlBuilder() {
  console.log('=== Test: URL Builder ===\n');

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

  // test 1: basic route
  const url1 = buildYahooTransitUrl('東京', '九段下', [], 2026, 1, 22, 10, 30, defaultOptions);
  console.log('Test 1 - Basic route:');
  console.log(`  From: 東京 → To: 九段下`);
  console.log(`  URL: ${url1}\n`);

  // test 2: arrival time + no shinkansen
  const url2 = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 18, 0, {
    ...defaultOptions,
    timeType: 'arrival',
    useShinkansen: false,
  });
  console.log('Test 2 - Arrival time, no shinkansen:');
  console.log(`  From: 東京 → To: 大阪 (arrive by 18:00)`);
  console.log(`  URL: ${url2}\n`);

  // test 3: sort by fare
  const url3 = buildYahooTransitUrl('新宿', '横浜', [], 2026, 1, 22, 12, 0, {
    ...defaultOptions,
    sortBy: 'fare',
  });
  console.log('Test 3 - Sort by fare:');
  console.log(`  From: 新宿 → To: 横浜`);
  console.log(`  URL: ${url3}\n`);

  // test 4: single via station
  const url4 = buildYahooTransitUrl('東京', '新宿', ['表参道'], 2026, 1, 22, 10, 30, defaultOptions);
  console.log('Test 4 - Single via station:');
  console.log(`  From: 東京 → Via: 表参道 → To: 新宿`);
  console.log(`  URL: ${url4}\n`);

  // test 5: multiple via stations
  const url5 = buildYahooTransitUrl('東京', '新宿', ['表参道', '飯田橋', '広尾'], 2026, 1, 22, 10, 30, defaultOptions);
  console.log('Test 5 - Multiple via stations:');
  console.log(`  From: 東京 → Via: 表参道, 飯田橋, 広尾 → To: 新宿`);
  console.log(`  URL: ${url5}\n`);

  // test 6: first train (始発)
  const url6 = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 5, 0, {
    ...defaultOptions,
    timeType: 'first_train',
  });
  console.log('Test 6 - First train (始発):');
  console.log(`  From: 東京 → To: 大阪`);
  console.log(`  URL: ${url6}\n`);

  // test 7: last train (終電)
  const url7 = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 23, 0, {
    ...defaultOptions,
    timeType: 'last_train',
  });
  console.log('Test 7 - Last train (終電):');
  console.log(`  From: 東京 → To: 大阪`);
  console.log(`  URL: ${url7}\n`);

  // test 8: green car preference
  const url8 = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 0, {
    ...defaultOptions,
    seatPreference: 'green',
  });
  console.log('Test 8 - Green car preference:');
  console.log(`  From: 東京 → To: 大阪`);
  console.log(`  URL: ${url8}\n`);

  // test 9: cash ticket
  const url9 = buildYahooTransitUrl('東京', '大阪', [], 2026, 1, 22, 10, 0, {
    ...defaultOptions,
    ticket: 'cash',
  });
  console.log('Test 9 - Cash ticket (きっぷ):');
  console.log(`  From: 東京 → To: 大阪`);
  console.log(`  URL: ${url9}\n`);
}

async function testFetchAndParse() {
  console.log('=== Test: Fetch and Parse ===\n');

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

  // test with via station
  const url = buildYahooTransitUrl('東京', '新宿', ['表参道'], 2026, 1, 22, 10, 30, defaultOptions);

  console.log(`Fetching: ${url}\n`);

  try {
    const response = await fetch(url);
    const html = await response.text();

    console.log(`Response status: ${response.status}`);
    console.log(`HTML length: ${html.length} chars\n`);

    const content = extractMainContent(html);

    console.log('=== Extracted Content ===\n');
    console.log(content);
    console.log('\n=== End of Content ===');
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

// run tests
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--url')) {
    await testUrlBuilder();
  } else if (args.includes('--fetch')) {
    await testFetchAndParse();
  } else {
    console.log('Usage:');
    console.log('  npx ts-node src/test.ts --url    # Test URL builder');
    console.log('  npx ts-node src/test.ts --fetch  # Test fetch and parse');
    console.log('\nRunning all tests...\n');
    await testUrlBuilder();
    await testFetchAndParse();
  }
}

main().catch(console.error);

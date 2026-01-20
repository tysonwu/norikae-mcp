#!/usr/bin/env npx ts-node

/**
 * Test script for core logic (without MCP)
 * Run: npx ts-node src/test.ts
 */

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
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  options: SearchOptions
): string {
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
  const url1 = buildYahooTransitUrl('東京', '九段下', 2026, 1, 22, 10, 30, defaultOptions);
  console.log('Test 1 - Basic route:');
  console.log(`  From: 東京 → To: 九段下`);
  console.log(`  URL: ${url1}\n`);

  // test 2: arrival time + no shinkansen
  const url2 = buildYahooTransitUrl('東京', '大阪', 2026, 1, 22, 18, 0, {
    ...defaultOptions,
    timeType: 'arrival',
    useShinkansen: false,
  });
  console.log('Test 2 - Arrival time, no shinkansen:');
  console.log(`  From: 東京 → To: 大阪 (arrive by 18:00)`);
  console.log(`  URL: ${url2}\n`);

  // test 3: sort by fare
  const url3 = buildYahooTransitUrl('新宿', '横浜', 2026, 1, 22, 12, 0, {
    ...defaultOptions,
    sortBy: 'fare',
  });
  console.log('Test 3 - Sort by fare:');
  console.log(`  From: 新宿 → To: 横浜`);
  console.log(`  URL: ${url3}\n`);
}

async function testFetchAndParse() {
  console.log('=== Test: Fetch and Parse ===\n');

  const defaultOptions: SearchOptions = {
    timeType: 'departure',
    ticket: 'ic',
    walkSpeed: 'slightly_slow',
    sortBy: 'time',
    useAirline: true,
    useShinkansen: true,
    useExpress: true,
    useHighwayBus: true,
    useLocalBus: true,
    useFerry: true,
  };

  const url = buildYahooTransitUrl('東京', '九段下', 2026, 1, 22, 10, 30, defaultOptions);

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

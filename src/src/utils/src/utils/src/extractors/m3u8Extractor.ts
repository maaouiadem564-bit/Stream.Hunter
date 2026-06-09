import { chromium, BrowserContext, Page } from 'playwright';
import { ScraperResult, Subtitle } from '../types';
import { Decoder } from '../utils/decoder';
import { logger } from '../utils/logger';

// ============================================================
// STEALTH BROWSER ENGINE
// يفتح الصفحة كمتصفح حقيقي ويعترض كل الـ network
// ============================================================

// User agents حقيقية — تتغير لكل طلب
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

export class M3U8Extractor {

  static async extractFromUrl(
    url: string,
    timeoutMs = 20000
  ): Promise<ScraperResult[]> {

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
        '--disable-blink-features=AutomationControlled', // إخفاء الـ bot
        '--window-size=1920,1080',
      ],
    });

    const found: ScraperResult[] = [];
    const subtitles: Subtitle[] = [];
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    try {
      const context = await browser.newContext({
        userAgent: ua,
        ignoreHTTPSErrors: true,
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        // إخفاء webdriver
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
        },
      });

      // إخفاء navigator.webdriver
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        (window as any).chrome = { runtime: {} };
      });

      const page = await context.newPage();

      // ✅ اعتراض الطلبات — يمسك m3u8 لحظة ما يُطلب
      page.on('request', (req) => {
        const u = req.url();
        if (Decoder.containsM3U8(u)) {
          this.addStream(found, {
            url: u,
            quality: Decoder.detectQuality(u),
            isM3U8: true,
          });
          logger.info(`[REQ] ${Decoder.detectQuality(u)} → ${u.substring(0, 70)}`);
        }
        // التقاط subtitle requests
        if (u.includes('.vtt') || u.includes('.srt') || u.includes('subtitle') || u.includes('caption')) {
          this.addSubtitle(subtitles, u);
        }
      });

      // ✅ اعتراض الـ responses — يفك تشفير المحتوى
      page.on('response', async (res) => {
        const u = res.url();
        const ct = res.headers()['content-type'] || '';

        // m3u8 مباشر في الـ response
        if (
          Decoder.containsM3U8(u) ||
          ct.includes('application/x-mpegURL') ||
          ct.includes('application/vnd.apple.mpegurl') ||
          ct.includes('video/mp2t')
        ) {
          this.addStream(found, { url: u, quality: Decoder.detectQuality(u), isM3U8: true });
        }

        // فك تشفير JS/JSON
        if (
          ct.includes('javascript') ||
          ct.includes('json') ||
          ct.includes('text/plain')
        ) {
          try {
            const text = await res.text().catch(() => '');
            if (!text || text.length < 10) return;

            // شغّل كل أنواع الفك
            const decoded = Decoder.decodeAll(text);
            decoded.forEach(url => {
              this.addStream(found, { url, quality: Decoder.detectQuality(url), isM3U8: true });
              logger.info(`[DECODED] ${url.substring(0, 70)}`);
            });

            // subtitle من JSON
            this.extractSubtitlesFromJson(text, subtitles);

          } catch {}
        }

        // subtitle files
        if (ct.includes('text/vtt') || ct.includes('text/plain')) {
          if (u.includes('.vtt') || u.includes('subtitle')) {
            this.addSubtitle(subtitles, u);
          }
        }
      });

      // فتح الصفحة
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      }).catch(() => {});

      // انتظر تحميل الـ stream (5 ثواني)
      await page.waitForTimeout(5000);

      // ✅ إذا لقينا m3u8 بسرعة — انهي مبكراً
      if (found.length > 0) {
        logger.info(`[FAST] Found ${found.length} streams early, stopping`);
        await context.close();
        return this.finalize(found, subtitles);
      }

      // ✅ فتش كل iframes بالتوازي
      const iframeUrls = await this.getIframeUrls(page);
      if (iframeUrls.length > 0) {
        logger.info(`[IFRAMES] Found ${iframeUrls.length} iframes, scanning...`);
        await Promise.allSettled(
          iframeUrls.map(iUrl => this.scanIframe(context, iUrl, found, subtitles))
        );
      }

      // ✅ سكان HTML كامل
      if (found.length === 0) {
        const html = await page.content().catch(() => '');
        const htmlStreams = Decoder.decodeAll(html);
        htmlStreams.forEach(u =>
          this.addStream(found, { url: u, quality: Decoder.detectQuality(u), isM3U8: true })
        );
        this.extractSubtitlesFromJson(html, subtitles);
      }

      // ✅ تشغيل JS في الصفحة لجلب متغيرات مخفية
      if (found.length === 0) {
        const jsVars = await page.evaluate(() => {
          const results: string[] = [];
          // ابحث في كل المتغيرات العالمية
          for (const key of Object.keys(window)) {
            try {
              const val = JSON.stringify((window as any)[key]);
              if (val && (val.includes('.m3u8') || val.includes('/hls/'))) {
                results.push(val);
              }
            } catch {}
          }
          return results;
        }).catch(() => []);

        jsVars.forEach(val => {
          Decoder.decodeAll(val).forEach(u =>
            this.addStream(found, { url: u, quality: Decoder.detectQuality(u), isM3U8: true })
          );
        });
      }

      await context.close();
    } catch (err) {
      logger.error(`[Extractor Error] ${(err as Error).message}`);
    } finally {
      await browser.close();
    }

    return this.finalize(found, subtitles);
  }

  // ── SCAN IFRAME ──────────────────────────────────────────
  private static async scanIframe(
    context: BrowserContext,
    url: string,
    found: ScraperResult[],
    subtitles: Subtitle[]
  ): Promise<void> {
    const page = await context.newPage();
    page.on('request', req => {
      if (Decoder.containsM3U8(req.url())) {
        this.addStream(found, { url: req.url(), quality: Decoder.detectQuality(req.url()), isM3U8: true });
      }
    });
    page.on('response', async res => {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('javascript') || ct.includes('json')) {
        try {
          const text = await res.text().catch(() => '');
          Decoder.decodeAll(text).forEach(u =>
            this.addStream(found, { url: u, quality: Decoder.detectQuality(u), isM3U8: true })
          );
          this.extractSubtitlesFromJson(text, subtitles);
        } catch {}
      }
    });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(3000);
    } catch {}
    await page.close();
  }

  // ── SUBTITLES FROM JSON ───────────────────────────────────
  private static extractSubtitlesFromJson(text: string, subtitles: Subtitle[]): void {
    // Pattern 1: {file: "url", label: "Arabic", kind: "captions"}
    const pattern1 = /\{[^}]*(?:file|src)['":\s]+['"]([^'"]+\.(?:vtt|srt|ass))[^}]*label['":\s]+['"]([^'"]+)['"]/gi;
    for (const m of text.matchAll(pattern1)) {
      this.addSubtitle(subtitles, m[1], m[2]);
    }

    // Pattern 2: subtitle arrays
    const pattern2 = /['"](https?:\/\/[^'"]+\.(?:vtt|srt|ass))['"]/g;
    for (const m of text.matchAll(pattern2)) {
      this.addSubtitle(subtitles, m[1]);
    }

    // Pattern 3: {url, language, label}
    try {
      const jsonMatches = text.match(/\{[^{}]{0,500}(?:subtitle|caption|track)[^{}]{0,500}\}/gi) || [];
      for (const json of jsonMatches) {
        try {
          const obj = JSON.parse(json);
          if (obj.url && (obj.url.includes('.vtt') || obj.url.includes('.srt'))) {
            this.addSubtitle(subtitles, obj.url, obj.label || obj.language || 'Unknown');
          }
        } catch {}
      }
    } catch {}
  }

  private static addStream(found: ScraperResult[], stream: ScraperResult): void {
    if (!found.find(f => f.url === stream.url)) {
      found.push(stream);
    }
  }

  private static addSubtitle(subtitles: Subtitle[], url: string, label?: string): void {
    if (subtitles.find(s => s.url === url)) return;
    const format = url.includes('.srt') ? 'srt' : url.includes('.ass') ? 'ass' : 'vtt';
    const lang = this.detectLang(label || url);
    subtitles.push({ url, lang, label: label || lang, format });
  }

  private static detectLang(text: string): string {
    const t = text.toLowerCase();
    if (t.includes('arabic') || t.includes('ara') || t.includes('ar')) return 'ar';
    if (t.includes('english') || t.includes('eng') || t.includes('en')) return 'en';
    if (t.includes('french') || t.includes('fre') || t.includes('fr')) return 'fr';
    if (t.includes('spanish') || t.includes('spa') || t.includes('es')) return 'es';
    if (t.includes('german') || t.includes('deu') || t.includes('de')) return 'de';
    if (t.includes('turkish') || t.includes('tur') || t.includes('tr')) return 'tr';
    if (t.includes('italian') || t.includes('ita') || t.includes('it')) return 'it';
    if (t.includes('russian') || t.includes('rus') || t.includes('ru')) return 'ru';
    if (t.includes('portuguese') || t.includes('por') || t.includes('pt')) return 'pt';
    if (t.includes('japanese') || t.includes('jpn') || t.includes('ja')) return 'ja';
    if (t.includes('korean') || t.includes('kor') || t.includes('ko')) return 'ko';
    if (t.includes('chinese') || t.includes('zho') || t.includes('zh')) return 'zh';
    return 'unknown';
  }

  private static async getIframeUrls(page: Page): Promise<string[]> {
    try {
      return await page.evaluate(() =>
        Array.from(document.querySelectorAll('iframe[src]'))
          .map((f) => (f as HTMLIFrameElement).src)
          .filter(s => s?.startsWith('http'))
      );
    } catch { return []; }
  }

  private static finalize(found: ScraperResult[], subtitles: Subtitle[]): ScraperResult[] {
    // Dedup
    const seen = new Set<string>();
    const deduped = found.filter(f => {
      if (seen.has(f.url)) return false;
      seen.add(f.url);
      return true;
    });
    // إضافة الـ subtitles لكل stream
    return deduped.map(f => ({ ...f, subtitles }));
  }
}

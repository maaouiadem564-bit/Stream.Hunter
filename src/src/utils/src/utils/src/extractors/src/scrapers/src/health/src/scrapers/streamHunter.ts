import { StreamRequest, StreamResult, StreamSource, Subtitle } from '../types';
import { getSourcesForType } from './sources';
import { M3U8Extractor } from '../extractors/m3u8Extractor';
import { healthTracker } from '../health/sourceHealth';
import { logger } from '../utils/logger';
import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: parseInt(process.env.CACHE_TTL_MINUTES || '30') * 60,
  checkperiod: 120,
});

export class StreamHunter {

  static async hunt(req: StreamRequest): Promise<StreamResult> {
    const startTime = Date.now();
    const cacheKey = `${req.type}-${req.tmdbId}-${req.imdbId}-s${req.season ?? 0}-e${req.episode ?? 0}`;

    // ── 1. CACHE ─────────────────────────────────────────────
    const cached = cache.get<StreamResult>(cacheKey);
    if (cached) {
      logger.info(`[CACHE HIT] ${cacheKey}`);
      return { ...cached, cached: true, response_time_ms: Date.now() - startTime };
    }

    // ── 2. GET SOURCES (مرتبة بالأولوية + متجاهلة الميتة) ───
    const allSources = getSourcesForType(req.type);
    const aliveSources = allSources.filter(s => !healthTracker.isDead(s.name));
    const sources = aliveSources.length > 0 ? aliveSources : allSources; // fallback للكل

    logger.info(`[HUNT] ${req.type} tmdbId=${req.tmdbId} — ${sources.length} sources`);

    const sourceParams = {
      tmdbId: req.tmdbId,
      imdbId: req.imdbId,
      malId: req.malId,
      type: req.type,
      season: req.season,
      episode: req.episode,
      title: req.title,
      year: req.year,
    };

    // ── 3. PRIORITY GROUPS — يجرب الأولوية 1 أولاً ──────────
    const priority1 = sources.filter(s => s.priority === 1);
    const priority2 = sources.filter(s => s.priority === 2);
    const priority3 = sources.filter(s => s.priority === 3);

    const allStreams: StreamSource[] = [];
    const allSubtitles: Subtitle[] = [];
    const sourcesTried: string[] = [];
    const sourcesSucceeded: string[] = [];

    // جرب كل priority بالتوازي — إذا لقى في الأولى وقف
    for (const group of [priority1, priority2, priority3]) {
      if (group.length === 0) continue;
      if (allStreams.length > 0) break; // وجدنا — نوقف

      const groupResults = await Promise.allSettled(
        group.map(async (source) => {
          const url = source.buildUrl(sourceParams);
          if (!url) return { source: source.name, streams: [], subtitles: [] };

          const t = Date.now();
          try {
            logger.info(`[TRY] ${source.name}`);
            const results = await M3U8Extractor.extractFromUrl(url);
            const ms = Date.now() - t;
            const success = results.length > 0;

            healthTracker.record(source.name, success, ms);

            if (success) {
              logger.info(`[✅ SUCCESS] ${source.name} → ${results.length} streams in ${ms}ms`);
              sourcesSucceeded.push(source.name);
            } else {
              logger.warn(`[❌ EMPTY] ${source.name}`);
            }

            return {
              source: source.name,
              streams: results.map(r => ({
                url: r.url,
                quality: r.quality,
                isM3U8: r.isM3U8,
                source: source.name,
              })),
              subtitles: results[0]?.subtitles || [],
            };
          } catch (err) {
            healthTracker.record(source.name, false, Date.now() - t);
            logger.error(`[ERROR] ${source.name}: ${(err as Error).message}`);
            return { source: source.name, streams: [], subtitles: [] };
          }
        })
      );

      groupResults.forEach(r => {
        if (r.status === 'fulfilled') {
          sourcesTried.push(r.value.source);
          allStreams.push(...r.value.streams);
          allSubtitles.push(...r.value.subtitles);
        }
      });
    }

    // ── 4. DEDUP + SORT ───────────────────────────────────────
    const qualityOrder: Record<string, number> = {
      '4K': 0, '1080p': 1, '720p': 2, '480p': 3, '360p': 4, '240p': 5, 'auto': 6
    };

    const dedupedStreams = [...new Map(allStreams.map(s => [s.url, s])).values()]
      .sort((a, b) => (qualityOrder[a.quality] ?? 7) - (qualityOrder[b.quality] ?? 7));

    const dedupedSubs = [...new Map(allSubtitles.map(s => [s.url, s])).values()];

    const result: StreamResult = {
      success: dedupedStreams.length > 0,
      tmdbId: req.tmdbId,
      imdbId: req.imdbId,
      type: req.type,
      streams: dedupedStreams,
      subtitles: dedupedSubs,
      cached: false,
      response_time_ms: Date.now() - startTime,
      sources_tried: sourcesTried,
      sources_succeeded: sourcesSucceeded,
      error: dedupedStreams.length === 0
        ? 'No m3u8 stream found from any source'
        : undefined,
    };

    // ── 5. CACHE IF SUCCESS ────────────────────────────────────
    if (result.success) {
      cache.set(cacheKey, result);
      logger.info(`[CACHED] ${cacheKey} — ${dedupedStreams.length} streams, ${dedupedSubs.length} subs`);
    }

    return result;
  }

  // ── PREWARM ───────────────────────────────────────────────
  static async prewarm(ids: number[]): Promise<void> {
    logger.info(`[PREWARM] Starting ${ids.length} titles...`);
    for (const tmdbId of ids) {
      try {
        const r = await this.hunt({ tmdbId, type: 'movie' });
        logger.info(`[PREWARM] ${tmdbId} → ${r.streams.length} streams`);
      } catch {}
      await new Promise(r => setTimeout(r, 2000)); // delay بين كل طلب
    }
    logger.info(`[PREWARM] Done!`);
  }
}

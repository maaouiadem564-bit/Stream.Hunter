import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { StreamHunter } from './scrapers/streamHunter';
import { healthTracker } from './health/sourceHealth';
import { MediaType, StreamRequest } from './types';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── HEALTH ────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'StreamHunter',
    version: '2.0.0',
    sources_health: healthTracker.getAllHealth(),
  });
});

// ── STREAM ────────────────────────────────────────────────────
// GET /stream?tmdbId=533535&type=movie
// GET /stream?tmdbId=1396&type=tv&season=1&episode=1
// GET /stream?tmdbId=21&type=anime&episode=1&title=One+Piece
app.get('/stream', async (req, res) => {
  try {
    const { tmdbId, imdbId, malId, type, season, episode, title, year } = req.query;

    if (!type) {
      return res.status(400).json({ success: false, error: 'Missing: type' });
    }
    if (!tmdbId && !imdbId && !malId) {
      return res.status(400).json({ success: false, error: 'Missing ID: tmdbId or imdbId or malId' });
    }

    const validTypes: MediaType[] = ['movie', 'tv', 'anime'];
    if (!validTypes.includes(type as MediaType)) {
      return res.status(400).json({ success: false, error: 'type must be: movie | tv | anime' });
    }

    const streamReq: StreamRequest = {
      tmdbId: tmdbId ? parseInt(tmdbId as string) : undefined,
      imdbId: imdbId as string | undefined,
      malId: malId ? parseInt(malId as string) : undefined,
      type: type as MediaType,
      season: season ? parseInt(season as string) : undefined,
      episode: episode ? parseInt(episode as string) : undefined,
      title: title as string | undefined,
      year: year ? parseInt(year as string) : undefined,
    };

    const result = await StreamHunter.hunt(streamReq);
    return res.json(result);

  } catch (err) {
    logger.error(`[API Error] ${(err as Error).message}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── SOURCES HEALTH ─────────────────────────────────────────────
app.get('/sources', (_, res) => {
  res.json({
    health: healthTracker.getAllHealth(),
  });
});

// ── START ──────────────────────────────────────────────────────
app.listen(PORT, async () => {
  logger.info(`\n🎬 StreamHunter v2 running on port ${PORT}`);
  logger.info(`📡 Health:  http://localhost:${PORT}/health`);
  logger.info(`🎥 Stream:  http://localhost:${PORT}/stream?tmdbId=533535&type=movie`);
  logger.info(`📊 Sources: http://localhost:${PORT}/sources\n`);

  // Prewarm أفلام شائعة في الخلفية
  const popular = [299536, 533535, 550, 27205, 155, 238, 680, 13, 278];
  StreamHunter.prewarm(popular).catch(() => {});
});

export type MediaType = 'movie' | 'tv' | 'anime';

export interface StreamRequest {
  tmdbId?: number;
  imdbId?: string;
  malId?: number;
  type: MediaType;
  season?: number;
  episode?: number;
  title?: string;
  year?: number;
}

export interface StreamSource {
  url: string;
  quality: string;
  isM3U8: boolean;
  source: string;
  lang?: string;
}

export interface Subtitle {
  url: string;
  lang: string;
  label: string;
  format: 'vtt' | 'srt' | 'ass';
}

export interface StreamResult {
  success: boolean;
  tmdbId?: number;
  imdbId?: string;
  type: MediaType;
  streams: StreamSource[];
  subtitles: Subtitle[];
  cached: boolean;
  response_time_ms: number;
  sources_tried: string[];
  sources_succeeded: string[];
  error?: string;
}

export interface ScraperResult {
  url: string;
  quality: string;
  isM3U8: boolean;
  subtitles?: Subtitle[];
}

export interface SourceHealth {
  name: string;
  successRate: number;
  avgResponseMs: number;
  lastChecked: Date;
  isAlive: boolean;
}

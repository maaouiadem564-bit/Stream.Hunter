import { MediaType } from '../types';

export interface SourceParams {
  tmdbId?: number;
  imdbId?: string;
  malId?: number;
  type: MediaType;
  season?: number;
  episode?: number;
  title?: string;
  year?: number;
}

export interface Source {
  name: string;
  supports: MediaType[];
  priority: number; // كلما قل الرقم كلما جرب أول
  buildUrl: (p: SourceParams) => string | null;
}

export const SOURCES: Source[] = [

  // ══════════════════════════════════════════
  // PRIORITY 1 — الأسرع والأكثر موثوقية
  // ══════════════════════════════════════════

  {
    name: 'VidSrc.to',
    supports: ['movie', 'tv'],
    priority: 1,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://vidsrc.to/embed/movie/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`;
      return null;
    }
  },
  {
    name: 'VidSrc.xyz',
    supports: ['movie', 'tv'],
    priority: 1,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
      return null;
    }
  },
  {
    name: 'VidSrc.cc',
    supports: ['movie', 'tv'],
    priority: 1,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://vidsrc.cc/v2/embed/movie/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`;
      return null;
    }
  },
  {
    name: 'VidSrc.me',
    supports: ['movie', 'tv'],
    priority: 1,
    buildUrl: ({ tmdbId, imdbId, type, season, episode }) => {
      const id = imdbId || tmdbId;
      if (!id) return null;
      if (type === 'movie') return `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
      return null;
    }
  },

  // ══════════════════════════════════════════
  // PRIORITY 2
  // ══════════════════════════════════════════

  {
    name: 'AutoEmbed',
    supports: ['movie', 'tv'],
    priority: 2,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://autoembed.cc/movie/tmdb/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://autoembed.cc/tv/tmdb/${tmdbId}-${season}-${episode}`;
      return null;
    }
  },
  {
    name: 'SuperEmbed',
    supports: ['movie', 'tv'],
    priority: 2,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
      if (type === 'tv' && season && episode) return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`;
      return null;
    }
  },
  {
    name: 'Embed.su',
    supports: ['movie', 'tv'],
    priority: 2,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://embed.su/embed/movie/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`;
      return null;
    }
  },
  {
    name: '2Embed',
    supports: ['movie', 'tv'],
    priority: 2,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://www.2embed.cc/embed/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`;
      return null;
    }
  },
  {
    name: 'VidLink',
    supports: ['movie', 'tv'],
    priority: 2,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://vidlink.pro/movie/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;
      return null;
    }
  },
  {
    name: 'MoviesAPI',
    supports: ['movie', 'tv'],
    priority: 2,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://moviesapi.club/movie/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`;
      return null;
    }
  },

  // ══════════════════════════════════════════
  // PRIORITY 3
  // ══════════════════════════════════════════

  {
    name: 'SmashyStream',
    supports: ['movie', 'tv'],
    priority: 3,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://player.smashy.stream/movie/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://player.smashy.stream/tv/${tmdbId}?s=${season}&e=${episode}`;
      return null;
    }
  },
  {
    name: 'NontonGo',
    supports: ['movie', 'tv'],
    priority: 3,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://www.nontongo.win/embed/movie/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://www.nontongo.win/embed/tv/${tmdbId}/${season}/${episode}`;
      return null;
    }
  },
  {
    name: 'EmbedSito',
    supports: ['movie', 'tv'],
    priority: 3,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://embedsito.com/v/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://embedsito.com/v/${tmdbId}/${season}/${episode}`;
      return null;
    }
  },
  {
    name: 'DBGo',
    supports: ['movie', 'tv'],
    priority: 3,
    buildUrl: ({ imdbId, type, season, episode }) => {
      if (!imdbId) return null;
      if (type === 'movie') return `https://www.db.go.com/embed/movie/${imdbId}`;
      if (type === 'tv' && season && episode) return `https://www.db.go.com/embed/tv/${imdbId}/${season}/${episode}`;
      return null;
    }
  },
  {
    name: 'FilmXY',
    supports: ['movie', 'tv'],
    priority: 3,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://filmxy.vip/embed/movie/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://filmxy.vip/embed/tv/${tmdbId}/${season}/${episode}`;
      return null;
    }
  },
  {
    name: 'CineStream',
    supports: ['movie', 'tv'],
    priority: 3,
    buildUrl: ({ tmdbId, type, season, episode }) => {
      if (!tmdbId) return null;
      if (type === 'movie') return `https://cinestream.to/embed/movie/${tmdbId}`;
      if (type === 'tv' && season && episode) return `https://cinestream.to/embed/tv/${tmdbId}/${season}/${episode}`;
      return null;
    }
  },

  // ══════════════════════════════════════════
  // ANIME SOURCES
  // ══════════════════════════════════════════

  {
    name: 'Gogoanime',
    supports: ['anime'],
    priority: 1,
    buildUrl: ({ title, episode }) => {
      if (!title) return null;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return `https://gogoanime3.co/${slug}-episode-${episode ?? 1}`;
    }
  },
  {
    name: 'AnimePahe',
    supports: ['anime'],
    priority: 1,
    buildUrl: ({ title }) => {
      if (!title) return null;
      return `https://animepahe.ru/anime/${encodeURIComponent(title)}`;
    }
  },
  {
    name: 'AnimeKai',
    supports: ['anime'],
    priority: 2,
    buildUrl: ({ title, episode }) => {
      if (!title) return null;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return `https://animekai.to/watch/${slug}-ep-${episode ?? 1}`;
    }
  },
  {
    name: 'AnimeFlix',
    supports: ['anime'],
    priority: 2,
    buildUrl: ({ title, episode }) => {
      if (!title) return null;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return `https://animeflix.io/watch/${slug}/episode-${episode ?? 1}`;
    }
  },
];

export function getSourcesForType(type: MediaType): Source[] {
  return SOURCES
    .filter(s => s.supports.includes(type))
    .sort((a, b) => a.priority - b.priority);
}

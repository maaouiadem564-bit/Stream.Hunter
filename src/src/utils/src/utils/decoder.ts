// ============================================================
// DECODER — فك كل أنواع التشفير المستخدمة في مواقع الستريم
// ============================================================

export class Decoder {

  // ✅ فك Base64
  static decodeBase64(text: string): string[] {
    const found: string[] = [];
    const pattern = /['"`]([A-Za-z0-9+/]{40,}={0,2})['"`;,\s]/g;
    for (const match of text.matchAll(pattern)) {
      try {
        const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
        if (this.containsM3U8(decoded)) {
          const urls = this.extractUrls(decoded);
          found.push(...urls);
        }
      } catch {}
    }
    return found;
  }

  // ✅ فك ROT13
  static decodeRot13(text: string): string {
    return text.replace(/[A-Za-z]/g, (c) => {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    });
  }

  // ✅ فك Unicode Escape مثل \u0068\u0074\u0074\u0070
  static decodeUnicode(text: string): string {
    try {
      return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
    } catch { return text; }
  }

  // ✅ فك Hex Encoding مثل %68%74%74%70
  static decodeHex(text: string): string {
    try {
      return decodeURIComponent(text);
    } catch { return text; }
  }

  // ✅ فك atob() JavaScript
  static decodeAtob(text: string): string[] {
    const found: string[] = [];
    const pattern = /atob\(['"`]([A-Za-z0-9+/=]+)['"`]\)/g;
    for (const match of text.matchAll(pattern)) {
      try {
        const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
        if (this.containsM3U8(decoded)) {
          found.push(...this.extractUrls(decoded));
        }
      } catch {}
    }
    return found;
  }

  // ✅ فك String.fromCharCode([72,84,84,80])
  static decodeCharCode(text: string): string[] {
    const found: string[] = [];
    const pattern = /String\.fromCharCode\(([0-9,\s]+)\)/g;
    for (const match of text.matchAll(pattern)) {
      try {
        const chars = match[1].split(',').map(n => parseInt(n.trim()));
        const decoded = String.fromCharCode(...chars);
        if (this.containsM3U8(decoded)) {
          found.push(...this.extractUrls(decoded));
        }
      } catch {}
    }
    return found;
  }

  // ✅ فك JSON مخفي داخل JS
  static decodeHiddenJson(text: string): string[] {
    const found: string[] = [];
    const pattern = /['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/g;
    for (const match of text.matchAll(pattern)) {
      found.push(match[1]);
    }
    return found;
  }

  // ✅ تشغيل كل أنواع الفك دفعة واحدة
  static decodeAll(text: string): string[] {
    const results = new Set<string>();

    // Direct URLs
    this.extractUrls(text).forEach(u => results.add(u));

    // Base64
    this.decodeBase64(text).forEach(u => results.add(u));

    // atob()
    this.decodeAtob(text).forEach(u => results.add(u));

    // fromCharCode
    this.decodeCharCode(text).forEach(u => results.add(u));

    // Hidden JSON
    this.decodeHiddenJson(text).forEach(u => results.add(u));

    // Unicode
    const unicodeDecoded = this.decodeUnicode(text);
    this.extractUrls(unicodeDecoded).forEach(u => results.add(u));

    // ROT13
    const rot13Decoded = this.decodeRot13(text);
    if (this.containsM3U8(rot13Decoded)) {
      this.extractUrls(rot13Decoded).forEach(u => results.add(u));
    }

    return [...results];
  }

  static containsM3U8(text: string): boolean {
    return (
      text.includes('.m3u8') ||
      text.includes('/hls/') ||
      text.includes('manifest.m3u') ||
      text.includes('playlist.m3u') ||
      text.includes('index.m3u')
    );
  }

  static extractUrls(text: string): string[] {
    const pattern = /https?:\/\/[^\s'"<>`,\\]+\.m3u8[^\s'"<>`,\\]*/g;
    return [...new Set(text.match(pattern) || [])];
  }

  static detectQuality(url: string, label?: string): string {
    const combined = `${url} ${label || ''}`.toLowerCase();
    if (combined.includes('4k') || combined.includes('2160')) return '4K';
    if (combined.includes('1080')) return '1080p';
    if (combined.includes('720')) return '720p';
    if (combined.includes('480')) return '480p';
    if (combined.includes('360')) return '360p';
    if (combined.includes('240')) return '240p';
    return 'auto';
  }
}

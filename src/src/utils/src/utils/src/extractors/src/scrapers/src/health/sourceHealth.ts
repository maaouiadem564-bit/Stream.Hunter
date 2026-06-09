import { SourceHealth } from '../types';
import { logger } from '../utils/logger';

// ============================================================
// SOURCE HEALTH TRACKER
// يتابع أي مصدر يشتغل وأيهم يفشل — يعطي أولوية للناجحين
// ============================================================

class HealthTracker {
  private stats: Map<string, {
    success: number;
    fail: number;
    totalMs: number;
    lastChecked: Date;
  }> = new Map();

  record(sourceName: string, success: boolean, responseMs: number): void {
    const existing = this.stats.get(sourceName) || {
      success: 0, fail: 0, totalMs: 0, lastChecked: new Date()
    };
    if (success) existing.success++;
    else existing.fail++;
    existing.totalMs += responseMs;
    existing.lastChecked = new Date();
    this.stats.set(sourceName, existing);
  }

  getHealth(sourceName: string): SourceHealth {
    const s = this.stats.get(sourceName);
    if (!s) return {
      name: sourceName,
      successRate: 1,
      avgResponseMs: 0,
      lastChecked: new Date(),
      isAlive: true,
    };
    const total = s.success + s.fail;
    const successRate = total === 0 ? 1 : s.success / total;
    return {
      name: sourceName,
      successRate,
      avgResponseMs: total === 0 ? 0 : s.totalMs / total,
      lastChecked: s.lastChecked,
      isAlive: successRate > 0.1, // ميت إذا نجح أقل من 10%
    };
  }

  getAllHealth(): SourceHealth[] {
    const allNames = [...this.stats.keys()];
    return allNames.map(name => this.getHealth(name));
  }

  // مصادر فاشلة كثير — تجاهلها مؤقتاً
  isDead(sourceName: string): boolean {
    const h = this.getHealth(sourceName);
    const s = this.stats.get(sourceName);
    if (!s) return false;
    const total = s.success + s.fail;
    return total >= 5 && !h.isAlive;
  }
}

export const healthTracker = new HealthTracker();

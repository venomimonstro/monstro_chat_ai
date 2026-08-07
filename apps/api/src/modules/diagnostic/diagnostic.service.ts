import { Injectable, Logger } from '@nestjs/common';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

export interface DiagnosticCheck {
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

export interface DiagnosticReport {
  timestamp: string;
  installDir: string;
  summary: { errors: number; warnings: number };
  checks: Record<string, DiagnosticCheck>;
  errors: string[];
  warnings: string[];
}

const INSTALL_DIR = process.env.INSTALL_DIR || '/opt/monstro_chat_ai';
const REPORT_PATH = resolve(INSTALL_DIR, '.deploy', 'diagnose-report.json');

@Injectable()
export class DiagnosticService {
  private readonly logger = new Logger('DiagnosticService');

  getReport(): DiagnosticReport & { lastReportAgeSeconds?: number } {
    if (!existsSync(REPORT_PATH)) {
      return {
        timestamp: new Date().toISOString(),
        installDir: INSTALL_DIR,
        summary: { errors: 1, warnings: 0 },
        checks: {
          report: { status: 'fail', detail: 'diagnose-report.json не найден — запустите scripts/aicw-diagnose.sh' },
        },
        errors: ['Диагностический агент ещё не запускался'],
        warnings: [],
      };
    }
    try {
      const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as DiagnosticReport;
      const stat = statSync(REPORT_PATH);
      return {
        ...report,
        lastReportAgeSeconds: Math.floor((Date.now() - stat.mtimeMs) / 1000),
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.error(`Не удалось прочитать ${REPORT_PATH}: ${err}`);
      return {
        timestamp: new Date().toISOString(),
        installDir: INSTALL_DIR,
        summary: { errors: 1, warnings: 0 },
        checks: { report: { status: 'fail', detail: err } },
        errors: [err],
        warnings: [],
      };
    }
  }

  runNow(full = false): { ok: boolean; stdout: string; stderr: string; report: DiagnosticReport } {
    const script = resolve(INSTALL_DIR, 'scripts', 'aicw-diagnose.sh');
    const result = spawnSync('/usr/bin/env', ['bash', script], {
      cwd: INSTALL_DIR,
      timeout: 180_000,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const report = this.getReport();
    return {
      ok: result.status === 0,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      report,
    };
  }

  quickCheck(): {
    apiHealth: { ok: boolean; status: string };
    authMe: { ok: boolean; status: string };
    authCsrf: { ok: boolean; status: string };
    admin: { ok: boolean; status: string };
    client: { ok: boolean; status: string };
    publicSite: { ok: boolean; status: string };
    widget: { ok: boolean; status: string };
  } {
    const http = (url: string) => {
      try {
        const result = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '5', url], {
          encoding: 'utf8',
          timeout: 10_000,
        });
        const code = result.stdout?.trim() || '000';
        return { ok: code === '200' || code === '401' || code === '403' || code === '302', status: code };
      } catch (e) {
        return { ok: false, status: 'error' };
      }
    };
    return {
      apiHealth: http('http://127.0.0.1:3000/api/health'),
      authMe: http('http://127.0.0.1:3000/api/auth/me'),
      authCsrf: http('http://127.0.0.1:3000/api/auth/csrf'),
      admin: http('http://127.0.0.1:5174/'),
      client: http('http://127.0.0.1:5173/'),
      publicSite: http('http://127.0.0.1:4321/'),
      widget: http('http://127.0.0.1:5175/embed.js'),
    };
  }
}

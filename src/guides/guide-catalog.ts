import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../logger.js';
import { GUIDE_IDS, guideNotation, type GuideId } from './guide-ids.js';
import type { DiagramFormat } from '../domain.js';

/**
 * Guide Catalog (aws-icons `plan.md` §3.2–3.3): loads the shipped Markdown guides once at boot from
 * a **closed** id set (no directory listing, no Requester-controlled path), resolves the single
 * `{{AWS_ICONS_VERSION}}` placeholder and serves them from memory. A missing file only omits that
 * guide (CI makes it impossible in a release).
 */

export const AWS_ICONS_VERSION_PLACEHOLDER = '{{AWS_ICONS_VERSION}}';

export interface Guide {
  readonly id: GuideId;
  readonly title: string;
  readonly summary: string;
  readonly notation: DiagramFormat;
  readonly markdown: string;
}

export interface GuideCatalog {
  readonly awsIconsVersion: string | null;
  readonly guides: ReadonlyMap<GuideId, Guide>;
}

/** Title = first `# ` line; summary = the first paragraph after it. */
export function parseGuide(id: GuideId, markdown: string): Guide {
  const lines = markdown.split(/\r?\n/);
  const titleIndex = lines.findIndex((l) => l.startsWith('# '));
  const title = titleIndex === -1 ? id : (lines[titleIndex] ?? '').slice(2).trim();
  const paragraph: string[] = [];
  for (let i = titleIndex + 1; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (line === '') {
      if (paragraph.length > 0) break;
      continue;
    }
    if (line.startsWith('#')) break;
    paragraph.push(line);
  }
  return { id, title, summary: paragraph.join(' '), notation: guideNotation(id), markdown };
}

export async function loadGuideCatalog(guidesRoot: string, awsIconsVersion: string | null): Promise<GuideCatalog> {
  const guides = new Map<GuideId, Guide>();
  for (const id of GUIDE_IDS) {
    let raw: string;
    try {
      raw = await readFile(path.join(guidesRoot, `${id}.md`), 'utf8');
    } catch (error) {
      // Only an absent file is an omission; anything else (permissions, I/O) is reported by code.
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') logger.warn('guides.unreadable', { id, code: code ?? 'UNKNOWN' });
      continue;
    }
    const markdown = raw.split(AWS_ICONS_VERSION_PLACEHOLDER).join(awsIconsVersion ?? 'unavailable');
    guides.set(id, parseGuide(id, markdown));
  }
  // The id set is closed and shipped, so a missing guide is a broken package: warn with the counts.
  // Guide ids are a closed set of System constants (never Requester input), so naming them is safe.
  const absent = GUIDE_IDS.filter((id) => !guides.has(id));
  const missing = absent.length;
  const fields = { count: guides.size, expected: GUIDE_IDS.length, missing, ...(missing > 0 ? { missingIds: absent.join(',') } : {}) };
  if (missing > 0) logger.warn('guides.ready', fields);
  else logger.info('guides.ready', fields);
  return { awsIconsVersion, guides };
}

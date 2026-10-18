import fs from 'node:fs/promises';
import path from 'node:path';
import { estimateReadingMinutes } from './article-meta';

export async function loadNotes() {
  const directory = path.join(process.cwd(), 'src/data/notes');
  let files: string[];
  try { files = await fs.readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const notes = await Promise.all(files.filter(file => file.endsWith('.json')).map(async file => {
    const data = JSON.parse(await fs.readFile(path.join(directory, file), 'utf-8'));
    return { ...data, slug: file.slice(0, -5), section: data.section ?? 'posts',
      readingMinutes: estimateReadingMinutes(data.contentHtml ?? ''), order: data.order ?? 999 };
  }));
  return notes.sort((a, b) => a.order - b.order);
}

import { unzipSync, strFromU8 } from 'fflate';

export interface LoadedScore {
  data: string | ArrayBuffer;
  isCompressed: boolean;
}

export function extractMusicXmlFromMxl(buffer: ArrayBuffer): string {
  const unzipped = unzipSync(new Uint8Array(buffer));
  for (const [name, data] of Object.entries(unzipped)) {
    if (
      name.endsWith('.musicxml') ||
      (name.endsWith('.xml') && !name.includes('META-INF') && name !== 'container.xml')
    ) {
      return strFromU8(data);
    }
  }
  throw new Error('No MusicXML file found in .mxl archive');
}

export async function loadFromFile(file: File): Promise<LoadedScore> {
  const isCompressed = file.name.endsWith('.mxl');
  if (isCompressed) {
    return { data: await file.arrayBuffer(), isCompressed: true };
  }
  return { data: await file.text(), isCompressed: false };
}

export async function loadFromUrl(url: string): Promise<LoadedScore> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  const isCompressed =
    url.endsWith('.mxl') ||
    response.headers.get('content-type')?.includes('application/vnd.recordare.musicxml') === true;
  if (isCompressed) {
    return { data: await response.arrayBuffer(), isCompressed: true };
  }
  return { data: await response.text(), isCompressed: false };
}

export interface LoadedScore {
  data: string | ArrayBuffer;
  isCompressed: boolean;
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

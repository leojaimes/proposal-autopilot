type ApifyResponse = { ok: boolean; json(): Promise<unknown> };
type FetchPage = (url: string) => Promise<ApifyResponse>;

export function findOldestApifyJobPostedAt(items: Record<string, unknown>[]): Date | null {
  let oldest: Date | null = null;
  for (const item of items) {
    if (typeof item.date_posted !== 'string') continue;
    const postedAt = new Date(item.date_posted);
    if (Number.isNaN(postedAt.valueOf())) continue;
    if (!oldest || postedAt < oldest) oldest = postedAt;
  }
  return oldest;
}

export async function readApifyDatasetPages(
  datasetId: string,
  token: string,
  fetchPage: FetchPage = (url) => fetch(url),
  pageSize = 1000,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`https://api.apify.com/v2/datasets/${datasetId}/items`);
    url.searchParams.set('token', token);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('clean', 'true');
    const response = await fetchPage(url.toString());
    if (!response.ok) throw new Error(`Apify dataset ${datasetId} could not be read`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Apify dataset ${datasetId} returned an invalid page`);
    items.push(...page as Record<string, unknown>[]);
    if (page.length < pageSize) return items;
  }
}

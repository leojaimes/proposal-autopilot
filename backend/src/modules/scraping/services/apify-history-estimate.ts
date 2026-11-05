export type ApifyHistoryEstimate = {
  postingCount: number;
  from: string;
  to: string;
};

export function parseApifyHistoryEstimate(statusMessage: string): ApifyHistoryEstimate {
  const match = statusMessage.match(/([\d,]+) postings, (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error('Apify estimate did not include a posting count and date range');
  return {
    postingCount: Number(match[1].replaceAll(',', '')),
    from: match[2],
    to: match[3],
  };
}

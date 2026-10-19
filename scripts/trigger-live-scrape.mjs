console.log('--- Triggering Live Apify Upwork Scraper ---');

const res = await fetch('http://localhost:7000/api/scraping/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    keywords: ['UX Designer', 'Figma', 'Product Designer', 'Design Systems', 'AI UX'],
    maxResults: 15
  })
});

const data = await res.json();
console.log('Apify Run Result:', JSON.stringify(data, null, 2));

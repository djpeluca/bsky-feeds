import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppContext } from '../config';
import algos from '../algos';
import { getFeedAnalytics, getAvailableFeeds } from './analytics';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createLandingPageRouter = (ctx: AppContext) => {
  const router = express.Router();
  router.use('/static', express.static(path.join(__dirname, 'public')));

  router.get('/api/feeds', (req, res) => {
    try {
      const feeds = getAvailableFeeds();
      res.json(feeds);
    } catch (error) {
      console.error('Error getting available feeds:', error);
      res.status(500).json({ error: 'Failed to get available feeds' });
    }
  });

  router.get('/api/analytics/:feedId', async (req, res) => {
    try {
      const feedId = req.params.feedId;
      const period = (req.query.period as string) || 'week';

      if (!algos[feedId]) return res.status(404).json({ error: 'Feed not found' });

      const analytics = await getFeedAnalytics(feedId, period);
      res.json(analytics);
    } catch (error) {
      console.error(`Error getting analytics for feed ${req.params.feedId}:`, error);
      res.status(500).json({ error: `Failed to get analytics for feed ${req.params.feedId}` });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const feedAlgos = Object.keys(algos).map(key => ({
        name: key,
        displayName: key.charAt(0).toUpperCase() + key.slice(1),
      }));
      res.send(generateLandingPageHTML(feedAlgos));
    } catch (error) {
      console.error('Error rendering landing page:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
};

function generateLandingPageHTML(feeds: { name: string; displayName: string }[]) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bsky Feeds Analytics Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body { font-family: Arial; margin: 0; background: #f4f4f4; }
header { background: #0066cc; color: white; padding: 1rem; text-align: center; }
.container { max-width: 1200px; margin: auto; padding: 1rem; }
.dashboard { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }
.card { background: white; padding: 1rem; border-radius: 8px; flex: 1 1 300px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.chart-container { height: 200px; }
.stat-item { margin: 0.5rem 0; display: flex; justify-content: space-between; }
.loading { color: gray; }
.error { color: red; }
</style>
</head>
<body>
<header><h1>Bsky Feeds Analytics Dashboard</h1></header>
<div class="container">
  <div class="dashboard">
    ${feeds.map(feed => `
      <div class="card" id="${feed.name}-card">
        <h2>${feed.displayName}</h2>
        <div class="stats" id="${feed.name}-stats"><div class="loading">Loading analytics...</div></div>
        <div class="chart-container">
          <canvas id="${feed.name}-chart"></canvas>
        </div>
      </div>
    `).join('')}
  </div>
</div>
<script>
async function fetchAnalytics(feedId, timeout=15000){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeout);
  try{
    const res = await fetch(\`/dashboard/api/analytics/\${feedId}\`, { signal: controller.signal });
    if(!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch(err){ 
    console.error(\`Analytics fetch failed for \${feedId}:\`, err); 
    return null; 
  } finally { clearTimeout(timer); }
}

function updateFeedCard(feedId, data){
  const stats = document.getElementById(\`\${feedId}-stats\`);
  if(!data){ stats.innerHTML='<div class="error">Failed to load analytics</div>'; return; }
  stats.innerHTML=\`
    <div class="stat-item"><span>Total Posts:</span><strong>\${data.postCount}</strong></div>
    <div class="stat-item"><span>Unique Authors:</span><strong>\${data.uniqueAuthors}</strong></div>
    <div class="stat-item"><span>Average Posts Per Day:</span><strong>\${data.avgPostsPerDay.toFixed(2)}</strong></div>
  \`;
  if(data.weeklyQuantity){
    const ctx=document.getElementById(\`\${feedId}-chart\`).getContext('2d');
    new Chart(ctx,{
      type:'bar',
      data:{ labels:data.weeklyQuantity.map(d=>d.week), datasets:[{label:'Posts per Week', data:data.weeklyQuantity.map(d=>d.count), backgroundColor:'rgba(0,102,204,0.7)', borderColor:'rgba(0,102,204,1)', borderWidth:1}]},
      options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
    });
  }
}

async function initDashboard(){
  const feeds=${JSON.stringify(feeds)};
  const brasilIndex = feeds.findIndex(f => f.name === 'brasil');
  const normalFeeds = feeds.filter(f => f.name !== 'brasil');

  // Load normal feeds sequentially
  for(const feed of normalFeeds){
    const data=await fetchAnalytics(feed.name);
    updateFeedCard(feed.name, data);
  }

  // Load brasil feed last, progressively
  if(brasilIndex>=0){
    const brasilFeed = feeds[brasilIndex];
    const placeholderStats = document.getElementById(\`\${brasilFeed.name}-stats\`);
    placeholderStats.innerHTML='<div class="loading">Loading brasil analytics (this may take a few seconds)...</div>';
    const data = await fetchAnalytics(brasilFeed.name, 30000); // increase timeout
    updateFeedCard(brasilFeed.name, data);
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);
</script>
</body>
</html>`;
}

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
      const analytics = await getFeedAnalytics(feedId);
      res.json(analytics);
    } catch (error) {
      console.error(`Error getting analytics for feed ${req.params.feedId}:`, error);
      res.status(500).json({ error: `Failed to get analytics for feed ${req.params.feedId}` });
    }
  });

  router.get('/', async (req, res) => {
    try {
      // Filter out the "external" feed
      const feedAlgos = Object.keys(algos)
        .filter(key => key !== 'external')
        .map(key => ({
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
<script src="https://cdn.jsdelivr.net/npm/chart.js" defer></script>
<style>
body { font-family: Arial; margin: 0; background: #f4f4f4; }
header { background: #0066cc; color: white; padding: 1rem; text-align: center; }
.container { max-width: 1400px; margin: auto; padding: 1rem; }
.dashboard { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }
.card { background: white; padding: 1rem; border-radius: 8px; flex: 1 1 450px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.chart-container { height: 250px; }
.stat-item { margin: 0.5rem 0; display: flex; justify-content: space-between; }
.trend-up { color: green; }
.trend-down { color: red; }
.heatmap { display: grid; grid-template-columns: repeat(24, 1fr); gap: 1px; }
.heatmap-cell { width: 100%; padding-top: 100%; position: relative; }
.heatmap-cell div { position: absolute; top:0; left:0; right:0; bottom:0; text-align:center; font-size:0.6rem; }
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
        <div class="chart-container"><canvas id="${feed.name}-weeklyChart"></canvas></div>
        <h3>Activity Heatmap (Day × Hour)</h3>
        <div class="heatmap" id="${feed.name}-heatmap"></div>
      </div>
    `).join('')}
  </div>
</div>
<script defer>
async function fetchAnalytics(feedId, timeout=20000){
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

function renderTrend(val){
  if(val > 0) return '<span class="trend-up">↑ '+val+'%</span>';
  if(val < 0) return '<span class="trend-down">↓ '+Math.abs(val)+'%</span>';
  return '<span>'+val+'%</span>';
}

function updateFeedCard(feedId, data){
  const stats = document.getElementById(\`\${feedId}-stats\`);
  if(!data){ stats.innerHTML='<div class="error">Failed to load analytics</div>'; return; }

  stats.innerHTML=\`
    <div class="stat-item"><span>Total Posts:</span><strong>\${data.postCount}</strong> \${renderTrend(data.postCountTrend)}</div>
    <div class="stat-item"><span>Unique Authors:</span><strong>\${data.uniqueAuthors}</strong> \${renderTrend(data.uniqueAuthorsTrend)}</div>
    <div class="stat-item"><span>Average Posts/Day:</span><strong>\${data.avgPostsPerDay.toFixed(2)}</strong> \${renderTrend(data.avgPostsPerDayTrend)}</div>
  \`;

  // Weekly bar chart
  if(data.weeklyQuantity){
    const ctx=document.getElementById(\`\${feedId}-weeklyChart\`).getContext('2d');
    new Chart(ctx,{ type:'bar',
      data:{ labels:data.weeklyQuantity.map(d=>d.week), 
             datasets:[{label:'Posts per Week', data:data.weeklyQuantity.map(d=>d.count),
                        backgroundColor:'rgba(0,102,204,0.7)', borderColor:'rgba(0,102,204,1)', borderWidth:1}]},
      options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
    });
  }


  // Heatmap
  const heatmapEl=document.getElementById(\`\${feedId}-heatmap\`);
  if(data.dowHourHeatmap){
    const maxCount = Math.max(...data.dowHourHeatmap.map(c=>c.count));
    heatmapEl.innerHTML=data.dowHourHeatmap.map(c=>{
      const intensity = maxCount>0 ? Math.round((c.count/maxCount)*255) : 0;
      const color = 'rgb('+intensity+',0,'+(255-intensity)+')';
      return '<div class="heatmap-cell" style="background:'+color+'"><div>'+ (c.count>0?c.count:'') +'</div></div>';
    }).join('');
  }
}

async function initDashboard(){
  const feeds=${JSON.stringify(feeds)};
  // Load each feed separately to avoid blocking
  for(const feed of feeds){
    fetchAnalytics(feed.name).then(data => updateFeedCard(feed.name, data));
  }
}
document.addEventListener('DOMContentLoaded', initDashboard);
</script>
</body>
</html>`;
}

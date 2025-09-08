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
      // Exclude "external" / "penarol"
      let feedAlgos = Object.keys(algos)
        .filter(key => key !== 'external' && key !== 'penarol')
        .map(key => ({
          name: key,
          displayName: key.charAt(0).toUpperCase() + key.slice(1),
        }));

      // Display name fixes
      feedAlgos = feedAlgos.map(f => f.name === 'ai' ? { ...f, displayName: 'AI' } : f);

      const regionalOrder = ['uruguay','argentina','brasil','riodelaplata'];
      const techOrder = ['fediverse','ai','salesforce'];

      const regionalFeeds = feedAlgos
        .filter(f => regionalOrder.includes(f.name))
        .sort((a,b) => regionalOrder.indexOf(a.name) - regionalOrder.indexOf(b.name));

      const techFeeds = feedAlgos
        .filter(f => techOrder.includes(f.name))
        .sort((a,b) => techOrder.indexOf(a.name) - techOrder.indexOf(b.name));

      const orderedFeeds = [...regionalFeeds, ...techFeeds];

      res.send(generateLandingPageHTML(orderedFeeds, regionalFeeds.map(f => f.name)));
    } catch (error) {
      console.error('Error rendering landing page:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
};

function generateLandingPageHTML(feeds: { name: string; displayName: string }[], GMT3_FEEDS: string[]) {
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
.block-title { width: 100%; font-size: 1.2rem; margin-top: 2rem; margin-bottom: 0.5rem; font-weight: bold; }
.card { background: white; padding: 1rem; border-radius: 8px; flex: 1 1 450px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.chart-container { height: 250px; }

.stat-item { display: flex; align-items: center; margin: 0.5rem 0; }
.stat-label { flex: 1; text-align: left; }
.stat-value { flex: 0; min-width: 70px; text-align: right; }
.stat-trend { flex: 0; text-align: right; white-space: nowrap; margin-left: 0.5rem; }
.trend-up { color: green; }
.trend-down { color: red; }

.heatmap-wrapper { display: flex; gap: 4px; }
.heatmap-labels { display: flex; flex-direction: column; justify-content: flex-start; font-size:0.8rem; line-height:1; }
.heatmap-labels div { flex:1; display:flex; align-items:center; justify-content:flex-end; padding-right:4px; }

.heatmap { display: flex; flex-direction: column; gap:2px; flex:1; }
.heatmap-row { display: flex; width: 100%; }
.heatmap-cell { flex:1; aspect-ratio: 1 / 1; }
.loading { color: gray; }
.error { color: red; }
</style>
</head>
<body>
<header><h1>Bsky Feeds Analytics Dashboard</h1></header>
<div class="container">
  <div class="dashboard">
    <div class="block-title">Regional Feeds</div>
    ${feeds.filter(f => GMT3_FEEDS.includes(f.name)).map(feed => `
      <div class="card" id="${feed.name}-card" data-tz="gmt-3">
        <h2>${feed.displayName}</h2>
        <div class="stats" id="${feed.name}-stats"><div class="loading">Loading analytics...</div></div>
        <div class="chart-container"><canvas id="${feed.name}-weeklyChart"></canvas></div>
        <h3>Activity Heatmap (Day × Hour, local time)</h3>
        <div class="heatmap-wrapper">
          <div class="heatmap-labels" id="${feed.name}-heatmap-labels"></div>
          <div class="heatmap" id="${feed.name}-heatmap"></div>
        </div>
      </div>
    `).join('')}

    <div class="block-title">Tech Feeds</div>
    ${feeds.filter(f => !GMT3_FEEDS.includes(f.name)).map(feed => `
      <div class="card" id="${feed.name}-card" data-tz="utc">
        <h2>${feed.displayName}</h2>
        <div class="stats" id="${feed.name}-stats"><div class="loading">Loading analytics...</div></div>
        <div class="chart-container"><canvas id="${feed.name}-weeklyChart"></canvas></div>
        <h3>Activity Heatmap (Day × Hour, UTC)</h3>
        <div class="heatmap-wrapper">
          <div class="heatmap-labels" id="${feed.name}-heatmap-labels"></div>
          <div class="heatmap" id="${feed.name}-heatmap"></div>
        </div>
      </div>
    `).join('')}
  </div>
</div>

<script defer>
async function fetchAnalytics(feedId, timeout=60000){
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
    <div class="stat-item">
      <span class="stat-label">Total Posts:</span>
      <strong class="stat-value">\${data.postCount}</strong>
      <span class="stat-trend">\${renderTrend(data.postCountTrend)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Unique Authors:</span>
      <strong class="stat-value">\${data.uniqueAuthors}</strong>
      <span class="stat-trend">\${renderTrend(data.uniqueAuthorsTrend)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Average Posts/Day:</span>
      <strong class="stat-value">\${data.avgPostsPerDay.toFixed(2)}</strong>
      <span class="stat-trend">\${renderTrend(data.avgPostsPerDayTrend)}</span>
    </div>
  \`;

  if(data.dailyQuantity){
    const ctx = document.getElementById(\`\${feedId}-weeklyChart\`).getContext('2d');
    if (Chart.getChart(ctx)) Chart.getChart(ctx).destroy();
    new Chart(ctx,{ type:'bar',
      data:{ labels:data.dailyQuantity.map(d=>d.day), 
             datasets:[{label:'Posts per Day', data:data.dailyQuantity.map(d=>d.count),
                        backgroundColor:'rgba(0,102,204,0.7)', borderColor:'rgba(0,102,204,1)', borderWidth:1}]},
      options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
    });
  }

  const heatmapEl = document.getElementById(\`\${feedId}-heatmap\`);
  const labelEl = document.getElementById(\`\${feedId}-heatmap-labels\`);
  if(data.dowHourHeatmap){
    const maxCount = Math.max(...data.dowHourHeatmap.map(c=>c.count));
    const dowLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    heatmapEl.innerHTML = '';
    labelEl.innerHTML = '';

    for(let d=1; d<=7; d++){
      const labelDiv = document.createElement('div');
      labelDiv.textContent = dowLabels[d-1];
      labelEl.appendChild(labelDiv);

      const rowDiv = document.createElement('div');
      rowDiv.className='heatmap-row';

      for(let h=0; h<24; h++){
        const cell = data.dowHourHeatmap.find(c => c.dow === d && c.hour === h);
        const count = cell ? cell.count : 0;
        const intensity = maxCount>0 ? Math.round((count/maxCount)*255) : 0;
        const color = 'rgb('+intensity+',0,'+(255-intensity)+')';

        const cellDiv = document.createElement('div');
        cellDiv.className='heatmap-cell';
        cellDiv.style.background=color;
        rowDiv.appendChild(cellDiv);
      }
      heatmapEl.appendChild(rowDiv);
    }
  }
}

async function initDashboard(){
  const feeds = ${JSON.stringify(feeds)};
  for(const feed of feeds){
    fetchAnalytics(feed.name).then(data => updateFeedCard(feed.name, data));
  }
}
document.addEventListener('DOMContentLoaded', initDashboard);
</script>
</body>
</html>
`;
}

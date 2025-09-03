import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppContext } from '../config';
import algos from '../algos';
import { getFeedAnalytics, getAvailableFeeds } from './analytics';

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createLandingPageRouter = (ctx: AppContext) => {
  const router = express.Router();

  // Serve static files from 'public' folder if needed
  router.use('/static', express.static(path.join(__dirname, 'public')));

  // API endpoints for analytics
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

      if (!algos[feedId]) {
        return res.status(404).json({ error: 'Feed not found' });
      }

      const analytics = await getFeedAnalytics(feedId, period);
      res.json(analytics);
    } catch (error) {
      console.error(`Error getting analytics for feed ${req.params.feedId}:`, error);
      res.status(500).json({ error: `Failed to get analytics for feed ${req.params.feedId}` });
    }
  });

  // Landing page
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

// Frontend HTML generator with inline CSS and sequential feed loading
function generateLandingPageHTML(feeds: { name: string; displayName: string }[]) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bsky Feeds Analytics Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    header { background: #0066cc; color: white; padding: 1rem; text-align: center; }
    .container { padding: 1rem; }
    .dashboard { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }
    .card { background: white; padding: 1rem; border-radius: 8px; width: 300px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .card h2 { margin-top: 0; }
    .stats { margin-bottom: 1rem; }
    .stat-item { display: flex; justify-content: space-between; margin: 0.5rem 0; }
    .loading { color: #888; }
    .error { color: red; }
    .chart-container { position: relative; height: 200px; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <header><h1>Bsky Feeds Analytics Dashboard</h1></header>
  <div class="container">
    <div class="dashboard">
      ${feeds
        .map(feed => `
        <div class="card" id="${feed.name}-card">
          <h2>${feed.displayName}</h2>
          <div class="stats" id="${feed.name}-stats">
            <div class="loading">Loading analytics...</div>
          </div>
          <div class="chart-container">
            <canvas id="${feed.name}-chart"></canvas>
          </div>
        </div>
      `)
        .join('')}
    </div>
  </div>
  <script>
    async function fetchAnalytics(feedId) {
      try {
        const response = await fetch(\`/dashboard/api/analytics/\${feedId}\`);
        if (!response.ok) throw new Error('Failed to fetch analytics');
        return await response.json();
      } catch (error) {
        console.error(\`Error fetching analytics for \${feedId}:\`, error);
        return null;
      }
    }

    function updateFeedCard(feedId, data) {
      const statsElement = document.getElementById(\`\${feedId}-stats\`);
      if (!data) {
        statsElement.innerHTML = '<div class="error">Failed to load analytics</div>';
        return;
      }
      statsElement.innerHTML = \`
        <div class="stat-item"><span>Total Posts:</span><strong>\${data.postCount}</strong></div>
        <div class="stat-item"><span>Unique Authors:</span><strong>\${data.uniqueAuthors}</strong></div>
        <div class="stat-item"><span>Average Posts Per Day:</span><strong>\${data.avgPostsPerDay.toFixed(2)}</strong></div>
      \`;

      const ctx = document.getElementById(\`\${feedId}-chart\`).getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.weeklyQuantity.map(d => d.week),
          datasets: [{
            label: 'Posts per Week',
            data: data.weeklyQuantity.map(d => d.count),
            backgroundColor: 'rgba(0, 102, 204, 0.7)',
            borderColor: 'rgba(0, 102, 204, 1)',
            borderWidth: 1
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
      });
    }

    async function initDashboard() {
      const feeds = ${JSON.stringify(feeds)};
      for (const feed of feeds) {
        const data = await fetchAnalytics(feed.name);
        updateFeedCard(feed.name, data);
        await new Promise(res => setTimeout(res, 300)); // load feeds sequentially
      }
    }

    document.addEventListener('DOMContentLoaded', initDashboard);
  </script>
</body>
</html>
  `;
}

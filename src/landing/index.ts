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

  // Serve static files from 'public' folder (mounted at /dashboard/static)
  router.use('/static', express.static(path.join(__dirname, 'public')));

  // API endpoints for analytics (mounted under /dashboard)
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

  // Landing page at /dashboard
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

// Frontend page
function generateLandingPageHTML(feeds: { name: string; displayName: string }[]) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bsky Feeds Analytics Dashboard</title>

  <!-- Optional external stylesheet if you add one to /landing/public/style.css -->
  <link rel="stylesheet" href="/dashboard/static/style.css" />

  <!-- Minimal inline styles as a fallback so it looks ok without external CSS -->
  <style>
    :root { --brand:#0066cc; --bg:#f5f7fb; --card:#fff; --muted:#667085; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:#111; }
    header { background:var(--brand); color:#fff; padding:16px 20px; }
    header h1 { margin:0; font-weight:600; font-size:20px; }
    .container { max-width:1200px; margin:0 auto; padding:16px; }
    .dashboard { display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:16px; }
    .card { background:var(--card); border-radius:12px; box-shadow: 0 4px 16px rgba(0,0,0,.06); padding:16px; display:flex; flex-direction:column; gap:12px; }
    .card h2 { margin:0; color:var(--brand); font-size:18px; border-bottom:1px solid #eef0f4; padding-bottom:8px; }
    .stats { display:grid; grid-template-columns:1fr 1fr; gap:8px 12px; }
    .stat-item { display:flex; flex-direction:column; gap:2px; background:#f8fafc; border:1px solid #eef0f4; border-radius:8px; padding:8px; }
    .stat-item span { color:var(--muted); font-size:12px; }
    .stat-item strong { font-size:16px; }
    .trend { font-size:12px; color:var(--muted); }
    .trend.up { color:#0a7a2e; }
    .trend.down { color:#b42318; }
    .chart-container { height:220px; }
    .section-title { margin:8px 0 4px; font-weight:600; font-size:14px; color:#111; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; }
    .chip { font-size:12px; background:#eef6ff; color:#0b60b0; border:1px solid #d4e6ff; padding:4px 8px; border-radius:999px; }
    .muted { color:var(--muted); font-size:13px; }
    .loading, .error { text-align:center; padding:8px; color:var(--muted); }
  </style>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <header><h1>Bsky Feeds Analytics Dashboard</h1></header>

  <div class="container">
    <div class="dashboard">
      ${feeds
        .map(
          (feed) => `
        <div class="card" id="${feed.name}-card">
          <h2>${feed.displayName}</h2>

          <div class="stats" id="${feed.name}-stats">
            <div class="loading" style="grid-column:1 / -1;">Loading analytics...</div>
          </div>

          <div class="chart-container">
            <canvas id="${feed.name}-chart"></canvas>
          </div>

          <div id="${feed.name}-highlights">
            <div class="section-title">Latest Week Highlights</div>
            <div class="muted">No data yet.</div>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  </div>

  <script>
    // Helpers
    function pctTrend(n) {
      if (n === 0) return '<span class="trend">0%</span>';
      const cls = n > 0 ? 'up' : 'down';
      const arrow = n > 0 ? '▲' : '▼';
      return '<span class="trend ' + cls + '">' + arrow + ' ' + Math.abs(n) + '%</span>';
    }

    function parseWeekStart(weekLabel) {
      // weekLabel format: "YYYY-MM-DD to YYYY-MM-DD"
      const start = weekLabel?.slice(0, 10);
      const d = new Date(start);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }

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
      const statsEl = document.getElementById(\`\${feedId}-stats\`);
      const highlightsEl = document.getElementById(\`\${feedId}-highlights\`);

      if (!data) {
        statsEl.innerHTML = '<div class="error" style="grid-column:1 / -1;">Failed to load analytics</div>';
        highlightsEl.innerHTML = '';
        return;
      }

      // Stats block (with trends)
      statsEl.innerHTML = \`
        <div class="stat-item">
          <span>Total Posts</span>
          <strong>\${data.postCount}</strong>
          <div>\${pctTrend(data.postCountTrend)}</div>
        </div>
        <div class="stat-item">
          <span>Unique Authors</span>
          <strong>\${data.uniqueAuthors}</strong>
          <div>\${pctTrend(data.uniqueAuthorsTrend)}</div>
        </div>
        <div class="stat-item">
          <span>Avg Posts/Day</span>
          <strong>\${(data.avgPostsPerDay || 0).toFixed(2)}</strong>
          <div>\${pctTrend(data.avgPostsPerDayTrend)}</div>
        </div>
        <div class="stat-item">
          <span>Hours Covered</span>
          <strong>\${(data.timeDistribution || []).filter(h => h.count>0).length}/24</strong>
          <div class="trend">&nbsp;</div>
        </div>
      \`;

      // Sort weekly data by week start asc
      const weeks = (data.weeklyQuantity || []).slice().sort((a,b) => parseWeekStart(a.week) - parseWeekStart(b.week));

      // Chart: Posts per Week (uses human-readable week ranges from API)
      const ctx = document.getElementById(\`\${feedId}-chart\`).getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: weeks.map(w => w.week),
          datasets: [{
            label: 'Posts per Week',
            data: weeks.map(w => w.count),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });

      // Latest week highlights
      if (weeks.length === 0) {
        highlightsEl.innerHTML = '<div class="section-title">Latest Week Highlights</div><div class="muted">No data yet.</div>';
      } else {
        const latest = weeks[weeks.length - 1];
        const topics = (latest.trendingTopics || []).map(t => '<span class="chip">' + t + '</span>').join(' ') || '<span class="muted">—</span>';
        const topAuthor = latest.topAuthor ? \`\${latest.topAuthor.did} (\${latest.topAuthor.count})\` : '<span class="muted">—</span>';
        const tp = latest.topPost;
        const topPost =
          tp
            ? \`<div><strong>Top Post</strong><div class="muted">\${(tp.text || '').slice(0, 140)}\${(tp.text || '').length > 140 ? '…' : ''}</div>
                <div class="muted">Likes: \${tp.likes ?? 0} · Reposts: \${tp.reposts ?? 0} · Replies: \${tp.replies ?? 0}</div></div>\`
            : '<div><strong>Top Post</strong><div class="muted">—</div></div>';

        highlightsEl.innerHTML = \`
          <div class="section-title">Latest Week Highlights</div>
          <div class="muted" style="margin-bottom:6px;">\${latest.week}</div>
          <div><strong>Trending Topics</strong></div>
          <div class="chips" style="margin-bottom:8px;">\${topics}</div>
          <div><strong>Top Author</strong></div>
          <div class="muted" style="margin-bottom:8px;">\${topAuthor}</div>
          \${topPost}
        \`;
      }
    }

    async function initDashboard() {
      const feeds = ${JSON.stringify(feeds)};
      for (const feed of feeds) {
        const data = await fetchAnalytics(feed.name);
        updateFeedCard(feed.name, data);
      }
    }

    document.addEventListener('DOMContentLoaded', initDashboard);
  </script>
</body>
</html>
  `;
}

export default createLandingPageRouter;

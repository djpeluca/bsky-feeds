import express from 'express'
import path from 'path'
import { AppContext } from '../config'
import dbClient from '../db/dbClient'
import algos from '../algos'
import { getFeedAnalytics, getAvailableFeeds, FeedAnalytics } from './analytics'

// Create router for the landing page
export const createLandingPageRouter = (ctx: AppContext) => {
  const router = express.Router()
  
  // Serve static files for the landing page
  router.use('/static', express.static(path.join(__dirname, 'public')))
  
  // Main landing page route
  router.get('/', async (req, res) => {
    try {
      // Get all available feed algorithms
      const feedAlgos = Object.keys(algos).map(key => ({
        name: key,
        displayName: key.charAt(0).toUpperCase() + key.slice(1)
      }))
      
      // Render the landing page with basic feed information
      res.send(generateLandingPageHTML(feedAlgos))
    } catch (error) {
      console.error('Error rendering landing page:', error)
      res.status(500).send('Internal Server Error')
    }
  })
  
  // API endpoint to get list of available feeds
  router.get('/api/feeds', (req, res) => {
    try {
      const feeds = getAvailableFeeds();
      res.json(feeds);
    } catch (error) {
      console.error('Error getting available feeds:', error);
      res.status(500).json({ error: 'Failed to get available feeds' });
    }
  })
  
  // API endpoint to get analytics data for a specific feed
  router.get('/api/analytics/:feedId', async (req, res) => {
    try {
      const feedId = req.params.feedId
      const period = req.query.period as string || 'week'
      
      // Verify the feed exists
      if (!algos[feedId]) {
        return res.status(404).json({ error: 'Feed not found' })
      }
      
      // Get analytics data for the feed
      const analytics = await getFeedAnalytics(feedId, period)
      res.json(analytics)
    } catch (error) {
      console.error(`Error getting analytics for feed ${req.params.feedId}:`, error)
      res.status(500).json({ error: `Failed to get analytics for feed ${req.params.feedId}` })
    }
  })
  
  return router
}

// Function to generate the HTML for the landing page
function generateLandingPageHTML(feeds: { name: string, displayName: string }[]) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bsky Feeds Analytics Dashboard</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        header {
          background-color: #0066cc;
          color: white;
          padding: 1rem;
          text-align: center;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
        }
        .dashboard {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }
        .card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 1rem;
          transition: transform 0.3s ease;
        }
        .card:hover {
          transform: translateY(-5px);
        }
        .card h2 {
          margin-top: 0;
          color: #0066cc;
          border-bottom: 1px solid #eee;
          padding-bottom: 0.5rem;
        }
        .stats {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .stat-item {
          display: flex;
          justify-content: space-between;
        }
        .loading {
          text-align: center;
          padding: 2rem;
          font-style: italic;
          color: #666;
        }
        .chart-container {
          height: 200px;
          margin-top: 1rem;
        }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body>
      <header>
        <h1>Bsky Feeds Analytics Dashboard</h1>
      </header>
      <div class="container">
        <div class="dashboard">
          ${feeds.map(feed => `
            <div class="card" id="${feed.name}-card">
              <h2>${feed.displayName}</h2>
              <div class="stats" id="${feed.name}-stats">
                <div class="loading">Loading analytics...</div>
              </div>
              <div class="chart-container">
                <canvas id="${feed.name}-chart"></canvas>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <script>
        // Function to fetch analytics data for each feed
        async function fetchAnalytics(feedId) {
          try {
            const response = await fetch(\`/api/analytics/\${feedId}\`);
            if (!response.ok) throw new Error('Failed to fetch analytics');
            return await response.json();
          } catch (error) {
            console.error(\`Error fetching analytics for \${feedId}:\`, error);
            return null;
          }
        }

        // Function to update the UI with analytics data
        function updateFeedCard(feedId, data) {
          const statsElement = document.getElementById(\`\${feedId}-stats\`);
          if (!data) {
            statsElement.innerHTML = '<div class="error">Failed to load analytics</div>';
            return;
          }

          statsElement.innerHTML = \`
            <div class="stat-item">
              <span>Total Posts:</span>
              <strong>\${data.totalPosts}</strong>
            </div>
            <div class="stat-item">
              <span>Posts This Week:</span>
              <strong>\${data.postsThisWeek}</strong>
            </div>
            <div class="stat-item">
              <span>Average Posts Per Day:</span>
              <strong>\${data.avgPostsPerDay.toFixed(2)}</strong>
            </div>
            <div class="stat-item">
              <span>Active Authors:</span>
              <strong>\${data.activeAuthors}</strong>
            </div>
          \`;

          // Create a chart for weekly post distribution
          const ctx = document.getElementById(\`\${feedId}-chart\`).getContext('2d');
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: data.weeklyData.map(d => d.day),
              datasets: [{
                label: 'Posts per Day',
                data: data.weeklyData.map(d => d.count),
                backgroundColor: 'rgba(0, 102, 204, 0.7)',
                borderColor: 'rgba(0, 102, 204, 1)',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }
          });
        }

        // Initialize the dashboard
        async function initDashboard() {
          const feeds = ${JSON.stringify(feeds)};
          
          for (const feed of feeds) {
            const data = await fetchAnalytics(feed.name);
            updateFeedCard(feed.name, data);
          }
        }

        // Load the dashboard when the page is ready
        document.addEventListener('DOMContentLoaded', initDashboard);
      </script>
    </body>
    </html>
  `;
}

// Function to get mock analytics data for a specific feed (used as fallback)
async function getMockFeedAnalytics(feedId: string) {
  // This is a placeholder function that provides mock data when actual analytics fail
  return {
    totalPosts: 0,
    postsThisWeek: 0,
    avgPostsPerDay: 0,
    activeAuthors: 0,
    weeklyData: [
      { day: 'Mon', count: 0 },
      { day: 'Tue', count: 0 },
      { day: 'Wed', count: 0 },
      { day: 'Thu', count: 0 },
      { day: 'Fri', count: 0 },
      { day: 'Sat', count: 0 },
      { day: 'Sun', count: 0 }
    ]
  };
}

export default createLandingPageRouter
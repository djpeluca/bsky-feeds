// Client-side JavaScript for the analytics dashboard

document.addEventListener('DOMContentLoaded', () => {
  // Initialize the dashboard
  initDashboard();

  // Set up event listeners for time filter buttons
  document.querySelectorAll('.time-filter button').forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      document.querySelectorAll('.time-filter button').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Update data based on selected time period
      const period = button.dataset.period;
      updateDashboardData(period);
    });
  });
});

async function initDashboard() {
  try {
    // Get the list of available feeds
    const feedsResponse = await fetch('/api/feeds');
    const feeds = await feedsResponse.json();
    
    // Initialize dashboard with the first feed or a default view
    if (feeds && feeds.length > 0) {
      await loadFeedAnalytics(feeds[0]);
    } else {
      displayNoFeedsMessage();
    }
    
    // Create feed selector
    createFeedSelector(feeds);
  } catch (error) {
    console.error('Error initializing dashboard:', error);
    displayErrorMessage('Failed to load dashboard data');
  }
}

async function loadFeedAnalytics(feedId) {
  try {
    // Fetch analytics data for the selected feed
    const response = await fetch(`/api/analytics/${feedId}`);
    const data = await response.json();
    
    // Update dashboard with the fetched data
    updateDashboardWithData(data);
  } catch (error) {
    console.error(`Error loading analytics for feed ${feedId}:`, error);
    displayErrorMessage(`Failed to load analytics for feed ${feedId}`);
  }
}

function createFeedSelector(feeds) {
  const selector = document.getElementById('feed-selector');
  if (!selector) return;
  
  // Clear existing options
  selector.innerHTML = '';
  
  // Add options for each feed
  feeds.forEach(feed => {
    const option = document.createElement('option');
    option.value = feed.id;
    option.textContent = feed.name || feed.id;
    selector.appendChild(option);
  });
  
  // Add change event listener
  selector.addEventListener('change', (event) => {
    loadFeedAnalytics(event.target.value);
  });
}

function updateDashboardWithData(data) {
  // Update post count
  updateStatCard('post-count', data.postCount || 0, data.postCountTrend || 0);
  
  // Update unique authors
  updateStatCard('unique-authors', data.uniqueAuthors || 0, data.uniqueAuthorsTrend || 0);
  
  // Update average posts per day
  updateStatCard('avg-posts-per-day', data.avgPostsPerDay || 0, data.avgPostsPerDayTrend || 0);
  
  // Update time distribution chart
  updateTimeDistributionChart(data.timeDistribution || []);
  
  // Update weekly quantity chart
  updateWeeklyQuantityChart(data.weeklyQuantity || []);
}

function updateStatCard(id, value, trend) {
  const cardElement = document.getElementById(id);
  if (!cardElement) return;
  
  const valueElement = cardElement.querySelector('.value');
  const trendElement = cardElement.querySelector('.trend');
  
  if (valueElement) {
    valueElement.textContent = formatNumber(value);
  }
  
  if (trendElement) {
    // Determine trend direction
    let trendClass = 'neutral';
    let trendIcon = '⟷';
    
    if (trend > 0) {
      trendClass = 'up';
      trendIcon = '↑';
    } else if (trend < 0) {
      trendClass = 'down';
      trendIcon = '↓';
    }
    
    // Update trend element
    trendElement.className = `trend ${trendClass}`;
    trendElement.innerHTML = `<span class="trend-icon">${trendIcon}</span> ${Math.abs(trend)}% from previous period`;
  }
}

function updateTimeDistributionChart(timeData) {
  const ctx = document.getElementById('hour-chart');
  if (!ctx) return;
  
  // Clear any existing chart
  if (window.timeChart) {
    window.timeChart.destroy();
  }
  
  // Prepare data for the chart
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const data = Array(24).fill(0);
  
  // Populate data from the API response
  timeData.forEach(item => {
    if (item.hour >= 0 && item.hour < 24) {
      data[item.hour] = item.count;
    }
  });
  
  // Create the chart
  window.timeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Posts by Hour',
        data: data,
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
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Posts'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Hour of Day (UTC)'
          }
        }
      }
    }
  });
}

function updateWeeklyQuantityChart(weeklyData) {
  const ctx = document.getElementById('weekly-chart');
  if (!ctx) return;
  
  // Clear any existing chart
  if (window.weeklyChart) {
    window.weeklyChart.destroy();
  }
  
  // Prepare data for the chart
  const labels = weeklyData.map(item => item.week);
  const data = weeklyData.map(item => item.count);
  
  // Create the chart
  window.weeklyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Posts per Week',
        data: data,
        backgroundColor: 'rgba(40, 167, 69, 0.2)',
        borderColor: 'rgba(40, 167, 69, 1)',
        borderWidth: 2,
        tension: 0.1,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Posts'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Week'
          }
        }
      }
    }
  });
}

function updateDashboardData(period) {
  // Get the currently selected feed
  const feedSelector = document.getElementById('feed-selector');
  if (!feedSelector) return;
  
  const selectedFeed = feedSelector.value;
  
  // Fetch updated data with the selected time period
  fetch(`/api/analytics/${selectedFeed}?period=${period}`)
    .then(response => response.json())
    .then(data => {
      updateDashboardWithData(data);
    })
    .catch(error => {
      console.error('Error updating dashboard data:', error);
      displayErrorMessage('Failed to update dashboard data');
    });
}

function displayNoFeedsMessage() {
  const container = document.querySelector('.dashboard-container');
  if (container) {
    container.innerHTML = '<div class="alert alert-info">No feeds available for analytics.</div>';
  }
}

function displayErrorMessage(message) {
  const container = document.querySelector('.dashboard-container');
  if (container) {
    const alertElement = document.createElement('div');
    alertElement.className = 'alert alert-danger';
    alertElement.textContent = message;
    
    // Insert at the top of the container
    container.insertBefore(alertElement, container.firstChild);
    
    // Remove after 5 seconds
    setTimeout(() => {
      alertElement.remove();
    }, 5000);
  }
}

function formatNumber(num) {
  return num.toLocaleString();
}
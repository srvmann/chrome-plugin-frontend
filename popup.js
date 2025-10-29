// popup.js

document.addEventListener("DOMContentLoaded", async () => {
  const outputDiv = document.getElementById("output");
  const loaderContainer = document.getElementById("loader-container");
  const loaderMessage = document.getElementById("loader-message");

  // Removed API_KEY and simplified MAX_COMMENTS_TO_FETCH management 
  const API_URL = 'http://192.168.1.3:5000'; // Corrected Base URL
  const MAX_COMMENTS_TO_FETCH = 5000; // Client-side limit remains for safety 
  
  let allPredictedComments = []; 
  let activeSentiment = 'all'; 

  console.log("-----------------------------------------");
  console.log("Analyzer Script Start.");
  console.log(`API_URL: ${API_URL}`);
  console.log("-----------------------------------------");

  // Helper functions for the spinner
  function showLoader(message) {
    loaderMessage.textContent = message;
    loaderContainer.style.display = 'block';
    outputDiv.style.display = 'none';
  }

  function hideLoader() {
    loaderContainer.style.display = 'none';
    outputDiv.style.display = 'block';
  }

  function updateButtonState(newSentiment) {
    const buttons = [
        document.getElementById('btn-positive'),
        document.getElementById('btn-neutral'),
        document.getElementById('btn-negative')
    ];

    buttons.forEach(button => {
        button.style.border = 'none'; 
    });

    if (newSentiment !== 'all') {
        const activeButton = document.getElementById(`btn-${newSentiment === 1 ? 'positive' : newSentiment === 0 ? 'neutral' : 'negative'}`);
        activeButton.style.border = '2px solid white'; 
    }
  }

  /**
   * Function to display filtered comments with random sampling logic.
   */
  function displayFilteredComments(sentimentValue) {
      const targetDiv = document.getElementById('filtered-comments-container');
      if (!targetDiv || !allPredictedComments.length) return;

      if (String(sentimentValue) === String(activeSentiment)) {
          activeSentiment = 'all';
      } else {
          activeSentiment = String(sentimentValue);
      }
      
      let filtered;
      let titleText;
      let maxComments;
      
      if (activeSentiment === 'all') {
          filtered = allPredictedComments;
          titleText = "Showing Top 30 Overall Comments";
          maxComments = 30;
      } else {
          filtered = allPredictedComments.filter(item => item.sentiment === activeSentiment);
          const sentimentMap = { '1': 'Positive', '0': 'Neutral', '-1': 'Negative' };
          titleText = `Showing 15 Random ${sentimentMap[activeSentiment]} Comments (${filtered.length} total)`;
          maxComments = 15;
          
          if (filtered.length > maxComments) {
             const shuffled = filtered.sort(() => 0.5 - Math.random());
             filtered = shuffled.slice(0, maxComments);
          }
      }
      
      const commentsToDisplay = filtered.slice(0, maxComments);

      let html = `<p class="section-title" style="margin-top: 5px;">${titleText}</p>`;
      
      if (commentsToDisplay.length === 0) {
          html += `<p style="color: #F44336; text-align: center;">No comments found in this category.</p>`;
      } else {
          html += `
            <ul class="comment-list" style="max-height: 250px;">
              ${commentsToDisplay.map((item, index) => `
                <li class="comment-item">
                  <span>${index + 1}. ${item.comment}</span><br>
                  <span class="comment-sentiment" data-sentiment="${item.sentiment}">Sentiment: ${item.sentiment}</span>
                </li>`).join('')}
            </ul>`;
      }
      
      targetDiv.innerHTML = html;
      updateButtonState(activeSentiment === 'all' ? null : Number(activeSentiment));
  }
  // End of displayFilteredComments

  // Function to fetch comments using the secure backend endpoint
  async function fetchComments(videoId) {
    let comments = [];
    let pageToken = "";
    try {
      console.log("fetchComments: Starting secure backend API calls.");
      let pageCount = 0;
      
      while (comments.length < MAX_COMMENTS_TO_FETCH) {
        pageCount++;
        loaderMessage.textContent = `Fetching comments: ${comments.length} so far (Page ${pageCount})...`;
        
        // --- SECURE FETCH LOGIC ---
        const url = `${API_URL}/fetch_youtube_comments`; 
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_id: videoId, page_token: pageToken })
        });
        
        if (!response.ok) {
            console.error(`Backend API Error: Status ${response.status}`);
            const errorData = await response.json();
            throw new Error(errorData.error || `Backend failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.comments) {
          data.comments.forEach(item => {
            comments.push(item);
          });
        }
        
        pageToken = data.next_page_token;
        // --- END SECURE FETCH LOGIC ---
        
        if (!pageToken) {
            console.log("fetchComments: No more pages (Backend returned null).");
            break;
        }
      }
      console.log(`fetchComments: Finished collecting ${comments.length} comments.`);
    } catch (error) {
      console.error("Error fetching comments:", error);
      outputDiv.innerHTML += "<p>Error fetching comments. Check backend server connection and YouTube API quota.</p>";
    }
    return comments;
  }

  // Function to fetch and display key themes
  async function fetchAndDisplayThemes(comments) {
    const endpoint = `${API_URL}/extract_topics`;
    console.log(`fetchAndDisplayThemes: Sending request to ${endpoint}`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: comments.map(c => c.text) }) // Send only the text content
      });

      if (!response.ok) {
        console.error(`fetchAndDisplayThemes: Server returned status ${response.status}`);
        return [];
      }
      
      const themes = await response.json();
      
      // Render the Key Themes section
      let themesHtml = '';
      if (themes.length > 0) {
        themesHtml = `
          <div class="section">
            <div class="section-title">Key Themes & Top Keywords</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;">
              ${themes.map(item => 
                `<span style="background-color: #00bcd4; color: #121212; padding: 4px 8px; border-radius: 12px; font-size: 13px; font-weight: 600;">
                  ${item.theme} (${item.count})
                </span>`
              ).join('')}
            </div>
          </div>
        `;
      } else {
         themesHtml = `<div class="section"><div class="section-title">Key Themes & Top Keywords</div><p>No significant themes found.</p></div>`;
      }
      
      // Insert the themes right after the metrics summary
      const summarySection = outputDiv.querySelector('.section');
      if (summarySection) {
          summarySection.insertAdjacentHTML('afterend', themesHtml);
      } else {
          outputDiv.innerHTML += themesHtml;
      }
      
    } catch (error) {
      console.error("Error fetching key themes:", error);
      outputDiv.innerHTML += "<p>Error fetching key themes.</p>";
    }
  }
  // End of fetchAndDisplayThemes

  // Function to fetch and display ALL charts sequentially
  async function fetchAndDisplayAllCharts(sentimentCounts, sentimentData, comments) {
      showLoader("Rendering charts..."); // New message for charts
      
      // CRITICAL: Await ALL asynchronous image fetching/insertion functions
      await fetchAndDisplayChart(sentimentCounts);
      await fetchAndDisplayTrendGraph(sentimentData);
      await fetchAndDisplayWordCloud(comments);
  }


  // Get the current tab's URL
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const url = tabs[0].url;
    console.log(`Current Tab URL: ${url}`);
    const youtubeRegex = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/;
    const match = url.match(youtubeRegex);

    if (match && match[1]) {
      const videoId = match[1];
      
      // 1. Start Loading: Fetching Comments
      showLoader("Fetching comments (this may take a moment for popular videos)...");
      console.log(`Video ID found: ${videoId}`);

      const comments = await fetchComments(videoId);
      
      if (comments.length === 0) {
        hideLoader();
        outputDiv.innerHTML = `<div class="section-title">YouTube Video ID</div><p>${videoId}</p><p>No comments found for this video.</p>`;
        console.log("Execution stopped: No comments found.");
        return;
      }

      // 2. Transition Loading: Sentiment Analysis
      showLoader(`Fetched ${comments.length} comments. Analyzing sentiment...`);
      console.log("Calling getSentimentPredictions...");
      const predictions = await getSentimentPredictions(comments);
      
      // Store all predictions
      allPredictedComments = predictions;
      
      // 3. Stop Loading and Display Results
      // *** hideLoader() IS DELAYED UNTIL AFTER ALL CHARTS ARE LOADED ***

      if (predictions) {
        console.log("Received sentiment predictions. Starting metrics calculation.");
        
        // Process the predictions to get sentiment counts and sentiment data
        const sentimentCounts = { "1": 0, "0": 0, "-1": 0 };
        const sentimentData = [];
        const totalSentimentScore = predictions.reduce((sum, item) => sum + parseInt(item.sentiment), 0);
        predictions.forEach((item) => {
          sentimentCounts[item.sentiment]++;
          sentimentData.push({
            timestamp: item.timestamp,
            sentiment: parseInt(item.sentiment)
          });
        });

        // Compute metrics
        const totalComments = comments.length;
        const uniqueCommenters = new Set(comments.map(comment => comment.authorId)).size;
        const totalWords = comments.reduce((sum, comment) => sum + comment.text.split(/\s+/).filter(word => word.length > 0).length, 0);
        const avgWordLength = (totalWords / totalComments).toFixed(2);
        const avgSentimentScore = (totalSentimentScore / totalComments).toFixed(2);
        const normalizedSentimentScore = (((parseFloat(avgSentimentScore) + 1) / 2) * 10).toFixed(2);
        
        console.log("Sentiment Counts:", sentimentCounts);

        // A. Render Metrics Summary
        outputDiv.innerHTML = `
          <div class="section-title">YouTube Video ID</div><p>${videoId}</p>
          <div class="section">
            <div class="section-title">Comment Analysis Summary</div>
            <div class="metrics-container">
              <div class="metric">
                <div class="metric-title">Total Comments</div>
                <div class="metric-value">${totalComments}</div>
              </div>
              <div class="metric">
                <div class="metric-title">Unique Commenters</div>
                <div class="metric-value">${uniqueCommenters}</div>
              </div>
              <div class="metric">
                <div class="metric-title">Avg Comment Length</div>
                <div class="metric-value">${avgWordLength} words</div>
              </div>
              <div class="metric">
                <div class="metric-title">Avg Sentiment Score</div>
                <div class="metric-value">${normalizedSentimentScore}/10</div>
              </div>
            </div>
          </div>
        `;

        // B. Fetch and Display Key Themes
        showLoader("Extracting key themes...");
        await fetchAndDisplayThemes(comments); 

        // C. Render Charts and Filtering UI
        outputDiv.innerHTML += `
          <div class="section">
            <div class="section-title">Sentiment Analysis Results</div>
            <p>Sentiment distribution based on ${totalComments} comments.</p>
            <div id="chart-container"></div>
          </div>
          <div class="section">
            <div class="section-title">Sentiment Trend Over Time</div>
            <div id="trend-graph-container"></div>
          </div>
          <div class="section">
            <div class="section-title">Comment Wordcloud</div>
            <div id="wordcloud-container"></div>
          </div>
          <div class="section">
            <div class="section-title">View Comments by Sentiment</div>
            <div style="display: flex; justify-content: space-around; margin-bottom: 10px; gap: 5px;">
                <button id="btn-positive" style="background-color: #4CAF50; color: white; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; flex-grow: 1; transition: border 0.1s;">Positive</button>
                <button id="btn-neutral" style="background-color: #FFC107; color: #121212; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; flex-grow: 1; transition: border 0.1s;">Neutral</button>
                <button id="btn-negative" style="background-color: #F44336; color: white; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; flex-grow: 1; transition: border 0.1s;">Negative</button>
            </div>
            <div id="filtered-comments-container">
                </div>
          </div>
        `;
        
        // D. Fetch and Display ALL Images (Awaits all image loading)
        await fetchAndDisplayAllCharts(sentimentCounts, sentimentData, comments);
        
        // E. FINAL STEP: Hide the loader and show content ONLY after ALL assets are inserted
        hideLoader(); 
        
        // F. Attach listeners and set default comment view
        document.getElementById('btn-positive').addEventListener('click', () => displayFilteredComments(1));
        document.getElementById('btn-neutral').addEventListener('click', () => displayFilteredComments(0));
        document.getElementById('btn-negative').addEventListener('click', () => displayFilteredComments(-1));
        displayFilteredComments('all'); 
        
        console.log("All tasks completed.");
      } else {
         console.error("Critical Failure: Predictions were null.");
         outputDiv.innerHTML += "<p>Could not analyze sentiment. Check server connection.</p>";
      }
    } else {
      outputDiv.innerHTML = "<p>This is not a valid YouTube URL.</p>";
      console.log("Execution stopped: Not a valid YouTube URL.");
    }
  });

  // --- Utility Functions (These are now simplified as they rely on the backend) ---

  async function getSentimentPredictions(comments) {
    const endpoint = `${API_URL}/predict_with_timestamps`;
    console.log(`getSentimentPredictions: Sending request to ${endpoint}`);
    loaderMessage.textContent = `Analyzing ${comments.length} comments. This can take a while...`;
    
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments })
      });
      
      console.log(`getSentimentPredictions: Received response. Status: ${response.status}`);
      
      const result = await response.json();
      if (response.ok) {
        console.log("getSentimentPredictions: Response successful.");
        return result;
      } else {
        console.error("getSentimentPredictions: Server returned an error:", result.error || 'Unknown error');
        throw new Error(result.error || 'Error fetching predictions');
      }
    } catch (error) {
      console.error("Error fetching predictions (CRITICAL NETWORK/API ERROR):", error);
      outputDiv.innerHTML += "<p>Error fetching sentiment predictions. Check Flask API server connection.</p>";
      return null;
    }
  }

  async function fetchAndDisplayChart(sentimentCounts) {
    const endpoint = `${API_URL}/generate_chart`;
    console.log(`fetchAndDisplayChart: Sending request to ${endpoint}`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentiment_counts: sentimentCounts })
      });
      
      if (!response.ok) {
        console.error(`fetchAndDisplayChart: Server returned status ${response.status}`);
        throw new Error('Failed to fetch chart image');
      }
      console.log("fetchAndDisplayChart: Image data received.");
      const blob = await response.blob();
      const imgURL = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = imgURL;
      const chartContainer = document.getElementById('chart-container');
      chartContainer.appendChild(img);
    } catch (error) {
      console.error("Error fetching chart image:", error);
      outputDiv.innerHTML += "<p>Error fetching chart image.</p>";
    }
  }

  async function fetchAndDisplayWordCloud(comments) {
    const endpoint = `${API_URL}/generate_wordcloud`;
    console.log(`fetchAndDisplayWordCloud: Sending request to ${endpoint}`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: comments.map(c => c.text) })
      });
      if (!response.ok) {
        console.error(`fetchAndDisplayWordCloud: Server returned status ${response.status}`);
        throw new Error('Failed to fetch word cloud image');
      }
      console.log("fetchAndDisplayWordCloud: Image data received.");
      const blob = await response.blob();
      const imgURL = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = imgURL;
      const wordcloudContainer = document.getElementById('wordcloud-container');
      wordcloudContainer.appendChild(img);
    } catch (error) {
      console.error("Error fetching word cloud image:", error);
      outputDiv.innerHTML += "<p>Error fetching word cloud image.</p>";
    }
  }

  async function fetchAndDisplayTrendGraph(sentimentData) {
    const endpoint = `${API_URL}/generate_trend_graph`;
    console.log(`fetchAndDisplayTrendGraph: Sending request to ${endpoint}`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentiment_data: sentimentData })
      });
      if (!response.ok) {
        console.error(`fetchAndDisplayTrendGraph: Server returned status ${response.status}`);
        throw new Error('Failed to fetch trend graph image');
      }
      console.log("fetchAndDisplayTrendGraph: Image data received.");
      const blob = await response.blob();
      const imgURL = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = imgURL;
      const trendGraphContainer = document.getElementById('trend-graph-container');
      trendGraphContainer.appendChild(img);
    } catch (error) {
      console.error("Error fetching trend graph image:", error);
      outputDiv.innerHTML += "<p>Error fetching trend graph image.</p>";
    }
  }
});
// Complete Search & Management functionality with Thumbnail URL Search
let selectedFiles = [];
let currentSearchResults = [];
let searchUploadedFile = null;

// Species caching
let cachedSpecies = null;
let speciesCacheTimestamp = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Configuration for search endpoints
const SEARCH_API_CONFIG = {
  getSpeciesEndpoint:
    "https://t89sef6460.execute-api.ap-southeast-2.amazonaws.com/dev/birdtag/search-s",
  searchByTagsEndpoint:
    "https://t89sef6460.execute-api.ap-southeast-2.amazonaws.com/dev/birdtag/search-s",
  thumbnailSearchEndpoint:
    "https://t89sef6460.execute-api.ap-southeast-2.amazonaws.com/dev/birdtag/search-t",

  // Future endpoints
  searchByFileEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/birdtag/search-file",
  addTagsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/birdtag/edit",
  removeTagsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/birdtag/edit",
  deleteFilesEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/birdtag/delete",
};

// Enhanced logging function
function debugLog(message, data = null) {
  console.log(`[DEBUG] ${message}`);
  if (data) {
    console.log(`[DEBUG DATA]`, data);
  }
}

// Show notification function
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification-toast ${type}`;
  notification.textContent = message;

  notification.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: ${
      type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#2563eb"
    };
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2001;
    font-weight: 500;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    max-width: 300px;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = "1";
    notification.style.transform = "translateX(0)";
  }, 100);

  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// Enhanced error handling
function handleSearchError(error, context = "Search") {
  console.error(`[ERROR] ${context}:`, error);
  showNotification(`${context} failed: ${error.message}`, "error");
  hideSearchResults();
}

// Dynamic Species Loading
async function getSpeciesList() {
  if (
    cachedSpecies &&
    speciesCacheTimestamp &&
    Date.now() - speciesCacheTimestamp < CACHE_DURATION
  ) {
    debugLog("Using cached species list", cachedSpecies);
    return cachedSpecies;
  }

  try {
    debugLog("Fetching species from API...");
    const authToken = getAuthenticationToken();

    if (!authToken) {
      throw new Error("Authentication required");
    }

    const response = await fetch(SEARCH_API_CONFIG.getSpeciesEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    debugLog(`Species API response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      debugLog("Species API response data", data);

      let speciesList = [];
      if (data.species) {
        speciesList = data.species;
      } else if (data.tags) {
        speciesList = data.tags;
      } else if (Array.isArray(data)) {
        speciesList = data;
      } else if (data.body) {
        try {
          const parsedBody = JSON.parse(data.body);
          speciesList = parsedBody.species || parsedBody.tags || [];
        } catch (e) {
          debugLog("Could not parse body as JSON", e);
        }
      }

      cachedSpecies = speciesList.sort();
      speciesCacheTimestamp = Date.now();

      debugLog(`Loaded ${speciesList.length} species from API`, speciesList);
      return cachedSpecies;
    } else {
      const errorText = await response.text();
      debugLog(`API request failed: ${response.status}`, errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("Failed to fetch species from API:", error);
    const fallbackSpecies = [
      "crow",
      "pigeon",
      "sparrow",
      "robin",
      "eagle",
      "hawk",
      "owl",
      "duck",
      "blue jay",
      "cardinal",
      "canary",
      "parrot",
      "flamingo",
      "penguin",
    ];
    showNotification("Using default species list (API unavailable)", "info");
    return fallbackSpecies;
  }
}

// Main search function for tags
async function searchByTags() {
  debugLog("=== Starting Search by Tags ===");

  const speciesSelect = document.getElementById("speciesSelect");
  if (!speciesSelect) {
    handleSearchError(
      new Error("Species select element not found"),
      "UI Error"
    );
    return;
  }

  const selectedSpecies = Array.from(speciesSelect.selectedOptions).map(
    (option) => option.value
  );

  debugLog("Selected species from UI", selectedSpecies);

  if (selectedSpecies.length === 0) {
    showNotification("Please select at least one bird species", "error");
    return;
  }

  try {
    showSearchLoading();

    const queryParams = new URLSearchParams();
    selectedSpecies.forEach((species, index) => {
      queryParams.append(`tag${index + 1}`, species);
    });

    const apiUrl = `${
      SEARCH_API_CONFIG.searchByTagsEndpoint
    }?${queryParams.toString()}`;
    debugLog("API URL being called", apiUrl);

    const authToken = getAuthenticationToken();
    if (!authToken) {
      throw new Error("Authentication required");
    }

    debugLog("Making API request with auth token");

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    debugLog(`Search API response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      debugLog("Raw API response data", data);

      const results = data.results || [];
      debugLog(`Found ${results.length} results in API response`, results);

      if (results.length === 0) {
        debugLog("No results found in response - showing no results");
        displayNoResults(selectedSpecies);
        return;
      }

      const searchResults = {
        results: results.map((item, index) => {
          debugLog(`Processing result item ${index + 1}`, item);

          return {
            id: `search-result-${index}`,
            filename: item.filename || `file-${index}`,
            shortenedPath: item.filename || `file-${index}`,
            type: item.file_type || "image",
            tags: selectedSpecies.reduce((acc, species) => {
              acc[species] = 1;
              return acc;
            }, {}),
            thumbnailUrl: item.thumbnail_url,
            fullUrl: item.full_url,
            downloadUrl: item.download_url,
            presignedUrl: item.thumbnail_url,
            s3Key: item.filename || `file-${index}`,
          };
        }),
        total: data.total || results.length,
        searchType: "tags",
        searchParams: { species: selectedSpecies },
      };

      debugLog("Final search results object", searchResults);

      displaySearchResults(searchResults, "tags");

      if (searchResults.total > 0) {
        showNotification(
          `Found ${
            searchResults.total
          } files containing: ${selectedSpecies.join(", ")}`,
          "success"
        );
      } else {
        showNotification(
          `No files found containing: ${selectedSpecies.join(", ")}`,
          "info"
        );
      }
    } else {
      const errorText = await response.text();
      debugLog("API request failed", {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Search failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    handleSearchError(error, "Search by tags");
  }

  debugLog("=== End Search by Tags ===");
}

// THUMBNAIL SEARCH FUNCTION
async function searchByThumbnailUrl() {
  debugLog("=== Starting Thumbnail URL Search ===");

  const thumbnailUrl = document.getElementById("thumbnailUrl").value.trim();

  if (!thumbnailUrl) {
    showNotification("Please enter a thumbnail URL", "error");
    return;
  }

  debugLog("Input thumbnail URL:", thumbnailUrl);

  // Extract filename from URL
  let thumbnailFilename = thumbnailUrl;
  if (thumbnailUrl.includes("/")) {
    thumbnailFilename = thumbnailUrl.split("/").pop();
    if (thumbnailFilename.includes("?")) {
      thumbnailFilename = thumbnailFilename.split("?")[0];
    }
  }

  debugLog("Extracted filename:", thumbnailFilename);

  // Validate that it's a thumbnail (has thumb_ prefix)
  if (!thumbnailFilename.startsWith("thumb_")) {
    showNotification(
      "Please enter a valid thumbnail URL (filename should start with 'thumb_')",
      "error"
    );
    return;
  }

  try {
    showSearchLoading();

    const results = await searchThumbnailAPI(thumbnailFilename);
    debugLog("Thumbnail API results:", results);

    if (results && results.links && results.links.length > 0) {
      const displayResults = {
        results: results.links.map((fullImageUrl, index) => {
          const cleanUrl = fullImageUrl.split("?")[0];
          const filename = cleanUrl.split("/").pop();

          return {
            id: `thumbnail-result-${index}`,
            filename: filename,
            type: "image",
            tags: { detected: 1 },
            thumbnailUrl: thumbnailUrl,
            fullUrl: fullImageUrl,
            downloadUrl: fullImageUrl,
            s3Key: cleanUrl.split("/").slice(-2).join("/"),
          };
        }),
        total: results.links.length,
        searchType: "thumbnail",
        searchParams: { thumbnailUrl: thumbnailUrl },
      };

      debugLog("Display results:", displayResults);

      displaySearchResults(displayResults, "thumbnail");
      showNotification(
        `Found ${results.links.length} matching image(s)`,
        "success"
      );
    } else {
      const emptyResults = {
        results: [],
        total: 0,
        searchType: "thumbnail",
        searchParams: { thumbnailUrl: thumbnailUrl },
      };
      displaySearchResults(emptyResults, "thumbnail");
      showNotification(
        "No matching full-size image found for this thumbnail",
        "info"
      );
    }
  } catch (error) {
    console.error("Thumbnail search error:", error);
    showNotification("Search failed: " + error.message, "error");
    hideSearchResults();
  }
}

// API call for thumbnail search
async function searchThumbnailAPI(thumbnailFilename) {
  try {
    const idToken = getAuthenticationToken();

    if (!idToken) {
      throw new Error(
        "Authentication required. Please sign in to use this feature."
      );
    }

    const queryParams = new URLSearchParams({
      turl1: thumbnailFilename.toLowerCase(),
    });

    const apiUrl = `${
      SEARCH_API_CONFIG.thumbnailSearchEndpoint
    }?${queryParams.toString()}`;
    debugLog("Thumbnail search API URL", apiUrl);

    const requestHeaders = {
      "Content-Type": "application/json",
    };

    if (idToken.startsWith("Bearer ")) {
      requestHeaders["Authorization"] = idToken;
    } else {
      requestHeaders["Authorization"] = idToken;
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: requestHeaders,
      mode: "cors",
    });

    debugLog("Thumbnail search response status:", response.status);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorText = await response.text();
        errorMessage += `: ${errorText}`;
      } catch (e) {
        // Could not read error response
      }

      if (response.status === 401) {
        throw new Error(
          "Authentication token expired. Please sign out and sign in again."
        );
      } else if (response.status === 403) {
        throw new Error(
          "Access denied. Please check your permissions or sign in again."
        );
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    debugLog("Thumbnail search API result", result);
    return result;
  } catch (error) {
    if (
      error.name === "TypeError" &&
      error.message.includes("Failed to fetch")
    ) {
      throw new Error(
        "Cannot connect to API. Check if you're signed in and try again."
      );
    } else if (error.message.includes("401")) {
      throw new Error(
        "Authentication token expired. Please sign out and sign in again."
      );
    } else if (error.message.includes("403")) {
      throw new Error("Access denied. Please check your permissions.");
    } else if (error.message.includes("404")) {
      throw new Error(
        "API endpoint not found. Check the API Gateway configuration."
      );
    } else {
      throw error;
    }
  }
}

// Helper function to display no results
function displayNoResults(selectedSpecies) {
  const resultsSection = document.getElementById("searchResultsSection");
  const resultsTitle = document.getElementById("resultsTitle");
  const resultsCount = document.getElementById("resultsCount");
  const resultsContainer = document.getElementById("searchResults");

  resultsTitle.textContent = "No Results Found";
  resultsCount.textContent = `No files found containing: ${selectedSpecies.join(
    ", "
  )}`;
  resultsContainer.innerHTML = `
    <div class="no-results">
      <p>No files found matching your search criteria.</p>
      <p>Searched for: <strong>${selectedSpecies.join(", ")}</strong></p>
      <p>Try adjusting your search parameters or check if files are properly tagged.</p>
    </div>
  `;

  currentSearchResults = [];
  resultsSection.style.display = "block";
  clearSelection();
}

// Show search loading
function showSearchLoading() {
  const resultsContainer = document.getElementById("searchResults");
  resultsContainer.innerHTML = `
    <div class="search-loading">
      <div class="loading-spinner"></div>
      <p>Searching...</p>
    </div>
  `;
  document.getElementById("searchResultsSection").style.display = "block";
}

// Hide search results
function hideSearchResults() {
  document.getElementById("searchResultsSection").style.display = "none";
  clearSelection();
}

// Display search results - INCLUDES THUMBNAIL SUPPORT
function displaySearchResults(results, searchType) {
  debugLog("=== Displaying Search Results ===", results);

  const resultsSection = document.getElementById("searchResultsSection");
  const resultsTitle = document.getElementById("resultsTitle");
  const resultsCount = document.getElementById("resultsCount");
  const resultsContainer = document.getElementById("searchResults");

  if (!results.results || results.results.length === 0) {
    debugLog("No results to display");
    resultsTitle.textContent = "No Results Found";
    resultsCount.textContent = "No files found matching your criteria";
    resultsContainer.innerHTML = `
      <div class="no-results">
        <p>No files found matching your search criteria.</p>
        <p>Try adjusting your search parameters.</p>
      </div>
    `;
  } else {
    debugLog(`Displaying ${results.results.length} results`);

    // Special handling for thumbnail search results
    if (searchType === "thumbnail") {
      resultsTitle.textContent = "Full-Size Image Found";
      resultsCount.textContent = `Found matching full-size image`;

      resultsContainer.innerHTML = results.results
        .map((file) => createThumbnailResultCard(file))
        .join("");
    } else {
      resultsTitle.textContent = "Search Results";
      resultsCount.textContent = `Found ${results.total} files matching your criteria`;
      resultsContainer.innerHTML = results.results
        .map((file) => createResultCard(file, searchType))
        .join("");
    }
  }

  currentSearchResults = results.results || [];
  resultsSection.style.display = "block";
  clearSelection();

  debugLog("=== Results Display Complete ===");
}

// CREATE THUMBNAIL RESULT CARD - THIS WAS MISSING!
function createThumbnailResultCard(file) {
  debugLog("Creating thumbnail result card", file);

  const fullUrl = file.fullUrl || "";
  const shortUrl =
    fullUrl.length > 80
      ? fullUrl.substring(0, 60) +
        "..." +
        fullUrl.substring(fullUrl.length - 20)
      : fullUrl;

  return `
    <div class="result-card thumbnail-result-card" data-file-id="${file.id}">
      <!-- Large Preview Display -->
      <div class="thumbnail-result-preview">
        <img src="${file.fullUrl}" alt="${file.filename}" 
             class="large-image-preview" 
             onerror="this.src='${
               file.thumbnailUrl || ""
             }'; this.alt='Image preview failed';">
      </div>
      
      <div class="thumbnail-result-info">
        <div class="result-filename"><strong>Filename:</strong> ${
          file.filename
        }</div>
        <div class="result-urls">
          <div class="url-item">
            <strong>Thumbnail URL:</strong> 
            <span class="url-text">${file.thumbnailUrl || "N/A"}</span>
          </div>
          <div class="url-item">
            <strong>Full-size URL (Pre-signed URL):</strong> 
            <a href="${file.fullUrl}" target="_blank" class="url-link" title="${
    file.fullUrl
  }">
              ${shortUrl}
            </a>
            <button class="btn-copy-url" onclick="copyToClipboard('${file.fullUrl.replace(
              /'/g,
              "\\'"
            )}')">📋 Copy Full URL</button>
          </div>
        </div>
        <div class="result-actions">
          <button class="btn-action" onclick="viewFile('${
            file.id
          }')">View Full Size</button>
          <button class="btn-action" onclick="downloadFile('${
            file.id
          }')">Download</button>
        </div>
      </div>
    </div>
  `;
}

// Create result card for regular searches
function createResultCard(file, searchType) {
  const tagsDisplay = Object.entries(file.tags)
    .map(([species, count]) => `${species} ×${count}`)
    .join(", ");

  let thumbnailContent;
  if (file.type === "image" && file.thumbnailUrl) {
    thumbnailContent = `<img src="${file.thumbnailUrl}" alt="${file.filename}" class="result-thumbnail">`;
  } else if (file.type === "video") {
    thumbnailContent = `<div class="result-thumbnail result-icon">${getFileTypeIcon(
      "video"
    )}</div>`;
  } else if (file.type === "audio") {
    thumbnailContent = `<div class="result-thumbnail result-icon">${getFileTypeIcon(
      "audio"
    )}</div>`;
  } else {
    thumbnailContent = `<div class="result-thumbnail result-icon">${getFileTypeIcon(
      "image"
    )}</div>`;
  }

  const thumbnailS3Url = file.thumbnailUrl
    ? file.thumbnailUrl.split("?")[0]
    : "No thumbnail URL available";

  const actionButtons = getActionButtons(file);

  return `
    <div class="result-card" data-file-id="${file.id}">
      <input type="checkbox" class="result-checkbox" 
             onchange="toggleFileSelection(this, '${file.id}')">
      
      ${thumbnailContent}
      
      <div class="result-content">
        <div class="result-filename">${file.filename}</div>
        <div class="result-tags">${tagsDisplay}</div>
        <div class="result-file-type">${file.type.toUpperCase()}</div>
        
        <div class="result-url-section">
          <div class="url-label">Full S3 URL for thumbnail:</div>
          <div class="full-url-display" title="${thumbnailS3Url}">
            ${thumbnailS3Url}
          </div>
        </div>
        
        <div class="result-actions">
          ${actionButtons}
        </div>
      </div>
    </div>
  `;
}

// Helper function to shorten URLs
function shortenUrl(url, maxLength = 60) {
  if (!url) return "No URL available";

  if (url.length <= maxLength) {
    return url;
  }

  const urlParts = url.split("?");
  const baseUrl = urlParts[0];
  const queryString = urlParts[1];

  if (baseUrl.length <= maxLength) {
    return `${baseUrl}?...`;
  }

  const start = url.substring(0, Math.floor(maxLength / 2));
  const end = url.substring(url.length - Math.floor(maxLength / 2));
  return `${start}...${end}`;
}

// Get action buttons
function getActionButtons(file) {
  if (file.type === "image") {
    return `
      <button class="btn-action btn-view-full" onclick="viewFullSizeImage('${file.id}')">View Full Size</button>
      <button class="btn-action" onclick="downloadFile('${file.id}')">Download</button>
    `;
  } else if (file.type === "video") {
    return `
      <button class="btn-action" onclick="playFile('${file.id}')">Play</button>
      <button class="btn-action" onclick="downloadFile('${file.id}')">Download</button>
    `;
  } else if (file.type === "audio") {
    return `
      <button class="btn-action" onclick="playFile('${file.id}')">Play</button>
      <button class="btn-action" onclick="downloadFile('${file.id}')">Download</button>
    `;
  }
  return `<button class="btn-action" onclick="downloadFile('${file.id}')">Download</button>`;
}

function getFileTypeIcon(type) {
  switch (type) {
    case "image":
      return "🖼️";
    case "video":
      return "🎥";
    case "audio":
      return "🎵";
    default:
      return "📄";
  }
}

// File actions
function viewFile(fileId) {
  const file = currentSearchResults.find((f) => f.id === fileId);
  if (file && file.fullUrl) {
    window.open(file.fullUrl, "_blank");
  } else {
    showNotification("File not found", "error");
  }
}

function viewFullSizeImage(fileId) {
  const file = currentSearchResults.find((f) => f.id === fileId);
  if (file && file.fullUrl) {
    window.open(file.fullUrl, "_blank");
  } else {
    showNotification("Full size image not found", "error");
  }
}

function playFile(fileId) {
  const file = currentSearchResults.find((f) => f.id === fileId);
  if (file && file.fullUrl) {
    window.open(file.fullUrl, "_blank");
  } else {
    showNotification("File not found", "error");
  }
}

// Enhanced downloadFile function
async function downloadFile(fileId) {
  debugLog("=== Download File Function ===");

  const file = currentSearchResults.find((f) => f.id === fileId);
  debugLog("Found file for download", file);

  if (!file) {
    showNotification("File not found", "error");
    return;
  }

  const downloadUrl = file.downloadUrl || file.fullUrl;
  debugLog("Download URL", downloadUrl);

  if (!downloadUrl) {
    showNotification("Download URL not available", "error");
    return;
  }

  try {
    let downloadFilename = file.filename || "download.jpg";
    if (downloadFilename.startsWith("thumb_")) {
      downloadFilename = downloadFilename.replace("thumb_", "");
    }

    debugLog("Download filename", downloadFilename);

    showNotification(`Download initiated: ${downloadFilename}`, "info");

    try {
      debugLog("Attempting fetch + blob download");

      const response = await fetch(downloadUrl, {
        method: "GET",
        mode: "cors",
        cache: "no-cache",
        headers: {
          Accept: "image/*,application/octet-stream,*/*",
        },
      });

      debugLog("Fetch response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      debugLog("Blob created", { size: blob.size, type: blob.type });

      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, downloadFilename);
        showNotification(`Download completed: ${downloadFilename}`, "success");
        debugLog("IE/Edge download successful");
        return;
      }

      const blobUrl = window.URL.createObjectURL(blob);
      debugLog("Blob URL created:", blobUrl);

      const link = document.createElement("a");
      link.style.display = "none";
      link.href = blobUrl;
      link.download = downloadFilename;

      link.addEventListener("click", function () {
        debugLog("Download link clicked");
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
          debugLog("Blob URL revoked");
        }, 100);
      });

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showNotification(`Download started: ${downloadFilename}`, "success");
      debugLog("Modern browser download successful");
    } catch (fetchError) {
      debugLog("Fetch method failed", fetchError);
      showDownloadInstructionsModal(downloadUrl, downloadFilename);
    }
  } catch (error) {
    console.error("All download methods failed:", error);
    debugLog("All download methods failed", error);
    showDownloadInstructionsModal(downloadUrl, downloadFilename);
  }
}

// Helper function to show download instructions
function showDownloadInstructionsModal(downloadUrl, filename) {
  const modal = document.createElement("div");
  modal.className = "download-instructions-modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Manual Download Required</h3>
      <p>Due to browser security restrictions, please follow these steps to download the file:</p>
      <div class="download-steps">
        <p><strong>Step 1:</strong> Click the button below to open the full-size image</p>
        <p><strong>Step 2:</strong> Right-click on the image</p>
        <p><strong>Step 3:</strong> Select "Save image as..." or "Save picture as..."</p>
        <p><strong>Step 4:</strong> Choose your download location and save</p>
      </div>
      <div class="modal-buttons">
        <button class="btn-open-image" onclick="window.open('${downloadUrl}', '_blank'); this.closest('.download-instructions-modal').remove();">
          Open Full-Size Image
        </button>
        <button class="btn-close-modal" onclick="this.closest('.download-instructions-modal').remove();">
          Close
        </button>
      </div>
    </div>
  `;

  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  `;

  const modalContent = modal.querySelector(".modal-content");
  modalContent.style.cssText = `
    background: white;
    padding: 2rem;
    border-radius: 0.5rem;
    max-width: 500px;
    margin: 1rem;
    text-align: center;
  `;

  const steps = modal.querySelector(".download-steps");
  steps.style.cssText = `
    text-align: left;
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 0.25rem;
    margin: 1rem 0;
  `;

  const buttons = modal.querySelectorAll("button");
  buttons.forEach((button) => {
    button.style.cssText = `
      padding: 0.75rem 1.5rem;
      margin: 0 0.5rem;
      border: none;
      border-radius: 0.25rem;
      cursor: pointer;
      font-weight: 500;
    `;
  });

  const openBtn = modal.querySelector(".btn-open-image");
  openBtn.style.backgroundColor = "#2563eb";
  openBtn.style.color = "white";

  const closeBtn = modal.querySelector(".btn-close-modal");
  closeBtn.style.backgroundColor = "#6b7280";
  closeBtn.style.color = "white";

  document.body.appendChild(modal);

  showNotification(`Manual download required for: ${filename}`, "info");
}

// Copy URL to clipboard function
function copyToClipboard(url) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        showNotification("Full URL copied to clipboard!", "success");
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
        showNotification("Failed to copy URL", "error");
      });
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = url;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
      showNotification("Full URL copied to clipboard!", "success");
    } catch (err) {
      console.error("Failed to copy: ", err);
      showNotification("Failed to copy URL", "error");
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

// Populate species select elements
async function populateSpeciesSelects() {
  const selectElements = document.querySelectorAll(
    ".tag-select, .species-select"
  );

  if (selectElements.length === 0) {
    debugLog("No species select elements found - skipping species loading");
    return;
  }

  const speciesList = await getSpeciesList();
  debugLog("Populating selects with species list", speciesList);

  selectElements.forEach((select) => {
    const currentValue = select.value;

    const placeholder = select.querySelector('option[value=""]');
    select.innerHTML = "";

    if (placeholder) {
      select.appendChild(placeholder);
    } else {
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Select bird species";
      select.appendChild(defaultOption);
    }

    speciesList.forEach((species) => {
      const option = document.createElement("option");
      option.value = species.toLowerCase();
      option.textContent = species.charAt(0).toUpperCase() + species.slice(1);
      select.appendChild(option);
    });

    if (currentValue && speciesList.includes(currentValue)) {
      select.value = currentValue;
    }
  });

  debugLog(
    `Populated ${selectElements.length} select elements with ${speciesList.length} species`
  );
}

// Show specific search form
function showSearchForm(searchType) {
  document.querySelectorAll(".search-form").forEach((form) => {
    form.style.display = "none";
  });

  const selectedForm = document.getElementById(`${searchType}-form`);
  if (selectedForm) {
    selectedForm.style.display = "block";

    const formsNeedingSpecies = ["tags-counts", "tags"];
    if (formsNeedingSpecies.includes(searchType)) {
      populateSpeciesSelects();
    }
  }

  hideSearchResults();
  clearSelection();
}

// Enhanced authentication token getter
function getAuthenticationToken() {
  const token = sessionStorage.getItem("idToken") || "";
  debugLog("Retrieved auth token length:", token.length);
  return token;
}

// File selection management
function toggleFileSelection(checkbox, fileId) {
  if (checkbox.checked) {
    if (!selectedFiles.includes(fileId)) {
      selectedFiles.push(fileId);
    }
  } else {
    selectedFiles = selectedFiles.filter((id) => id !== fileId);
  }
  updateFloatingActionBar();
}

function updateFloatingActionBar() {
  const actionBar = document.getElementById("floatingActionBar");
  if (selectedFiles.length > 0) {
    actionBar.classList.remove("hidden");
    document.getElementById(
      "selectedCount"
    ).textContent = `${selectedFiles.length} files selected`;
  } else {
    actionBar.classList.add("hidden");
  }
}

function clearSelection() {
  selectedFiles = [];
  document
    .querySelectorAll(".result-checkbox")
    .forEach((cb) => (cb.checked = false));
  updateFloatingActionBar();
}

// Form functions
function clearTagsForm() {
  const speciesSelect = document.getElementById("speciesSelect");
  if (speciesSelect) {
    speciesSelect.selectedIndex = -1;
  }
  hideSearchResults();
}

function clearThumbnailForm() {
  document.getElementById("thumbnailUrl").value = "";
  hideSearchResults();
}

function clearFileUploadForm() {
  document.getElementById("searchFileInput").value = "";
  document.getElementById("searchByFileBtn").disabled = true;
  searchUploadedFile = null;
  hideSearchResults();
}

// Placeholder functions for not yet implemented features
function initializeSearchFileUpload() {
  debugLog("Search file upload functionality - placeholder");
}

function initializeDeleteConfirmation() {
  debugLog("Delete confirmation functionality - placeholder");
}

function searchByTagsAndCounts() {
  showNotification("Tags & Counts search not yet implemented", "info");
}

function searchByFileUpload() {
  showNotification("File upload search not yet implemented", "info");
}

// Placeholder modal functions
function showAddTagsModal() {
  showNotification("Add tags functionality not yet implemented", "info");
}

function showRemoveTagsModal() {
  showNotification("Remove tags functionality not yet implemented", "info");
}

function showDeleteFilesModal() {
  showNotification("Delete files functionality not yet implemented", "info");
}

// API connectivity test
async function testAPIConnectivity() {
  try {
    debugLog("=== Testing API Connectivity ===");

    const authToken = getAuthenticationToken();
    debugLog("Auth token available:", !!authToken);

    if (!authToken) {
      debugLog("No auth token - user may not be signed in");
      return;
    }

    const testUrl = `${SEARCH_API_CONFIG.searchByTagsEndpoint}?tag1=hawk`;
    debugLog("Testing URL:", testUrl);

    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    debugLog("Test response status:", response.status);
    debugLog(
      "Test response headers:",
      Object.fromEntries(response.headers.entries())
    );

    const responseText = await response.text();
    debugLog("Test response text:", responseText);

    try {
      const responseJson = JSON.parse(responseText);
      debugLog("Test response JSON:", responseJson);
    } catch (e) {
      debugLog("Response is not valid JSON");
    }
  } catch (error) {
    debugLog("API connectivity test failed:", error);
  }
}

// Initialize search functionality
function initializeSearch() {
  debugLog("=== Initializing Search Functionality ===");

  const searchTabs = document.querySelectorAll(".sub-nav-links a");

  searchTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();

      searchTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const searchType = tab.getAttribute("data-search-type");
      showSearchForm(searchType);
    });
  });

  initializeSearchFileUpload();
  initializeDeleteConfirmation();
  populateSpeciesSelects();
  showSearchForm("tags");

  debugLog("Search initialization complete");
}

// Add debugging helpers to window
window.testAPIConnectivity = testAPIConnectivity;
window.debugSearchByTags = searchByTags;

// Initialize search functionality on page load
document.addEventListener("DOMContentLoaded", () => {
  debugLog("DOM Content Loaded - Starting initialization");
  initializeSearch();
});

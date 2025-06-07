// Complete Search & Management functionality with Dynamic Species Loading and Backend Integration
let selectedFiles = [];
let currentSearchResults = [];
let searchUploadedFile = null;

// Species caching
let cachedSpecies = null;
let speciesCacheTimestamp = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Configuration for search endpoints
const SEARCH_API_CONFIG = {
  // Existing endpoints
  thumbnailSearchEndpoint:
    "https://t89sef6460.execute-api.ap-southeast-2.amazonaws.com/dev/birdtag/search-t",

  // UPDATED: Use search-s for BOTH species listing AND search functionality
  getSpeciesEndpoint:
    "https://t89sef6460.execute-api.ap-southeast-2.amazonaws.com/dev/birdtag/search-s",
  searchByTagsEndpoint:
    "https://t89sef6460.execute-api.ap-southeast-2.amazonaws.com/dev/birdtag/search-s",

  // Future endpoints (keep as is)
  searchByFileEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/birdtag/search-file",
  addTagsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/birdtag/edit",
  removeTagsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/birdtag/edit",
  deleteFilesEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/birdtag/delete",
};

// Dynamic Species Loading
async function getSpeciesList() {
  // Check cache first
  if (
    cachedSpecies &&
    speciesCacheTimestamp &&
    Date.now() - speciesCacheTimestamp < CACHE_DURATION
  ) {
    console.log("Using cached species list:", cachedSpecies);
    return cachedSpecies;
  }

  try {
    console.log("Fetching species from API...");
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

    if (response.ok) {
      const data = await response.json();

      // Extract species names from response
      const speciesList = data.species || [];

      // Cache the results
      cachedSpecies = speciesList.sort(); // Sort alphabetically
      speciesCacheTimestamp = Date.now();

      console.log(
        `Loaded ${speciesList.length} species from API:`,
        speciesList
      );
      return cachedSpecies;
    } else {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("Failed to fetch species from API:", error);

    // Fall back to hardcoded list
    const fallbackSpecies = [
      "crow",
      "pigeon",
      "sparrow",
      "robin",
      "eagle",
      "hawk",
      "owl",
      "duck",
    ];
    showNotification("Using default species list (API unavailable)", "info");
    return fallbackSpecies;
  }
}

// Populate species select elements
async function populateSpeciesSelects() {
  const speciesList = await getSpeciesList();

  // Find all species select elements
  const selectElements = document.querySelectorAll(
    ".tag-select, .species-select"
  );

  selectElements.forEach((select) => {
    // Save current selection
    const currentValue = select.value;

    // Clear existing options except the first placeholder
    const placeholder = select.querySelector('option[value=""]');
    select.innerHTML = "";

    // Add placeholder back
    if (placeholder) {
      select.appendChild(placeholder);
    } else {
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Select bird species";
      select.appendChild(defaultOption);
    }

    // Add species options
    speciesList.forEach((species) => {
      const option = document.createElement("option");
      option.value = species.toLowerCase();
      option.textContent = species.charAt(0).toUpperCase() + species.slice(1);
      select.appendChild(option);
    });

    // Restore selection if it exists
    if (currentValue && speciesList.includes(currentValue)) {
      select.value = currentValue;
    }
  });

  console.log(
    `Populated ${selectElements.length} select elements with ${speciesList.length} species`
  );
}

// Refresh species cache manually
async function refreshSpeciesCache() {
  cachedSpecies = null;
  speciesCacheTimestamp = null;
  await populateSpeciesSelects();
  showNotification("Species list refreshed!", "success");
}

// Search Functions - UPDATED with real API integration
async function searchByTags() {
  const speciesSelect = document.getElementById("speciesSelect");
  const selectedSpecies = Array.from(speciesSelect.selectedOptions).map(
    (option) => option.value
  );

  if (selectedSpecies.length === 0) {
    showNotification("Please select at least one bird species", "error");
    return;
  }

  try {
    showSearchLoading();

    // Build API URL with query parameters for your existing Lambda
    // Using format: tag1=crow&tag2=pigeon (no counts for search-s)
    const queryParams = new URLSearchParams();
    selectedSpecies.forEach((species, index) => {
      queryParams.append(`tag${index + 1}`, species);
    });

    const apiUrl = `${
      SEARCH_API_CONFIG.searchByTagsEndpoint
    }?${queryParams.toString()}`;

    console.log("Searching by tags:", selectedSpecies);
    console.log("API URL:", apiUrl);

    const authToken = getAuthenticationToken();
    if (!authToken) {
      throw new Error("Authentication required");
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();

      // Convert API response to displayable format
      const searchResults = {
        results: data.links
          ? data.links.map((url, index) => {
              // Determine if it's a thumbnail (image) or direct file (video/audio)
              const isThumbUrl = url && url.includes("thumb_");
              const filename = url ? url.split("/").pop() : `file_${index}`;

              return {
                id: `search-result-${index}`,
                filename: filename,
                type: isThumbUrl ? "image" : "video", // Simplified - could be audio too
                tags: selectedSpecies.reduce((acc, species) => {
                  acc[species] = 1; // We know it contains these species
                  return acc;
                }, {}),
                thumbnailUrl: isThumbUrl ? url : null,
                fullUrl: url,
                s3Key: url ? url.replace(/^https?:\/\/[^\/]+\//, "") : "",
              };
            })
          : [],
        total: data.links ? data.links.length : 0,
        searchType: "tags",
        searchParams: { species: selectedSpecies },
      };

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
      throw new Error(`Search failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("Search by tags failed:", error);
    showNotification("Search failed: " + error.message, "error");
    hideSearchResults();
  }
}

async function searchByTagsAndCounts() {
  const tagPairs = document.querySelectorAll("#tagCountPairs .tag-count-pair");
  const searchParams = {};

  tagPairs.forEach((pair) => {
    const tag = pair.querySelector(".tag-select").value;
    const count = pair.querySelector(".count-input").value;

    if (tag && count) {
      searchParams[tag] = parseInt(count);
    }
  });

  if (Object.keys(searchParams).length === 0) {
    showNotification(
      "Please select at least one bird species and count",
      "error"
    );
    return;
  }

  try {
    showSearchLoading();

    // NOTE: For tags & counts, you'll need to create a different endpoint
    // or modify your existing search-s Lambda to handle counts
    // For now, this will use the mock approach
    const results = await performSearch("tags-counts", searchParams);
    displaySearchResults(results, "tags-counts");

    showNotification(
      "Note: Tag counts search using mock data. Backend integration needed.",
      "info"
    );
  } catch (error) {
    showNotification("Search failed: " + error.message, "error");
    hideSearchResults();
  }
}

// Initialize search functionality
function initializeSearch() {
  const searchTabs = document.querySelectorAll(".sub-nav-links a");

  searchTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();

      // Remove active class from all tabs
      searchTabs.forEach((t) => t.classList.remove("active"));

      // Add active class to clicked tab
      tab.classList.add("active");

      // Show corresponding search form
      const searchType = tab.getAttribute("data-search-type");
      showSearchForm(searchType);
    });
  });

  // Initialize file upload for search
  initializeSearchFileUpload();

  // Initialize delete confirmation input
  initializeDeleteConfirmation();

  // Load species on page load
  populateSpeciesSelects();

  // Show the first form by default
  showSearchForm("tags-counts");
}

// Enhanced form functions with species population
function addTagCountPair() {
  const container = document.getElementById("tagCountPairs");
  const pairDiv = document.createElement("div");
  pairDiv.className = "tag-count-pair";
  pairDiv.innerHTML = `
    <select class="tag-select">
      <option value="">Select bird species</option>
    </select>
    <input type="number" class="count-input" placeholder="Count" min="1">
    <button class="btn-remove-tag" onclick="this.parentElement.remove()">× Remove</button>
  `;
  container.appendChild(pairDiv);

  // Populate the new select element
  populateSpeciesSelects();
}

function addTagPairToModal(containerId) {
  const container = document.getElementById(containerId);
  const pairDiv = document.createElement("div");
  pairDiv.className = "tag-count-pair";
  pairDiv.innerHTML = `
    <select class="tag-select">
      <option value="">Select bird species</option>
    </select>
    <input type="number" class="count-input" placeholder="Count" min="1">
    <button class="btn-remove-tag" onclick="this.parentElement.remove()">× Remove</button>
  `;
  container.appendChild(pairDiv);

  // Populate the new select element
  populateSpeciesSelects();

  // Update preview
  if (containerId === "addTagsPairs") {
    updateAddTagsPreview();
  } else if (containerId === "removeTagsPairs") {
    updateRemoveTagsPreview();
  }
}

// Show specific search form
function showSearchForm(searchType) {
  // Hide all search forms
  document.querySelectorAll(".search-form").forEach((form) => {
    form.style.display = "none";
  });

  // Show selected form
  const selectedForm = document.getElementById(`${searchType}-form`);
  if (selectedForm) {
    selectedForm.style.display = "block";

    // Ensure species selects are populated when showing form
    populateSpeciesSelects();
  }

  // Hide results when switching forms
  hideSearchResults();
  clearSelection();
}

// Reset forms with species repopulation
function resetTagsCountsForm() {
  const container = document.getElementById("tagCountPairs");
  container.innerHTML = `
    <div class="tag-count-pair">
      <select class="tag-select">
        <option value="">Select bird species</option>
      </select>
      <input type="number" class="count-input" placeholder="Count" min="1">
      <button class="btn-remove-tag" onclick="this.parentElement.remove()">× Remove</button>
    </div>
  `;
  populateSpeciesSelects();
  hideSearchResults();
}

function clearTagsForm() {
  document.getElementById("speciesSelect").selectedIndex = -1;
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

// Display search results
function displaySearchResults(results, searchType) {
  const resultsSection = document.getElementById("searchResultsSection");
  const resultsTitle = document.getElementById("resultsTitle");
  const resultsCount = document.getElementById("resultsCount");
  const resultsContainer = document.getElementById("searchResults");

  if (!results.results || results.results.length === 0) {
    resultsTitle.textContent = "No Results Found";
    resultsCount.textContent = "No files found matching your criteria";
    resultsContainer.innerHTML = `
      <div class="no-results">
        <p>No files found matching your search criteria.</p>
        <p>Try adjusting your search parameters.</p>
      </div>
    `;
  } else {
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
}

function createResultCard(file, searchType) {
  const tagsDisplay = Object.entries(file.tags)
    .map(([species, count]) => `${species} ×${count}`)
    .join(", ");

  const thumbnailContent =
    file.type === "image" && file.thumbnailUrl
      ? `<img src="${file.thumbnailUrl}" alt="${file.filename}" class="result-thumbnail">`
      : `<div class="result-thumbnail result-icon">${getFileTypeIcon(
          file.type
        )}</div>`;

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
        <div class="result-actions">
          ${actionButtons}
        </div>
      </div>
    </div>
  `;
}

function createThumbnailResultCard(file) {
  const fullUrl = file.fullUrl;
  const shortUrl =
    fullUrl.length > 80
      ? fullUrl.substring(0, 60) +
        "..." +
        fullUrl.substring(fullUrl.length - 20)
      : fullUrl;

  return `
    <div class="result-card thumbnail-result-card" data-file-id="${file.id}">
      <div class="thumbnail-result-preview">
        <img src="${file.fullUrl}" alt="${file.filename}" 
             class="large-image-preview" 
             onerror="this.src='${
               file.thumbnailUrl
             }'; this.alt='Image preview failed';">
      </div>
      
      <div class="thumbnail-result-info">
        <div class="result-filename"><strong>Filename:</strong> ${
          file.filename
        }</div>
        <div class="result-urls">
          <div class="url-item">
            <strong>Thumbnail URL:</strong> 
            <span class="url-text">${file.thumbnailUrl}</span>
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

function getActionButtons(file) {
  if (file.type === "image") {
    return `
      <button class="btn-action" onclick="viewFile('${file.id}')">View Full Size</button>
      <button class="btn-action" onclick="downloadFile('${file.id}')">Download</button>
    `;
  } else if (file.type === "video" || file.type === "audio") {
    return `
      <button class="btn-action" onclick="playFile('${file.id}')">Play</button>
      <button class="btn-action" onclick="downloadFile('${file.id}')">Download</button>
    `;
  }
  return `<button class="btn-action" onclick="downloadFile('${file.id}')">Download</button>`;
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

function playFile(fileId) {
  const file = currentSearchResults.find((f) => f.id === fileId);
  if (file && file.fullUrl) {
    window.open(file.fullUrl, "_blank");
  } else {
    showNotification("File not found", "error");
  }
}

function downloadFile(fileId) {
  const file = currentSearchResults.find((f) => f.id === fileId);
  if (file && file.fullUrl) {
    const link = document.createElement("a");
    link.href = file.fullUrl;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Downloading ${file.filename}`, "success");
  } else {
    showNotification("File not found", "error");
  }
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

// Helper functions
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

function hideSearchResults() {
  document.getElementById("searchResultsSection").style.display = "none";
  clearSelection();
}

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

function getAuthenticationToken() {
  return sessionStorage.getItem("idToken") || "";
}

// File selection management (placeholder functions)
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

// Mock function for search types not yet implemented
async function performSearch(searchType, searchParams) {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock results for demonstration
  const mockFiles = [
    {
      id: "file1",
      filename: "bird_observation_001.jpg",
      type: "image",
      tags: { crow: 3, pigeon: 2 },
      thumbnailUrl: "https://example.s3.amazonaws.com/bird1-thumb.jpg",
      fullUrl: "https://example.s3.amazonaws.com/bird1.jpg",
      s3Key: "user-123/bird1.jpg",
    },
  ];

  return {
    results: mockFiles,
    total: mockFiles.length,
    searchType: searchType,
    searchParams: searchParams,
  };
}

// Placeholder functions for features not yet implemented
function initializeSearchFileUpload() {
  console.log("File upload search not yet implemented");
}

function initializeDeleteConfirmation() {
  console.log("Delete confirmation not yet implemented");
}

async function searchByThumbnailUrl() {
  showNotification(
    "Thumbnail URL search functionality exists in your original code",
    "info"
  );
}

async function searchByFileUpload() {
  showNotification("File upload search not yet implemented", "info");
}

// Initialize search functionality on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeSearch();
});

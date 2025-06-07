// Enhanced Search.js with comprehensive debugging and fixes

let selectedFiles = [];
let currentSearchResults = [];
let searchUploadedFile = null;

// Species caching
let cachedSpecies = null;
let speciesCacheTimestamp = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Configuration for search endpoints
const SEARCH_API_CONFIG = {
  // UPDATED: Use search-s for BOTH species listing AND search functionality
  getSpeciesEndpoint:
    "https://t89sef6460.execute-api.ap-southeast-2.amazonaws.com/dev/birdtag/search-s",
  searchByTagsEndpoint:
    "https://t89sef6460.execute-api.ap-southeast-2.amazonaws.com/dev/birdtag/search-s",
  thumbnailSearchEndpoint:
    "https://t89sef6460.execute-api.ap-southeast-2.amazonaws.com/dev/birdtag/search-t",

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

// Enhanced logging function
function debugLog(message, data = null) {
  console.log(`[DEBUG] ${message}`);
  if (data) {
    console.log(`[DEBUG DATA]`, data);
  }
}

// Enhanced error handling
function handleSearchError(error, context = "Search") {
  console.error(`[ERROR] ${context}:`, error);
  showNotification(`${context} failed: ${error.message}`, "error");
  hideSearchResults();
}

// Dynamic Species Loading with better error handling
async function getSpeciesList() {
  // Check cache first
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

      // Try different possible response structures
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

      // Cache the results
      cachedSpecies = speciesList.sort(); // Sort alphabetically
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

// Enhanced searchByTags function with comprehensive debugging
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

    // Build API URL with query parameters
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

      // Enhanced data parsing to handle different response structures
      let links = [];

      if (data.links) {
        links = data.links;
      } else if (data.body) {
        try {
          const parsedBody = JSON.parse(data.body);
          links = parsedBody.links || [];
        } catch (e) {
          debugLog("Could not parse body as JSON", e);
        }
      } else if (data.Items) {
        // Handle DynamoDB direct response format
        links = data.Items.map(
          (item) => item.s3_url || item.url || item.link
        ).filter(Boolean);
      } else if (Array.isArray(data)) {
        links = data;
      }

      debugLog(`Extracted ${links.length} links from response`, links);

      if (links.length === 0) {
        debugLog("No links found in response - showing no results");
        displayNoResults(selectedSpecies);
        return;
      }

      // Convert API response to displayable format
      const searchResults = {
        results: await Promise.all(
          links.map(async (url, index) => {
            debugLog(`Processing URL ${index + 1}`, url);

            // Extract filename from URL
            const urlParts = url.split("?")[0]; // Remove query parameters
            const filename = urlParts.split("/").pop();

            debugLog(`Extracted filename: ${filename}`);

            // Determine file type and create appropriate URLs
            const isThumbUrl = filename && filename.startsWith("thumb_");
            let thumbnailUrl = null;
            let fullUrl = url;

            if (isThumbUrl) {
              // This is a thumbnail URL, we need to get the full-size URL
              thumbnailUrl = url;

              // Generate full-size URL by removing 'thumb_' prefix
              const fullFilename = filename.replace("thumb_", "");
              const fullUrlBase = url
                .split("?")[0]
                .replace(filename, fullFilename);

              // For now, we'll use the same URL structure
              const queryString = url.split("?")[1];
              fullUrl = queryString
                ? `${fullUrlBase}?${queryString}`
                : fullUrlBase;
            }

            // Determine file type more accurately
            let fileType = "image"; // default
            if (filename) {
              const extension = filename.split(".").pop().toLowerCase();
              if (["mp4", "avi", "mov", "wmv"].includes(extension)) {
                fileType = "video";
              } else if (["mp3", "wav", "aac", "ogg"].includes(extension)) {
                fileType = "audio";
              }
            }

            const resultItem = {
              id: `search-result-${index}`,
              filename: filename || `file-${index}`,
              shortenedPath: filename || `file-${index}`,
              type: fileType,
              tags: selectedSpecies.reduce((acc, species) => {
                acc[species] = 1; // Default count of 1 for each searched species
                return acc;
              }, {}),
              thumbnailUrl: thumbnailUrl,
              fullUrl: fullUrl,
              presignedUrl: url, // Store the original pre-signed URL
              s3Key: urlParts.replace(/^https?:\/\/[^\/]+\//, ""),
            };

            debugLog(`Created result item ${index + 1}`, resultItem);
            return resultItem;
          })
        ),
        total: links.length,
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

// Enhanced displaySearchResults function
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

// Add a test function to help debug API connectivity
async function testAPIConnectivity() {
  try {
    debugLog("=== Testing API Connectivity ===");

    const authToken = getAuthenticationToken();
    debugLog("Auth token available:", !!authToken);

    if (!authToken) {
      debugLog("No auth token - user may not be signed in");
      return;
    }

    // Test the search endpoint with a simple request
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

// Add the test function to window for manual debugging
window.testAPIConnectivity = testAPIConnectivity;
window.debugSearchByTags = searchByTags;

// Rest of your existing functions remain the same...
// (I'll include the key ones that might need fixes)

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

  debugLog(
    `Populated ${selectElements.length} select elements with ${speciesList.length} species`
  );
}

// Enhanced authentication token getter
function getAuthenticationToken() {
  const token = sessionStorage.getItem("idToken") || "";
  debugLog("Retrieved auth token length:", token.length);
  return token;
}

// Enhanced initialization
function initializeSearch() {
  debugLog("=== Initializing Search Functionality ===");

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

  debugLog("Search initialization complete");

  // Add debugging helpers to console
  console.log("Debug helpers available:");
  console.log("- testAPIConnectivity() - Test API connection");
  console.log("- debugSearchByTags() - Run search with full logging");
}

// [Keep all your other existing functions like createResultCard, viewFile, etc.]

// Initialize search functionality on page load
document.addEventListener("DOMContentLoaded", () => {
  debugLog("DOM Content Loaded - Starting initialization");
  initializeSearch();
});

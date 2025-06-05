// Search & Management functionality
let selectedFiles = [];

// Configuration for search endpoints (to be added later)
const SEARCH_API_CONFIG = {
  searchEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/search",
  // Add other search endpoints as needed
};

function initializeSearch() {
  const searchTabs = document.querySelectorAll(".sub-nav-links a");
  searchTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      searchTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      // Show corresponding search form
      showSearchForm(tab.getAttribute("data-search-type"));
    });
  });
}

function showSearchForm(searchType) {
  // Hide all search forms
  document.querySelectorAll(".search-form").forEach((form) => {
    form.style.display = "none";
  });

  // Show selected form
  const selectedForm = document.getElementById(`${searchType}-form`);
  if (selectedForm) {
    selectedForm.style.display = "block";
  }
}

function addTagCountPair() {
  const container = document.getElementById("tagCountPairs");
  const pairDiv = document.createElement("div");
  pairDiv.className = "tag-count-pair";
  pairDiv.innerHTML = `
        <select class="tag-select">
            <option value="">Select bird species</option>
            <option value="crow">Crow</option>
            <option value="pigeon">Pigeon</option>
            <option value="sparrow">Sparrow</option>
            <option value="robin">Robin</option>
        </select>
        <input type="number" class="count-input" placeholder="Count" min="1">
        <button class="btn-remove-tag" onclick="this.parentElement.remove()">× Remove</button>
    `;
  container.appendChild(pairDiv);
}

function toggleFileSelection(checkbox, fileId) {
  if (checkbox.checked) {
    selectedFiles.push(fileId);
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

// Search functionality (to be implemented when APIs are ready)
async function performSearch(searchType, searchParams) {
  try {
    // This will be implemented when search APIs are created
    console.log("Performing search:", searchType, searchParams);

    // Placeholder response
    return {
      results: [],
      message: "Search functionality will be implemented when APIs are ready",
    };
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}

// Tag-based search
async function searchByTags() {
  const tagPairs = document.querySelectorAll(".tag-count-pair");
  const searchParams = {};

  tagPairs.forEach((pair) => {
    const tag = pair.querySelector(".tag-select").value;
    const count = pair.querySelector(".count-input").value;

    if (tag && count) {
      searchParams[tag] = parseInt(count);
    }
  });

  if (Object.keys(searchParams).length === 0) {
    alert("Please select at least one bird species and count");
    return;
  }

  try {
    const results = await performSearch("tags", searchParams);
    displaySearchResults(results);
  } catch (error) {
    alert("Search failed: " + error.message);
  }
}

// Species-based search
async function searchBySpecies(species) {
  try {
    const results = await performSearch("species", { species });
    displaySearchResults(results);
  } catch (error) {
    alert("Search failed: " + error.message);
  }
}

// Display search results
function displaySearchResults(results) {
  const resultsContainer = document.getElementById("searchResults");

  if (!resultsContainer) {
    console.error("Search results container not found");
    return;
  }

  if (!results.results || results.results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="no-results">
        <p>No files found matching your search criteria.</p>
      </div>
    `;
    return;
  }

  // Display results in grid format
  resultsContainer.innerHTML = `
    <div class="results-grid">
      ${results.results
        .map(
          (file) => `
        <div class="result-card">
          <input type="checkbox" class="result-checkbox" 
                 onchange="toggleFileSelection(this, '${file.id}')">
          ${
            file.type === "image"
              ? `<img src="${file.thumbnailUrl}" alt="${file.filename}" class="result-thumbnail">`
              : `<div class="result-thumbnail">${file.type.toUpperCase()}</div>`
          }
          <div class="result-content">
            <div class="result-tags">
              ${file.tags
                .map((tag) => `<span class="tag-badge">${tag}</span>`)
                .join("")}
            </div>
            <div class="result-actions">
              <button class="btn-action" onclick="viewFile('${
                file.id
              }')">View</button>
              <button class="btn-action" onclick="downloadFile('${
                file.id
              }')">Download</button>
            </div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// File actions
function viewFile(fileId) {
  // This will open the file in a modal or new tab
  console.log("View file:", fileId);
  alert("View functionality will be implemented later");
}

function downloadFile(fileId) {
  // This will trigger file download
  console.log("Download file:", fileId);
  alert("Download functionality will be implemented later");
}

// Bulk actions
function bulkDeleteFiles() {
  if (selectedFiles.length === 0) {
    alert("Please select files to delete");
    return;
  }

  if (
    confirm(`Are you sure you want to delete ${selectedFiles.length} files?`)
  ) {
    console.log("Bulk delete files:", selectedFiles);
    alert("Bulk delete functionality will be implemented later");
  }
}

function bulkDownloadFiles() {
  if (selectedFiles.length === 0) {
    alert("Please select files to download");
    return;
  }

  console.log("Bulk download files:", selectedFiles);
  alert("Bulk download functionality will be implemented later");
}

// Initialize search functionality on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeSearch();
});

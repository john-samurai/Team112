// Search & Management functionality
let selectedFiles = [];
let currentSearchResults = [];
let searchUploadedFile = null;

// Configuration for search endpoints (to be added later)
const SEARCH_API_CONFIG = {
  searchByTagsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/search-tags",
  searchByThumbnailEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/search-thumbnail",
  searchByFileEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/search-file",
  addTagsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/add-tags",
  removeTagsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/remove-tags",
  deleteFilesEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/delete-files",
};

// Initialize search functionality
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

  // Initialize file upload for search
  initializeSearchFileUpload();

  // Initialize delete confirmation input
  initializeDeleteConfirmation();

  // Show the first form by default
  showSearchForm("tags-counts");
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
  }

  // Hide results when switching forms
  hideSearchResults();
  clearSelection();
}

// Tag-Count Pairs Management
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

function addTagPairToModal(containerId) {
  const container = document.getElementById(containerId);
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

  // Update preview
  if (containerId === "addTagsPairs") {
    updateAddTagsPreview();
  } else if (containerId === "removeTagsPairs") {
    updateRemoveTagsPreview();
  }
}

// Reset forms
function resetTagsCountsForm() {
  const container = document.getElementById("tagCountPairs");
  container.innerHTML = `
    <div class="tag-count-pair">
      <select class="tag-select">
        <option value="">Select bird species</option>
        <option value="crow">Crow</option>
        <option value="pigeon">Pigeon</option>
        <option value="sparrow">Sparrow</option>
        <option value="robin">Robin</option>
      </select>
      <input type="number" class="count-input" placeholder="Count" min="1">
      <button class="btn-remove-tag" onclick="this.parentElement.remove()">× Remove</button>
    </div>
  `;
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

// Search Functions
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
    const results = await performSearch("tags-counts", searchParams);
    displaySearchResults(results, "tags-counts");
  } catch (error) {
    showNotification("Search failed: " + error.message, "error");
    hideSearchResults();
  }
}

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
    const results = await performSearch("tags", { species: selectedSpecies });
    displaySearchResults(results, "tags");
  } catch (error) {
    showNotification("Search failed: " + error.message, "error");
    hideSearchResults();
  }
}

async function searchByThumbnailUrl() {
  const thumbnailUrl = document.getElementById("thumbnailUrl").value.trim();

  if (!thumbnailUrl) {
    showNotification("Please enter a thumbnail URL", "error");
    return;
  }

  if (!isValidUrl(thumbnailUrl)) {
    showNotification("Please enter a valid URL", "error");
    return;
  }

  try {
    showSearchLoading();
    const results = await performSearch("thumbnail", { url: thumbnailUrl });
    displaySearchResults(results, "thumbnail");
  } catch (error) {
    showNotification("Search failed: " + error.message, "error");
    hideSearchResults();
  }
}

async function searchByFileUpload() {
  if (!searchUploadedFile) {
    showNotification("Please upload a file first", "error");
    return;
  }

  try {
    showSearchLoading();

    // Analyze the uploaded file to get tags
    const fileAnalysis = await analyzeUploadedFile(searchUploadedFile);

    if (!fileAnalysis.tags || Object.keys(fileAnalysis.tags).length === 0) {
      showNotification("No bird species detected in the uploaded file", "info");
      hideSearchResults();
      return;
    }

    // Search for files with similar tags
    const results = await performSearch("file-upload", {
      detectedTags: fileAnalysis.tags,
      uploadedFile: searchUploadedFile,
    });

    // Show detected tags info
    showFileAnalysisResult(fileAnalysis);

    displaySearchResults(results, "file-upload");
  } catch (error) {
    showNotification("Search failed: " + error.message, "error");
    hideSearchResults();
  }
}

// File upload for search
function initializeSearchFileUpload() {
  const uploadArea = document.getElementById("searchUploadArea");
  const fileInput = document.getElementById("searchFileInput");

  if (uploadArea && fileInput) {
    // Click to upload
    uploadArea.addEventListener("click", () => fileInput.click());

    // Drag and drop
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("drag-over");
    });

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("drag-over");
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("drag-over");
      handleSearchFile(e.dataTransfer.files[0]);
    });

    // File input change
    fileInput.addEventListener("change", (e) => {
      handleSearchFile(e.target.files[0]);
    });
  }
}

function handleSearchFile(file) {
  if (!file) return;

  const acceptedTypes = [
    "image/jpeg",
    "image/png",
    "audio/mp3",
    "audio/mpeg",
    "audio/wav",
    "video/mp4",
  ];

  if (!acceptedTypes.includes(file.type)) {
    showNotification(`Unsupported file type: ${file.type}`, "error");
    return;
  }

  const maxSize = 8 * 1024 * 1024; // 8MB
  if (file.size > maxSize) {
    showNotification("File is too big. Max file size is 8MB.", "error");
    return;
  }

  searchUploadedFile = file;
  document.getElementById("searchByFileBtn").disabled = false;

  showNotification(`File "${file.name}" selected for search`, "success");
}

// Search API calls (mock for now, ready for real implementation)
async function performSearch(searchType, searchParams) {
  try {
    console.log("Performing search:", searchType, searchParams);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock results based on search type
    const mockResults = generateMockResults(searchType, searchParams);

    return mockResults;

    // TODO: Replace with real API calls when backend is ready
    /*
    const endpoint = getSearchEndpoint(searchType);
    const authToken = getAuthenticationToken();
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(searchParams)
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }
    
    return await response.json();
    */
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}

function generateMockResults(searchType, searchParams) {
  // Generate mock data for demonstration
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
    {
      id: "file2",
      filename: "bird_observation_002.mp4",
      type: "video",
      tags: { crow: 2, sparrow: 1 },
      thumbnailUrl: null,
      fullUrl: "https://example.s3.amazonaws.com/bird2.mp4",
      s3Key: "user-123/bird2.mp4",
    },
    {
      id: "file3",
      filename: "bird_song_001.mp3",
      type: "audio",
      tags: { pigeon: 1, robin: 2 },
      thumbnailUrl: null,
      fullUrl: "https://example.s3.amazonaws.com/bird3.mp3",
      s3Key: "user-123/bird3.mp3",
    },
  ];

  // Filter based on search type and params
  let filteredResults = mockFiles;

  if (searchType === "tags-counts") {
    filteredResults = mockFiles.filter((file) => {
      return Object.entries(searchParams).every(([species, minCount]) => {
        return file.tags[species] && file.tags[species] >= minCount;
      });
    });
  } else if (searchType === "tags") {
    filteredResults = mockFiles.filter((file) => {
      return searchParams.species.some((species) => file.tags[species]);
    });
  } else if (searchType === "thumbnail") {
    // For thumbnail search, return single result
    filteredResults = mockFiles.filter(
      (file) => file.thumbnailUrl === searchParams.url
    );
  }

  return {
    results: filteredResults,
    total: filteredResults.length,
    searchType: searchType,
    searchParams: searchParams,
  };
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
    resultsTitle.textContent = "Search Results";
    resultsCount.textContent = `Found ${results.total} files matching your criteria`;

    resultsContainer.innerHTML = results.results
      .map((file) => createResultCard(file, searchType))
      .join("");
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

// Modal management
function showAddTagsModal() {
  if (selectedFiles.length === 0) {
    showNotification("Please select files first", "error");
    return;
  }

  document.getElementById("addTagsFileCount").textContent =
    selectedFiles.length;
  document.getElementById("addTagsModal").classList.add("active");
  updateAddTagsPreview();
}

function hideAddTagsModal() {
  document.getElementById("addTagsModal").classList.remove("active");
}

function showRemoveTagsModal() {
  if (selectedFiles.length === 0) {
    showNotification("Please select files first", "error");
    return;
  }

  document.getElementById("removeTagsFileCount").textContent =
    selectedFiles.length;
  displayCurrentTags();
  document.getElementById("removeTagsModal").classList.add("active");
  updateRemoveTagsPreview();
}

function hideRemoveTagsModal() {
  document.getElementById("removeTagsModal").classList.remove("active");
}

function showDeleteFilesModal() {
  if (selectedFiles.length === 0) {
    showNotification("Please select files first", "error");
    return;
  }

  document.getElementById("deleteFileCount").textContent = selectedFiles.length;
  displayFilesToDelete();
  document.getElementById("deleteFilesModal").classList.add("active");
}

function hideDeleteFilesModal() {
  document.getElementById("deleteFilesModal").classList.remove("active");
  document.getElementById("deleteConfirmation").value = "";
  document.getElementById("confirmDeleteBtn").disabled = true;
}

// Modal content updates
function updateAddTagsPreview() {
  const pairs = document.querySelectorAll("#addTagsPairs .tag-count-pair");
  const preview = {};

  pairs.forEach((pair) => {
    const tag = pair.querySelector(".tag-select").value;
    const count = pair.querySelector(".count-input").value;
    if (tag && count) {
      preview[tag] = parseInt(count);
    }
  });

  document.getElementById("addTagsPreview").textContent =
    JSON.stringify(preview);
}

function updateRemoveTagsPreview() {
  const pairs = document.querySelectorAll("#removeTagsPairs .tag-count-pair");
  const preview = {};

  pairs.forEach((pair) => {
    const tag = pair.querySelector(".tag-select").value;
    const count = pair.querySelector(".count-input").value;
    if (tag && count) {
      preview[tag] = parseInt(count);
    }
  });

  document.getElementById("removeTagsPreview").textContent =
    JSON.stringify(preview);
}

function displayCurrentTags() {
  // Mock current tags for selected files
  const currentTags = {
    crow: 3,
    pigeon: 2,
    sparrow: 1,
    robin: 1,
  };

  const tagsHtml = Object.entries(currentTags)
    .map(
      ([species, count]) => `
      <label class="current-tag-item">
        <input type="checkbox" value="${species}"> 
        ${species} (×${count})
      </label>
    `
    )
    .join("");

  document.getElementById("currentTagsDisplay").innerHTML = tagsHtml;
}

function displayFilesToDelete() {
  const selectedFilesData = currentSearchResults.filter((file) =>
    selectedFiles.includes(file.id)
  );

  const filesHtml = selectedFilesData
    .map((file) => {
      const tagsDisplay = Object.entries(file.tags)
        .map(([species, count]) => `${species} ×${count}`)
        .join(", ");
      return `<div class="file-to-delete">• ${file.filename} (${tagsDisplay})</div>`;
    })
    .join("");

  document.getElementById("filesToDeleteList").innerHTML = filesHtml;
}

function initializeDeleteConfirmation() {
  const confirmInput = document.getElementById("deleteConfirmation");
  const confirmBtn = document.getElementById("confirmDeleteBtn");

  if (confirmInput && confirmBtn) {
    confirmInput.addEventListener("input", (e) => {
      confirmBtn.disabled = e.target.value !== "DELETE";
    });
  }
}

// Modal actions
async function applyAddTags() {
  const pairs = document.querySelectorAll("#addTagsPairs .tag-count-pair");
  const tagsToAdd = {};

  pairs.forEach((pair) => {
    const tag = pair.querySelector(".tag-select").value;
    const count = pair.querySelector(".count-input").value;
    if (tag && count) {
      tagsToAdd[tag] = parseInt(count);
    }
  });

  if (Object.keys(tagsToAdd).length === 0) {
    showNotification("Please specify tags to add", "error");
    return;
  }

  try {
    await performBulkOperation("add-tags", {
      fileIds: selectedFiles,
      tags: tagsToAdd,
    });

    showNotification("Tags added successfully!", "success");
    hideAddTagsModal();
    // Refresh results would go here
  } catch (error) {
    showNotification("Failed to add tags: " + error.message, "error");
  }
}

async function applyRemoveTags() {
  // Get tags from checkboxes and manual input
  const selectedCurrentTags = Array.from(
    document.querySelectorAll(
      "#currentTagsDisplay input[type='checkbox']:checked"
    )
  ).map((cb) => cb.value);

  const manualTags = {};
  const pairs = document.querySelectorAll("#removeTagsPairs .tag-count-pair");
  pairs.forEach((pair) => {
    const tag = pair.querySelector(".tag-select").value;
    const count = pair.querySelector(".count-input").value;
    if (tag && count) {
      manualTags[tag] = parseInt(count);
    }
  });

  if (
    selectedCurrentTags.length === 0 &&
    Object.keys(manualTags).length === 0
  ) {
    showNotification("Please specify tags to remove", "error");
    return;
  }

  try {
    await performBulkOperation("remove-tags", {
      fileIds: selectedFiles,
      selectedTags: selectedCurrentTags,
      manualTags: manualTags,
    });

    showNotification("Tags removed successfully!", "success");
    hideRemoveTagsModal();
    // Refresh results would go here
  } catch (error) {
    showNotification("Failed to remove tags: " + error.message, "error");
  }
}

async function confirmDeleteFiles() {
  try {
    await performBulkOperation("delete-files", {
      fileIds: selectedFiles,
    });

    showNotification("Files deleted successfully!", "success");
    hideDeleteFilesModal();

    // Remove deleted files from current results
    currentSearchResults = currentSearchResults.filter(
      (file) => !selectedFiles.includes(file.id)
    );

    // Refresh display
    displaySearchResults(
      { results: currentSearchResults, total: currentSearchResults.length },
      "refresh"
    );
    clearSelection();
  } catch (error) {
    showNotification("Failed to delete files: " + error.message, "error");
  }
}

// Bulk operations
async function performBulkOperation(operation, params) {
  console.log("Performing bulk operation:", operation, params);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // TODO: Implement real API calls
  /*
  const authToken = getAuthenticationToken();
  const endpoint = SEARCH_API_CONFIG[`${operation}Endpoint`];
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(params)
  });
  
  if (!response.ok) {
    throw new Error(`Operation failed: ${response.status}`);
  }
  */
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
  showNotification("Play functionality will be implemented later", "info");
}

function downloadFile(fileId) {
  const file = currentSearchResults.find((f) => f.id === fileId);
  if (file && file.fullUrl) {
    // Create temporary download link
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

function showFileAnalysisResult(analysis) {
  const tagsDisplay = Object.entries(analysis.tags)
    .map(([species, count]) => `${species} ×${count}`)
    .join(", ");

  showNotification(
    `Detected in your file: ${tagsDisplay}. File was not stored.`,
    "info"
  );
}

async function analyzeUploadedFile(file) {
  // Mock file analysis
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    tags: { crow: 2, pigeon: 1 },
    confidence: 0.95,
  };
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
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

// FIXED SIGN OUT FUNCTIONALITY
function showSignOutModal() {
  const modal = document.getElementById("signOutModal");
  if (modal) {
    modal.classList.add("active");
  }
}

function hideSignOutModal() {
  const modal = document.getElementById("signOutModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

function confirmSignOut() {
  hideSignOutModal();

  try {
    // Initialize Cognito User Pool if available
    if (typeof AmazonCognitoIdentity !== "undefined") {
      const userPool = new AmazonCognitoIdentity.CognitoUserPool({
        UserPoolId: "ap-southeast-2_rXnAUdmtr",
        ClientId: "77so3j6u54v3qk4qttle2k8tsk",
      });

      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.signOut();
      }
    }
  } catch (error) {
    console.log(
      "Cognito signout error (this is normal if user pool not initialized):",
      error
    );
  }

  // Clear all session storage
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("idToken");
  sessionStorage.removeItem("isAuthenticated");
  sessionStorage.removeItem("currentUser");
  sessionStorage.clear();

  // Redirect to home page
  window.location.href = "../index.html";
}

// Initialize search functionality on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeSearch();
});

// File upload functionality
let uploadedFiles = [];

// Configuration - Your actual API Gateway endpoint
const API_CONFIG = {
  uploadEndpoint:
    "https://1on783g7h9.execute-api.ap-southeast-2.amazonaws.com/dev/upload",
  // Add other endpoints as needed
};

function initializeUpload() {
  const uploadArea = document.getElementById("uploadArea");
  const fileInput = document.getElementById("fileInput");

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
      handleFiles(e.dataTransfer.files);
    });

    // File input change
    fileInput.addEventListener("change", (e) => {
      handleFiles(e.target.files);
    });
  }
}

function handleFiles(files) {
  const fileList = document.getElementById("fileList");
  const acceptedTypes = [
    "image/jpeg",
    "image/png",
    "audio/mp3",
    "audio/mpeg",
    "video/mp4",
  ];
  const maxSize = 8 * 1024 * 1024; // 8MB

  Array.from(files).forEach((file) => {
    if (!acceptedTypes.includes(file.type)) {
      addFileToList(file, "error", "Unsupported file type");
      return;
    }

    if (file.size > maxSize) {
      addFileToList(file, "error", "File is too big. Max file size is 8MB.");
      return;
    }

    // Add file to list
    const fileId = Date.now() + Math.random();
    uploadedFiles.push({ id: fileId, file, status: "uploading" });
    addFileToList(file, "uploading", null, fileId);

    // Upload to real API instead of simulation
    uploadToAPI(file, fileId);
  });
}

async function uploadToAPI(file, fileId) {
  try {
    // For now, we'll upload without auth token (will add Cognito later)
    // const authToken = await getAuthToken();

    // Read file as ArrayBuffer for binary upload
    const fileData = await readFileAsArrayBuffer(file);

    // Upload to API Gateway
    const response = await fetch(API_CONFIG.uploadEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: fileData,
    });

    if (response.ok) {
      const result = await response.json();
      markUploadComplete(fileId, result);
    } else {
      const errorText = await response.text();
      markUploadError(fileId, `Upload failed: ${errorText}`);
    }
  } catch (error) {
    console.error("Upload error:", error);
    markUploadError(fileId, "Upload failed: " + error.message);
  }
}

// Helper function to read file as ArrayBuffer
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function addFileToList(file, status, error, fileId) {
  const fileList = document.getElementById("fileList");
  const fileItem = document.createElement("div");
  fileItem.className = "file-item";
  fileItem.id = `file-${fileId}`;

  const fileType = file.type.split("/")[0];
  const fileTypeName = fileType.charAt(0).toUpperCase() + fileType.slice(1);

  fileItem.innerHTML = `
        <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-type">${fileTypeName} • ${formatFileSize(
    file.size
  )}</div>
        </div>
        <div class="file-status">
            ${
              status === "uploading"
                ? `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
            `
                : ""
            }
            ${status === "success" ? '<span class="success-icon">✓</span>' : ""}
            ${
              status === "error"
                ? `<span class="error-message">${error}</span>`
                : ""
            }
            ${
              status !== "success"
                ? `<button class="remove-btn" onclick="removeFile('${fileId}')">×</button>`
                : ""
            }
        </div>
    `;

  fileList.appendChild(fileItem);

  // Start progress animation for uploads
  if (status === "uploading") {
    simulateProgress(fileId);
  }
}

function simulateProgress(fileId) {
  let progress = 0;
  const interval = setInterval(() => {
    progress += 15;
    updateProgress(fileId, progress);

    // Stop at 90% and wait for actual upload completion
    if (progress >= 90) {
      clearInterval(interval);
    }
  }, 200);
}

function updateProgress(fileId, progress) {
  const fileItem = document.getElementById(`file-${fileId}`);
  if (fileItem) {
    const progressFill = fileItem.querySelector(".progress-fill");
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
  }
}

function markUploadComplete(fileId, result) {
  const fileItem = document.getElementById(`file-${fileId}`);
  if (fileItem) {
    const fileStatus = fileItem.querySelector(".file-status");
    fileStatus.innerHTML =
      '<span class="success-icon">✓ Uploaded successfully</span>';

    const file = uploadedFiles.find((f) => f.id === fileId);
    if (file) {
      file.status = "success";
      file.s3Url = result.s3Url; // Store S3 URL from API response
      file.s3Key = result.s3Key;
      file.serverFileId = result.fileId;
    }
  }
}

function markUploadError(fileId, errorMessage) {
  const fileItem = document.getElementById(`file-${fileId}`);
  if (fileItem) {
    const fileStatus = fileItem.querySelector(".file-status");
    fileStatus.innerHTML = `<span class="error-message">${errorMessage}</span>
                           <button class="remove-btn" onclick="removeFile('${fileId}')">×</button>`;

    const file = uploadedFiles.find((f) => f.id === fileId);
    if (file) {
      file.status = "error";
    }
  }
}

function removeFile(fileId) {
  const fileItem = document.getElementById(`file-${fileId}`);
  if (fileItem) {
    fileItem.remove();
    uploadedFiles = uploadedFiles.filter((f) => f.id !== fileId);
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Function to get auth token (to be implemented when Cognito is ready)
async function getAuthToken() {
  // This should be implemented when your teammate completes Cognito
  // Return the JWT token from Cognito
  return localStorage.getItem("authToken") || "";
}

// Initialize upload functionality on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeUpload();
});

// File upload functionality
let uploadedFiles = [];

function initializeUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (uploadArea && fileInput) {
        // Click to upload
        uploadArea.addEventListener('click', () => fileInput.click());
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }
}

function handleFiles(files) {
    const fileList = document.getElementById('fileList');
    const acceptedTypes = ['image/jpeg', 'image/png', 'audio/mp3', 'audio/mpeg', 'video/mp4'];
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    Array.from(files).forEach(file => {
        if (!acceptedTypes.includes(file.type)) {
            addFileToList(file, 'error', 'Unsupported file type');
            return;
        }
        
        if (file.size > maxSize) {
            addFileToList(file, 'error', 'File is too big. Max file size is 50MB.');
            return;
        }
        
        // Add file to list
        const fileId = Date.now() + Math.random();
        uploadedFiles.push({ id: fileId, file, status: 'uploading' });
        addFileToList(file, 'uploading', null, fileId);
        
        // Simulate upload (in real app, this would upload to S3)
        simulateUpload(fileId);
    });
}

function addFileToList(file, status, error, fileId) {
    const fileList = document.getElementById('fileList');
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.id = `file-${fileId}`;
    
    const fileType = file.type.split('/')[0];
    const fileTypeName = fileType.charAt(0).toUpperCase() + fileType.slice(1);
    
    fileItem.innerHTML = `
        <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-type">${fileTypeName} • ${formatFileSize(file.size)}</div>
        </div>
        <div class="file-status">
            ${status === 'uploading' ? `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
            ` : ''}
            ${status === 'success' ? '<span class="success-icon">✓</span>' : ''}
            ${status === 'error' ? `<span class="error-message">${error}</span>` : ''}
            ${status !== 'success' ? `<button class="remove-btn" onclick="removeFile('${fileId}')">×</button>` : ''}
        </div>
    `;
    
    fileList.appendChild(fileItem);
}

function simulateUpload(fileId) {
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        updateProgress(fileId, progress);
        
        if (progress >= 100) {
            clearInterval(interval);
            markUploadComplete(fileId);
        }
    }, 200);
}

function updateProgress(fileId, progress) {
    const fileItem = document.getElementById(`file-${fileId}`);
    if (fileItem) {
        const progressFill = fileItem.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
    }
}

function markUploadComplete(fileId) {
    const fileItem = document.getElementById(`file-${fileId}`);
    if (fileItem) {
        const fileStatus = fileItem.querySelector('.file-status');
        fileStatus.innerHTML = '<span class="success-icon">✓</span>';
        
        const file = uploadedFiles.find(f => f.id === fileId);
        if (file) {
            file.status = 'success';
        }
    }
}

function removeFile(fileId) {
    const fileItem = document.getElementById(`file-${fileId}`);
    if (fileItem) {
        fileItem.remove();
        uploadedFiles = uploadedFiles.filter(f => f.id !== fileId);
    }
}

// Search & Management functionality
let selectedFiles = [];

function initializeSearch() {
    const searchTabs = document.querySelectorAll('.sub-nav-links a');
    searchTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            searchTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // Show corresponding search form
            showSearchForm(tab.getAttribute('data-search-type'));
        });
    });
}

function showSearchForm(searchType) {
    // Hide all search forms
    document.querySelectorAll('.search-form').forEach(form => {
        form.style.display = 'none';
    });
    
    // Show selected form
    const selectedForm = document.getElementById(`${searchType}-form`);
    if (selectedForm) {
        selectedForm.style.display = 'block';
    }
}

function addTagCountPair() {
    const container = document.getElementById('tagCountPairs');
    const pairDiv = document.createElement('div');
    pairDiv.className = 'tag-count-pair';
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
        selectedFiles = selectedFiles.filter(id => id !== fileId);
    }
    
    updateFloatingActionBar();
}

function updateFloatingActionBar() {
    const actionBar = document.getElementById('floatingActionBar');
    if (selectedFiles.length > 0) {
        actionBar.classList.remove('hidden');
        document.getElementById('selectedCount').textContent = `${selectedFiles.length} files selected`;
    } else {
        actionBar.classList.add('hidden');
    }
}

// Settings functionality
function saveNotificationPreferences() {
    const checkboxes = document.querySelectorAll('.notification-item input[type="checkbox"]');
    const preferences = {};
    
    checkboxes.forEach(checkbox => {
        preferences[checkbox.value] = checkbox.checked;
    });
    
    // Save to localStorage (in real app, this would be saved to backend)
    localStorage.setItem('notificationPreferences', JSON.stringify(preferences));
    alert('Preferences saved successfully!');
}

function resetNotificationPreferences() {
    const checkboxes = document.querySelectorAll('.notification-item input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    localStorage.removeItem('notificationPreferences');
    alert('Preferences reset to default!');
}

function loadNotificationPreferences() {
    const preferences = JSON.parse(localStorage.getItem('notificationPreferences')) || {};
    const checkboxes = document.querySelectorAll('.notification-item input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
        if (preferences[checkbox.value] !== undefined) {
            checkbox.checked = preferences[checkbox.value];
        }
    });
}

// Initialize core functionality on page load
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage === 'upload.html') {
        initializeUpload();
    } else if (currentPage === 'search.html') {
        initializeSearch();
    } else if (currentPage === 'settings.html') {
        loadNotificationPreferences();
    }
});
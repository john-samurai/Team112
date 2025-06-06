// Settings functionality with Tag-based Notifications

// Configuration for settings endpoints (to be added later)
const SETTINGS_API_CONFIG = {
  settingsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/settings",
  notificationsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/notifications",
  // Add other settings endpoints as needed
};

// Initialize settings functionality
function initializeSettings() {
  // Handle sub-navigation tabs
  const settingsTabs = document.querySelectorAll(".sub-nav-links a");
  settingsTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      settingsTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Show corresponding settings section
      const tabType = tab.getAttribute("data-settings-tab");
      showSettingsSection(tabType);
    });
  });

  // Load saved preferences on page load
  loadNotificationPreferences();
}

// Show specific settings section
function showSettingsSection(sectionType) {
  // Hide all sections
  document.querySelectorAll(".settings-section").forEach((section) => {
    section.style.display = "none";
  });

  // Show selected section
  const selectedSection = document.getElementById(`${sectionType}-section`);
  if (selectedSection) {
    selectedSection.style.display = "block";
  }
}

// Save notification preferences
function saveNotificationPreferences() {
  const checkboxes = document.querySelectorAll('input[name="bird-species"]');
  const preferences = {};

  checkboxes.forEach((checkbox) => {
    preferences[checkbox.value] = checkbox.checked;
  });

  // Save to localStorage for now (will integrate with backend later)
  localStorage.setItem("notificationPreferences", JSON.stringify(preferences));

  // In the future, this will also save to backend
  savePreferencesToBackend(preferences);

  // Show success message
  showNotificationMessage("Preferences saved successfully!", "success");

  console.log("Saved notification preferences:", preferences);
}

// Reset notification preferences to default (none selected)
function resetNotificationPreferences() {
  const checkboxes = document.querySelectorAll('input[name="bird-species"]');

  // Uncheck all boxes (default state)
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });

  // Remove from localStorage
  localStorage.removeItem("notificationPreferences");

  // In the future, this will also reset in backend
  resetPreferencesInBackend();

  // Show success message
  showNotificationMessage("Preferences reset to default!", "info");

  console.log("Reset notification preferences to default");
}

// Load notification preferences from storage
function loadNotificationPreferences() {
  const preferences =
    JSON.parse(localStorage.getItem("notificationPreferences")) || {};
  const checkboxes = document.querySelectorAll('input[name="bird-species"]');

  checkboxes.forEach((checkbox) => {
    if (preferences[checkbox.value] !== undefined) {
      checkbox.checked = preferences[checkbox.value];
    } else {
      // Default state: unchecked
      checkbox.checked = false;
    }
  });

  console.log("Loaded notification preferences:", preferences);
}

// Show notification message to user
function showNotificationMessage(message, type = "info") {
  // Create a temporary notification element
  const notification = document.createElement("div");
  notification.className = `notification-toast ${type}`;
  notification.textContent = message;

  // Style the notification
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
  `;

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.opacity = "1";
    notification.style.transform = "translateX(0)";
  }, 100);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Backend integration functions (to be implemented when APIs are ready)
async function savePreferencesToBackend(preferences) {
  try {
    // This will save preferences to backend when API is ready
    console.log("Saving preferences to backend:", preferences);

    const authToken = getAuthenticationToken();
    if (!authToken) {
      console.warn("No auth token available for backend save");
      return;
    }

    // Placeholder for future API call
    /*
    const response = await fetch(SETTINGS_API_CONFIG.notificationsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        userId: getCurrentUserId(),
        preferences: preferences
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save preferences to backend');
    }
    
    console.log("Successfully saved preferences to backend");
    */
  } catch (error) {
    console.error("Error saving preferences to backend:", error);
    showNotificationMessage(
      "Warning: Preferences saved locally but not synced to server",
      "error"
    );
  }
}

async function resetPreferencesInBackend() {
  try {
    // This will reset preferences in backend when API is ready
    console.log("Resetting preferences in backend");

    const authToken = getAuthenticationToken();
    if (!authToken) {
      console.warn("No auth token available for backend reset");
      return;
    }

    // Placeholder for future API call
    /*
    const response = await fetch(SETTINGS_API_CONFIG.notificationsEndpoint, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to reset preferences in backend');
    }
    
    console.log("Successfully reset preferences in backend");
    */
  } catch (error) {
    console.error("Error resetting preferences in backend:", error);
    showNotificationMessage(
      "Warning: Preferences reset locally but not synced to server",
      "error"
    );
  }
}

async function loadPreferencesFromBackend() {
  try {
    // This will load preferences from backend when API is ready
    console.log("Loading preferences from backend");

    const authToken = getAuthenticationToken();
    if (!authToken) {
      console.warn("No auth token available for backend load");
      return null;
    }

    // Placeholder for future API call
    /*
    const response = await fetch(SETTINGS_API_CONFIG.notificationsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.preferences;
    }
    */

    return null;
  } catch (error) {
    console.error("Error loading preferences from backend:", error);
    return null;
  }
}

// User profile management (future functionality)
function updateUserProfile() {
  const firstName = document.getElementById("firstName")?.value;
  const lastName = document.getElementById("lastName")?.value;
  const email = document.getElementById("email")?.value;

  if (!firstName || !lastName || !email) {
    alert("Please fill in all required fields");
    return;
  }

  const profileData = {
    firstName,
    lastName,
    email,
  };

  // Save to localStorage temporarily
  localStorage.setItem("userProfile", JSON.stringify(profileData));

  // In the future, this will also save to backend
  saveProfileToBackend(profileData);

  alert("Profile updated successfully!");
}

async function saveProfileToBackend(profileData) {
  try {
    // This will save profile to backend when API is ready
    console.log("Saving profile to backend:", profileData);

    // Placeholder for future API call
  } catch (error) {
    console.error("Error saving profile to backend:", error);
  }
}

function loadUserProfile() {
  const profileData = JSON.parse(localStorage.getItem("userProfile")) || {};

  if (document.getElementById("firstName")) {
    document.getElementById("firstName").value = profileData.firstName || "";
  }
  if (document.getElementById("lastName")) {
    document.getElementById("lastName").value = profileData.lastName || "";
  }
  if (document.getElementById("email")) {
    document.getElementById("email").value = profileData.email || "";
  }
}

// Account management (future functionality)
function changePassword() {
  const currentPassword = document.getElementById("currentPassword")?.value;
  const newPassword = document.getElementById("newPassword")?.value;
  const confirmPassword = document.getElementById("confirmPassword")?.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    alert("Please fill in all password fields");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("New passwords do not match");
    return;
  }

  if (newPassword.length < 8) {
    alert("Password must be at least 8 characters long");
    return;
  }

  // In the future, this will integrate with Cognito
  console.log("Change password requested");
  alert(
    "Password change functionality will be implemented with Cognito integration"
  );
}

function deleteAccount() {
  const confirmation = prompt(
    "Are you sure you want to delete your account? Type 'DELETE' to confirm:"
  );

  if (confirmation === "DELETE") {
    // In the future, this will integrate with backend
    console.log("Account deletion requested");
    alert("Account deletion functionality will be implemented later");
  }
}

// Utility functions
function getCurrentUserId() {
  const currentUser = getCurrentUserInfo();
  return currentUser?.sub || currentUser?.email || "temp-user-123";
}

function getAuthenticationToken() {
  // Use the common.js function if available
  if (typeof window !== "undefined" && window.getAuthenticationToken) {
    return window.getAuthenticationToken();
  }
  // Fallback to session storage
  return sessionStorage.getItem("idToken") || "";
}

function getCurrentUserInfo() {
  // Use the common.js function if available
  if (typeof window !== "undefined" && window.getCurrentUserInfo) {
    return window.getCurrentUserInfo();
  }
  // Fallback to session storage
  const userInfo = sessionStorage.getItem("currentUser");
  return userInfo ? JSON.parse(userInfo) : null;
}

// Initialize settings functionality on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeSettings();
  loadUserProfile();

  // Show notifications section by default
  showSettingsSection("notifications");
});

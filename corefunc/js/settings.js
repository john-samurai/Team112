// Settings functionality

// Configuration for settings endpoints (to be added later)
const SETTINGS_API_CONFIG = {
  settingsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/settings",
  notificationsEndpoint:
    "https://your-api-id.execute-api.region.amazonaws.com/dev/notifications",
  // Add other settings endpoints as needed
};

function saveNotificationPreferences() {
  const checkboxes = document.querySelectorAll(
    '.notification-item input[type="checkbox"]'
  );
  const preferences = {};

  checkboxes.forEach((checkbox) => {
    preferences[checkbox.value] = checkbox.checked;
  });

  // Save to localStorage (in real app, this would be saved to backend)
  localStorage.setItem("notificationPreferences", JSON.stringify(preferences));

  // In the future, this will also save to backend
  savePreferencesToBackend(preferences);

  alert("Preferences saved successfully!");
}

function resetNotificationPreferences() {
  const checkboxes = document.querySelectorAll(
    '.notification-item input[type="checkbox"]'
  );
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });

  localStorage.removeItem("notificationPreferences");

  // In the future, this will also reset in backend
  resetPreferencesInBackend();

  alert("Preferences reset to default!");
}

function loadNotificationPreferences() {
  const preferences =
    JSON.parse(localStorage.getItem("notificationPreferences")) || {};
  const checkboxes = document.querySelectorAll(
    '.notification-item input[type="checkbox"]'
  );

  checkboxes.forEach((checkbox) => {
    if (preferences[checkbox.value] !== undefined) {
      checkbox.checked = preferences[checkbox.value];
    }
  });
}

// Backend integration functions (to be implemented when APIs are ready)
async function savePreferencesToBackend(preferences) {
  try {
    // This will save preferences to backend when API is ready
    console.log("Saving preferences to backend:", preferences);

    // Placeholder for future API call
    /*
    const response = await fetch(SETTINGS_API_CONFIG.settingsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`
      },
      body: JSON.stringify({
        userId: getCurrentUserId(),
        preferences: preferences
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save preferences');
    }
    */
  } catch (error) {
    console.error("Error saving preferences to backend:", error);
  }
}

async function resetPreferencesInBackend() {
  try {
    // This will reset preferences in backend when API is ready
    console.log("Resetting preferences in backend");

    // Placeholder for future API call
    /*
    const response = await fetch(SETTINGS_API_CONFIG.settingsEndpoint, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to reset preferences');
    }
    */
  } catch (error) {
    console.error("Error resetting preferences in backend:", error);
  }
}

async function loadPreferencesFromBackend() {
  try {
    // This will load preferences from backend when API is ready
    console.log("Loading preferences from backend");

    // Placeholder for future API call
    /*
    const response = await fetch(SETTINGS_API_CONFIG.settingsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`
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

// User profile management
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

// Account management
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
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  return currentUser?.id || "temp-user-123";
}

async function getAuthToken() {
  // This should be implemented when Cognito integration is ready
  return localStorage.getItem("authToken") || "";
}

// Initialize settings functionality on page load
document.addEventListener("DOMContentLoaded", () => {
  loadNotificationPreferences();
  loadUserProfile();
});

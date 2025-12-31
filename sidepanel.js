import { generateRoast, generatePolish } from './roaster.js';
import { AI_CONFIG } from './config.js';

// State management
let currentUser = null;
let currentProfile = null;
let lastRoastData = null;

// DOM Elements
const authSection = document.getElementById('auth-section');
const mainContent = document.getElementById('main-content');
const googleSigninBtn = document.getElementById('google-signin-btn');
const signoutBtn = document.getElementById('signout-btn');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const profilePreview = document.getElementById('profile-preview');
const profileName = document.getElementById('profile-name');
const profileHeadline = document.getElementById('profile-headline');
const profileLocation = document.getElementById('profile-location');
const roastBtn = document.getElementById('roast-btn');
const roastResult = document.getElementById('roast-result');
const roastContent = document.getElementById('roast-content');
const roastTimestamp = document.getElementById('roast-timestamp');
const loadingState = document.getElementById('loading-state');
const copyRoastBtn = document.getElementById('copy-roast-btn');
const refreshBtn = document.getElementById('refresh-btn');

// New Dashboard Elements
const navRoast = document.getElementById('nav-roast');
const navPolish = document.getElementById('nav-polish');
const polishDashboard = document.getElementById('polish-dashboard');
const polishContent = document.getElementById('polish-content');
const optimizeBtn = document.getElementById('optimize-btn');
const proBadge = document.getElementById('pro-badge');
const upgradeCta = document.getElementById('upgrade-cta');
const upgradeBtn = document.getElementById('upgrade-btn');

// Initialize app on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('LinkedIn Roaster sidepanel loaded...');

  // Restore user session from storage
  const stored = await chrome.storage.local.get(['accessToken', 'user', 'googleToken']);

  if (stored.user) {
    console.log('Restoring session for:', stored.user.email);
    currentUser = stored.user;

    // Show content immediately from cache
    showMainContent();
    // loadRoastHistory();

    // Background validation to refresh data if possible
    try {
      chrome.identity.getAuthToken({ interactive: false }, async (token) => {
        if (!chrome.runtime.lastError && token) {
          const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (response.ok) {
            const userInfo = await response.json();
            // Merge with existing user data
            await updateSession(token, { ...currentUser, ...userInfo });
            // Fetch latest pro status from Supabase
            await syncProStatus(userInfo.email);
          }
        }
      });
    } catch (e) {
      console.log('Silent token refresh failed, keeping current session');
    }
  } else {
    console.log('No stored session, showing auth screen');
    showAuthSection();
  }

  // Setup event listeners
  setupEventListeners();

  // Check if we're already on a LinkedIn profile page
  checkCurrentPage();
});

// Show auth section
function showAuthSection() {
  authSection.style.display = 'flex';
  mainContent.style.display = 'none';
}

// Show main content
function showMainContent() {
  authSection.style.display = 'none';
  mainContent.style.display = 'block';
  updateUserInfo();
}

// Update user info display
async function updateUserInfo() {
  if (!currentUser) return;

  const displayName = currentUser.name || currentUser.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  userAvatar.textContent = initial;
  userName.textContent = displayName;
  userEmail.textContent = currentUser.email || '';

  // Set avatar background from user photo if available
  if (currentUser.picture) {
    userAvatar.style.backgroundImage = `url(${currentUser.picture})`;
    userAvatar.style.backgroundSize = 'cover';
    userAvatar.textContent = '';
  }

  // Pro UI
  if (currentUser.isPro) {
    proBadge.style.display = 'block';
    upgradeCta.style.display = 'none';
  } else {
    proBadge.style.display = 'none';
    upgradeCta.style.display = 'flex'; // Use flex to respect CSS layout

    // Show remaining limit
    const today = new Date().toISOString().split('T')[0];
    const stored = await chrome.storage.local.get(['usageStats']);
    const stats = stored.usageStats || { date: today, count: 0 };

    // Reset if it's a new day
    const currentCount = (stats.date === today) ? stats.count : 0;
    const remaining = Math.max(0, 8 - currentCount);

    const usageCountEl = document.getElementById('usage-count');
    if (usageCountEl) {
      usageCountEl.textContent = `${remaining}/8`;
      // Make it red if 0
      usageCountEl.style.color = remaining === 0 ? 'var(--error)' : 'var(--success)';
      usageCountEl.style.fontWeight = 'bold';
    }
  }
}

// Setup event listeners
function setupEventListeners() {
  // Google Sign In
  googleSigninBtn.addEventListener('click', handleGoogleSignIn);

  // Sign Out
  signoutBtn.addEventListener('click', handleSignOut);

  // Roast button
  roastBtn.addEventListener('click', async () => {
    if (!currentProfile) {
      alert('No profile data detected yet. Please wait a moment or try refreshing.');
      return;
    }

    // Show loading state
    loadingState.style.display = 'block';
    profilePreview.style.display = 'none';
    roastResult.style.display = 'none';

    try {
      // Check daily limit
      const canRoast = await checkRoastLimit();
      if (!canRoast) {
        loadingState.style.display = 'none';
        profilePreview.style.display = 'block';
        return;
      }

      // Generate roast
      const roast = await generateRoast(currentProfile);

      // Display roast
      displayRoast(roast);

      // Hide loading
      loadingState.style.display = 'none';
      roastResult.style.display = 'block';

    } catch (error) {
      console.error('Error generating roast:', error);
      loadingState.style.display = 'none';
      alert('Failed to generate roast. Please try again.');
      profilePreview.style.display = 'block';
    }
  });

  // Copy roast to clipboard
  copyRoastBtn.addEventListener('click', () => {
    if (!lastRoastData) return;

    let roastText = `🔥 LinkedIn Roast for ${currentProfile?.name || 'this profile'}\n\n`;

    if (lastRoastData.summary) {
      roastText += `🎯 FIRST IMPRESSION\n${lastRoastData.summary}\n\n`;
    }

    if (lastRoastData.strengths && lastRoastData.strengths.length > 0) {
      roastText += `💪 WHAT'S WORKING\n${lastRoastData.strengths.map(s => `• ${s}`).join('\n')}\n\n`;
    }

    if (lastRoastData.weaknesses && lastRoastData.weaknesses.length > 0) {
      roastText += `🔥 THE ROAST\n${lastRoastData.weaknesses.map(w => `• ${w}`).join('\n')}\n\n`;
    }

    if (lastRoastData.advice && lastRoastData.advice.length > 0) {
      roastText += `💡 FEEDBACK\n${lastRoastData.advice.map(a => `• ${a}`).join('\n')}\n\n`;
    }

    if (lastRoastData.rating) {
      roastText += `📊 OVERALL RATING: ${lastRoastData.rating}/10\n\n`;
    }

    roastText += `Generated by 🔥 LinkedIn Roaster`;

    navigator.clipboard.writeText(roastText).then(() => {
      const originalText = copyRoastBtn.textContent;
      copyRoastBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        copyRoastBtn.textContent = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  });

  // Navigation
  navRoast.addEventListener('click', () => {
    navRoast.classList.add('active');
    navPolish.classList.remove('active');
    roastResult.style.display = 'none';
    profilePreview.style.display = 'block';
    polishDashboard.style.display = 'none';
  });

  navPolish.addEventListener('click', () => {
    if (!currentUser?.isPro) {
      alert('✨ Profile Surgeon (Polish) is a PRO feature (IDR 20k/mo). Upgrade to unlock visionary rewrites and unlimited roasts!');
      return;
    }
    navPolish.classList.add('active');
    navRoast.classList.remove('active');
    roastResult.style.display = 'none';
    profilePreview.style.display = 'none';
    polishDashboard.style.display = 'block';
    renderPolishEmpty();
  });

  // Optimize Button
  optimizeBtn.addEventListener('click', handleOptimize);

  // Upgrade Button
  upgradeBtn.addEventListener('click', () => {
    const message = encodeURIComponent(`Hi! I want to upgrade my LinkedIn Roaster to PRO (IDR 20k/mo). My email is: ${currentUser?.email || ''}`);
    window.open(`https://wa.me/6285158851103?text=${message}`, '_blank');
  });

  // Refresh profile data
  refreshBtn.addEventListener('click', () => {
    checkCurrentPage();
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Handle Google Sign In with Chrome Identity API (popup, no tab redirect)
async function handleGoogleSignIn() {
  try {
    console.log('Starting Google Sign In...');
    googleSigninBtn.disabled = true;
    googleSigninBtn.textContent = 'Signing in...';

    // 1. Try silent sign-in first (no UI)
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
      if (!chrome.runtime.lastError && token) {
        console.log('Silent sign-in successful');
        await processLoginSuccess(token);
        return;
      }

      // 2. Silent failed, try to get Chrome's primary account to skip the picker
      chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
        const options = { interactive: true };

        // If we found a Chrome account ID, use it to bypass the "choose an account" screen
        if (userInfo && userInfo.id) {
          console.log('Using primary Chrome account ID to skip picker:', userInfo.email);
          options.account = { id: userInfo.id };
        }

        // 3. Trigger interactive sign-in
        chrome.identity.getAuthToken(options, async (token) => {
          if (chrome.runtime.lastError) {
            handleLoginError(chrome.runtime.lastError);
            return;
          }
          console.log('Interactive sign-in successful');
          await processLoginSuccess(token);
        });
      });
    });

  } catch (error) {
    console.error('Sign in error:', error);
    handleLoginError(error);
  }
}

// Unified success handler
async function processLoginSuccess(token) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to fetch user info');

    const userInfo = await response.json();
    console.log('User info received:', userInfo.email);

    // Store session
    await updateSession(token, {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      isPro: false
    });

    // Sync with Supabase for real Pro status
    await syncProStatus(userInfo.email);

    console.log('Session stored, showing main content');
    showMainContent();
  } catch (error) {
    handleLoginError(error);
  }
}

// Unified error handler
function handleLoginError(error) {
  console.error('Auth error:', error);
  googleSigninBtn.disabled = false;
  googleSigninBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
            <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
        </svg>
        Sign in with Google
    `;
  if (error && error.message && !error.message.includes('User interaction required')) {
    alert('Authentication failed: ' + error.message);
  }
}

// Update and save session
async function updateSession(token, userData) {
  // Keep isPro if it exists in the current session OR provided in userData
  const isPro = userData.isPro !== undefined ? userData.isPro : (currentUser?.isPro || false);
  currentUser = { ...userData, isPro };

  await chrome.storage.local.set({
    accessToken: token,
    googleToken: token,
    user: currentUser
  });
  updateUserInfo();
}

/**
 * Fetch Pro status from Supabase source of truth
 */
async function syncProStatus(email) {
  if (!email) return;

  try {
    console.log('Syncing Pro status via backend...');
    const response = await fetch(`${AI_CONFIG.apiUrl}/pro-status?email=${encodeURIComponent(email)}`);

    if (response.ok) {
      const data = await response.json();
      const isPro = data.is_pro;
      console.log('Pro status from API:', isPro);

      // Only update if it changed
      if (currentUser && currentUser.isPro !== isPro) {
        currentUser.isPro = isPro;
        await updateSession(null, currentUser); // token is already stored
      }
    }
  } catch (error) {
    console.error('Failed to sync Pro status:', error);
  }
}

// Handle Sign Out
async function handleSignOut() {
  try {
    console.log('Signing out...');

    // Get the token and clear it from Chrome's cache only
    const stored = await chrome.storage.local.get(['googleToken', 'accessToken']);
    const tokenToClear = stored.googleToken || stored.accessToken;

    if (tokenToClear) {
      chrome.identity.removeCachedAuthToken({ token: tokenToClear }, () => {
        console.log('Token removed from local cache');
      });
      // We NO LONGER fetch the revoke URL here. 
      // This allows the next login to be "one-tap" because the user has already granted permission.
    }

    // Clear session storage
    await chrome.storage.local.remove(['accessToken', 'user', 'googleToken']);

    // Reset state
    currentUser = null;
    currentProfile = null;
    lastRoastData = null;

    // Reset UI Components
    showAuthSection();
    resetUI();

    // Re-enable sign-in button if it was disabled
    googleSigninBtn.disabled = false;
    googleSigninBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
            <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        `;

    console.log('Signed out successfully');
  } catch (error) {
    console.error('Sign out error:', error);
  }
}

// Handle messages from background script
function handleMessage(message) {
  console.log('Received message:', message);

  if (message.type === 'PROFILE_DATA_RECEIVED') {
    handleProfileData(message.data, message.url);
  } else if (message.type === 'VALID_PROFILE_PAGE') {
    // Automatically fetch data when a valid page is detected
    checkCurrentPage();
  } else if (message.type === 'NOT_PROFILE_PAGE') {
    // Clear UI when navigating away from a LinkedIn profile
    resetUI();
  }
}

// Check current page
async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Shared permissive regex for LinkedIn profiles
    const profileRegex = /^https:\/\/www\.linkedin\.com\/in\/[^\/\?#]+[\/\?#]?.*$/;

    if (tab?.url && tab.url.match(profileRegex)) {
      updateStatus('ready', 'Fetching profile data...');

      // Add a small delay to ensure content script is ready
      setTimeout(() => {
        // Request profile data
        chrome.runtime.sendMessage({ type: 'GET_PROFILE_DATA' }, (response) => {
          console.log('GET_PROFILE_DATA response:', response);
          if (response?.data) {
            handleProfileData(response.data, tab.url);
          } else if (response?.error) {
            console.error('Extraction error:', response.error);
            updateStatus('error', response.error);
          } else {
            updateStatus('error', 'Profile data extraction failed');
          }
        });
      }, 500);
    } else {
      updateStatus('idle', 'Navigate to a LinkedIn profile');
      currentProfile = null;
      profilePreview.style.display = 'none';
    }
  } catch (error) {
    console.error('Error checking current page:', error);
  }
}

// Handle profile data
function handleProfileData(data, url) {
  // Shared permissive regex for LinkedIn profiles
  const profileRegex = /^https:\/\/www\.linkedin\.com\/in\/[^\/\?#]+[\/\?#]?.*$/;

  // Validate URL format
  if (!url.match(profileRegex)) {
    updateStatus('error', 'Invalid LinkedIn profile URL');
    return;
  }

  currentProfile = { ...data, url };

  // Update UI
  profileName.textContent = data.name || 'Unknown';
  profileHeadline.textContent = data.headline || 'No headline';
  profileLocation.textContent = data.location || 'Unknown location';

  profilePreview.style.display = 'block';
  roastResult.style.display = 'none';

  updateStatus('ready', 'Ready to roast!');
}

// Update status indicator
function updateStatus(status, text) {
  statusIndicator.className = `status-indicator status-${status}`;
  statusText.textContent = text;
}

// Display roast
function displayRoast(roast) {
  lastRoastData = roast;
  roastContent.innerHTML = formatRoast(roast);
  roastTimestamp.textContent = new Date().toLocaleString();
}

// Format roast content
function formatRoast(roast) {
  if (typeof roast === 'string') {
    return `<p>${roast.replace(/\n/g, '</p><p>')}</p>`;
  }

  let html = '';

  if (roast.summary) {
    html += `<h4>🎯 First Impression</h4><p>${roast.summary}</p>`;
  }

  if (roast.strengths && roast.strengths.length > 0) {
    html += `<h4>💪 What's Working</h4><ul>`;
    roast.strengths.forEach(s => html += `<li>${s}</li>`);
    html += `</ul>`;
  }

  if (roast.weaknesses && roast.weaknesses.length > 0) {
    html += `<h4>🔥 The Roast</h4><ul>`;
    roast.weaknesses.forEach(w => html += `<li>${w}</li>`);
    html += `</ul>`;
  }

  if (roast.advice && roast.advice.length > 0) {
    html += `<h4>💡 Constructive Feedback</h4><ul>`;
    roast.advice.forEach(a => html += `<li>${a}</li>`);
    html += `</ul>`;
  }

  if (roast.rating) {
    html += `<h4>📊 Overall Rating</h4><p>${roast.rating}/10</p>`;
  }

  return html;
}

// Reset UI
function resetUI() {
  profilePreview.style.display = 'none';
  roastResult.style.display = 'none';
  loadingState.style.display = 'none';
  updateStatus('idle', 'Navigate to a LinkedIn profile');
}

// DOMContentLoaded listener handles initialization automatically

// --- Profile Surgeon Dashboard Logic ---

function renderPolishEmpty() {
  polishContent.innerHTML = `
        <div class="empty-polish">
            <p>Ready to transform your profile into a visionary masterpiece?</p>
            <button id="optimize-btn-inner" class="btn btn-primary">✨ Optimize Profile</button>
        </div>
    `;
  document.getElementById('optimize-btn-inner').addEventListener('click', handleOptimize);
}

async function handleOptimize() {
  if (!currentUser?.isPro) {
    alert('✨ Upgrade to Pro to use the Profile Surgeon.');
    return;
  }
  if (!currentProfile) {
    alert('Please navigate to a LinkedIn profile first!');
    return;
  }

  // Show loading
  polishContent.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Performing surgical profile precision...</p>
        </div>
    `;

  try {
    const polished = await generatePolish(currentProfile, lastRoastData);
    renderPolishedDashboard(polished);
  } catch (error) {
    console.error('Optimization failed:', error);
    polishContent.innerHTML = `
            <div class="empty-polish">
                <p>⚠️ Surgeon was interrupted. Please try again.</p>
                <button id="optimize-btn-retry" class="btn btn-primary">🔄 Retry Operation</button>
            </div>
        `;
    document.getElementById('optimize-btn-retry').addEventListener('click', handleOptimize);
  }
}

function renderPolishedDashboard(data) {
  let html = `
        <div class="polish-card">
            <span class="card-label">🔥 Elite Branding Tip</span>
            <p style="font-style: italic; color: #bdffcb;">"${data.branding_tip}"</p>
        </div>

        <div class="polish-card">
            <span class="card-label">Headline Upgrade</span>
            <div class="comparison">
                <div class="comp-box before">${currentProfile.headline || 'No headline'}</div>
                <div class="comp-box after">${data.headline}</div>
            </div>
            <div class="card-actions">
                <button class="btn-text copy-polish" data-copy="${data.headline}">📋 Copy</button>
            </div>
        </div>

        <div class="polish-card">
            <span class="card-label">About Section (Summary)</span>
            <div class="comparison">
                <div class="comp-box after" style="white-space: pre-line;">${data.summary}</div>
            </div>
            <div class="card-actions">
                <button class="btn-text copy-polish" data-copy="${data.summary}">📋 Copy</button>
            </div>
        </div>
    `;

  if (data.experience && data.experience.length > 0) {
    html += `<div class="section-divider">Experience Optimization</div>`;
    data.experience.forEach(exp => {
      html += `
                <div class="polish-card">
                    <span class="card-label">${exp.original}</span>
                    <div class="comparison">
                        <div class="comp-box after">
                            <strong>Title: ${exp.polished}</strong><br><br>
                            ${exp.improvements.map(i => '• ' + i).join('<br>')}
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn-text copy-polish" data-copy="${exp.polished}\n\n${exp.improvements.join('\n')}">📋 Copy</button>
                    </div>
                </div>
            `;
    });
  }

  polishContent.innerHTML = html;

  // Setup copy listeners
  document.querySelectorAll('.copy-polish').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const text = e.target.dataset.copy;
      navigator.clipboard.writeText(text).then(() => {
        const original = e.target.textContent;
        e.target.textContent = '✅';
        setTimeout(() => e.target.textContent = original, 2000);
      });
    });
  });
}

/**
 * Check and increment daily roast limit (8 per day)
 */
async function checkRoastLimit() {
  const today = new Date().toISOString().split('T')[0];
  const stored = await chrome.storage.local.get(['usageStats']);
  const stats = stored.usageStats || { date: today, count: 0 };

  if (stats.date !== today) {
    // New day, reset counter
    stats.date = today;
    stats.count = 0;
  }

  if (stats.count >= 8) {
    if (currentUser?.isPro) return true; // Unlimited for Pro
    alert('🔥 Daily Roast Limit Reached (8/8). Upgrade to PRO (IDR 20k/mo) for unlimited burns and the Polish Surgeon!');
    return false;
  }

  // Increment and save
  stats.count++;
  await chrome.storage.local.set({ usageStats: stats });
  console.log(`Roast usage for ${today}: ${stats.count}/8`);

  // Refresh UI to show new limit
  updateUserInfo();

  return true;
}

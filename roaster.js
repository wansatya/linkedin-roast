// LinkedIn Profile Roaster - Client-side wrapper for backend API
import { AI_CONFIG } from './config.js';

/**
 * Generate a roast for a LinkedIn profile via backend
 */
export async function generateRoast(profile) {
  console.log('Generating roast for:', profile.name);

  // Capture screenshot via background script
  const screenshot = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, response => resolve(response));
  });

  try {
    const response = await fetch(`${AI_CONFIG.apiUrl}/roast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...profile,
        screenshot: screenshot?.dataUrl || null
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Backend roast failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Roast failed:', error);
    throw error;
  }
}

/**
 * Generate Polish/Improvement suggestions via backend
 */
export async function generatePolish(profile, roast = null) {
  console.log('Polishing profile using roast context:', !!roast);

  try {
    const response = await fetch(`${AI_CONFIG.apiUrl}/polish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profile,
        roast
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Backend polish failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Polish failed:', error);
    throw error;
  }
}

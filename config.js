// LinkedIn Roaster Configuration
// Note: Sensitive API keys and models are now handled by the backend for security.

export const AI_CONFIG = {
  // Local or deployed backend URL
  apiUrl: 'https://roast.wansatya.com',
};

// Roast Configuration
export const ROAST_CONFIG = {
  maxLength: 1000, // Maximum length of roast
  tone: 'satirical', // satirical, constructive, brutal
  includeAdvice: true, // Include constructive feedback
};

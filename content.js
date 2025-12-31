// Guard to prevent multiple injections
if (window.hasLinkedInRoasterInjected) {
  console.log('LinkedIn Roaster content script already active');
} else {
  window.hasLinkedInRoasterInjected = true;
  console.log('LinkedIn Roaster content script loading...');

  // Wrap all initialization in an IIFE or just keep it as is since it's now guarded

  // Helper to clean up text (removes 'see more', extra newlines, etc.)
  function cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\s*see more\s*$/i, '')
      .replace(/\s*show more\s*$/i, '')
      .replace(/\s*…\s*$/i, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  // Function to extract profile data from LinkedIn page
  function extractProfileData() {
    console.log('Starting deep extraction...');

    const profileData = {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      fromLdJson: false
    };

    try {
      // 🎯 Strategy 1: Try to find structured ld+json data first
      // This is often more reliable than scraping the DOM
      const ldJsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of ldJsonScripts) {
        try {
          const json = JSON.parse(script.textContent);

          // Find the Person object (sometimes it's a single object, sometimes inside an @graph)
          const person = json['@type'] === 'Person' ? json : (json['@graph']?.find(item => item['@type'] === 'Person'));

          if (person) {
            if (person.name) profileData.name = person.name;
            if (person.jobTitle) profileData.headline = person.jobTitle;
            if (person.description && person.description.length > 20) {
              profileData.about = person.description;
              profileData.fromLdJson = true;
            }
            console.log('Got hints from structured data');
            // Don't break here, let DOM scraping fill in the gaps or overwrite better data
          }
        } catch (e) { /* skip */ }
      }

      // 🎯 Strategy 2: Deep DOM Scraping (Fallbacks)

      // 1. Name Focus
      if (!profileData.name) {
        const nameSelectors = [
          'h1.text-heading-xlarge',
          'h1.inline.t-24',
          'main h1',
          '.pv-top-card-section__name',
          'title' // Final fallback
        ];
        for (const selector of nameSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            let name = el.textContent.split('|')[0].trim();
            if (name !== 'LinkedIn') {
              profileData.name = name;
              break;
            }
          }
        }
      }

      // 2. Headline Focus
      if (!profileData.headline) {
        const headlineSelectors = [
          '.text-body-medium.break-words',
          '.pv-top-card-section__headline',
          'main h2',
          '.mt1 .text-body-medium'
        ];
        for (const selector of headlineSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim()) {
            profileData.headline = el.textContent.trim();
            break;
          }
        }
      }

      // 3. About Section Focus
      if (!profileData.about) {
        // Find the "See more" button specifically within the about section to avoid clicking everything
        const aboutSection = document.querySelector('#about')?.closest('section');
        if (aboutSection) {
          const seeMoreBtn = aboutSection.querySelector('button.inline-show-more-text__button');
          if (seeMoreBtn) seeMoreBtn.click();
        }

        const aboutSelectors = [
          '#about ~ .display-flex .inline-show-more-text span[aria-hidden="true"]',
          '#about + div + div .inline-show-more-text span[aria-hidden="true"]',
          '.pv-about-section .inline-show-more-text span[aria-hidden="true"]',
          '#about-section ~ div .pv-about__summary-text span[aria-hidden="true"]',
          'section.pv-about-section .inline-show-more-text',
          '.pv-shared-text-with-see-more',
          // Generic fallback: any section that contains the #about anchor
          'section:has(#about) .inline-show-more-text'
        ];

        for (const selector of aboutSelectors) {
          try {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim()) {
              profileData.about = cleanText(el.textContent);
              break;
            }
          } catch (e) { }
        }
      }

      // Fallback: If still not found, try searching by common "About" icons or ID-based proximity
      if (!profileData.about) {
        const aboutAnchor = document.getElementById('about');
        if (aboutAnchor) {
          const section = aboutAnchor.closest('section');
          const textEl = section?.querySelector('.inline-show-more-text span[aria-hidden="true"]') ||
            section?.querySelector('.inline-show-more-text') ||
            section?.querySelector('.pv-shared-text-with-see-more');
          if (textEl) profileData.about = cleanText(textEl.textContent);
        }
      }

      // 4. Experience Focus
      const experienceSection = document.querySelector('#experience');
      if (experienceSection) {
        const expContainer = experienceSection.closest('section');

        // Expand all internal "See more" buttons within experience items
        const internalSeeMore = expContainer.querySelectorAll('button.inline-show-more-text__button');
        internalSeeMore.forEach(btn => btn.click());

        const items = expContainer.querySelectorAll('li.artdeco-list__item');
        profileData.experience = Array.from(items).slice(0, 8).map(item => {
          // LinkedIn sometimes nests roles under one company. 
          // We try to get the most relevant title/company info.
          const title = item.querySelector('.display-flex.align-items-center [aria-hidden="true"]')?.textContent || '';
          const company = item.querySelector('.t-14.t-normal [aria-hidden="true"]')?.textContent || '';
          const duration = item.querySelector('.t-14.t-normal.t-black--light [aria-hidden="true"]')?.textContent || '';

          // Improved description selector to get the full expanded text
          const descClean = item.querySelector('.inline-show-more-text span[aria-hidden="true"]') ||
            item.querySelector('.pvs-list__outer-container span[aria-hidden="true"]') ||
            item.querySelector('.pv-shared-text-with-see-more');

          return {
            title: cleanText(title),
            company: cleanText(company),
            duration: cleanText(duration),
            description: cleanText(descClean?.textContent || '')
          };
        }).filter(exp => exp.title || exp.company);
      } else {
        profileData.experience = [];
      }

      // 5. Education Focus
      const educationSection = document.querySelector('#education');
      if (educationSection) {
        const eduContainer = educationSection.closest('section');
        const items = eduContainer.querySelectorAll('li.artdeco-list__item');
        profileData.education = Array.from(items).slice(0, 5).map(item => {
          const school = item.querySelector('.display-flex.align-items-center span[aria-hidden="true"]')?.textContent || '';
          const degree = item.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.textContent || '';
          return {
            school: cleanText(school),
            degree: cleanText(degree)
          };
        }).filter(edu => edu.school);
      }

      // 6. Skills Focus
      const skillsSection = document.querySelector('#skills');
      if (skillsSection) {
        const skillsContainer = skillsSection.closest('section');
        const skills = skillsContainer.querySelectorAll('div.display-flex.align-items-center span[aria-hidden="true"]');
        profileData.skills = Array.from(skills)
          .map(s => s.textContent.trim())
          .filter(s => s && s.length > 2 && !s.includes('Skill')); // Filter out noise
      }

      // 7. Visuals
      const pic = document.querySelector('img.pv-top-card-profile-picture__image, .pv-top-card-profile-picture img');
      profileData.hasProfilePicture = pic && !pic.src.includes('ghost-person');

      const banner = document.querySelector('img.profile-background-image__image, .profile-background-image img');
      profileData.hasCoverImage = banner && !banner.src.includes('default-background');

      // 6. Connections & Followers
      const connEl = document.querySelector('.t-black--light .t-bold') || document.querySelector('li.text-body-small span.t-bold');
      profileData.connections = connEl ? connEl.textContent.trim() : 'Unknown';

      // Completeness Check
      let score = 0;
      if (profileData.name) score += 10;
      if (profileData.headline) score += 20;
      if (profileData.about) score += 30;
      if (profileData.experience?.length > 0) score += 20;
      if (profileData.hasProfilePicture) score += 20;
      profileData.completenessScore = score;

      console.log('Extraction complete. Status:', {
        name: !!profileData.name,
        headline: !!profileData.headline,
        about: !!profileData.about,
        experience: profileData.experience?.length || 0,
        education: profileData.education?.length || 0,
        skills: profileData.skills?.length || 0,
        hasPic: profileData.hasProfilePicture,
        score: score
      });
      return profileData;

    } catch (error) {
      console.error('Deep extraction failed:', error);
      return { ...profileData, error: error.message };
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_PROFILE') {
      const data = extractProfileData();
      sendResponse({ success: true, data });
    }
    return true;
  });

  // Auto-extract and send profile data when page loads
  window.addEventListener('load', () => {
    setTimeout(() => {
      const data = extractProfileData();
      chrome.runtime.sendMessage({
        type: 'PROFILE_DATA',
        data: data,
        url: window.location.href
      }).catch(() => { });
    }, 3500); // 3.5s for deep load
  });
}

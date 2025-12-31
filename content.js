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
  async function extractProfileData(retryCount = 0) {
    console.log(`Starting deep extraction (attempt ${retryCount + 1})...`);

    const profileData = {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      fromLdJson: false
    };

    try {
      // 1. Initial structured data check
      const ldJsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of ldJsonScripts) {
        try {
          const json = JSON.parse(script.textContent);
          const person = json['@type'] === 'Person' ? json : (json['@graph']?.find(item => item['@type'] === 'Person'));
          if (person) {
            if (person.name) profileData.name = person.name;
            if (person.jobTitle) profileData.headline = person.jobTitle;
            if (person.description && person.description.length > 20) {
              profileData.about = person.description;
              profileData.fromLdJson = true;
            }
          }
        } catch (e) { /* skip */ }
      }

      // 🎯 Strategy 2: Deep DOM Scraping (Fallbacks)

      // 1. Name Focus
      if (!profileData.name) {
        const nameSelectors = ['h1.text-heading-xlarge', 'h1.inline.t-24', 'main h1', '.pv-top-card-section__name', 'title'];
        for (const selector of nameSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            let name = el.textContent.split('|')[0].trim();
            if (name !== 'LinkedIn') { profileData.name = name; break; }
          }
        }
      }

      // 2. Headline Focus
      if (!profileData.headline) {
        const headlineSelectors = ['.text-body-medium.break-words', '.pv-top-card-section__headline', 'main h2', '.mt1 .text-body-medium'];
        for (const selector of headlineSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim()) { profileData.headline = el.textContent.trim(); break; }
        }
      }

      // 3. About Section Focus (and Wait for expansion)
      if (!profileData.about) {
        const aboutSection = document.querySelector('#about')?.closest('section');
        if (aboutSection) {
          const seeMoreBtn = aboutSection.querySelector('button.inline-show-more-text__button');
          if (seeMoreBtn) {
            seeMoreBtn.click();
            // Wait a bit for expansion if it's the first time
            if (retryCount === 0) await new Promise(r => setTimeout(r, 300));
          }
        }

        const aboutSelectors = [
          '#about ~ .display-flex .inline-show-more-text span[aria-hidden="true"]',
          '#about + div + div .inline-show-more-text span[aria-hidden="true"]',
          '.pv-about-section .inline-show-more-text span[aria-hidden="true"]',
          'section.pv-about-section .inline-show-more-text',
          '.pv-shared-text-with-see-more',
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

      // 4. Experience Focus
      const experienceSection = document.querySelector('#experience');
      if (experienceSection) {
        const expContainer = experienceSection.closest('section');
        // Expand internal "See more" buttons within experience
        expContainer.querySelectorAll('button.inline-show-more-text__button').forEach(btn => btn.click());

        const items = expContainer.querySelectorAll('li.artdeco-list__item');
        profileData.experience = Array.from(items).slice(0, 8).map(item => {
          const title = item.querySelector('.display-flex.align-items-center [aria-hidden="true"]')?.textContent || '';
          const company = item.querySelector('.t-14.t-normal [aria-hidden="true"]')?.textContent || '';
          const descClean = item.querySelector('.inline-show-more-text span[aria-hidden="true"]') ||
            item.querySelector('.pvs-list__outer-container span[aria-hidden="true"]') ||
            item.querySelector('.pv-shared-text-with-see-more');
          return {
            title: cleanText(title),
            company: cleanText(company),
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
          return { school: cleanText(school), degree: cleanText(degree) };
        }).filter(edu => edu.school);
      }

      // 6. Skills Focus
      const skillsSection = document.querySelector('#skills');
      if (skillsSection) {
        const skillsContainer = skillsSection.closest('section');
        const skills = skillsContainer.querySelectorAll('div.display-flex.align-items-center span[aria-hidden="true"]');
        profileData.skills = Array.from(skills)
          .map(s => s.textContent.trim())
          .filter(s => s && s.length > 2 && !s.includes('Skill'));
      }

      // 7. Check if we need to retry (e.g., if core data is still missing)
      const isMissingCoreData = !profileData.name || !profileData.headline;
      if (isMissingCoreData && retryCount < 3) {
        console.log('Core data missing, retrying in 1s...');
        await new Promise(r => setTimeout(r, 1000));
        return extractProfileData(retryCount + 1);
      }

      // Final metadata
      const pic = document.querySelector('img.pv-top-card-profile-picture__image, .pv-top-card-profile-picture img');
      profileData.hasProfilePicture = pic && !pic.src.includes('ghost-person');
      const connEl = document.querySelector('.t-black--light .t-bold') || document.querySelector('li.text-body-small span.t-bold');
      profileData.connections = connEl ? connEl.textContent.trim() : 'Unknown';

      return profileData;

    } catch (error) {
      console.error('Extraction failed:', error);
      return { ...profileData, error: error.message };
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_PROFILE') {
      extractProfileData().then(data => {
        sendResponse({ success: true, data });
      });
      return true; // Keep channel open for async response
    }
    return true;
  });

  // Auto-extract and send profile data when page loads
  window.addEventListener('load', () => {
    setTimeout(async () => {
      const data = await extractProfileData();
      chrome.runtime.sendMessage({
        type: 'PROFILE_DATA',
        data: data,
        url: window.location.href
      }).catch(() => { });
    }, 2000); // Start earlier but with retries
  });
}

# Wan Satya - LinkedIn Profile Roaster™ 🍖

Get honest, satirical, and constructive feedback on LinkedIn profiles using AI. This Chrome extension adds a side panel that analyzes the currently viewed LinkedIn profile and delivers a witty roast along with actionable advice.

## ✨ Features

- **Profile Analysis**: Automatically extracts profile details from LinkedIn.
- **AI-Powered Roasts**: Generates satirical yet insightful critiques of LinkedIn profiles.
- **Side Panel Integration**: Seamlessly integrated into Chrome's side panel for easy access.
- **Satirical Tone**: Delivers humor while maintaining professional (mostly) boundaries.
- **Constructive Advice**: includes tips on how to actually improve the profile after the roast.

## 🚀 Installation (Developer Mode)

To install this extension in your Chrome browser using developer mode, follow these steps:

### 1. Clone the Repository
First, clone this repository to your local machine:
```bash
git clone https://github.com/wansatya/linkedin-roast.git
cd linkedin-roast
```

### 2. Open Chrome Extensions
- Open Google Chrome.
- Navigate to the Extensions page by typing `chrome://extensions/` in the address bar and pressing Enter.
- Alternatively, you can click on the three dots (Menu) -> **Extensions** -> **Manage Extensions**.

### 3. Enable Developer Mode
- In the top right corner of the Extensions page, toggle the switch for **Developer mode** to the "On" position.

### 4. Load Unpacked Extension
- Click the **Load unpacked** button that appeared in the top left.
- In the file picker dialog, navigate to and select the `linkedin-roast` folder (the directory containing `manifest.json`).
- Click **Open** or **Select Folder**.

### 5. Verify Installation
- The **Wan Satya - LinkedIn Profile Roaster™** should now appear in your list of extensions.
- Make sure it is enabled (toggle switch is blue).

## 🛠️ How to Use

1. Go to any [LinkedIn](https://www.linkedin.com) profile page.
2. Click on the **Extensions** icon (puzzle piece) in the Chrome toolbar.
3. Find **LinkedIn Profile Roaster** and pin it for easy access.
4. Click the extension icon or open the Side Panel (via the side panel button in Chrome).
5. Let the AI analyze the profile and enjoy the roast!

## ⚙️ Configuration

The extension is pre-configured to work with a hosted backend. If you need to change settings, you can find them in `config.js`:

- `apiUrl`: The endpoint for the AI processing backend.
- `tone`: Adjust the roasting style (satirical, constructive, brutal).

## 🧰 Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript, CSS3
- **Extension API**: Manifest V3, Side Panel API
- **Backend Service**: Supabase & Custom Roaster API

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Created with ❤️ by [Wan Satya](https://github.com/wansatya)

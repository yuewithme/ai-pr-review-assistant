# AI PR Review Assistant Chrome Extension

This is the first browser-extension MVP for AI PR Review Assistant.

## Load Locally

1. Start the backend service locally.
2. Open Chrome or another Chromium browser.
3. Go to `chrome://extensions`.
4. Enable Developer mode.
5. Click "Load unpacked".
6. Select this `extension` directory.

## Usage

1. Open a GitHub Pull Request page.
2. Click the AI PR Review extension icon.
3. Confirm the PR URL is auto-filled.
4. Click "开始分析".
5. The extension opens the generated HTML report in a new tab.

If the current page is not a GitHub PR, paste a PR URL manually.

## Storage

The extension stores only lightweight local metadata in `chrome.storage.local`:

- Recent PR URLs.
- Report title.
- Analysis id.
- Created time.
- Last backend URL.

Full HTML reports are stored only in `chrome.storage.session` for the current browser session. The extension does not store PR diffs, AI prompts, GitHub tokens, or DeepSeek API keys.


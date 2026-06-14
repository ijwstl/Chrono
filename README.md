<img width="150" height="150" alt="icon" src="https://github.com/user-attachments/assets/469378f8-55b1-4ac8-a483-0c92bacfca85" /><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Cat icon">
  <rect x="0" y="0" width="128" height="128" fill="#ffffff"/>
  <path d="M24 47 20 13l29 22a56 56 0 0 1 30 0l29-22-4 34a52 52 0 1 1-80 0Z" fill="#f6bf62"/>
  <path d="M33 39 29 25l13 10" fill="#e87972"/>
  <path d="M95 39 99 25l-13 10" fill="#e87972"/>
  <ellipse cx="45" cy="65" rx="6" ry="8" fill="#111827"/>
  <ellipse cx="83" cy="65" rx="6" ry="8" fill="#111827"/>
  <path d="M64 76 57 70h14l-7 6Z" fill="#111827"/>
  <path d="M64 76v9" stroke="#111827" stroke-width="5" stroke-linecap="round"/>
  <path d="M53 89c6 6 16 6 22 0" fill="none" stroke="#111827" stroke-width="5" stroke-linecap="round"/>
  <path d="M28 76h22M28 88h22M78 76h22M78 88h22" stroke="#111827" stroke-width="5" stroke-linecap="round" opacity="0.72"/>
</svg>

# Chrono

Chrono is a Chrome / Chromium extension for extracting subtitles from the current Bilibili or YouTube video page and optionally generating an AI summary from the transcript.

## Features

- Detects the current Bilibili or YouTube video page.
- Lists available subtitle tracks.
- Extracts the selected subtitle track.
- Previews subtitle segments in the popup.
- Exports transcripts as Markdown, SRT, TXT, or JSON.
- Copies Markdown transcript to the clipboard.
- Generates optional AI summaries through OpenAI-compatible Chat Completions APIs.
- Supports provider presets for OpenAI, DeepSeek, Qwen / Alibaba Cloud Model Studio, MiniMax, and custom compatible endpoints.

## Install Locally

Download the packaged extension from either:

- GitHub Releases: `chrono-extension-v0.2.1.zip`
- Repository artifact: `releases/chrono-extension-v0.2.1.zip`

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Extract the zip file.
5. Select the extracted `extension` directory.
6. Open a supported video page, for example `https://www.bilibili.com/video/BV...` or `https://www.youtube.com/watch?v=...`.
7. Click the Chrono extension icon.

## Usage

1. Click **获取字幕轨道** to load available subtitle tracks.
2. Select a subtitle language.
3. Click **提取字幕**.
4. Use the export actions:
   - **复制 MD**
   - **下载 MD**
   - **SRT**
   - **TXT**
   - **JSON**
5. To use AI summary:
   - Open **AI 总结** settings.
   - Choose a provider.
   - Enter the provider API key.
   - Confirm the model and Base URL.
   - Optionally customize the summary prompt, or restore the default prompt.
   - Save settings.
   - Click **AI 总结字幕** after extracting subtitles.

## AI Provider Notes

Chrono calls OpenAI-compatible `/chat/completions` endpoints from the popup.

Built-in defaults:

| Provider | Default Base URL | Default Model |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-5.5` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` |
| Qwen / Alibaba Cloud Model Studio | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| MiniMax | `https://api.minimax.io/v1` | `MiniMax-M1` |

API keys, model settings, and the custom summary prompt are stored locally in `chrome.storage.local`. Subtitle text is sent to the selected AI provider only when you click **AI 总结字幕**.

## Privacy

- Chrono does not ask you to paste browser cookies.
- Bilibili and YouTube metadata and subtitle-track discovery run in the video page context so the browser can use the active session naturally.
- Subtitle-track discovery and subtitle fetching are handled by platform page scripts, while `content/content.js` only routes popup requests.
- AI requests are optional and only run after the user clicks the summary button.

## Project Structure

```text
extension/
  manifest.json
  content/
    content.js
  injected/
    bilibili-page.js
    youtube-page.js
  icons/
    icon.svg
    icon-16.png
    icon-32.png
    icon-48.png
    icon-128.png
  popup/
    popup.html
    popup.css
    popup.js
```

## Extension Flow

The popup sends platform-specific messages:

- `BCE_GET_BILIBILI_TRACKS`
- `BCE_EXTRACT_BILIBILI_SUBTITLE`
- `BCE_GET_YOUTUBE_TRACKS`
- `BCE_EXTRACT_YOUTUBE_SUBTITLE`

`content/content.js` only routes messages. It detects the active platform, injects the matching page script, normalizes payload platform fields, and forwards the action as `getTracks` or `extractSubtitle`.

Platform-specific popup behavior, including message names, URL detection, video-id parsing, title cleanup, and author labels, is declared in `PLATFORM_CONFIG` instead of inline branching.

Each file in `injected/` owns the platform-specific implementation and returns the same result shape: `platform`, `videoId`, `url`, `title`, `author`, `selectedTrack`, `availableTracks`, `segments`, `text`, and `warnings`.

## Current Scope

Chrono currently focuses on the active Bilibili or YouTube video page. Batch extraction and Obsidian integration are not included yet.

# Chrono

Chrono is a Chrome / Chromium extension for extracting subtitles from the current Bilibili video page and optionally generating an AI summary from the transcript.

## Features

- Detects the current Bilibili video page.
- Lists available subtitle tracks.
- Extracts the selected subtitle track.
- Previews subtitle segments in the popup.
- Exports transcripts as Markdown or JSON.
- Copies Markdown transcript to the clipboard.
- Generates optional AI summaries through OpenAI-compatible Chat Completions APIs.
- Supports provider presets for OpenAI, DeepSeek, Qwen / Alibaba Cloud Model Studio, MiniMax, and custom compatible endpoints.

## Install Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension` directory in this repository.
5. Open a Bilibili video page, for example `https://www.bilibili.com/video/BV...`.
6. Click the Chrono extension icon.

## Usage

1. Click **获取字幕轨道** to load available subtitle tracks.
2. Select a subtitle language.
3. Click **提取字幕**.
4. Use the export actions:
   - **复制 MD**
   - **下载 MD**
   - **JSON**
5. To use AI summary:
   - Open **AI 总结** settings.
   - Choose a provider.
   - Enter the provider API key.
   - Confirm the model and Base URL.
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

API keys and model settings are stored locally in `chrome.storage.local`. Subtitle text is sent to the selected AI provider only when you click **AI 总结字幕**.

## Privacy

- Chrono does not ask you to paste browser cookies.
- Bilibili metadata and subtitle-track discovery run in the video page context so the browser can use the active session naturally.
- Subtitle file fetching runs through the extension context using declared host permissions.
- AI requests are optional and only run after the user clicks the summary button.

## Project Structure

```text
extension/
  manifest.json
  content/
    content.js
  injected/
    bilibili-page.js
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

## Current Scope

Chrono currently focuses on the active Bilibili video page. Batch extraction, YouTube support, and Obsidian integration are not included yet.

const state = {
  tab: null,
  metadata: null,
  tracks: [],
  result: null,
  summary: "",
  aiSettings: {
    provider: "openai",
    apiKey: "",
    model: "gpt-5.5",
    baseUrl: "https://api.openai.com/v1"
  }
};

const AI_PROVIDERS = {
  openai: {
    label: "OpenAI",
    apiKeyLabel: "OpenAI API Key",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.5"
  },
  deepseek: {
    label: "DeepSeek",
    apiKeyLabel: "DeepSeek API Key",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash"
  },
  qwen: {
    label: "Qwen / 阿里云百炼",
    apiKeyLabel: "DashScope API Key",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus"
  },
  minimax: {
    label: "MiniMax",
    apiKeyLabel: "MiniMax API Key",
    baseUrl: "https://api.minimax.io/v1",
    model: "MiniMax-M1"
  },
  custom: {
    label: "自定义兼容接口",
    apiKeyLabel: "API Key",
    baseUrl: "",
    model: ""
  }
};

const BUTTON_ICON_HTML = {
  loadTracksButton: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4 4v-4.5A2.5 2.5 0 0 1 4 13.5v-8Z"/><path d="M8 8h8M8 11.5h5"/></svg>',
  extractButton: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11"/><path d="m7 9 5 5 5-5"/><path d="M5 19h14"/></svg>',
  copyMarkdownButton: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h10v12H8z"/><path d="M6 16H4V4h12v2"/></svg>',
  downloadMarkdownButton: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 20h14"/></svg>',
  downloadJsonButton: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2"/></svg>',
  toggleAiSettingsButton: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19 12a7.2 7.2 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7.2 7.2 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"/></svg>',
  saveAiSettingsButton: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4"/><path d="M8 20v-6h8v6"/></svg>',
  summarizeButton: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.4 4.2L18 8.6l-4.2 1.5L12 15l-1.8-4.9L6 8.6l4.6-1.4L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/></svg>',
  copySummaryButton: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h10v12H8z"/><path d="M6 16H4V4h12v2"/></svg>',
  downloadSummaryButton: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 20h14"/></svg>'
};

const nodes = {
  pageStatus: document.getElementById("pageStatus"),
  videoId: document.getElementById("videoId"),
  videoTitle: document.getElementById("videoTitle"),
  videoAuthor: document.getElementById("videoAuthor"),
  loadTracksButton: document.getElementById("loadTracksButton"),
  trackSelect: document.getElementById("trackSelect"),
  extractButton: document.getElementById("extractButton"),
  resultPanel: document.getElementById("resultPanel"),
  segmentCount: document.getElementById("segmentCount"),
  selectedLanguage: document.getElementById("selectedLanguage"),
  preview: document.getElementById("preview"),
  copyMarkdownButton: document.getElementById("copyMarkdownButton"),
  downloadMarkdownButton: document.getElementById("downloadMarkdownButton"),
  downloadJsonButton: document.getElementById("downloadJsonButton"),
  toggleAiSettingsButton: document.getElementById("toggleAiSettingsButton"),
  aiSettings: document.getElementById("aiSettings"),
  providerSelect: document.getElementById("providerSelect"),
  apiKeyLabel: document.getElementById("apiKeyLabel"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  modelInput: document.getElementById("modelInput"),
  baseUrlInput: document.getElementById("baseUrlInput"),
  saveAiSettingsButton: document.getElementById("saveAiSettingsButton"),
  summarizeButton: document.getElementById("summarizeButton"),
  summaryPreview: document.getElementById("summaryPreview"),
  copySummaryButton: document.getElementById("copySummaryButton"),
  downloadSummaryButton: document.getElementById("downloadSummaryButton"),
  message: document.getElementById("message")
};

init();

async function init() {
  bindEvents();
  await loadAiSettings();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab;

  if (!isBilibiliVideoUrl(tab?.url)) {
    setStatus("不支持", "error");
    nodes.videoTitle.textContent = "请打开 B 站视频页面";
    nodes.videoId.textContent = "-";
    nodes.loadTracksButton.disabled = true;
    setMessage("当前第一版只支持 https://www.bilibili.com/video/BV... 页面。", true);
    return;
  }

  const bvid = parseBvid(tab.url);
  setStatus("可提取", "ok");
  nodes.videoId.textContent = bvid || "-";
  nodes.videoTitle.textContent = tab.title ? cleanTitle(tab.title) : "已检测到 B 站视频";
  setMessage("点击获取字幕轨道。");
}

function bindEvents() {
  nodes.loadTracksButton.addEventListener("click", loadTracks);
  nodes.extractButton.addEventListener("click", extractSubtitle);
  nodes.copyMarkdownButton.addEventListener("click", copyMarkdown);
  nodes.downloadMarkdownButton.addEventListener("click", () => downloadText("md"));
  nodes.downloadJsonButton.addEventListener("click", () => downloadText("json"));
  nodes.toggleAiSettingsButton.addEventListener("click", toggleAiSettings);
  nodes.providerSelect.addEventListener("change", applyProviderPreset);
  nodes.saveAiSettingsButton.addEventListener("click", saveAiSettings);
  nodes.summarizeButton.addEventListener("click", summarizeWithAi);
  nodes.copySummaryButton.addEventListener("click", copySummary);
  nodes.downloadSummaryButton.addEventListener("click", downloadSummary);
}

async function loadTracks() {
  setBusy(nodes.loadTracksButton, true, "获取中");
  setMessage("正在读取当前页面字幕轨道。");
  nodes.resultPanel.hidden = true;

  try {
    const data = await sendToContent("BCE_GET_BILIBILI_TRACKS");
    state.metadata = data;
    state.tracks = data.availableTracks || [];
    state.result = null;
    state.summary = "";
    resetSummary();
    nodes.summarizeButton.disabled = true;

    nodes.videoId.textContent = data.videoId || parseBvid(state.tab.url) || "-";
    nodes.videoTitle.textContent = data.title || "未命名视频";
    nodes.videoAuthor.textContent = data.author ? `UP 主：${data.author}` : "";

    renderTracks();

    if (!state.tracks.length) {
      nodes.extractButton.disabled = true;
      setMessage("当前视频没有暴露字幕轨道。", true);
      return;
    }

    nodes.extractButton.disabled = false;
    setMessage(`找到 ${state.tracks.length} 条字幕轨道。`);
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    setBusy(nodes.loadTracksButton, false, "获取字幕轨道");
  }
}

async function extractSubtitle() {
  const track = state.tracks.find((item) => item.id === nodes.trackSelect.value);
  if (!track) {
    setMessage("请先选择字幕语言。", true);
    return;
  }

  setBusy(nodes.extractButton, true, "提取中");
  setMessage("正在拉取字幕内容。");

  try {
    const data = await sendToContent("BCE_EXTRACT_BILIBILI_SUBTITLE", {
      track,
      metadata: state.metadata,
      availableTracks: state.tracks
    });
    state.result = data;
    state.summary = "";
    renderResult(data);
    resetSummary();
    nodes.summarizeButton.disabled = false;
    setMessage("字幕提取完成。");
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    setBusy(nodes.extractButton, false, "提取字幕");
  }
}

function renderTracks() {
  nodes.trackSelect.innerHTML = "";

  if (!state.tracks.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "没有可用字幕";
    nodes.trackSelect.appendChild(option);
    nodes.trackSelect.disabled = true;
    return;
  }

  for (const track of state.tracks) {
    const option = document.createElement("option");
    option.value = track.id;
    option.textContent = `${track.label || track.language} (${track.language})`;
    nodes.trackSelect.appendChild(option);
  }

  nodes.trackSelect.disabled = false;
}

function renderResult(result) {
  nodes.resultPanel.hidden = false;
  nodes.segmentCount.textContent = String(result.segments.length);
  nodes.selectedLanguage.textContent = result.selectedTrack.label || result.selectedTrack.language;
  nodes.preview.textContent = result.segments.slice(0, 80).map(formatSegment).join("\n");
}

async function loadAiSettings() {
  const stored = await chrome.storage.local.get([
    "aiProvider",
    "aiProviderSettings",
    "openaiApiKey",
    "openaiModel"
  ]);
  const provider = stored.aiProvider || "openai";
  const savedByProvider = stored.aiProviderSettings || {};
  const defaults = AI_PROVIDERS[provider] || AI_PROVIDERS.openai;
  const saved = savedByProvider[provider] || {};

  state.aiSettings.provider = provider;
  state.aiSettings.apiKey = saved.apiKey || (provider === "openai" ? stored.openaiApiKey : "") || "";
  state.aiSettings.model = saved.model || (provider === "openai" ? stored.openaiModel : "") || defaults.model;
  state.aiSettings.baseUrl = saved.baseUrl || defaults.baseUrl;

  nodes.providerSelect.value = provider;
  nodes.apiKeyInput.value = state.aiSettings.apiKey;
  nodes.modelInput.value = state.aiSettings.model;
  nodes.baseUrlInput.value = state.aiSettings.baseUrl;
  renderProviderLabels();
}

async function saveAiSettings() {
  const provider = nodes.providerSelect.value;
  const apiKey = nodes.apiKeyInput.value.trim();
  const defaults = AI_PROVIDERS[provider] || AI_PROVIDERS.custom;
  const model = nodes.modelInput.value.trim() || defaults.model;
  const baseUrl = normalizeBaseUrl(nodes.baseUrlInput.value.trim() || defaults.baseUrl);
  const stored = await chrome.storage.local.get(["aiProviderSettings"]);
  const aiProviderSettings = stored.aiProviderSettings || {};
  aiProviderSettings[provider] = { apiKey, model, baseUrl };

  await chrome.storage.local.set({
    aiProvider: provider,
    aiProviderSettings
  });

  state.aiSettings.provider = provider;
  state.aiSettings.apiKey = apiKey;
  state.aiSettings.model = model;
  state.aiSettings.baseUrl = baseUrl;
  nodes.modelInput.value = model;
  nodes.baseUrlInput.value = baseUrl;
  setMessage(`${AI_PROVIDERS[provider]?.label || "AI"} 设置已保存。`);
}

function toggleAiSettings() {
  const nextHidden = !nodes.aiSettings.hidden;
  nodes.aiSettings.hidden = nextHidden;
  setButtonLabel(nodes.toggleAiSettingsButton, nextHidden ? "设置" : "收起");
}

async function applyProviderPreset() {
  const provider = nodes.providerSelect.value;
  const defaults = AI_PROVIDERS[provider] || AI_PROVIDERS.custom;
  const stored = await chrome.storage.local.get(["aiProviderSettings"]);
  const saved = stored.aiProviderSettings?.[provider] || {};

  nodes.apiKeyInput.value = saved.apiKey || "";
  nodes.modelInput.value = saved.model || defaults.model;
  nodes.baseUrlInput.value = saved.baseUrl || defaults.baseUrl;
  renderProviderLabels();
}

function renderProviderLabels() {
  const provider = nodes.providerSelect.value;
  const defaults = AI_PROVIDERS[provider] || AI_PROVIDERS.custom;
  nodes.apiKeyLabel.textContent = defaults.apiKeyLabel;
  nodes.apiKeyInput.placeholder = provider === "qwen" ? "sk-..." : "sk-...";
}

async function summarizeWithAi() {
  if (!state.result) {
    setMessage("请先提取字幕。", true);
    return;
  }

  if (!state.aiSettings.apiKey) {
    nodes.aiSettings.hidden = false;
    setButtonLabel(nodes.toggleAiSettingsButton, "收起");
    setMessage("请先填写并保存当前供应商的 API Key。", true);
    return;
  }

  setBusy(nodes.summarizeButton, true, "总结中");
  setMessage("正在生成 AI 总结。");

  try {
    const summary = await requestAiSummary(state.result);
    state.summary = summary;
    renderSummary(summary);
    setMessage("AI 总结完成。");
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    setBusy(nodes.summarizeButton, false, "AI 总结字幕");
    nodes.summarizeButton.disabled = !state.result;
  }
}

async function requestAiSummary(result) {
  const transcript = trimTranscriptForAi(result.text);
  const endpoint = buildChatCompletionsUrl(state.aiSettings.baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${state.aiSettings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: state.aiSettings.model,
      messages: [
        {
          role: "system",
          content: [
            "你是一个中文视频内容分析助手。",
            "根据字幕输出结构化总结，不要编造字幕中没有的信息。",
            "输出包含：一句话概括、要点列表、关键术语、适合复习的时间线。"
          ].join("\n")
        },
        {
          role: "user",
          content: [
            `视频标题：${result.title}`,
            `UP 主：${result.author || "未知"}`,
            `字幕语言：${result.selectedTrack.label || result.selectedTrack.language}`,
            "",
            "字幕：",
            transcript
          ].join("\n")
        }
      ],
      stream: false
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `AI API HTTP ${response.status}`;
    throw new Error(message);
  }

  const text = extractChatCompletionText(data);
  if (!text) {
    throw new Error("AI 接口返回了空总结。");
  }

  return text.trim();
}

function extractChatCompletionText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => part.text || part.content || "")
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function buildChatCompletionsUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) throw new Error("请先配置 Base URL。");
  if (/\/chat\/completions$/i.test(normalized)) return normalized;
  return `${normalized}/chat/completions`;
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function trimTranscriptForAi(text) {
  const maxChars = 28000;
  const normalized = String(text || "").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}\n\n[字幕过长，已截取前 ${maxChars} 个字符用于总结]`;
}

function renderSummary(summary) {
  nodes.summaryPreview.hidden = false;
  nodes.summaryPreview.textContent = summary;
  nodes.copySummaryButton.disabled = false;
  nodes.downloadSummaryButton.disabled = false;
}

function resetSummary() {
  nodes.summaryPreview.hidden = true;
  nodes.summaryPreview.textContent = "";
  nodes.copySummaryButton.disabled = true;
  nodes.downloadSummaryButton.disabled = true;
}

async function copySummary() {
  if (!state.summary) return;
  await navigator.clipboard.writeText(state.summary);
  showButtonFeedback(nodes.copySummaryButton, "已复制", "复制总结");
  setMessage("AI 总结已复制。");
}

function downloadSummary() {
  if (!state.summary || !state.result) return;
  const filename = `${safeFilename(`${state.result.title || state.result.videoId}-summary`)}.md`;
  const text = [`# ${state.result.title}`, "", "## AI Summary", "", state.summary, ""].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));

  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function sendToContent(type, payload = {}) {
  return sendMessageToTab(type, payload).catch(async (error) => {
    if (!/Receiving end does not exist|Could not establish connection/i.test(error.message)) {
      throw error;
    }

    await chrome.scripting.executeScript({
      target: { tabId: state.tab.id },
      files: ["content/content.js"]
    });

    return sendMessageToTab(type, payload);
  });
}

function sendMessageToTab(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(state.tab.id, { type, payload }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || "Could not connect to the content script."));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Request failed."));
        return;
      }

      resolve(response.data);
    });
  });
}

function buildMarkdown(result) {
  const lines = [
    "---",
    "platform: bilibili",
    `video_id: ${escapeYaml(result.videoId)}`,
    `source: ${escapeYaml(result.url)}`,
    `subtitle_language: ${escapeYaml(result.selectedTrack.language)}`,
    "---",
    "",
    `# ${result.title}`,
    "",
    "## Transcript",
    ""
  ];

  for (const segment of result.segments) {
    lines.push(`[${formatTime(segment.startSeconds)}] ${segment.text}`);
  }

  return `${lines.join("\n")}\n`;
}

async function copyMarkdown() {
  if (!state.result) return;

  await navigator.clipboard.writeText(buildMarkdown(state.result));
  showButtonFeedback(nodes.copyMarkdownButton, "已复制", "复制 MD");
  setMessage("Markdown 已复制。");
}

function downloadText(type) {
  if (!state.result) return;

  const text = type === "json" ? JSON.stringify(state.result, null, 2) : buildMarkdown(state.result);
  const extension = type === "json" ? "json" : "md";
  const mime = type === "json" ? "application/json" : "text/markdown";
  const filename = `${safeFilename(state.result.title || state.result.videoId)}.${extension}`;
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));

  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  setButtonLabel(button, label);
}

function setButtonLabel(button, label) {
  const labelNode = button.querySelector(".button-label");
  if (labelNode) {
    labelNode.textContent = label;
    return;
  }

  button.innerHTML = `${BUTTON_ICON_HTML[button.id] || ""}<span class="button-label"></span>`;
  button.querySelector(".button-label").textContent = label;
}

function showButtonFeedback(button, feedbackLabel, restoreLabel) {
  setButtonLabel(button, feedbackLabel);
  button.classList.add("copied");
  window.setTimeout(() => {
    button.classList.remove("copied");
    setButtonLabel(button, restoreLabel);
  }, 1300);
}

function setStatus(text, variant) {
  nodes.pageStatus.textContent = text;
  nodes.pageStatus.classList.remove("ok", "error");
  if (variant) nodes.pageStatus.classList.add(variant);
}

function setMessage(text, isError = false) {
  nodes.message.textContent = text;
  nodes.message.classList.toggle("error", isError);
}

function isBilibiliVideoUrl(url) {
  return /^https:\/\/www\.bilibili\.com\/video\/BV/i.test(url || "");
}

function parseBvid(url) {
  return (url || "").match(/\/video\/(BV[a-zA-Z0-9]+)/i)?.[1] || "";
}

function cleanTitle(title) {
  return title.replace(/_哔哩哔哩_bilibili$/, "").trim();
}

function formatSegment(segment) {
  return `[${formatTime(segment.startSeconds)}] ${segment.text}`;
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  if (hh > 0) {
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  }
  return `${pad(mm)}:${pad(ss)}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeYaml(value) {
  return JSON.stringify(String(value || ""));
}

function safeFilename(value) {
  return String(value || "bilibili-subtitle")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "bilibili-subtitle";
}

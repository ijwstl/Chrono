(() => {
if (window.__BCE_CONTENT_SCRIPT_LOADED__) {
  return;
}
window.__BCE_CONTENT_SCRIPT_LOADED__ = true;

const EXTENSION_SOURCE = "browser-caption-extension";
const PAGE_SOURCE = "browser-caption-extension-page";

let pageScriptInjected = false;
let pageScriptReady = null;
const pendingRequests = new Map();

const PLATFORM_CONFIG = {
  bilibili: {
    pageScript: "injected/bilibili-page.js",
    isPage: () => window.location.hostname === "www.bilibili.com"
  },
  youtube: {
    pageScript: "injected/youtube-page.js",
    isPage: () => window.location.hostname === "www.youtube.com" || window.location.hostname === "m.youtube.com"
  }
};

const MESSAGE_ROUTES = {
  BCE_GET_BILIBILI_TRACKS: { platform: "bilibili", action: "getTracks" },
  BCE_EXTRACT_BILIBILI_SUBTITLE: { platform: "bilibili", action: "extractSubtitle" },
  BCE_GET_YOUTUBE_TRACKS: { platform: "youtube", action: "getTracks" },
  BCE_EXTRACT_YOUTUBE_SUBTITLE: { platform: "youtube", action: "extractSubtitle" },
  BCE_GET_TRACKS: { platform: null, action: "getTracks" },
  BCE_EXTRACT_SUBTITLE: { platform: null, action: "extractSubtitle" }
};

primePageScript();

function injectPageScript() {
  const platform = getCurrentPlatform();
  const file = PLATFORM_CONFIG[platform]?.pageScript;
  if (!file) throw new Error("Current page is not supported.");

  const scriptId = `bce-${platform}-page-script`;
  if (pageScriptInjected || document.getElementById(scriptId)) {
    pageScriptInjected = true;
    return pageScriptReady || Promise.resolve();
  }

  pageScriptReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = chrome.runtime.getURL(file);
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => {
      pageScriptInjected = false;
      pageScriptReady = null;
      script.remove();
      reject(new Error("Failed to inject the page extractor."));
    };
    appendPageScript(script);
  });
  pageScriptInjected = true;
  return pageScriptReady;
}

function appendPageScript(script) {
  const target = document.documentElement || document.head || document.body;
  if (target) {
    target.appendChild(script);
    return;
  }

  document.addEventListener("DOMContentLoaded", () => appendPageScript(script), { once: true });
}

function primePageScript() {
  if (!getCurrentPlatform()) return;
  injectPageScript().catch(() => {});
}

async function sendToPage(action, payload = {}) {
  await injectPageScript();
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.postMessage(
    {
      source: EXTENSION_SOURCE,
      requestId,
      action,
      payload
    },
    window.location.origin
  );

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("Timed out while waiting for the page extractor."));
    }, 30000);

    pendingRequests.set(requestId, { resolve, reject, timeoutId });
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const message = event.data;
  if (!message || message.source !== PAGE_SOURCE || !message.requestId) return;

  const pending = pendingRequests.get(message.requestId);
  if (!pending) return;

  window.clearTimeout(pending.timeoutId);
  pendingRequests.delete(message.requestId);

  if (message.ok) {
    pending.resolve(message.data);
  } else {
    pending.reject(new Error(message.error || "Subtitle extraction failed."));
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;

  const route = MESSAGE_ROUTES[message.type];
  if (!route) return false;

  const currentPlatform = getCurrentPlatform();
  if (route.platform && route.platform !== currentPlatform) {
    sendResponse({
      ok: false,
      error: `Message ${message.type} cannot run on ${currentPlatform || "unsupported"} page.`
    });
    return false;
  }

  const request = sendToPage(route.action, normalizePayload(message.payload || {}, currentPlatform));

  request
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

function normalizePayload(payload, platform) {
  return {
    ...payload,
    platform,
    metadata: payload.metadata ? { ...payload.metadata, platform: payload.metadata.platform || platform } : payload.metadata,
    track: payload.track ? { ...payload.track, platform: payload.track.platform || platform } : payload.track,
    availableTracks: Array.isArray(payload.availableTracks)
      ? payload.availableTracks.map((track) => ({ ...track, platform: track.platform || platform }))
      : payload.availableTracks
  };
}

function getCurrentPlatform() {
  for (const [platform, config] of Object.entries(PLATFORM_CONFIG)) {
    if (config.isPage()) return platform;
  }
  return "";
}

})();

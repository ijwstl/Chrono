(() => {
  const EXTENSION_SOURCE = "browser-caption-extension";
  const PAGE_SOURCE = "browser-caption-extension-page";

  const MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32,
    15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19,
    29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61,
    26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63,
    57, 62, 11, 36, 20, 34, 44, 52
  ];

  function parseBilibiliVideoId(input = location.href) {
    const url = new URL(input, location.href);
    const match = url.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/i);
    if (!match) throw new Error("Could not parse BV id from the current page.");
    return match[1];
  }

  async function fetchJson(url, init = {}) {
    const { credentials = "include", ...fetchInit } = init;
    const response = await fetch(url, {
      credentials,
      referrer: location.href,
      ...fetchInit,
      headers: {
        ...(fetchInit.headers || {})
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
    }

    const text = await response.text();
    if (!text.trim()) throw new Error(`Empty response for ${url}`);
    return JSON.parse(text);
  }

  async function loadVideoMetadata() {
    const bilibiliVideoId = parseBilibiliVideoId();
    const video = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bilibiliVideoId)}`);

    if (video.code !== 0 || !video.data) {
      throw new Error(`Failed to load video metadata: ${video.message || "unknown error"}`);
    }

    const aid = video.data.aid;
    const cid = video.data.cid;
    if (!aid || !cid) throw new Error("Bilibili metadata did not include aid/cid.");

    return {
      platform: "bilibili",
      videoId: bilibiliVideoId,
      url: location.href,
      aid,
      cid,
      title: video.data.title || document.title.replace(/_哔哩哔哩_bilibili$/, ""),
      author: video.data.owner?.name,
      durationSeconds: video.data.duration
    };
  }

  async function fetchWbiKeys() {
    const nav = await fetchJson("https://api.bilibili.com/x/web-interface/nav");
    const imgUrl = nav.data?.wbi_img?.img_url;
    const subUrl = nav.data?.wbi_img?.sub_url;
    if (!imgUrl || !subUrl) throw new Error("Could not get WBI image keys from /x/web-interface/nav.");

    return {
      imgKey: extractKeyFromUrl(imgUrl),
      subKey: extractKeyFromUrl(subUrl)
    };
  }

  function extractKeyFromUrl(url) {
    const pathname = new URL(url).pathname;
    const filename = pathname.slice(pathname.lastIndexOf("/") + 1);
    return filename.slice(0, filename.indexOf("."));
  }

  function getMixinKey(original) {
    return MIXIN_KEY_ENC_TAB.map((index) => original[index]).join("").slice(0, 32);
  }

  function buildPlayerParams(metadata) {
    return {
      aid: metadata.aid,
      cid: metadata.cid,
      isGaiaAvoided: "false",
      web_location: 1315873,
      dm_img_list: "[]",
      dm_img_str: "V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ",
      dm_cover_img_str: "QU5HTEUgKEFwcGxlLCBBTkdMRSBNZXRhbCBSZW5kZXJlcjogQXBwbGUgTTMgTWF4LCBVbnNwZWNpZmllZCBWZXJzaW9uKUdvb2dsZSBJbmMuIChBcHBsZS",
      dm_img_inter: JSON.stringify({ ds: [], wh: [3906, 5767, 64], of: [174, 348, 174] })
    };
  }

  function signWbiParams(params, keys, nowSeconds = Math.floor(Date.now() / 1000)) {
    const mixinKey = getMixinKey(`${keys.imgKey}${keys.subKey}`);
    const cleanParams = { ...params, wts: nowSeconds };
    const query = Object.keys(cleanParams)
      .sort()
      .map((key) => {
        const value = String(cleanParams[key]).replace(/[!'()*]/g, "");
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join("&");

    return `${query}&w_rid=${md5(`${query}${mixinKey}`)}`;
  }

  async function loadPlayerData(metadata) {
    const keys = await fetchWbiKeys();
    const signedQuery = signWbiParams(buildPlayerParams(metadata), keys);
    const player = await fetchJson(`https://api.bilibili.com/x/player/wbi/v2?${signedQuery}`);

    if (player.code !== 0 || !player.data) {
      throw new Error(`Failed to load player data: ${player.message || "unknown error"}`);
    }

    return player.data;
  }

  function normalizeSubtitleUrl(url) {
    if (!url) return undefined;
    if (url.startsWith("//")) return `https:${url}`;
    return url;
  }

  function normalizeTrack(track) {
    const language = track.lan || "unknown";
    const label = track.lan_doc || language;
    return {
      id: String(track.id || `${language}-${label}`),
      platform: "bilibili",
      language,
      label,
      source: /auto|自动/i.test(label) ? "auto" : "unknown",
      url: normalizeSubtitleUrl(track.subtitle_url)
    };
  }

  async function getTracks() {
    const metadata = await loadVideoMetadata();
    const player = await loadPlayerData(metadata);
    const rawTracks = player.subtitle?.subtitles || [];
    const availableTracks = rawTracks.map(normalizeTrack);

    return {
      ...metadata,
      availableTracks,
      warnings: availableTracks.length ? [] : ["Current video did not expose subtitle tracks."]
    };
  }

  async function extractSubtitle(payload) {
    const track = payload?.track;
    if (!track?.url) throw new Error("No subtitle track URL was provided.");

    const subtitleUrl = normalizeSubtitleUrl(track.url);
    const subtitle = await fetchJson(subtitleUrl, { credentials: "omit" });
    const selectedTrack = {
      ...track,
      url: subtitleUrl
    };
    const segments = (subtitle.body || [])
      .map((item) => ({
        startSeconds: Number(item.from),
        durationSeconds: typeof item.from === "number" && typeof item.to === "number" ? item.to - item.from : undefined,
        text: String(item.content || "").replace(/\s+/g, " ").trim()
      }))
      .filter((item) => Number.isFinite(item.startSeconds) && item.text.length > 0);

    if (!segments.length) {
      throw new Error("Subtitle file was fetched, but it had no readable text segments.");
    }

    const metadata = payload.metadata || await loadVideoMetadata();
    const text = segments.map((segment) => segment.text).join("\n");

    return {
      platform: "bilibili",
      videoId: metadata.videoId || parseBilibiliVideoId(),
      url: metadata.url || location.href,
      title: metadata.title || document.title,
      author: metadata.author,
      selectedTrack,
      availableTracks: payload.availableTracks || [track],
      segments,
      text,
      warnings: []
    };
  }

  function postResult(requestId, ok, data, error) {
    window.postMessage(
      {
        source: PAGE_SOURCE,
        requestId,
        ok,
        data,
        error
      },
      window.location.origin
    );
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== EXTENSION_SOURCE || !message.requestId) return;

    try {
      if (message.action === "getTracks") {
        postResult(message.requestId, true, await getTracks());
        return;
      }

      if (message.action === "extractSubtitle") {
        postResult(message.requestId, true, await extractSubtitle(message.payload));
        return;
      }

      throw new Error(`Unsupported page action: ${message.action}`);
    } catch (error) {
      postResult(message.requestId, false, null, error instanceof Error ? error.message : String(error));
    }
  });

  function md5(input) {
    function rotateLeft(value, shift) {
      return (value << shift) | (value >>> (32 - shift));
    }
    function addUnsigned(x, y) {
      const x4 = x & 0x40000000;
      const y4 = y & 0x40000000;
      const x8 = x & 0x80000000;
      const y8 = y & 0x80000000;
      const result = (x & 0x3fffffff) + (y & 0x3fffffff);
      if (x4 & y4) return result ^ 0x80000000 ^ x8 ^ y8;
      if (x4 | y4) return result & 0x40000000 ? result ^ 0xc0000000 ^ x8 ^ y8 : result ^ 0x40000000 ^ x8 ^ y8;
      return result ^ x8 ^ y8;
    }
    function f(x, y, z) { return (x & y) | (~x & z); }
    function g(x, y, z) { return (x & z) | (y & ~z); }
    function h(x, y, z) { return x ^ y ^ z; }
    function i(x, y, z) { return y ^ (x | ~z); }
    function round(func, a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(func(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function utf8Encode(value) {
      return unescape(encodeURIComponent(value));
    }
    function wordArray(value) {
      const length = value.length;
      const wordCount = (((length + 8) - ((length + 8) % 64)) / 64 + 1) * 16;
      const words = new Array(wordCount).fill(0);
      let bytePosition = 0;
      for (let i = 0; i < length; i += 1) {
        const wordPosition = (i - (i % 4)) / 4;
        bytePosition = (i % 4) * 8;
        words[wordPosition] = words[wordPosition] | (value.charCodeAt(i) << bytePosition);
      }
      const wordPosition = (length - (length % 4)) / 4;
      bytePosition = (length % 4) * 8;
      words[wordPosition] = words[wordPosition] | (0x80 << bytePosition);
      words[wordCount - 2] = length << 3;
      words[wordCount - 1] = length >>> 29;
      return words;
    }
    function hex(value) {
      let output = "";
      for (let i = 0; i <= 3; i += 1) {
        output += (`0${((value >>> (i * 8)) & 255).toString(16)}`).slice(-2);
      }
      return output;
    }

    const x = wordArray(utf8Encode(input));
    let a = 0x67452301;
    let b = 0xefcdab89;
    let c = 0x98badcfe;
    let d = 0x10325476;

    for (let k = 0; k < x.length; k += 16) {
      const aa = a;
      const bb = b;
      const cc = c;
      const dd = d;

      a = round(f, a, b, c, d, x[k + 0], 7, 0xd76aa478);
      d = round(f, d, a, b, c, x[k + 1], 12, 0xe8c7b756);
      c = round(f, c, d, a, b, x[k + 2], 17, 0x242070db);
      b = round(f, b, c, d, a, x[k + 3], 22, 0xc1bdceee);
      a = round(f, a, b, c, d, x[k + 4], 7, 0xf57c0faf);
      d = round(f, d, a, b, c, x[k + 5], 12, 0x4787c62a);
      c = round(f, c, d, a, b, x[k + 6], 17, 0xa8304613);
      b = round(f, b, c, d, a, x[k + 7], 22, 0xfd469501);
      a = round(f, a, b, c, d, x[k + 8], 7, 0x698098d8);
      d = round(f, d, a, b, c, x[k + 9], 12, 0x8b44f7af);
      c = round(f, c, d, a, b, x[k + 10], 17, 0xffff5bb1);
      b = round(f, b, c, d, a, x[k + 11], 22, 0x895cd7be);
      a = round(f, a, b, c, d, x[k + 12], 7, 0x6b901122);
      d = round(f, d, a, b, c, x[k + 13], 12, 0xfd987193);
      c = round(f, c, d, a, b, x[k + 14], 17, 0xa679438e);
      b = round(f, b, c, d, a, x[k + 15], 22, 0x49b40821);

      a = round(g, a, b, c, d, x[k + 1], 5, 0xf61e2562);
      d = round(g, d, a, b, c, x[k + 6], 9, 0xc040b340);
      c = round(g, c, d, a, b, x[k + 11], 14, 0x265e5a51);
      b = round(g, b, c, d, a, x[k + 0], 20, 0xe9b6c7aa);
      a = round(g, a, b, c, d, x[k + 5], 5, 0xd62f105d);
      d = round(g, d, a, b, c, x[k + 10], 9, 0x02441453);
      c = round(g, c, d, a, b, x[k + 15], 14, 0xd8a1e681);
      b = round(g, b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
      a = round(g, a, b, c, d, x[k + 9], 5, 0x21e1cde6);
      d = round(g, d, a, b, c, x[k + 14], 9, 0xc33707d6);
      c = round(g, c, d, a, b, x[k + 3], 14, 0xf4d50d87);
      b = round(g, b, c, d, a, x[k + 8], 20, 0x455a14ed);
      a = round(g, a, b, c, d, x[k + 13], 5, 0xa9e3e905);
      d = round(g, d, a, b, c, x[k + 2], 9, 0xfcefa3f8);
      c = round(g, c, d, a, b, x[k + 7], 14, 0x676f02d9);
      b = round(g, b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);

      a = round(h, a, b, c, d, x[k + 5], 4, 0xfffa3942);
      d = round(h, d, a, b, c, x[k + 8], 11, 0x8771f681);
      c = round(h, c, d, a, b, x[k + 11], 16, 0x6d9d6122);
      b = round(h, b, c, d, a, x[k + 14], 23, 0xfde5380c);
      a = round(h, a, b, c, d, x[k + 1], 4, 0xa4beea44);
      d = round(h, d, a, b, c, x[k + 4], 11, 0x4bdecfa9);
      c = round(h, c, d, a, b, x[k + 7], 16, 0xf6bb4b60);
      b = round(h, b, c, d, a, x[k + 10], 23, 0xbebfbc70);
      a = round(h, a, b, c, d, x[k + 13], 4, 0x289b7ec6);
      d = round(h, d, a, b, c, x[k + 0], 11, 0xeaa127fa);
      c = round(h, c, d, a, b, x[k + 3], 16, 0xd4ef3085);
      b = round(h, b, c, d, a, x[k + 6], 23, 0x04881d05);
      a = round(h, a, b, c, d, x[k + 9], 4, 0xd9d4d039);
      d = round(h, d, a, b, c, x[k + 12], 11, 0xe6db99e5);
      c = round(h, c, d, a, b, x[k + 15], 16, 0x1fa27cf8);
      b = round(h, b, c, d, a, x[k + 2], 23, 0xc4ac5665);

      a = round(i, a, b, c, d, x[k + 0], 6, 0xf4292244);
      d = round(i, d, a, b, c, x[k + 7], 10, 0x432aff97);
      c = round(i, c, d, a, b, x[k + 14], 15, 0xab9423a7);
      b = round(i, b, c, d, a, x[k + 5], 21, 0xfc93a039);
      a = round(i, a, b, c, d, x[k + 12], 6, 0x655b59c3);
      d = round(i, d, a, b, c, x[k + 3], 10, 0x8f0ccc92);
      c = round(i, c, d, a, b, x[k + 10], 15, 0xffeff47d);
      b = round(i, b, c, d, a, x[k + 1], 21, 0x85845dd1);
      a = round(i, a, b, c, d, x[k + 8], 6, 0x6fa87e4f);
      d = round(i, d, a, b, c, x[k + 15], 10, 0xfe2ce6e0);
      c = round(i, c, d, a, b, x[k + 6], 15, 0xa3014314);
      b = round(i, b, c, d, a, x[k + 13], 21, 0x4e0811a1);
      a = round(i, a, b, c, d, x[k + 4], 6, 0xf7537e82);
      d = round(i, d, a, b, c, x[k + 11], 10, 0xbd3af235);
      c = round(i, c, d, a, b, x[k + 2], 15, 0x2ad7d2bb);
      b = round(i, b, c, d, a, x[k + 9], 21, 0xeb86d391);

      a = addUnsigned(a, aa);
      b = addUnsigned(b, bb);
      c = addUnsigned(c, cc);
      d = addUnsigned(d, dd);
    }

    return `${hex(a)}${hex(b)}${hex(c)}${hex(d)}`.toLowerCase();
  }
})();

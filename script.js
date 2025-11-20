const pdfInput = document.getElementById("pdfInput");
const uploadBtn = document.getElementById("uploadBtn");
const loader = document.getElementById("loader");
const resultEl = document.getElementById("result");
const chatEl = document.getElementById("chat");
const sendBtn = document.getElementById("send");
const textInput = document.getElementById("text");
const outEl = document.getElementById("out");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function fetchWithTimeout(url, options = {}, timeout = 120000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  options.signal = controller.signal;
  try {
    const res = await fetch(url, options);
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

uploadBtn.addEventListener("click", () => uploadFile());

async function uploadFile(retries = 2) {
  if (!pdfInput.files.length) {
    resultEl.textContent = "Please select a PDF file first.";
    return;
  }

  const file = pdfInput.files[0];
  const formData = new FormData();
  formData.append("data", file);

  loader.style.display = "block";
  resultEl.style.display = "none";
  chatEl.style.display = "none";
  resultEl.textContent = "";

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await fetchWithTimeout(
        "https://agent-beta.endare.com/webhook/NN-demo",
        { method: "POST", body: formData },
        120000
      );

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      let id = await extractId(response);
      if (!Number.isFinite(id)) {
        loader.style.display = "none";
        resultEl.style.display = "block";
        resultEl.textContent =
          "Upload succeeded but could not extract a numeric ID.";
        return;
      }

      resultEl.style.display = "block";
      resultEl.innerHTML = `Upload successful. Generating summary now...`;
      await sleep(60000);

      await pollForSummary(id);
      return;
    } catch (error) {
      console.warn(`Upload attempt ${attempt} failed: ${error.message}`);
      if (attempt > retries) {
        loader.style.display = "none";
        resultEl.style.display = "block";
        resultEl.textContent = `Error: ${error.message || "Upload failed"}`;
        return;
      }
      await sleep(1000);
    }
  }
}

async function extractId(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await response.clone().json();
    if (typeof json === "number") return json;
    if (typeof json === "string" && !isNaN(Number(json))) return Number(json);
    if (json && (json.id || json.ID || json.Id))
      return Number(json.id ?? json.ID ?? json.Id);
    if (json && json.output && !isNaN(Number(json.output)))
      return Number(json.output);
    const m = JSON.stringify(json).match(/(\d+)/);
    if (m) return Number(m[1]);
  } else {
    const text = await response.text();
    if (!isNaN(Number(text.trim()))) return Number(text.trim());
    const m = text.match(/(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

async function pollForSummary(id) {
  const maxAttempts = 10;
  const pollIntervalMs = 10000;
  const url = `https://agent-beta.endare.com/webhook/get-summary?id=${encodeURIComponent(
    id
  )}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      resultEl.innerHTML = `Fetching summary now...`;
      const res = await fetchWithTimeout(url, { method: "GET" }, 30000);

      if (!res.ok) throw new Error(`Summary endpoint returned ${res.status}`);

      let content = null;
      const ct = res.headers.get("content-type") || "";

      if (ct.includes("application/json")) {
        const json = await res.json();
        content = json.output || json.summary || JSON.stringify(json, null, 2);
      } else {
        content = await res.text();
      }

      if (!content || content.trim() === "" || content.trim() === "null") {
        throw new Error("Empty / not-ready response");
      }

      if (typeof content === "string") {
        const trimmed = content.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          const parsed = JSON.parse(content);
          content =
            parsed.output || parsed.summary || JSON.stringify(parsed, null, 2);
        }
        resultEl.innerHTML =
          trimmed.startsWith("{") || trimmed.startsWith("[")
            ? `<pre>${escapeHtml(content)}</pre>`
            : marked.parse(content);
      } else {
        resultEl.innerHTML = escapeHtml(String(content));
      }

      loader.style.display = "none";
      resultEl.style.display = "block";
      chatEl.style.display = "block";

      return;
    } catch (err) {
      console.warn(`Summary attempt ${attempt} failed: ${err.message}`);
      if (attempt === maxAttempts) {
        loader.style.display = "none";
        resultEl.style.display = "block";
        resultEl.textContent =
          "Could not fetch summary after multiple attempts.";
        return;
      }
      await sleep(pollIntervalMs);
    }
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Chat send
sendBtn.addEventListener("click", async () => {
  const text = textInput.value || "";
  const fd = new FormData();
  fd.append("chatInput", text);
  fd.append("messages[0][role]", "user");
  fd.append("messages[0][content]", text);

  try {
    const res = await fetch(
      "https://agent-beta.endare.com/webhook/f5ed7916-342d-4de2-ac40-4d24d1e2e471/chat",
      {
        method: "POST",
        body: fd,
      }
    );
    const json = await res.json().catch(() => null);
    outEl.innerText = json
      ? JSON.stringify(json.output, null, 2)
      : "No JSON returned";
  } catch (err) {
    outEl.innerText = "Error: " + err;
  }
});

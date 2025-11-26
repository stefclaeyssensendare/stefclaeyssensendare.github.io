"use client";

import React, { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useLanguage } from "@/contexts/LanguageContext";

/** small helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 120000,
  externalSignal?: AbortSignal | null
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

  let onExternalAbort: (() => void) | null = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      timeoutController.abort();
    } else {
      onExternalAbort = () => {
        timeoutController.abort();
      };
      externalSignal.addEventListener("abort", onExternalAbort);
    }
  }

  const opts: RequestInit = { ...options, signal: timeoutController.signal };

  try {
    const res = await fetch(url, opts);
    clearTimeout(timeoutId);
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (
      (err as any)?.name === "AbortError" &&
      timeoutController.signal.aborted
    ) {
      if (externalSignal && externalSignal.aborted) {
        throw new Error("Request aborted by external signal");
      }
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    if (externalSignal && onExternalAbort)
      externalSignal.removeEventListener("abort", onExternalAbort);
  }
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Try to deeply unwrap JSON if the value is a string containing JSON,
 * and return the primitive/object found. Also handles quoted JSON strings.
 */
function deeplyUnwrapPossibleJson(value: any, maxDepth = 3): any {
  let cur = value;
  for (let i = 0; i < maxDepth; i++) {
    if (typeof cur === "string") {
      const trimmed = cur.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          cur = JSON.parse(trimmed);
          continue;
        } catch {
          return cur;
        }
      }
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        try {
          const normal = trimmed.startsWith("'")
            ? '"' +
              trimmed.slice(1, -1).replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
              '"'
            : trimmed;
          const parsed = JSON.parse(normal);
          cur = parsed;
          continue;
        } catch {
          return cur;
        }
      }
      return cur;
    } else {
      return cur;
    }
  }
  return cur;
}

export default function UploadForm() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultHtml, setResultHtml] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  // helper to broadcast id changes inside the same window
  const broadcastSavedId = (id: number | null) => {
    try {
      window.dispatchEvent(
        new CustomEvent("nn_summary_id_changed", { detail: id })
      );
    } catch (err) {
      console.warn("broadcastSavedId error", err);
    }
  };

  const isMountedRef = useRef(true);
  useEffect(() => {
    // Clear any saved execution ID on page load
    try {
      localStorage.removeItem("nn_summary_id");
      localStorage.removeItem("nn_summary_created_at");
    } catch {}

    isMountedRef.current = true;
    // on mount: restore saved id from localStorage (if present)
    try {
      const maybe = localStorage.getItem("nn_summary_id");
      if (maybe && !isNaN(Number(maybe))) {
        const num = Number(maybe);
        setSavedId(num);
        // broadcast initial value so other components sync
        broadcastSavedId(num);
      }
    } catch (err) {
      console.warn("Could not read localStorage", err);
    }
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { language } = useLanguage();

  const buttonText =
    language === "FR"
      ? "Télécharger le bilan/les comptes annuels"
      : "Upload Balans/Jaarrekening";

  const masterControllerRef = useRef<AbortController | null>(null);

  async function extractId(response: Response) {
    const contentType = response.headers.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        const json = await response.clone().json();
        if (typeof json === "number") return json;
        if (typeof json === "string" && !isNaN(Number(json)))
          return Number(json);
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
    } catch (err) {
      console.warn("extractId error", err);
    }
    return null;
  }

  async function renderResponseContent(raw: any): Promise<string> {
    const unwrapped = deeplyUnwrapPossibleJson(raw, 4);

    // Always returns Promise<string>
    async function ensureString(maybe: any): Promise<string> {
      if (typeof maybe === "string") return maybe;

      if (maybe && typeof maybe.then === "function") {
        try {
          const resolved = await maybe;
          if (typeof resolved === "string") return resolved;
          return JSON.stringify(resolved, null, 2);
        } catch (err) {
          console.warn("ensureString: failed to await promise", err);
          return "";
        }
      }

      try {
        return JSON.stringify(maybe, null, 2);
      } catch {
        return String(maybe ?? "");
      }
    }

    // object (not array) -> try to extract candidate
    if (
      unwrapped &&
      typeof unwrapped === "object" &&
      !Array.isArray(unwrapped)
    ) {
      const candidateRaw: any =
        typeof unwrapped.summary === "string"
          ? deeplyUnwrapPossibleJson(unwrapped.summary, 3)
          : typeof unwrapped.output === "string"
          ? deeplyUnwrapPossibleJson(unwrapped.output, 3)
          : unwrapped.summary ?? unwrapped.output ?? unwrapped;

      // candidateContent is now definitely a string
      const candidateContent: string = await ensureString(candidateRaw);
      const trimmed = candidateContent.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return `<pre>${escapeHtml(candidateContent)}</pre>`;
      }

      // *** IMPORTANT: await marked.parse because its type may be string | Promise<string> ***
      const parsedCandidate = await marked.parse(candidateContent);
      // Ensure a plain string (coerce just in case)
      const candidateHtml: string = String(parsedCandidate);

      return DOMPurify.sanitize(candidateHtml);
    }

    // Top-level handling
    const topContent: string = await ensureString(unwrapped);
    const topTrim = topContent.trim();
    if (topTrim.startsWith("{") || topTrim.startsWith("[")) {
      return `<pre>${escapeHtml(topContent)}</pre>`;
    }

    const parsedTop = await marked.parse(topContent);
    const topHtml: string = String(parsedTop);
    return DOMPurify.sanitize(topHtml);
  }

  async function pollForSummary(id: number): Promise<boolean> {
    const maxAttempts = 30;
    const pollIntervalMs = 10000;
    const url = `https://agent-beta.endare.com/webhook/get-summary?id=${encodeURIComponent(
      id
    )}`;

    if (masterControllerRef.current) masterControllerRef.current.abort();
    masterControllerRef.current = new AbortController();
    const masterSignal = masterControllerRef.current.signal;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!isMountedRef.current) return false;

      try {
        const res = await fetchWithTimeout(
          url,
          { method: "GET" },
          30000,
          masterSignal
        );

        if (!res.ok) {
          if ([404, 202, 425].includes(res.status)) {
            if (attempt === maxAttempts) {
              if (isMountedRef.current) {
                setResultHtml("No summary produced after multiple attempts.");
                setLoading(false);
                setShowResult(true);
              }
              masterControllerRef.current = null;
              return false;
            }
            await sleep(pollIntervalMs);
            continue;
          }
          if (isMountedRef.current) {
            setResultHtml(`Server returned ${res.status} — aborting.`);
            setLoading(false);
            setShowResult(true);
          }
          masterControllerRef.current = null;
          return false;
        }

        const ct = (res.headers.get("content-type") || "").toLowerCase();
        let rawText: any = "";
        if (ct.includes("application/json")) {
          try {
            const json = await res.json();
            const candidate = json?.summary ?? json?.output ?? json;
            rawText = candidate;
          } catch {
            if (attempt === maxAttempts) {
              if (isMountedRef.current) {
                setResultHtml(
                  "Could not parse summary response after multiple attempts."
                );
                setLoading(false);
                setShowResult(true);
              }
              masterControllerRef.current = null;
              return false;
            }
            await sleep(pollIntervalMs);
            continue;
          }
        } else {
          rawText = await res.text();
        }

        if (!rawText || rawText === "null") {
          if (attempt === maxAttempts) {
            if (isMountedRef.current) {
              setResultHtml("No summary produced after multiple attempts.");
              setLoading(false);
              setShowResult(true);
            }
            masterControllerRef.current = null;
            return false;
          }
          await sleep(pollIntervalMs);
          continue;
        }

        try {
          const finalHtml = await renderResponseContent(rawText);
          if (isMountedRef.current) setResultHtml(finalHtml);
        } catch (err) {
          console.error("rendering error", err);
          if (attempt === maxAttempts) {
            if (isMountedRef.current) {
              setResultHtml(
                "Received a response but failed to parse/render it."
              );
              setLoading(false);
              setShowResult(true);
            }
            masterControllerRef.current = null;
            return false;
          }
          await sleep(pollIntervalMs);
          continue;
        }

        // IMPORTANT: DO NOT clear the saved id on successful summary.
        // Keep the saved id in localStorage so ChatPanel can continue using it.
        // (User can clear it manually via the UI.)
        if (isMountedRef.current) {
          // ensure savedId still reflects the id we're polling (keeps chat working)
          setSavedId(id);
          // broadcast current id (so ChatPanel remains in sync)
          broadcastSavedId(id);
          setLoading(false);
          setShowResult(true);
          setShowChat(true);
        }
        masterControllerRef.current = null;
        return true;
      } catch (err) {
        console.warn("poll error", err);
        if (attempt === maxAttempts) {
          if (isMountedRef.current) {
            setLoading(false);
            setShowResult(true);
            setResultHtml("Could not fetch summary after multiple attempts.");
          }
          masterControllerRef.current = null;
          return false;
        }
        await sleep(pollIntervalMs);
      }
    }

    if (isMountedRef.current) {
      setLoading(false);
      setShowResult(true);
      setResultHtml("Could not fetch summary after multiple attempts.");
    }
    masterControllerRef.current = null;
    return false;
  }

  async function uploadFile(retries = 2) {
    const files = fileRef.current?.files;
    if (!files || !files.length) {
      setShowResult(true);
      setResultHtml(
        language === "FR"
          ? "Veuillez d'abord sélectionner un fichier PDF"
          : "Selecteer eerst een PDF-bestand"
      );
      return;
    }

    const file = files[0];
    const formData = new FormData();
    formData.append("data", file);

    if (isMountedRef.current) {
      setLoading(true);
      setShowResult(false);
      setShowChat(false);
      setResultHtml("");
    }

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const response = await fetchWithTimeout(
          `https://agent-beta.endare.com/webhook/NN-demo?lang=${language}`,
          { method: "POST", body: formData },
          120000
        );

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const id = await extractId(response);
        if (!Number.isFinite(id)) {
          if (isMountedRef.current) {
            setLoading(false);
            setShowResult(true);
            setResultHtml(
              "Upload succeeded but could not extract a numeric ID."
            );
          }
          return;
        }

        // store the id in localStorage for ChatPanel (and broadcast)
        try {
          localStorage.setItem("nn_summary_id", String(id));
          localStorage.setItem(
            "nn_summary_created_at",
            new Date().toISOString()
          );
          setSavedId(id);
          broadcastSavedId(id);
        } catch (err) {
          console.warn("Could not save id to localStorage", err);
        }

        if (isMountedRef.current) {
          setShowResult(true);
          setResultHtml(
            language === "FR"
              ? "Téléchargement réussi. Génération du résumé en cours…"
              : "Uploaden succesvol. Samenvatting wordt nu gegenereerd..."
          );
        }

        await sleep(60000);

        if (typeof id === "number") {
          await pollForSummary(id);
        }

        return;
      } catch (error: any) {
        if (attempt > retries) {
          if (isMountedRef.current) {
            setLoading(false);
            setShowResult(true);
            setResultHtml(`Error: ${error?.message || "Upload failed"}`);
          }
          return;
        }
        await sleep(1000);
      }
    }
  }

  const resumePolling = async () => {
    if (!savedId) return;
    setLoading(true);
    setShowResult(false);
    setResultHtml("");
    await pollForSummary(savedId);
  };

  const clearSavedId = () => {
    try {
      localStorage.removeItem("nn_summary_id");
      localStorage.removeItem("nn_summary_created_at");
    } catch {}
    setSavedId(null);
    broadcastSavedId(null);
  };

  useEffect(() => {
    return () => {
      if (masterControllerRef.current) masterControllerRef.current.abort();
      masterControllerRef.current = null;
    };
  }, []);

  return (
    <>
      <div className="upload-container">
        <input ref={fileRef} type="file" id="pdfInput" accept=".pdf" />
        <button onClick={() => uploadFile()} disabled={loading}>
          {buttonText}
        </button>
      </div>

      {loading && <div className="loader" />}

      {showResult && (
        <div
          className="result"
          /* resultHtml already sanitized by DOMPurify when rendering markdown */
          dangerouslySetInnerHTML={{ __html: resultHtml }}
        />
      )}

      <input type="hidden" value={showChat ? "1" : "0"} id="nn_show_chat" />
    </>
  );
}

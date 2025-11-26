"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import React, { useState, useEffect } from "react";

type ChatEntry = {
  id: number; // timestamp used as key
  question: string;
  answer: string;
};

export default function ChatPanel() {
  const [text, setText] = useState("");
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const { language } = useLanguage();

  // helper to format API output nicely
  function formatChatOutput(raw: any): string {
    if (typeof raw === "string") {
      try {
        // unwrap quoted JSON strings like '"line1\nline2"'
        const parsed = JSON.parse(raw);
        if (typeof parsed === "string") raw = parsed;
      } catch {
        // ignore parse errors
      }
      // convert escaped newlines to actual newlines
      return raw
        .replace(/\\r\\n/g, "\r\n")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r");
    }

    if (typeof raw === "object" && raw !== null) {
      return JSON.stringify(raw, null, 2);
    }

    return String(raw);
  }

  useEffect(() => {
    setMounted(true);

    try {
      const maybe = localStorage.getItem("nn_summary_id");
      if (maybe && !isNaN(Number(maybe))) {
        setSavedId(Number(maybe));
      } else {
        setSavedId(null);
      }
    } catch (err) {
      console.warn("Could not read nn_summary_id from localStorage", err);
    }

    const handler = (e: Event) => {
      try {
        const ce = e as CustomEvent;
        const detail = ce.detail;
        if (detail === null || detail === undefined) {
          setSavedId(null);
        } else {
          const n = Number(detail);
          if (!isNaN(n)) setSavedId(n);
        }
      } catch (err) {
        console.warn("nn_summary_id_changed handler error", err);
      }
    };

    window.addEventListener("nn_summary_id_changed", handler as EventListener);

    return () => {
      window.removeEventListener(
        "nn_summary_id_changed",
        handler as EventListener
      );
      setMounted(false);
    };
  }, []);

  async function onSendChat() {
    const message = text.trim();
    if (!message) return;

    // clear input immediately
    setText("");

    // use timestamp as id/key
    const id = Date.now();

    // optimistic entry: show question immediately
    setHistory((prev) => [
      ...prev,
      { id, question: message, answer: "…" }, // placeholder while waiting
    ]);

    // if no execution id, patch entry immediately
    if (!savedId) {
      setHistory((prev) =>
        prev.map((h) =>
          h.id === id
            ? {
                ...h,
                answer:
                  language === "FR"
                    ? "Veuillez d'abord sélectionner un fichier PDF"
                    : "Selecteer eerst een PDF-bestand",
              }
            : h
        )
      );
      return;
    }

    const fd = new FormData();
    fd.append("chatInput", message);
    fd.append("messages[0][role]", "user");
    fd.append("messages[0][content]", message);
    fd.append("executionId", String(savedId));

    try {
      const res = await fetch(
        "https://agent-beta.endare.com/webhook/f5ed7916-342d-4de2-ac40-4d24d1e2e471/chat",
        { method: "POST", body: fd }
      );

      const json = await res.json().catch(() => null);
      const answer = json ? formatChatOutput(json.output) : "No JSON returned";

      // patch optimistic entry with real answer
      setHistory((prev) =>
        prev.map((h) => (h.id === id ? { ...h, answer } : h))
      );
    } catch (err) {
      setHistory((prev) =>
        prev.map((h) =>
          h.id === id ? { ...h, answer: "Error: " + String(err) } : h
        )
      );
    }
  }

  if (!mounted) return null;

  const sendButtonText = language === "FR" ? "Envoyer" : "Verzend";

  return (
    <div id="chat" className="upload-container">
      <div className="chat-container">
        <div id="out" className="chat-out" aria-live="polite">
          {history.map((h) => (
            <div key={h.id} className="entry">
              {/* right: Question block first */}
              <div className="question-box">
                <div className="question-box-container">
                  <div className="question-text">{h.question}</div>
                </div>
              </div>

              {/* left: Answer block second */}
              <div className="answer-box">
                <div className="answer-text">
                  {h.answer === "…" ? (
                    <span className="dots" aria-label="Answer loading">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </span>
                  ) : (
                    <pre className="answer-pre">{h.answer}</pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="chat-form">
          <input
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); // prevent newline
                onSendChat();
              }
            }}
          />
          <button onClick={onSendChat} disabled={text.trim().length === 0}>
            {sendButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

// "use client";

// import React, { useEffect, useRef, useState } from "react";
// import { useLanguage } from "@/contexts/LanguageContext";

// type ChatEntry = {
//   id: number;
//   question: string;
//   answer: string;
// };

// const VAT_REGEX = /^BE\d{10}$/i;

// async function fetchWithTimeout(
//   url: string,
//   options: RequestInit = {},
//   timeout = 120000,
//   externalSignal?: AbortSignal | null
// ): Promise<Response> {
//   const timeoutController = new AbortController();
//   const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

//   let onExternalAbort: (() => void) | null = null;
//   if (externalSignal) {
//     if (externalSignal.aborted) {
//       clearTimeout(timeoutId);
//       timeoutController.abort();
//     } else {
//       onExternalAbort = () => {
//         timeoutController.abort();
//       };
//       externalSignal.addEventListener("abort", onExternalAbort);
//     }
//   }

//   const opts: RequestInit = { ...options, signal: timeoutController.signal };

//   try {
//     const res = await fetch(url, opts);
//     clearTimeout(timeoutId);
//     return res;
//   } catch (err: any) {
//     clearTimeout(timeoutId);
//     if (
//       (err as any)?.name === "AbortError" &&
//       timeoutController.signal.aborted
//     ) {
//       if (externalSignal && externalSignal.aborted) {
//         throw new Error("Request aborted by external signal");
//       }
//       throw new Error("Request timed out");
//     }
//     throw err;
//   } finally {
//     if (externalSignal && onExternalAbort)
//       externalSignal.removeEventListener("abort", onExternalAbort);
//   }
// }

// export default function ChatPanel() {
//   const [text, setText] = useState("");
//   const [history, setHistory] = useState<ChatEntry[]>([]);
//   const [savedId, setSavedId] = useState<number | null>(null);
//   const [mounted, setMounted] = useState(false);
//   const [pollingController, setPollingController] =
//     useState<AbortController | null>(null);
//   const isMountedRef = useRef(true);

//   const { language } = useLanguage();

//   useEffect(() => {
//     setMounted(true);
//     isMountedRef.current = true;

//     try {
//       const maybe = localStorage.getItem("nn_summary_id");
//       if (maybe && !isNaN(Number(maybe))) setSavedId(Number(maybe));
//     } catch {}

//     const handler = (e: Event) => {
//       try {
//         const ce = e as CustomEvent;
//         const detail = ce.detail;
//         if (detail === null || detail === undefined) setSavedId(null);
//         else if (!isNaN(Number(detail))) setSavedId(Number(detail));
//       } catch {}
//     };

//     window.addEventListener("nn_summary_id_changed", handler as EventListener);

//     return () => {
//       window.removeEventListener(
//         "nn_summary_id_changed",
//         handler as EventListener
//       );
//       setMounted(false);
//       isMountedRef.current = false;
//       if (pollingController) pollingController.abort();
//     };
//   }, []);

//   const broadcastSavedId = (id: number | null) => {
//     try {
//       window.dispatchEvent(
//         new CustomEvent("nn_summary_id_changed", { detail: id })
//       );
//     } catch {}
//   };

//   function formatChatOutput(raw: any): string {
//     if (typeof raw === "string") {
//       try {
//         const parsed = JSON.parse(raw);
//         if (typeof parsed === "string") raw = parsed;
//       } catch {}
//       return raw
//         .replace(/\\r\\n/g, "\r\n")
//         .replace(/\\n/g, "\n")
//         .replace(/\\r/g, "\r");
//     }
//     if (typeof raw === "object" && raw !== null) {
//       try {
//         return JSON.stringify(raw, null, 2);
//       } catch {
//         return String(raw);
//       }
//     }
//     return String(raw);
//   }

//   async function extractId(response: Response): Promise<number | null> {
//     const contentType = response.headers.get("content-type") || "";
//     try {
//       if (contentType.includes("application/json")) {
//         const json = await response
//           .clone()
//           .json()
//           .catch(() => null);
//         if (json == null) return null;
//         if (typeof json === "number") return json;
//         if (typeof json === "string" && !isNaN(Number(json)))
//           return Number(json);
//         if (json && (json.id || json.ID || json.Id))
//           return Number(json.id ?? json.ID ?? json.Id);
//         if (json && json.output && !isNaN(Number(json.output)))
//           return Number(json.output);
//         const m = JSON.stringify(json).match(/(\d+)/);
//         if (m) return Number(m[1]);
//       } else {
//         const text = await response.text();
//         if (!isNaN(Number(text.trim()))) return Number(text.trim());
//         const m = text.match(/(\d+)/);
//         if (m) return Number(m[1]);
//       }
//     } catch {}
//     return null;
//   }

//   async function pollForSummary(id: number): Promise<any> {
//     const maxAttempts = 30;
//     const pollIntervalMs = 10000;
//     const url = `https://agent-beta.endare.com/webhook/get-summary?id=${encodeURIComponent(
//       id
//     )}`;

//     if (pollingController) pollingController.abort();
//     const controller = new AbortController();
//     setPollingController(controller);

//     for (let attempt = 1; attempt <= maxAttempts; attempt++) {
//       if (!isMountedRef.current) return null;
//       try {
//         const res = await fetchWithTimeout(
//           url,
//           { method: "GET" },
//           30000,
//           controller.signal
//         );
//         if (!res.ok) {
//           if ([404, 202, 425].includes(res.status)) {
//             if (attempt === maxAttempts) return null;
//             await new Promise((r) => setTimeout(r, pollIntervalMs));
//             continue;
//           }
//           return null;
//         }
//         const ct = (res.headers.get("content-type") || "").toLowerCase();
//         let rawText: any = "";
//         if (ct.includes("application/json")) {
//           try {
//             const json = await res.json();
//             rawText = json?.summary ?? json?.output ?? json;
//           } catch {
//             if (attempt === maxAttempts) return null;
//             await new Promise((r) => setTimeout(r, pollIntervalMs));
//             continue;
//           }
//         } else {
//           rawText = await res.text();
//         }
//         if (
//           !rawText ||
//           rawText === "null" ||
//           (typeof rawText === "string" && rawText.trim() === "")
//         ) {
//           if (attempt === maxAttempts) return null;
//           await new Promise((r) => setTimeout(r, pollIntervalMs));
//           continue;
//         }
//         return rawText;
//       } catch {
//         if (attempt === maxAttempts) return null;
//         await new Promise((r) => setTimeout(r, pollIntervalMs));
//       }
//     }
//     return null;
//   }

//   // --- Updated: fetch via Vercel API proxy ---
//   async function fetchCompanyAndAccounts(vat: string) {
//     const vatNorm = vat.trim().toUpperCase();
//     const res = await fetchWithTimeout(
//       `/api/openthebox?vat=${encodeURIComponent(vatNorm)}`,
//       { method: "GET" },
//       30000
//     );
//     if (!res.ok) {
//       const body = await res.text().catch(() => "");
//       throw new Error(`OpenTheBox proxy returned ${res.status}: ${body}`);
//     }
//     const json = await res.json().catch(() => null);
//     if (!json) throw new Error("Failed to parse OpenTheBox JSON");
//     return { company: json.company, annualAccounts: json.annualAccounts };
//   }

//   async function onSendChat() {
//     const message = text.trim();
//     if (!message) return;

//     setText("");
//     const id = Date.now();
//     setHistory((prev) => [...prev, { id, question: message, answer: "…" }]);

//     if (!savedId) {
//       const sanitized = message.replace(/\s+/g, "").toUpperCase();
//       if (!VAT_REGEX.test(sanitized)) {
//         setHistory((prev) =>
//           prev.map((h) =>
//             h.id === id
//               ? {
//                   ...h,
//                   answer:
//                     language === "FR"
//                       ? "Veuillez entrer un numéro de TVA bien formaté (ex. BE0845561272)."
//                       : "Geef een correct geformatteerd BTW-nummer op (bv. BE0845561272).",
//                 }
//               : h
//           )
//         );
//         return;
//       }

//       try {
//         const combined = await fetchCompanyAndAccounts(sanitized);
//         const payload = {
//           vat: sanitized,
//           fetchedAt: new Date().toISOString(),
//           ...combined,
//         };

//         const res = await fetchWithTimeout(
//           `https://agent-beta.endare.com/webhook/NN-demo?lang=${encodeURIComponent(
//             language
//           )}`,
//           {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify(payload),
//           },
//           120000
//         );

//         if (!res.ok) {
//           setHistory((prev) =>
//             prev.map((h) =>
//               h.id === id
//                 ? { ...h, answer: `Upload endpoint returned ${res.status}` }
//                 : h
//             )
//           );
//           return;
//         }

//         const newId = await extractId(res);
//         if (!Number.isFinite(newId) || newId === null) {
//           setHistory((prev) =>
//             prev.map((h) =>
//               h.id === id
//                 ? {
//                     ...h,
//                     answer:
//                       "Upload succeeded but could not extract a numeric ID.",
//                   }
//                 : h
//             )
//           );
//           return;
//         }

//         localStorage.setItem("nn_summary_id", String(newId));
//         localStorage.setItem("nn_summary_created_at", new Date().toISOString());
//         setSavedId(newId);
//         broadcastSavedId(newId);

//         // ✅ Guarded call: newId is guaranteed to be a number
//         const summaryRaw = await pollForSummary(newId);
//         const formatted = summaryRaw
//           ? formatChatOutput(summaryRaw)
//           : language === "FR"
//           ? "Aucun résumé produit."
//           : "Geen samenvatting gevonden.";

//         setHistory((prev) =>
//           prev.map((h) => (h.id === id ? { ...h, answer: formatted } : h))
//         );
//       } catch (err: any) {
//         setHistory((prev) =>
//           prev.map((h) =>
//             h.id === id
//               ? { ...h, answer: "Error: " + String(err?.message ?? err) }
//               : h
//           )
//         );
//       }
//       return;
//     }

//     // Normal chat messages after savedId exists
//     const fd = new FormData();
//     fd.append("chatInput", message);
//     fd.append("messages[0][role]", "user");
//     fd.append("messages[0][content]", message);
//     fd.append("executionId", String(savedId));

//     try {
//       const res = await fetch(
//         "https://agent-beta.endare.com/webhook/f5ed7916-342d-4de2-ac40-4d24d1e2e471/chat",
//         { method: "POST", body: fd }
//       );

//       const json = await res.json().catch(() => null);
//       const answer = json
//         ? formatChatOutput(json.output ?? json.summary ?? json)
//         : "No JSON returned";

//       setHistory((prev) =>
//         prev.map((h) => (h.id === id ? { ...h, answer } : h))
//       );
//     } catch (err) {
//       setHistory((prev) =>
//         prev.map((h) =>
//           h.id === id ? { ...h, answer: "Error: " + String(err) } : h
//         )
//       );
//     }
//   }

//   if (!mounted) return null;
//   const sendButtonText = language === "FR" ? "Envoyer" : "Verzend";

//   return (
//     <div id="chat" className="upload-container">
//       <div className="chat-container">
//         <div id="out" className="chat-out" aria-live="polite">
//           {history.map((h) => (
//             <div key={h.id} className="entry">
//               <div className="question-box">
//                 <div className="question-box-container">
//                   <div className="question-text">{h.question}</div>
//                 </div>
//               </div>
//               <div className="answer-box">
//                 <div className="answer-text">
//                   {h.answer === "…" ? (
//                     <span className="dots" aria-label="Answer loading">
//                       <span className="dot" />
//                       <span className="dot" />
//                       <span className="dot" />
//                     </span>
//                   ) : (
//                     <pre className="answer-pre">{h.answer}</pre>
//                   )}
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//         <div className="chat-form">
//           <input
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//             placeholder={
//               !savedId
//                 ? language === "FR"
//                   ? "Entrez le numéro de TVA (ex. BE0845561272)"
//                   : "Voer het BTW-nummer in (bv. BE0845561272)"
//                 : "..."
//             }
//             onKeyDown={(e) => {
//               if (e.key === "Enter" && !e.shiftKey) {
//                 e.preventDefault();
//                 onSendChat();
//               }
//             }}
//           />
//           <button onClick={onSendChat} disabled={text.trim().length === 0}>
//             {sendButtonText}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

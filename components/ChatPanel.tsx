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

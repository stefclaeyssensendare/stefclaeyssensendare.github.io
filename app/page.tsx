"use client";

import React from "react";
import UploadForm from "../components/UploadForm";
import ChatPanel from "../components/ChatPanel";
import LanguageSelector from "@/components/LanguageSelector";
import { LanguageProvider } from "@/contexts/LanguageContext";

export default function Page() {
  return (
    <LanguageProvider>
      <main className="relative container mx-auto">
        <img src="/logo-nn.png" alt="NN Logo" className="logo" />

        {/* Absolutely positioned LanguageSelector */}
        <div className="language-selector">
          <LanguageSelector />
        </div>

        <UploadForm />
        <ChatPanel />
      </main>
    </LanguageProvider>
  );
}

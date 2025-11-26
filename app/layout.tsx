import "../styles/globals.css";
import React from "react";

export const metadata = {
  title: "NN Demo",
  description: "Upload PDFs and chat with the NN agent",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

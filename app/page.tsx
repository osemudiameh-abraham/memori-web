"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
};

export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  function sendMessage() {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "assistant", text: "Memori is not connected yet." },
    ]);

    setInput("");
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>Memori</h1>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 12,
          minHeight: 200,
          marginTop: 16,
        }}
      >
        {messages.map((message, index) => (
          <div key={index} style={{ marginBottom: 8 }}>
            <strong>{message.role === "user" ? "You" : "Memori"}:</strong>{" "}
            {message.text}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1, padding: 8 }}
          placeholder="Type a message..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage();
            }
          }}
        />
        <button onClick={sendMessage} style={{ padding: "8px 16px" }}>
          Send
        </button>
      </div>
    </main>
  );
}

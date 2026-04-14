"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const GREETING = "Salut ! Je suis Maia 👋 Posez-moi n'importe quelle question sur RUN IDKA ou 4YOU, je suis là pour vous aider !";

export default function MaiaChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING, timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function formatTime(date: Date) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage, timestamp: new Date() },
    ]);
    setLoading(true);
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage }),
      });

      const data = await res.json();
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer ?? "Une erreur est survenue. Réessayez !",
          timestamp: new Date(),
        },
      ]);
    } catch {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Oups, je n'arrive pas à joindre le serveur. Vérifiez votre connexion 🙏",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=Nunito:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0f0c1a;
          font-family: 'Nunito', sans-serif;
        }

        .chat-root {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          max-width: 780px;
          margin: 0 auto;
          position: relative;
          background: #13101f;
        }

        .chat-root::before {
          content: '';
          position: fixed;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 24px;
          background: rgba(19,16,31,0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7c3aed, #a78bfa, #ec4899);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(139,92,246,0.25), 0 4px 20px rgba(139,92,246,0.3);
          position: relative;
        }

        .avatar::after {
          content: '';
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 10px;
          height: 10px;
          background: #22c55e;
          border-radius: 50%;
          border: 2px solid #13101f;
        }

        .header-info h1 {
          font-family: 'Sora', sans-serif;
          font-size: 17px;
          font-weight: 600;
          color: #f1eeff;
          letter-spacing: -0.3px;
        }

        .header-info p {
          font-size: 12px;
          color: #22c55e;
          font-weight: 500;
          margin-top: 1px;
        }

        .header-badge {
          margin-left: auto;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(139,92,246,0.15);
          color: #a78bfa;
          border: 1px solid rgba(139,92,246,0.25);
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
          z-index: 1;
          scroll-behavior: smooth;
        }

        .messages::-webkit-scrollbar { width: 4px; }
        .messages::-webkit-scrollbar-track { background: transparent; }
        .messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

        .date-sep {
          text-align: center;
          font-size: 11px;
          color: rgba(255,255,255,0.2);
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin: 4px 0;
        }

        .msg-row {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          animation: fadeUp 0.25s ease forwards;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .msg-row.user { flex-direction: row-reverse; }

        .msg-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
        }

        .msg-avatar.maia {
          background: linear-gradient(135deg, #7c3aed, #ec4899);
          box-shadow: 0 2px 12px rgba(139,92,246,0.3);
        }

        .msg-avatar.user-av {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .msg-body { max-width: 72%; display: flex; flex-direction: column; gap: 4px; }
        .msg-row.user .msg-body { align-items: flex-end; }

        .msg-name {
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.3);
          padding: 0 4px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        .bubble {
          padding: 12px 16px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.65;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .bubble.maia {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #e8e3ff;
          border-bottom-left-radius: 4px;
        }

        .bubble.user {
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: #fff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 20px rgba(109,40,217,0.35);
        }

        .msg-time {
          font-size: 10px;
          color: rgba(255,255,255,0.18);
          padding: 0 4px;
          font-weight: 500;
        }

        .typing-row {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          animation: fadeUp 0.25s ease forwards;
        }

        .typing-bubble {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          border-bottom-left-radius: 4px;
          padding: 14px 18px;
          display: flex;
          gap: 5px;
          align-items: center;
        }

        .typing-bubble span {
          width: 7px;
          height: 7px;
          background: #a78bfa;
          border-radius: 50%;
          display: inline-block;
          animation: bounce 1.2s infinite ease-in-out;
        }

        .typing-bubble span:nth-child(2) { animation-delay: 0.2s; }
        .typing-bubble span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-6px); opacity: 1; }
        }

        .suggestions {
          display: flex;
          gap: 8px;
          padding: 0 20px 12px;
          overflow-x: auto;
          scrollbar-width: none;
          flex-shrink: 0;
        }

        .suggestions::-webkit-scrollbar { display: none; }

        .suggestion-chip {
          flex-shrink: 0;
          padding: 7px 14px;
          border-radius: 20px;
          border: 1px solid rgba(139,92,246,0.25);
          background: rgba(139,92,246,0.08);
          color: #c4b5fd;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          font-family: 'Nunito', sans-serif;
          transition: all 0.15s ease;
        }

        .suggestion-chip:hover {
          background: rgba(139,92,246,0.2);
          border-color: rgba(139,92,246,0.5);
          color: #e9d5ff;
          transform: translateY(-1px);
        }

        .input-area {
          padding: 12px 16px 20px;
          background: rgba(19,16,31,0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.06);
          position: sticky;
          bottom: 0;
          z-index: 10;
        }

        .input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 8px 8px 8px 18px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .input-wrap:focus-within {
          border-color: rgba(139,92,246,0.5);
          box-shadow: 0 0 0 3px rgba(139,92,246,0.1);
        }

        .input-wrap input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #f1eeff;
          font-size: 14px;
          font-family: 'Nunito', sans-serif;
          font-weight: 500;
        }

        .input-wrap input::placeholder { color: rgba(255,255,255,0.2); }

        .send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          box-shadow: 0 2px 12px rgba(109,40,217,0.4);
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.08);
          box-shadow: 0 4px 20px rgba(109,40,217,0.5);
        }

        .send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
        }

        .send-btn svg { width: 18px; height: 18px; color: white; }

        @media (max-width: 640px) {
          .header { padding: 14px 16px; }
          .messages { padding: 16px 12px; }
          .msg-body { max-width: 82%; }
          .bubble { font-size: 13.5px; }
          .input-area { padding: 10px 12px 16px; }
        }
      `}</style>

      <div className="chat-root">
        <div className="header">
          <div className="avatar">🤖</div>
          <div className="header-info">
            <h1>Maia</h1>
            <p>● En ligne</p>
          </div>
          <div className="header-badge">ProdOps AI</div>
        </div>

        <div className="messages">
          <div className="date-sep">Aujourd'hui</div>

          {messages.map((m, i) => (
            <div key={i} className={`msg-row ${m.role === "user" ? "user" : ""}`}>
              <div className={`msg-avatar ${m.role === "assistant" ? "maia" : "user-av"}`}>
                {m.role === "assistant" ? "✨" : "👤"}
              </div>
              <div className="msg-body">
                <div className="msg-name">
                  {m.role === "assistant" ? "Maia" : "Vous"}
                </div>
                <div className={`bubble ${m.role === "assistant" ? "maia" : "user"}`}>
                  {m.content}
                </div>
                <div className="msg-time">{formatTime(m.timestamp)}</div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="typing-row">
              <div className="msg-avatar maia">✨</div>
              <div className="typing-bubble">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 && (
          <div className="suggestions">
            {[
              "Déploiement 4YOU",
              "Comment accéder à RUN IDKA ?",
              "Chaînes standards HRA",
              "Procédure de mise à jour",
            ].map((s) => (
              <button
                key={s}
                className="suggestion-chip"
                onClick={() => {
                  setInput(s);
                  inputRef.current?.focus();
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="input-area">
          <div className="input-wrap">
            <input
              ref={inputRef}
              placeholder="Écrivez votre message..."
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button className="send-btn" onClick={sendMessage} disabled={loading}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
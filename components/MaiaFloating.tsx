"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const GREETING =
  "Salut ! Je suis Maia 👋 Posez-moi n'importe quelle question sur RUN IDKA ou 4YOU, je suis là pour vous aider !";

export default function MaiaFloating() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING, timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, open]);

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
      const answer = data.answer ?? "Une erreur est survenue. Réessayez !";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer, timestamp: new Date() },
      ]);
      if (!open) setUnread((n) => n + 1);
    } catch {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Oups, je n'arrive pas à joindre le serveur 🙏",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      if (open) inputRef.current?.focus();
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600&family=Nunito:wght@400;500;600;700&display=swap');

        .maia-wrapper {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 9999;
          font-family: 'Nunito', sans-serif;
        }

        /* FAB button */
        .maia-fab {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          box-shadow: 0 4px 24px rgba(109,40,217,0.5), 0 0 0 0 rgba(139,92,246,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          position: relative;
          animation: pulse-ring 2.5s infinite;
        }

        @keyframes pulse-ring {
          0% { box-shadow: 0 4px 24px rgba(109,40,217,0.5), 0 0 0 0 rgba(139,92,246,0.35); }
          70% { box-shadow: 0 4px 24px rgba(109,40,217,0.5), 0 0 0 14px rgba(139,92,246,0); }
          100% { box-shadow: 0 4px 24px rgba(109,40,217,0.5), 0 0 0 0 rgba(139,92,246,0); }
        }

        .maia-fab:hover {
          transform: scale(1.1);
        }

        .maia-fab.open {
          animation: none;
          box-shadow: 0 4px 24px rgba(109,40,217,0.5);
        }

        .maia-fab .fab-icon {
          transition: transform 0.3s ease, opacity 0.2s ease;
          position: absolute;
        }

        .maia-fab .fab-icon.chat { opacity: 1; transform: scale(1) rotate(0deg); }
        .maia-fab .fab-icon.close { opacity: 0; transform: scale(0.5) rotate(-90deg); }

        .maia-fab.open .fab-icon.chat { opacity: 0; transform: scale(0.5) rotate(90deg); }
        .maia-fab.open .fab-icon.close { opacity: 1; transform: scale(1) rotate(0deg); }

        .maia-unread {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 20px;
          height: 20px;
          background: #ef4444;
          border-radius: 50%;
          border: 2px solid white;
          font-size: 10px;
          font-weight: 700;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pop 0.3s ease;
        }

        @keyframes pop {
          0% { transform: scale(0); }
          70% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        /* Chat panel */
        .maia-panel {
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 370px;
          height: 540px;
          background: #13101f;
          border-radius: 20px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transform-origin: bottom right;
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease;
        }

        .maia-panel.hidden {
          transform: scale(0.85) translateY(10px);
          opacity: 0;
          pointer-events: none;
        }

        .maia-panel.visible {
          transform: scale(1) translateY(0);
          opacity: 1;
        }

        /* Ambient glow */
        .maia-panel::before {
          content: '';
          position: absolute;
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* Header */
        .panel-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(19,16,31,0.98);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }

        .panel-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7c3aed, #a78bfa, #ec4899);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
          box-shadow: 0 0 0 2px rgba(139,92,246,0.3);
          position: relative;
        }

        .panel-avatar::after {
          content: '';
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: 9px;
          height: 9px;
          background: #22c55e;
          border-radius: 50%;
          border: 2px solid #13101f;
        }

        .panel-info h2 {
          font-family: 'Sora', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #f1eeff;
        }

        .panel-info p {
          font-size: 11px;
          color: #22c55e;
          font-weight: 500;
        }

        .panel-badge {
          margin-left: auto;
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 20px;
          background: rgba(139,92,246,0.15);
          color: #a78bfa;
          border: 1px solid rgba(139,92,246,0.25);
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        /* Messages */
        .panel-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          z-index: 1;
        }

        .panel-messages::-webkit-scrollbar { width: 3px; }
        .panel-messages::-webkit-scrollbar-track { background: transparent; }
        .panel-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

        .date-sep {
          text-align: center;
          font-size: 10px;
          color: rgba(255,255,255,0.18);
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .msg-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          animation: fadeUp 0.2s ease forwards;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .msg-row.user { flex-direction: row-reverse; }

        .msg-av {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .msg-av.maia { background: linear-gradient(135deg, #7c3aed, #ec4899); }
        .msg-av.user-av { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); }

        .msg-body { max-width: 78%; display: flex; flex-direction: column; gap: 3px; }
        .msg-row.user .msg-body { align-items: flex-end; }

        .bubble {
          padding: 10px 13px;
          border-radius: 16px;
          font-size: 13px;
          line-height: 1.6;
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
          box-shadow: 0 3px 14px rgba(109,40,217,0.3);
        }

        .msg-time {
          font-size: 9px;
          color: rgba(255,255,255,0.15);
          padding: 0 3px;
        }

        .typing-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          animation: fadeUp 0.2s ease forwards;
        }

        .typing-bubble {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          border-bottom-left-radius: 4px;
          padding: 12px 16px;
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .typing-bubble span {
          width: 6px;
          height: 6px;
          background: #a78bfa;
          border-radius: 50%;
          display: inline-block;
          animation: bounce 1.2s infinite ease-in-out;
        }

        .typing-bubble span:nth-child(2) { animation-delay: 0.2s; }
        .typing-bubble span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }

        /* Suggestions */
        .suggestions {
          display: flex;
          gap: 6px;
          padding: 0 14px 10px;
          overflow-x: auto;
          scrollbar-width: none;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }

        .suggestions::-webkit-scrollbar { display: none; }

        .chip {
          flex-shrink: 0;
          padding: 5px 11px;
          border-radius: 20px;
          border: 1px solid rgba(139,92,246,0.25);
          background: rgba(139,92,246,0.08);
          color: #c4b5fd;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          font-family: 'Nunito', sans-serif;
          transition: all 0.15s ease;
        }

        .chip:hover {
          background: rgba(139,92,246,0.2);
          border-color: rgba(139,92,246,0.5);
          color: #e9d5ff;
          transform: translateY(-1px);
        }

        /* Input */
        .panel-input {
          padding: 10px 12px 14px;
          background: rgba(19,16,31,0.98);
          border-top: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }

        .input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 7px 7px 7px 14px;
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
          font-size: 13px;
          font-family: 'Nunito', sans-serif;
          font-weight: 500;
          min-width: 0;
        }

        .input-wrap input::placeholder { color: rgba(255,255,255,0.2); }

        .send-btn {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          box-shadow: 0 2px 10px rgba(109,40,217,0.4);
          transition: all 0.2s ease;
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.08);
          box-shadow: 0 3px 16px rgba(109,40,217,0.5);
        }

        .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .send-btn svg { width: 15px; height: 15px; color: white; }

        @media (max-width: 480px) {
          .maia-wrapper { bottom: 16px; right: 16px; }
          .maia-panel { width: calc(100vw - 32px); height: 75dvh; right: 0; }
        }
      `}</style>

      <div className="maia-wrapper">
        {/* Chat panel */}
        <div className={`maia-panel ${open ? "visible" : "hidden"}`}>
          {/* Header */}
          <div className="panel-header">
            <div className="panel-avatar">✨</div>
            <div className="panel-info">
              <h2>Maia</h2>
              <p>● En ligne</p>
            </div>
            <div className="panel-badge">ProdOps AI</div>
          </div>

          {/* Messages */}
          <div className="panel-messages">
            <div className="date-sep">Aujourd'hui</div>

            {messages.map((m, i) => (
              <div key={i} className={`msg-row ${m.role === "user" ? "user" : ""}`}>
                <div className={`msg-av ${m.role === "assistant" ? "maia" : "user-av"}`}>
                  {m.role === "assistant" ? "✨" : "👤"}
                </div>
                <div className="msg-body">
                  <div className={`bubble ${m.role === "assistant" ? "maia" : "user"}`}>
                    {m.content}
                  </div>
                  <div className="msg-time">{formatTime(m.timestamp)}</div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="typing-row">
                <div className="msg-av maia">✨</div>
                <div className="typing-bubble">
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="suggestions">
              {["Déploiement 4YOU", "Accès RUN IDKA", "Chaînes HRA", "Mise à jour"].map((s) => (
                <button
                  key={s}
                  className="chip"
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="panel-input">
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

        {/* FAB */}
        <button className={`maia-fab ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)}>
          <span className="fab-icon chat">🤖</span>
          <span className="fab-icon close" style={{ fontSize: 20 }}>✕</span>
          {unread > 0 && !open && (
            <div className="maia-unread">{unread}</div>
          )}
        </button>
      </div>
    </>
  );
}
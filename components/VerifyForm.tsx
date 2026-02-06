"use client";

import React, { useState } from "react";

export default function VerifyForm() {
  const [client, setClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerify = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || JSON.stringify(data));
      } else {
        setResult(data.result || data);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h2>Jira Verification</h2>
      <input
        value={client}
        onChange={(e) => setClient(e.target.value)}
        placeholder="Client name (e.g., ACME)"
        style={{ width: "100%", padding: 8, fontSize: 16, marginBottom: 8 }}
      />
      <button onClick={runVerify} disabled={loading || !client}>
        {loading ? "Running..." : "Verify"}
      </button>
      {error && <pre style={{ color: "red" }}>{error}</pre>}
      {result && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

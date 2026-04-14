const MAIA_URL = process.env.MAIA_API_URL || "https://presenting-remarks-roles-nation.trycloudflare.com";

export async function askMaia(question: string): Promise<string> {
  const res = await fetch(`${MAIA_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error("Maia API error");
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.answer;
}
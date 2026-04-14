import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import https from "https";

// Fix for corporate proxy with self-signed certificates
const agent = new https.Agent({ rejectUnauthorized: false });

type Doc = { text: string; embedding: number[] };

let cachedDocs: Doc[] | null = null;

async function getDocs(): Promise<Doc[]> {
  if (cachedDocs) return cachedDocs;
  const filePath = path.join(process.cwd(), "public", "embeddings (2).json");
  const raw = await fs.readFile(filePath, "utf-8");
  cachedDocs = JSON.parse(raw);
  return cachedDocs!;
}

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(
    "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
      // @ts-ignore — Node.js fetch accepts agent
      agent,
    }
  );

  const data = await res.json();

  if (Array.isArray(data) && Array.isArray(data[0])) return data[0];
  if (Array.isArray(data) && typeof data[0] === "number") return data;

  console.error("Unexpected HF response:", data);
  throw new Error("Failed to get embedding from HuggingFace");
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function retrieve(queryEmbedding: number[], topK = 3): Promise<string[]> {
  const docs = await getDocs();
  const scored = docs.map((doc) => ({
    score: cosineSimilarity(queryEmbedding, doc.embedding),
    text: doc.text,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((d) => d.text);
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const queryEmbedding = await getEmbedding(query);
    const context = (await retrieve(queryEmbedding)).join("\n\n");

    const prompt = `You are Maia, a ProdOps assistant specialized in RUN IDKA and 4YOU.
Rules:
- Answer ONLY using the provided context
- If the answer is not in the context, say: "Je ne sais pas"
- Be concise and structured
- Prefer step-by-step instructions when relevant
- Use bullet points or numbered steps
- Keep answers clear and professional
- Answer in the same language as the question

Context:
${context}

Question: ${query}`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt },
        ],
      }),
      // @ts-ignore
      agent,
    });

    const groqData = await groqRes.json();

    if (!groqData.choices) {
      console.error("Groq error:", groqData);
      return NextResponse.json({ error: "Groq API error" }, { status: 500 });
    }

    return NextResponse.json({ answer: groqData.choices[0].message.content });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
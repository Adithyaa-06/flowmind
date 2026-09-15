import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
});

export async function askYesNo(prompt: string): Promise<"YES" | "NO"> {
  const res = await client.chat.completions.create({
    model: process.env.LLM_MODEL!,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are a decision engine. You must respond with exactly one word: YES or NO. Never explain, never add punctuation, never say anything else.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const raw = res.choices[0].message.content?.trim().toUpperCase() ?? "";

  if (raw.startsWith("YES")) return "YES";
  if (raw.startsWith("NO")) return "NO";

  console.warn(`Unexpected LLM response: "${raw}" — defaulting to NO`);
  return "NO";
}
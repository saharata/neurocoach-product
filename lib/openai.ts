export async function callOpenAIJson({
  apiKey,
  model,
  system,
  user,
}: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}) {
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: {
        format: { type: "json_object" }
      }
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text);
  }

  const data = await resp.json();

  // 🔥 ดึง JSON จากทุก possible location
  let textOut = "";

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    textOut = data.output_text;
  } else if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c?.type === "output_text" && typeof c.text === "string") {
            textOut += c.text;
          }
        }
      }
    }
  }

  if (!textOut.trim()) {
    throw new Error("Model returned empty output");
  }

  return textOut;
}
import fetch from "node-fetch";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const runDocumentAI = async ({ content, mode }) => {
  const safeContent =
    typeof content === "string"
      ? content
      : JSON.stringify(content || "");

  let systemPrompt = "";

  if (mode === "summary") {
    systemPrompt =
      "Summarize the document using ONLY bullet points. Each point must start with '- '. Do not add introductions, explanations, headings, or extra text. Return only bullet points.";
  } else if (mode === "grammar") {
    systemPrompt = "Fix grammar mistakes without changing the meaning.";
  } else if (mode === "improve") {
    systemPrompt = "Improve the writing and make it clear and professional.";
  } else if (mode === "actions") {
    systemPrompt =
      "Extract clear action points using ONLY bullet points. Each point must start with '- '. Do not add any extra text.";
  } else {
    systemPrompt = "Respond based on the document content.";
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: safeContent }
      ],
      temperature: 0.2
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return data.choices?.[0]?.message?.content || "AI response empty";
};

export const runWorkspaceAI = async ({ context, question }) => {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "You are a workspace AI assistant. Answer clearly using the provided workspace data. Do not assume anything outside the data."
        },
        {
          role: "user",
          content: `Workspace Data:\n${context}\n\nQuestion:\n${question}`
        }
      ],
      temperature: 0.2
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  return data.choices?.[0]?.message?.content || "AI response empty";
};

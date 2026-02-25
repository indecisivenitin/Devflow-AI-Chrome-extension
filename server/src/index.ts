import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import compression from "compression";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =============================
   Security & Performance
============================= */

// Compression
app.use(compression());

// Rate Limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

// Body parser
app.use(express.json({ limit: "1mb" }));

/* =============================
   CORS (Chrome Extension Safe)
============================= */

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow no origin (Postman, curl, extension sometimes)
      if (!origin) return callback(null, true);

      // Allow Chrome extensions
      if (origin.startsWith("chrome-extension://")) {
        return callback(null, true);
      }

      // Allow local dev
      if (origin.includes("localhost")) {
        return callback(null, true);
      }

      // Allow your Render frontend if needed
      if (
        origin ===
        "https://devflow-ai-chrome-extension.onrender.com"
      ) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);

/* =============================
   Groq Setup
============================= */

if (!process.env.GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY in environment variables");
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* =============================
   Routes
============================= */

// Health check (important for Render)
app.get("/", (_req, res) => {
  res.status(200).json({
    status: "DevFlow API running 🚀",
  });
});

app.post("/api/ask", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Streaming response
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You are DevFlow, a professional AI coding assistant. Provide clear, concise, structured answers with proper formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(content);
      }
    }

    res.end();
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =============================
   Start Server
============================= */

app.listen(PORT, () => {
  console.log(`🚀 DevFlow API running on port ${PORT}`);
});
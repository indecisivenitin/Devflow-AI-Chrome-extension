import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";

dotenv.config();

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY missing in environment variables");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------- Security Middlewares ---------------- */

app.use(helmet());
app.use(compression());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later."
  })
);

/* ---------------- CORS ---------------- */

const allowedOrigins = [
  process.env.EXTENSION_ORIGIN || ""
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["POST"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json());

/* ---------------- Groq Setup ---------------- */

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/* ---------------- Health Check ---------------- */

app.get("/", (_req, res) => {
  res.json({ status: "DevFlow API running" });
});

/* ---------------- Ask Route (Streaming) ---------------- */

app.post("/api/ask", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Valid prompt required" });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are DevFlow, a professional AI assistant that provides clear, concise, and well-formatted answers."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-8b-instant",
      stream: true
    });

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(content);
      }
    }

    res.end();

  } catch (error) {
    console.error("❌ API Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ---------------- Start Server ---------------- */

app.listen(PORT, () => {
  console.log(`🚀 DevFlow API running on port ${PORT}`);
});
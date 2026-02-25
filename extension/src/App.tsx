import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const sessionId = crypto.randomUUID();

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  /* ---------------- Restore Chat ---------------- */
  useEffect(() => {
    chrome?.storage?.local.get(["chatHistory"], (result) => {
      if (Array.isArray(result.chatHistory)) {
        setMessages(result.chatHistory);
      }
    });
  }, []);

  /* ---------------- Persist Chat ---------------- */
  useEffect(() => {
    chrome?.storage?.local.set({ chatHistory: messages });
  }, [messages]);

  /* ---------------- Listen for Selected Text Changes ---------------- */
  useEffect(() => {
    if (!chrome?.storage) return;

    const handleChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes.selectedText) {
        const newValue = changes.selectedText.newValue;
        if (typeof newValue === "string" && newValue.trim()) {
          setInput(newValue);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleChange);
    };
  }, []);

  /* ---------------- Auto Scroll ---------------- */
  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, loading]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const askAI = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const res = await fetch("http://localhost:3000/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: input, sessionId })
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    let aiMessage: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, aiMessage]);

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      aiMessage.content += chunk;

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...aiMessage };
        return updated;
      });
    }

    setLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
    chrome.storage.local.remove("chatHistory");
  };

  return (
    <div className="h-screen flex flex-col p-5 bg-[#f4f7f5] text-gray-800">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-semibold tracking-tight text-emerald-600">
          DevFlow
        </h1>
        <button
          onClick={clearChat}
          className="text-sm text-gray-500 hover:text-gray-800 transition"
        >
          Clear
        </button>
      </div>

      {/* Chat Area */}
      <div ref={chatRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
        <AnimatePresence>
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`p-4 rounded-2xl backdrop-blur-lg shadow-sm transition-all duration-200 hover:shadow-md ${
                msg.role === "user"
                  ? "ml-auto bg-emerald-50 border border-emerald-100"
                  : "bg-white/80 border border-black/5"
              }`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props) {
                    const { className, children } = props as any;
                    const match = /language-(\w+)/.exec(className || "");
                    const codeString = String(children).replace(/\n$/, "");

                    if (match) {
                      return (
                        <div className="relative group">
                          <button
                            onClick={() => copyToClipboard(codeString)}
                            className="absolute right-2 top-2 text-xs bg-gray-200 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
                          >
                            Copy
                          </button>
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        </div>
                      );
                    }

                    return (
                      <code className="bg-gray-100 px-1 py-0.5 rounded">
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Cursor */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/80 border border-black/5 p-4 rounded-2xl shadow-sm w-fit"
          >
            <span className="inline-block w-2 h-5 bg-orange-500 animate-pulse rounded-sm"></span>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask DevFlow..."
          className="flex-1 p-3 rounded-xl bg-white border border-black/10 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          onKeyDown={(e) => e.key === "Enter" && askAI()}
        />
        <button
          onClick={askAI}
          className="px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition"
        >
          Ask
        </button>
      </div>
    </div>
  );
}

export default App;
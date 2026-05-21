"use client";

import { motion } from "framer-motion";

const messages = [
  { side: "comment", text: "price" },
  { side: "brand", text: "Sent DM with offer link" },
  { side: "dm", text: "Hey! Want the launch price?" },
  { side: "ai", text: "AI collected email + tagged Hot Lead" }
];

export function PhoneDemo() {
  return (
    <div className="relative mx-auto aspect-[9/18] w-full max-w-[330px] rounded-[2rem] border border-white/14 bg-black p-3 shadow-pink">
      <div className="h-full overflow-hidden rounded-[1.5rem] bg-[#111]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-xs text-white/45">Instagram automation</p>
            <p className="font-semibold">@glowstudio</p>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-signal" />
        </div>
        <div className="space-y-4 p-4">
          <div className="aspect-square rounded-lg bg-gradient-to-br from-signal via-white to-pulse p-1">
            <div className="flex h-full items-end rounded-md bg-[url('https://images.unsplash.com/photo-1513097847644-f00cfe868607?q=80&w=800&auto=format&fit=crop')] bg-cover p-3">
              <span className="rounded bg-black/70 px-2 py-1 text-xs">New reel comment</span>
            </div>
          </div>
          {messages.map((message, index) => (
            <motion.div
              key={message.text}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.35, repeat: Infinity, repeatDelay: 3.2, repeatType: "reverse" }}
              className={message.side === "comment" ? "mr-10 rounded-md bg-white/10 p-3" : "ml-8 rounded-md bg-pulse p-3 text-white"}
            >
              <p className="text-xs uppercase tracking-[0.16em] text-white/55">{message.side}</p>
              <p className="mt-1 text-sm font-semibold">{message.text}</p>
            </motion.div>
          ))}
          <div className="flex gap-1 rounded-md bg-white/8 p-3">
            <span className="h-2 w-2 animate-bounce rounded-full bg-white/70" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:120ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:240ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

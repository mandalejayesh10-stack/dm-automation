import OpenAI from "openai";
import { env } from "../config/env.js";

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

export type ReplyContext = {
  brandName: string;
  channel: "instagram" | "facebook";
  userMessage: string;
  leadName?: string;
  offer?: string;
};

export async function generateAiReply(context: ReplyContext) {
  if (!client) {
    return {
      mode: "mock",
      text: `Hey${context.leadName ? ` ${context.leadName}` : ""}! Thanks for reaching out. I can help with that and send the details here.`
    };
  }

  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    instructions:
      "You are an expert social media DM assistant for a premium brand. Keep replies concise, friendly, compliant, and conversion-focused. Never promise platform actions that were not requested.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              task: "Draft one DM reply",
              brand: context.brandName,
              channel: context.channel,
              leadName: context.leadName,
              offer: context.offer,
              incomingMessage: context.userMessage
            })
          }
        ]
      }
    ]
  });

  return {
    mode: "openai",
    model: env.OPENAI_MODEL,
    text: response.output_text
  };
}

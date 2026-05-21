import { env } from "../config/env.js";

export type MetaMessageRequest = {
  accessToken: string;
  provider: string;
  pageId: string;
  instagramBusinessId?: string | null;
  recipientId: string;
  commentId?: string | null;
  text: string;
  metadata?: Record<string, unknown>;
  quickReplies?: Array<{ title: string; payload: string }>;
  buttons?: Array<{ title: string; payload: string }>;
};

export async function sendMetaDirectMessage(request: MetaMessageRequest) {
  const isPrivateReply = Boolean(request.commentId);
  // Meta private replies to comments are sent via the connected Page messages endpoint
  // with a recipient object that contains the comment_id.
  const targetId = isPrivateReply ? request.pageId : request.provider === "instagram" && request.instagramBusinessId ? request.instagramBusinessId : request.pageId;
  const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${targetId}/messages`);
  url.searchParams.set("access_token", request.accessToken);

  const message: Record<string, unknown> = { text: request.text };
  if (request.quickReplies?.length) {
    message.quick_replies = request.quickReplies.map((reply) => ({
      content_type: "text",
      title: reply.title,
      payload: reply.payload
    }));
  }
  if (request.buttons?.length) {
    message.attachment = {
      type: "template",
      payload: {
        template_type: "button",
        text: request.text,
        buttons: request.buttons.map((button) => ({
          type: "postback",
          title: button.title,
          payload: button.payload
        }))
      }
    };
  }

  const body = new URLSearchParams();
  body.set("recipient", JSON.stringify(isPrivateReply ? { comment_id: request.commentId } : { id: request.recipientId }));
  body.set("messaging_type", "RESPONSE");
  body.set("message", JSON.stringify(message));
  body.set("metadata", JSON.stringify(request.metadata ?? {}));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Meta message send failed: ${response.status} ${payload}`);
  }

  return response.json() as Promise<{ recipient_id?: string; message_id?: string }>;
}

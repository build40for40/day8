export interface InboundMessage {
  channelMessageId: string;
  from: string;
  kind: "text" | "other";
  text: string;
  sentAt: string;
}

export interface Channel {
  send(to: string, text: string): Promise<void>;
}

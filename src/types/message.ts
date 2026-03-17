export type MessageType = "sms" | "email";

export type MessageJobName = "send";

export interface MessageJob {
  id: string;
  type: MessageType;
  to: string;
  subject?: string;
  content: string;
}

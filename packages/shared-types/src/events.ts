export type OverlayEventType =
  | "chat"
  | "subscriber"
  | "superchat"
  | "supersticker"
  | "member-milestone"
  | "membership-gift"
  | "membership-gift-received"
  | "poll"
  | "chat-moderation"
  | "chat-mode";

export interface OverlayEventBase {
  id: string;
  type: OverlayEventType;
  occurredAt: string;
  author: string;
  /** Relay-internal provider identity; must be replaced before browser broadcast. */
  authorId?: string;
  avatarUrl?: string;
  /** Official authorDetails role flags; absent when the provider omits them. */
  isOwner?: boolean;
  isModerator?: boolean;
  isMember?: boolean;
  isVerified?: boolean;
}

export interface ChatEvent extends OverlayEventBase {
  type: "chat";
  message: string;
}

export interface SubscriberEvent extends OverlayEventBase {
  type: "subscriber";
  message?: string;
}

export interface SuperChatEvent extends OverlayEventBase {
  type: "superchat";
  amount: string;
  currency: string;
  amountMicros?: number;
  message: string;
}

export interface SuperStickerEvent extends OverlayEventBase {
  type: "supersticker";
  amount: string;
  currency: string;
  amountMicros?: number;
  stickerAltText?: string;
  stickerId?: string;
}

export interface MemberMilestoneEvent extends OverlayEventBase {
  type: "member-milestone";
  memberMonths: number;
  message?: string;
}

export interface MembershipGiftEvent extends OverlayEventBase {
  type: "membership-gift";
  membershipCount: number;
  levelName?: string;
}

export interface MembershipGiftReceivedEvent extends OverlayEventBase {
  type: "membership-gift-received";
  recipientCount: number;
  levelName?: string;
}
/** Mirrors snippet.pollDetails.metadata.options: option text plus its official vote tally. */
export interface PollChoice {
  text: string;
  tally?: number;
}

export interface PollEvent extends OverlayEventBase {
  type: "poll";
  pollStatus: "active" | "ended";
  question: string;
  choices: PollChoice[];
}

export interface ChatModerationEvent extends OverlayEventBase {
  type: "chat-moderation";
  moderationAction: "deleted" | "banned" | "ended";
  targetMessageId?: string;
  bannedAuthorId?: string;
}

export interface ChatModeEvent extends OverlayEventBase {
  type: "chat-mode";
  chatMode: "members-only" | "subscribers-only" | "unknown";
  enabled: boolean;
}

export type OverlayEvent =
  | ChatEvent
  | SubscriberEvent
  | SuperChatEvent
  | SuperStickerEvent
  | MemberMilestoneEvent
  | MembershipGiftEvent
  | MembershipGiftReceivedEvent
  | PollEvent
  | ChatModerationEvent
  | ChatModeEvent;

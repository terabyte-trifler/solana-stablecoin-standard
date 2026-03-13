// tui/src/components/EventFeed.tsx

import React from "react";
import { Box, Text } from "ink";

interface Props {
  events: Array<{ name: string; data: Record<string, unknown>; time: string }>;
}

const EVENT_COLORS: Record<string, string> = {
  TokensMinted: "green",
  TokensBurned: "red",
  AccountFrozen: "blue",
  AccountThawed: "cyan",
  StablecoinPaused: "yellow",
  StablecoinUnpaused: "green",
  AddressBlacklisted: "magenta",
  AddressRemovedFromBlacklist: "cyan",
  TokensSeized: "red",
  MinterAdded: "green",
  MinterRemoved: "yellow",
  RoleGranted: "cyan",
  RoleRevoked: "yellow",
  AuthorityTransferProposed: "yellow",
  AuthorityTransferAccepted: "green",
};

const EVENT_ICONS: Record<string, string> = {
  TokensMinted: "💰",
  TokensBurned: "🔥",
  AccountFrozen: "🧊",
  AccountThawed: "☀️",
  StablecoinPaused: "⏸️",
  StablecoinUnpaused: "▶️",
  AddressBlacklisted: "🚫",
  AddressRemovedFromBlacklist: "✅",
  TokensSeized: "⚡",
  MinterAdded: "➕",
  MinterRemoved: "➖",
};

function summarize(name: string, data: Record<string, unknown>): string {
  switch (name) {
    case "TokensMinted":
      return `${data.amount} → ${shortVal(data.recipient)}`;
    case "TokensBurned":
      return `${data.amount} by ${shortVal(data.burner)}`;
    case "AccountFrozen":
      return `${shortVal(data.tokenAccount)} by ${shortVal(data.frozenBy)}`;
    case "AddressBlacklisted":
      return `${shortVal(data.address)} — ${data.reason}`;
    case "TokensSeized":
      return `${data.amount} from ${shortVal(data.fromOwner)}`;
    default:
      return Object.values(data).slice(0, 2).map(shortVal).join(", ");
  }
}

function shortVal(v: unknown): string {
  const s = String(v);
  return s.length > 16 ? s.slice(0, 8) + "..." + s.slice(-4) : s;
}

export const EventFeed: React.FC<Props> = ({ events }) => (
  <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={2} paddingY={1}>
    <Text bold color="gray">RECENT EVENTS ({events.length})</Text>

    {events.length === 0 ? (
      <Box marginTop={1}>
        <Text color="gray">No events indexed yet. Waiting for on-chain activity...</Text>
      </Box>
    ) : (
      <Box flexDirection="column" marginTop={1}>
        {events.slice(0, 15).map((event, i) => (
          <Box key={i} gap={1}>
            <Text color="gray" dimColor>{event.time}</Text>
            <Text>{EVENT_ICONS[event.name] || "📋"}</Text>
            <Text color={EVENT_COLORS[event.name] || "white"} bold>
              {event.name.replace(/([A-Z])/g, " $1").trim()}
            </Text>
            <Text color="gray">{summarize(event.name, event.data)}</Text>
          </Box>
        ))}
      </Box>
    )}
  </Box>
);

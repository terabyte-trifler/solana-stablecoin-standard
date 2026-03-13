// tui/src/components/Header.tsx

import React from "react";
import { Box, Text } from "ink";
import { StablecoinConfigAccount } from "@stbr/sss-token";

interface HeaderProps {
  config: StablecoinConfigAccount;
  isCompliant: boolean;
  lastRefresh: Date | null;
}

export const Header: React.FC<HeaderProps> = ({ config, isCompliant, lastRefresh }) => {
  const presetBadge = isCompliant ? "SSS-2 COMPLIANT" : "SSS-1 MINIMAL";
  const presetColor = isCompliant ? "green" : "blue";
  const pauseBadge = config.isPaused ? " PAUSED " : "";

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={2} paddingY={0}>
      <Box justifyContent="space-between">
        <Box gap={2}>
          <Text bold color="white">
            {config.name} ({config.symbol})
          </Text>
          <Text color={presetColor} bold>
            [{presetBadge}]
          </Text>
          {config.isPaused && (
            <Text color="red" bold inverse>
              {pauseBadge}
            </Text>
          )}
        </Box>
        <Text color="gray">
          {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : "Loading..."}
        </Text>
      </Box>
      <Box gap={2}>
        <Text color="gray">Mint: {config.mint.toBase58().slice(0, 24)}...</Text>
        <Text color="gray">Decimals: {config.decimals}</Text>
        <Text color="gray">Authority: {config.masterAuthority.toBase58().slice(0, 12)}...</Text>
      </Box>
    </Box>
  );
};

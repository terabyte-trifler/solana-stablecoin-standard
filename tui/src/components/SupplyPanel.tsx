// tui/src/components/SupplyPanel.tsx

import React from "react";
import { Box, Text } from "ink";
import { StablecoinConfigAccount } from "@stbr/sss-token";
import BN from "bn.js";

interface Props {
  config: StablecoinConfigAccount;
}

function formatSupply(amount: BN, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals) || "0";
  const frac = str.slice(str.length - decimals, str.length - decimals + 2);
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac === "00" ? withCommas : `${withCommas}.${frac}`;
}

export const SupplyPanel: React.FC<Props> = ({ config }) => {
  const supply = formatSupply(config.totalSupply, config.decimals);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={2} paddingY={1} width="50%">
      <Text color="gray" bold>TOTAL SUPPLY</Text>
      <Box marginTop={1}>
        <Text color="green" bold>
          {supply}
        </Text>
        <Text color="gray"> {config.symbol}</Text>
      </Box>
      <Box marginTop={1} gap={2}>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Features</Text>
          <Text>
            {config.enablePermanentDelegate ? "🔒" : "  "} Permanent Delegate
          </Text>
          <Text>
            {config.enableTransferHook ? "🪝" : "  "} Transfer Hook
          </Text>
          <Text>
            {config.defaultAccountFrozen ? "🧊" : "  "} Default Frozen
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

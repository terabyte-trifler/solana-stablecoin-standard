// tui/src/components/HoldersPanel.tsx

import React from "react";
import { Box, Text } from "ink";
import { HolderInfo } from "@stbr/sss-token";
import BN from "bn.js";

interface Props {
  holders: HolderInfo[];
  decimals: number;
}

function fmtBalance(amount: BN, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals) || "0";
  const frac = str.slice(str.length - decimals, str.length - decimals + 2);
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac === "00" ? withCommas : `${withCommas}.${frac}`;
}

function shortKey(key: any): string {
  const s = key.toBase58 ? key.toBase58() : String(key);
  return s.slice(0, 8) + "..." + s.slice(-4);
}

export const HoldersPanel: React.FC<Props> = ({ holders, decimals }) => {
  const sorted = [...holders].sort((a, b) => (b.balance.gt(a.balance) ? 1 : -1));
  const display = sorted.slice(0, 20);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={2} paddingY={1}>
      <Text bold color="green">TOKEN HOLDERS ({holders.length} total)</Text>

      {holders.length === 0 ? (
        <Text color="gray">No holders found</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Box width={4}><Text bold color="gray">#</Text></Box>
            <Box width={18}><Text bold color="gray">Owner</Text></Box>
            <Box width={18}><Text bold color="gray">Token Account</Text></Box>
            <Box width={20}><Text bold color="gray">Balance</Text></Box>
            <Box width={8}><Text bold color="gray">Status</Text></Box>
          </Box>
          {display.map((h, i) => (
            <Box key={i}>
              <Box width={4}><Text color="gray">{i + 1}</Text></Box>
              <Box width={18}><Text>{shortKey(h.owner)}</Text></Box>
              <Box width={18}><Text color="gray">{shortKey(h.tokenAccount)}</Text></Box>
              <Box width={20}><Text color="green">{fmtBalance(h.balance, decimals)}</Text></Box>
              <Box width={8}><Text color={h.isFrozen ? "red" : "gray"}>{h.isFrozen ? "FROZEN" : "ok"}</Text></Box>
            </Box>
          ))}
          {holders.length > 20 && (
            <Text color="gray" dimColor>... and {holders.length - 20} more</Text>
          )}
        </Box>
      )}
    </Box>
  );
};

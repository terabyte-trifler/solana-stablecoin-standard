// tui/src/components/RolesPanel.tsx

import React from "react";
import { Box, Text } from "ink";
import { RoleManagerAccount } from "@stbr/sss-token";
import BN from "bn.js";

interface Props {
  roles: RoleManagerAccount;
  isCompliant: boolean;
}

function shortKey(key: any): string {
  const str = key.toBase58 ? key.toBase58() : String(key);
  return str.slice(0, 8) + "..." + str.slice(-4);
}

function fmtQuota(q: BN): string {
  if (q.isZero()) return "unlimited";
  return q.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const RolesPanel: React.FC<Props> = ({ roles, isCompliant }) => (
  <Box flexDirection="column" gap={1}>
    {/* Minters */}
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Text bold color="cyan">MINTERS ({roles.minters.length})</Text>
      {roles.minters.length === 0 ? (
        <Text color="gray">No minters registered</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Box width={16}><Text bold color="gray">Address</Text></Box>
            <Box width={22}><Text bold color="gray">Quota/Epoch</Text></Box>
            <Box width={22}><Text bold color="gray">Minted</Text></Box>
            <Box width={10}><Text bold color="gray">Epoch</Text></Box>
          </Box>
          {roles.minters.map((m, i) => (
            <Box key={i}>
              <Box width={16}><Text>{shortKey(m.address)}</Text></Box>
              <Box width={22}><Text color="green">{fmtQuota(m.quota)}</Text></Box>
              <Box width={22}><Text color="yellow">{m.minted.toString()}</Text></Box>
              <Box width={10}><Text color="gray">{m.lastResetEpoch.toString()}</Text></Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>

    {/* Simple roles */}
    <Box gap={2}>
      <RoleList title="BURNERS" entries={roles.burners} color="blue" />
      <RoleList title="PAUSERS" entries={roles.pausers} color="yellow" />
      {isCompliant && <RoleList title="BLACKLISTERS" entries={roles.blacklisters} color="magenta" />}
      {isCompliant && <RoleList title="SEIZERS" entries={roles.seizers} color="red" />}
    </Box>
  </Box>
);

const RoleList: React.FC<{ title: string; entries: any[]; color: string }> = ({ title, entries, color }) => (
  <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={2} paddingY={1} minWidth={24}>
    <Text bold color={color}>{title} ({entries.length})</Text>
    {entries.length === 0 ? (
      <Text color="gray">None</Text>
    ) : (
      entries.map((addr, i) => (
        <Text key={i}>{shortKey(addr)}</Text>
      ))
    )}
  </Box>
);

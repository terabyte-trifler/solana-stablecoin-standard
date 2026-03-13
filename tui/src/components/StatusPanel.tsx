// tui/src/components/StatusPanel.tsx

import React from "react";
import { Box, Text } from "ink";
import { StablecoinConfigAccount, RoleManagerAccount } from "@stbr/sss-token";

interface Props {
  config: StablecoinConfigAccount;
  roles: RoleManagerAccount;
  isCompliant: boolean;
}

export const StatusPanel: React.FC<Props> = ({ config, roles, isCompliant }) => (
  <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={2} paddingY={1} width="50%">
    <Text color="gray" bold>STATUS</Text>

    <Box marginTop={1} flexDirection="column">
      <Row label="State" value={config.isPaused ? "PAUSED" : "Active"} color={config.isPaused ? "red" : "green"} />
      <Row label="Preset" value={isCompliant ? "SSS-2" : "SSS-1"} color={isCompliant ? "green" : "blue"} />
      <Row
        label="Authority"
        value={config.masterAuthority.toBase58().slice(0, 16) + "..."}
        color="white"
      />
      <Row
        label="Pending Transfer"
        value={config.pendingMasterAuthority ? config.pendingMasterAuthority.toBase58().slice(0, 12) + "..." : "None"}
        color={config.pendingMasterAuthority ? "yellow" : "gray"}
      />
    </Box>

    <Box marginTop={1} flexDirection="column">
      <Text color="gray" bold dimColor>ROLES</Text>
      <Row label="Minters" value={`${roles.minters.length}`} color="cyan" />
      <Row label="Burners" value={`${roles.burners.length}`} color="cyan" />
      <Row label="Pausers" value={`${roles.pausers.length}`} color="cyan" />
      {isCompliant && (
        <>
          <Row label="Blacklisters" value={`${roles.blacklisters.length}`} color="magenta" />
          <Row label="Seizers" value={`${roles.seizers.length}`} color="magenta" />
        </>
      )}
    </Box>
  </Box>
);

const Row: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <Box>
    <Box width={20}>
      <Text color="gray">{label}</Text>
    </Box>
    <Text color={color}>{value}</Text>
  </Box>
);

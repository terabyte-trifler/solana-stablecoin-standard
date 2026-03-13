// tui/src/components/HelpBar.tsx

import React from "react";
import { Box, Text } from "ink";

export const HelpBar: React.FC = () => (
  <Box marginTop={1} gap={2}>
    <Text color="gray" dimColor>[1] Overview</Text>
    <Text color="gray" dimColor>[2] Roles</Text>
    <Text color="gray" dimColor>[3] Holders</Text>
    <Text color="gray" dimColor>[4] Events</Text>
    <Text color="gray" dimColor>[r] Refresh</Text>
    <Text color="gray" dimColor>[q] Quit</Text>
    <Text color="gray" dimColor>Auto-refresh: 5s</Text>
  </Box>
);

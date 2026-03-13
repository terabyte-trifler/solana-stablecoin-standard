// tui/src/App.tsx

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Connection, PublicKey } from "@solana/web3.js";
import { SolanaStablecoin, StablecoinConfigAccount, RoleManagerAccount, HolderInfo } from "@stbr/sss-token";
import { Header } from "./components/Header.js";
import { SupplyPanel } from "./components/SupplyPanel.js";
import { StatusPanel } from "./components/StatusPanel.js";
import { RolesPanel } from "./components/RolesPanel.js";
import { EventFeed } from "./components/EventFeed.js";
import { HoldersPanel } from "./components/HoldersPanel.js";
import { HelpBar } from "./components/HelpBar.js";

interface AppProps {
  configPda: string;
  rpcUrl: string;
}

export type Tab = "overview" | "roles" | "holders" | "events";

export interface AppState {
  config: StablecoinConfigAccount | null;
  roles: RoleManagerAccount | null;
  holders: HolderInfo[];
  events: Array<{ name: string; data: Record<string, unknown>; time: string }>;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

export const App: React.FC<AppProps> = ({ configPda, rpcUrl }) => {
  const { exit } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  const [stable, setStable] = useState<SolanaStablecoin | null>(null);
  const [state, setState] = useState<AppState>({
    config: null,
    roles: null,
    holders: [],
    events: [],
    loading: true,
    error: null,
    lastRefresh: null,
  });

  // ── Initialize connection ──────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const connection = new Connection(rpcUrl, "confirmed");
        const pda = new PublicKey(configPda);
        const instance = await SolanaStablecoin.load(connection, pda);
        setStable(instance);
      } catch (err: any) {
        setState((s) => ({ ...s, error: `Connection failed: ${err.message}`, loading: false }));
      }
    };
    init();
  }, [configPda, rpcUrl]);

  // ── Poll chain data ────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!stable) return;
    try {
      const [config, roles, holders] = await Promise.all([
        stable.getConfig(),
        stable.getRoles(),
        stable.getHolders(),
      ]);

      // Fetch recent events if compliant
      let events: AppState["events"] = [];
      if (stable.isCompliant) {
        try {
          const auditEvents = await stable.compliance.getAuditLog({ limit: 20 });
          events = auditEvents.map((e) => ({
            name: e.name,
            data: e.data as Record<string, unknown>,
            time: e.blockTime ? new Date(e.blockTime * 1000).toISOString().slice(11, 19) : "??:??:??",
          }));
        } catch {}
      }

      setState({
        config,
        roles,
        holders,
        events,
        loading: false,
        error: null,
        lastRefresh: new Date(),
      });
    } catch (err: any) {
      setState((s) => ({ ...s, error: err.message, loading: false }));
    }
  }, [stable]);

  useEffect(() => {
    if (stable) {
      refresh();
      const interval = setInterval(refresh, 5000);
      return () => clearInterval(interval);
    }
  }, [stable, refresh]);

  // ── Keyboard navigation ────────────────────────────────────
  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) exit();
    if (input === "1") setTab("overview");
    if (input === "2") setTab("roles");
    if (input === "3") setTab("holders");
    if (input === "4") setTab("events");
    if (input === "r") refresh();
  });

  // ── Loading state ──────────────────────────────────────────
  if (state.loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">Connecting to {rpcUrl}...</Text>
        <Text color="gray">Config: {configPda.slice(0, 20)}...</Text>
      </Box>
    );
  }

  if (state.error && !state.config) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {state.error}</Text>
        <Text color="gray">Press q to exit</Text>
      </Box>
    );
  }

  // ── Main layout ────────────────────────────────────────────
  return (
    <Box flexDirection="column" width="100%">
      <Header
        config={state.config!}
        isCompliant={stable?.isCompliant ?? false}
        lastRefresh={state.lastRefresh}
      />

      {/* Tab bar */}
      <Box marginTop={1} marginBottom={1} gap={2}>
        <TabButton label="Overview" num="1" active={tab === "overview"} />
        <TabButton label="Roles" num="2" active={tab === "roles"} />
        <TabButton label="Holders" num="3" active={tab === "holders"} />
        <TabButton label="Events" num="4" active={tab === "events"} />
      </Box>

      {/* Active panel */}
      <Box flexDirection="column" minHeight={15}>
        {tab === "overview" && (
          <Box gap={2}>
            <SupplyPanel config={state.config!} />
            <StatusPanel config={state.config!} roles={state.roles!} isCompliant={stable?.isCompliant ?? false} />
          </Box>
        )}
        {tab === "roles" && <RolesPanel roles={state.roles!} isCompliant={stable?.isCompliant ?? false} />}
        {tab === "holders" && <HoldersPanel holders={state.holders} decimals={state.config?.decimals ?? 6} />}
        {tab === "events" && <EventFeed events={state.events} />}
      </Box>

      {state.error && (
        <Box marginTop={1}>
          <Text color="yellow">Warning: {state.error}</Text>
        </Box>
      )}

      <HelpBar />
    </Box>
  );
};

const TabButton: React.FC<{ label: string; num: string; active: boolean }> = ({ label, num, active }) => (
  <Text color={active ? "cyan" : "gray"} bold={active}>
    [{num}] {label}
  </Text>
);

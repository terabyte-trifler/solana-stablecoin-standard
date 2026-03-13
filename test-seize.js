// Quick test to see what accounts are being passed
const { Connection, PublicKey } = require("@solana/web3.js");
const { resolveTransferHookAccounts } = require("./sdk/dist/src/pda");

async function test() {
  const connection = new Connection("http://localhost:8899", "confirmed");
  const mint = new PublicKey("FK9ZkyWCVUTLeDFq76p77KqTwS3RcNeBxoCifuVoPKob");
  const source = new PublicKey("3FsCMGg51ZRNq95xGQ7CpRsnrZ4RisXUqkM4nMCce43E");
  const dest = new PublicKey("ASjqDJXwtzo3UrhW5VvUZ1iphS76j5VGgqTH9gMqn8CP");
  const config = new PublicKey("2vtwCs3FEDLBmP9BZ34TzskvxGf7s2Zon9hPaVvvWqms");

  console.log("Resolving hook accounts...");
  const accounts = await resolveTransferHookAccounts(connection, mint, source, dest, config);
  
  console.log("\nHook accounts:");
  accounts.forEach((acc, i) => {
    console.log(`  [${i}] ${acc.pubkey.toBase58()} (signer: ${acc.isSigner}, writable: ${acc.isWritable})`);
  });
}

test().catch(console.error);

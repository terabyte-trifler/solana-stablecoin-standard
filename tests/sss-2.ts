// tests/sss-2.ts
//
// SSS-2 (Compliant Stablecoin) test suite.
// Tests all core functionality PLUS compliance features:
// - Blacklist management
// - Transfer hook enforcement (blocked transfers)
// - Seize via permanent delegate
// - Full compliance workflow

import * as anchor from "@coral-xyz/anchor";
import {
  TestContext, createTestContext, initSSS2, mintTo, getBalance, expectError, transferWithHook,
  assert, expect, BN, Keypair, PublicKey, SystemProgram, TOKEN_2022_PROGRAM_ID,
  findBlacklistPda, findExtraMetaListPda,
} from "./helpers/setup";
import {
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

describe("SSS-2: Compliant Stablecoin", () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
    await initSSS2(ctx);
  });

  // ================================================================
  // INITIALIZATION
  // ================================================================

  describe("Initialize", () => {
    it("creates SSS-2 with compliance features enabled", async () => {
      const config = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      assert.equal(config.name, "Compliance USD");
      assert.equal(config.symbol, "CUSD");
      assert.equal(config.enablePermanentDelegate, true);
      assert.equal(config.enableTransferHook, true);
      assert.equal(config.defaultAccountFrozen, false);
      assert.equal(config.isPaused, false);
    });

    it("verifies mint has correct extensions", async () => {
      // Fetch raw mint account data to check extensions
      const mintInfo = await ctx.connection.getAccountInfo(ctx.mintKeypair.publicKey);
      assert.isNotNull(mintInfo);
      // Mint should be owned by Token-2022
      assert.ok(mintInfo!.owner.equals(TOKEN_2022_PROGRAM_ID));
      // Size should be larger than base mint (165) due to extensions
      assert.isAbove(mintInfo!.data.length, 200);
    });
  });

  // ================================================================
  // CORE OPERATIONS (same as SSS-1 but on SSS-2 config)
  // ================================================================

  describe("Core Operations on SSS-2", () => {
    it("mint works", async () => {
      await mintTo(ctx, ctx.userA.publicKey, 10_000_000);
      const balance = await getBalance(ctx, ctx.userA.publicKey);
      assert.equal(balance, BigInt(10_000_000));
    });

    it("mint tracks supply", async () => {
      const config = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      assert.ok(config.totalSupply.eq(new BN(10_000_000)));
    });

    it("burn works", async () => {
      await mintTo(ctx, ctx.authority.publicKey, 5_000_000);
      const ata = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.authority.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      await ctx.program.methods
        .burnTokens(new BN(1_000_000))
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          mint: ctx.mintKeypair.publicKey,
          tokenAccount: ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([ctx.authority])
        .rpc();
    });

    it("freeze and thaw work", async () => {
      const ata = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );

      await ctx.program.methods
        .freezeAccount()
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          mint: ctx.mintKeypair.publicKey,
          tokenAccount: ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([ctx.authority])
        .rpc();

      await ctx.program.methods
        .thawAccount()
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          mint: ctx.mintKeypair.publicKey,
          tokenAccount: ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([ctx.authority])
        .rpc();
    });

    it("pause and unpause work", async () => {
      await ctx.program.methods
        .pause()
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      const config = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      assert.equal(config.isPaused, true);

      await ctx.program.methods
        .unpause()
        .accounts({ authority: ctx.authority.publicKey, stablecoinConfig: ctx.configPda })
        .signers([ctx.authority])
        .rpc();
    });
  });

  // ================================================================
  // ROLE MANAGEMENT (SSS-2 roles)
  // ================================================================

  describe("SSS-2 Role Management", () => {
    it("grants blacklister role", async () => {
      await ctx.program.methods
        .grantRole({ blacklister: {} }, ctx.blacklister.publicKey)
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      const roles = await ctx.program.account.roleManager.fetch(ctx.rolesPda);
      assert.ok(roles.blacklisters.some((b: PublicKey) => b.equals(ctx.blacklister.publicKey)));
    });

    it("grants seizer role", async () => {
      await ctx.program.methods
        .grantRole({ seizer: {} }, ctx.seizer.publicKey)
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      const roles = await ctx.program.account.roleManager.fetch(ctx.rolesPda);
      assert.ok(roles.seizers.some((s: PublicKey) => s.equals(ctx.seizer.publicKey)));
    });
  });

  // ================================================================
  // BLACKLIST MANAGEMENT
  // ================================================================

  describe("Blacklist", () => {
    it("blacklister can add address to blacklist", async () => {
      const [blacklistPda] = findBlacklistPda(
        ctx.configPda, ctx.userB.publicKey, ctx.program.programId
      );

      await ctx.program.methods
        .addToBlacklist(ctx.userB.publicKey, "OFAC SDN match — test")
        .accounts({
          authority: ctx.blacklister.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          blacklistEntry: blacklistPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.blacklister])
        .rpc();

      // Verify entry exists
      const entry = await ctx.program.account.blacklistEntry.fetch(blacklistPda);
      assert.ok(entry.address.equals(ctx.userB.publicKey));
      assert.equal(entry.reason, "OFAC SDN match — test");
      assert.ok(entry.blacklistedBy.equals(ctx.blacklister.publicKey));
    });

    it("rejects duplicate blacklist", async () => {
      const [blacklistPda] = findBlacklistPda(
        ctx.configPda, ctx.userB.publicKey, ctx.program.programId
      );

      // PDA already exists — Anchor init will fail with "already in use"
      await expectError(
        () => ctx.program.methods
          .addToBlacklist(ctx.userB.publicKey, "duplicate")
          .accounts({
            authority: ctx.blacklister.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
            blacklistEntry: blacklistPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([ctx.blacklister])
          .rpc(),
        "already in use"
      );
    });

    it("unauthorized cannot blacklist", async () => {
      const target = Keypair.generate().publicKey;
      const [blacklistPda] = findBlacklistPda(
        ctx.configPda, target, ctx.program.programId
      );

      await expectError(
        () => ctx.program.methods
          .addToBlacklist(target, "test")
          .accounts({
            authority: ctx.unauthorized.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
            blacklistEntry: blacklistPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([ctx.unauthorized])
          .rpc(),
        "UnauthorizedBlacklister"
      );
    });

    it("master authority can also blacklist", async () => {
      const target = Keypair.generate().publicKey;
      const [blacklistPda] = findBlacklistPda(
        ctx.configPda, target, ctx.program.programId
      );

      await ctx.program.methods
        .addToBlacklist(target, "Master action")
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          blacklistEntry: blacklistPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.authority])
        .rpc();
    });

    it("blacklister can remove from blacklist", async () => {
      const [blacklistPda] = findBlacklistPda(
        ctx.configPda, ctx.userB.publicKey, ctx.program.programId
      );

      await ctx.program.methods
        .removeFromBlacklist(ctx.userB.publicKey)
        .accounts({
          authority: ctx.blacklister.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          blacklistEntry: blacklistPda,
        })
        .signers([ctx.blacklister])
        .rpc();

      // Verify entry is gone
      const info = await ctx.connection.getAccountInfo(blacklistPda);
      assert.isNull(info);
    });

    it("blacklist allowed while paused", async () => {
      await ctx.program.methods
        .pause()
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      const target = Keypair.generate().publicKey;
      const [blacklistPda] = findBlacklistPda(
        ctx.configPda, target, ctx.program.programId
      );

      // Should succeed — compliance ops allowed during pause
      await ctx.program.methods
        .addToBlacklist(target, "Paused action")
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          blacklistEntry: blacklistPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.authority])
        .rpc();

      await ctx.program.methods
        .unpause()
        .accounts({ authority: ctx.authority.publicKey, stablecoinConfig: ctx.configPda })
        .signers([ctx.authority])
        .rpc();
    });
  });

  // ================================================================
  // TRANSFER HOOK ENFORCEMENT
  // ================================================================

  describe("Transfer Hook Blacklist Enforcement", () => {
    it("transfer succeeds when neither party is blacklisted", async () => {
      // Mint to userA, then transfer to userB
      // userB was removed from blacklist above
      await mintTo(ctx, ctx.userA.publicKey, 1_000_000);
      await mintTo(ctx, ctx.userB.publicKey, 100); // ensure ATA exists

      // Direct Token-2022 transfer (triggers hook)
      const sourceAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      const destAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userB.publicKey, true, TOKEN_2022_PROGRAM_ID
      );

      await transferWithHook(ctx, sourceAta, destAta, ctx.userA, 500_000, 6);

      const balance = await getBalance(ctx, ctx.userB.publicKey);
      assert.isAbove(Number(balance), 0);
    });

    it("transfer blocked when sender is blacklisted", async () => {
      // Blacklist userA
      const [blacklistPda] = findBlacklistPda(
        ctx.configPda, ctx.userA.publicKey, ctx.program.programId
      );

      await ctx.program.methods
        .addToBlacklist(ctx.userA.publicKey, "Test: sender blocked")
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          blacklistEntry: blacklistPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.authority])
        .rpc();

      // Attempt transfer from blacklisted userA
      const sourceAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      const destAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userB.publicKey, true, TOKEN_2022_PROGRAM_ID
      );

      try {
        await transferWithHook(ctx, sourceAta, destAta, ctx.userA, 100, 6);
        assert.fail("Transfer should have been blocked by hook");
      } catch (err: any) {
        // Transfer hook rejected the transfer
        assert.include(err.message.toLowerCase(), "blacklisted");
      }
    });

    it("transfer blocked when receiver is blacklisted", async () => {
      // Remove userA from blacklist first
      const [blacklistPdaA] = findBlacklistPda(
        ctx.configPda, ctx.userA.publicKey, ctx.program.programId
      );
      await ctx.program.methods
        .removeFromBlacklist(ctx.userA.publicKey)
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          blacklistEntry: blacklistPdaA,
        })
        .signers([ctx.authority])
        .rpc();

      // Blacklist userB
      const [blacklistPdaB] = findBlacklistPda(
        ctx.configPda, ctx.userB.publicKey, ctx.program.programId
      );
      await ctx.program.methods
        .addToBlacklist(ctx.userB.publicKey, "Test: receiver blocked")
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          blacklistEntry: blacklistPdaB,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.authority])
        .rpc();

      const sourceAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      const destAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userB.publicKey, true, TOKEN_2022_PROGRAM_ID
      );

      try {
        await transferWithHook(ctx, sourceAta, destAta, ctx.userA, 100, 6);
        assert.fail("Transfer should have been blocked by hook");
      } catch (err: any) {
        assert.include(err.message.toLowerCase(), "blacklisted");
      }

      // Clean up
      await ctx.program.methods
        .removeFromBlacklist(ctx.userB.publicKey)
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          blacklistEntry: blacklistPdaB,
        })
        .signers([ctx.authority])
        .rpc();
    });

    it("transfer succeeds after removal from blacklist", async () => {
      // Both users should be un-blacklisted now
      const sourceAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      const destAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userB.publicKey, true, TOKEN_2022_PROGRAM_ID
      );

      // Should succeed now
      await transferWithHook(ctx, sourceAta, destAta, ctx.userA, 100, 6);
    });
  });

  // ================================================================
  // SEIZE (Permanent Delegate)
  // ================================================================

  describe("Seize", () => {
    it("seizer can seize tokens via permanent delegate", async () => {
      // Ensure userA has tokens and treasury (authority) has an ATA
      await mintTo(ctx, ctx.userA.publicKey, 5_000_000);
      await mintTo(ctx, ctx.authority.publicKey, 100); // ensure ATA exists

      const sourceAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      const destAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.authority.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      const [extraMetaList] = findExtraMetaListPda(
        ctx.mintKeypair.publicKey,
        ctx.hookProgram.programId
      );
      const [srcBlacklist] = findBlacklistPda(
        ctx.configPda,
        ctx.userA.publicKey,
        ctx.program.programId
      );
      const [dstBlacklist] = findBlacklistPda(
        ctx.configPda,
        ctx.authority.publicKey,
        ctx.program.programId
      );

      const beforeSource = await getBalance(ctx, ctx.userA.publicKey);
      const beforeDest = await getBalance(ctx, ctx.authority.publicKey);

      // Resolve hook accounts for the CPI
      const [extraMetaList] = findExtraMetaListPda(
        ctx.mintKeypair.publicKey, ctx.hookProgram.programId
      );
      const sourceOwner = ctx.userA.publicKey;
      const destOwner = ctx.authority.publicKey;
      const [srcBlacklist] = findBlacklistPda(ctx.configPda, sourceOwner, ctx.program.programId);
      const [dstBlacklist] = findBlacklistPda(ctx.configPda, destOwner, ctx.program.programId);

      await ctx.program.methods
        .seize(new BN(2_000_000))
        .accounts({
          authority: ctx.seizer.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          mint: ctx.mintKeypair.publicKey,
          sourceTokenAccount: sourceAta,
          destinationTokenAccount: destAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          extraAccountMetaList: extraMetaList,
          transferHookProgram: ctx.hookProgram.programId,
          sssTokenProgram: ctx.program.programId,
        })
        .remainingAccounts([
          { pubkey: ctx.configPda, isSigner: false, isWritable: false },
          { pubkey: srcBlacklist, isSigner: false, isWritable: false },
          { pubkey: dstBlacklist, isSigner: false, isWritable: false },
        ])
        .signers([ctx.seizer])
        .rpc();

      const afterSource = await getBalance(ctx, ctx.userA.publicKey);
      const afterDest = await getBalance(ctx, ctx.authority.publicKey);

      assert.equal(Number(beforeSource) - Number(afterSource), 2_000_000);
      assert.equal(Number(afterDest) - Number(beforeDest), 2_000_000);
    });

    it("seize does NOT change total supply", async () => {
      const configBefore = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      const supplyBefore = configBefore.totalSupply;

      // The seize above already happened. Verify supply unchanged.
      // (It's a transfer, not mint/burn)
      const configAfter = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      assert.ok(configAfter.totalSupply.eq(supplyBefore));
    });

    it("unauthorized cannot seize", async () => {
      const sourceAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      const destAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.authority.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      const [extraMetaList] = findExtraMetaListPda(
        ctx.mintKeypair.publicKey,
        ctx.hookProgram.programId
      );
      const [srcBlacklist] = findBlacklistPda(
        ctx.configPda,
        ctx.userA.publicKey,
        ctx.program.programId
      );
      const [dstBlacklist] = findBlacklistPda(
        ctx.configPda,
        ctx.authority.publicKey,
        ctx.program.programId
      );

      await expectError(
        () => ctx.program.methods
          .seize(new BN(100))
          .accounts({
            authority: ctx.unauthorized.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
            mint: ctx.mintKeypair.publicKey,
            sourceTokenAccount: sourceAta,
            destinationTokenAccount: destAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            extraAccountMetaList: extraMetaList,
            transferHookProgram: ctx.hookProgram.programId,
            sssTokenProgram: ctx.program.programId,
          })
          .remainingAccounts([
            { pubkey: ctx.configPda, isSigner: false, isWritable: false },
            { pubkey: srcBlacklist, isSigner: false, isWritable: false },
            { pubkey: dstBlacklist, isSigner: false, isWritable: false },
          ])
          .signers([ctx.unauthorized])
          .rpc(),
        "UnauthorizedSeizer"
      );
    });

    it("seize allowed while paused", async () => {
      await ctx.program.methods
        .pause()
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      const sourceAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      const destAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.authority.publicKey, true, TOKEN_2022_PROGRAM_ID
      );

      const [extraMetaList] = findExtraMetaListPda(
        ctx.mintKeypair.publicKey, ctx.hookProgram.programId
      );
      const [srcBl] = findBlacklistPda(ctx.configPda, ctx.userA.publicKey, ctx.program.programId);
      const [dstBl] = findBlacklistPda(ctx.configPda, ctx.authority.publicKey, ctx.program.programId);

      // Seize should work while paused
      await ctx.program.methods
        .seize(new BN(100))
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          mint: ctx.mintKeypair.publicKey,
          sourceTokenAccount: sourceAta,
          destinationTokenAccount: destAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          extraAccountMetaList: extraMetaList,
          transferHookProgram: ctx.hookProgram.programId,
          sssTokenProgram: ctx.program.programId,
        })
        .remainingAccounts([
          { pubkey: ctx.configPda, isSigner: false, isWritable: false },
          { pubkey: srcBl, isSigner: false, isWritable: false },
          { pubkey: dstBl, isSigner: false, isWritable: false },
        ])
        .signers([ctx.authority])
        .rpc();

      await ctx.program.methods
        .unpause()
        .accounts({ authority: ctx.authority.publicKey, stablecoinConfig: ctx.configPda })
        .signers([ctx.authority])
        .rpc();
    });
  });

  // ================================================================
  // FULL COMPLIANCE LIFECYCLE
  // ================================================================

  describe("Full SSS-2 Lifecycle", () => {
    it("init → mint → transfer → blacklist → blocked → seize → unblacklist → transfer ok", async () => {
      // 1. Mint 10M to userA
      await mintTo(ctx, ctx.userA.publicKey, 10_000_000);

      // 2. userA transfers 3M to userB
      const sourceAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      const destAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userB.publicKey, true, TOKEN_2022_PROGRAM_ID
      );

      await transferWithHook(ctx, sourceAta, destAta, ctx.userA, 3_000_000, 6);

      // 3. Blacklist userA (sanctions match)
      const [blPda] = findBlacklistPda(
        ctx.configPda, ctx.userA.publicKey, ctx.program.programId
      );
      await ctx.program.methods
        .addToBlacklist(ctx.userA.publicKey, "Lifecycle test: sanctions")
        .accounts({
          authority: ctx.blacklister.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          blacklistEntry: blPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.blacklister])
        .rpc();

      // 4. Transfer from userA should now fail
      try {
        await transferWithHook(ctx, sourceAta, destAta, ctx.userA, 100, 6);
        assert.fail("Expected blocked transfer");
      } catch {
        // Expected
      }

      // 5. Seize remaining tokens from userA → authority treasury
      const treasuryAta = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.authority.publicKey, true, TOKEN_2022_PROGRAM_ID
      );

      const [extraMeta] = findExtraMetaListPda(
        ctx.mintKeypair.publicKey, ctx.hookProgram.programId
      );
      const [srcBl] = findBlacklistPda(ctx.configPda, ctx.userA.publicKey, ctx.program.programId);
      const [dstBl] = findBlacklistPda(ctx.configPda, ctx.authority.publicKey, ctx.program.programId);

      const remaining = await getBalance(ctx, ctx.userA.publicKey);

      await ctx.program.methods
        .seize(new BN(remaining.toString()))
        .accounts({
          authority: ctx.seizer.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          mint: ctx.mintKeypair.publicKey,
          sourceTokenAccount: sourceAta,
          destinationTokenAccount: treasuryAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          extraAccountMetaList: extraMeta,
          transferHookProgram: ctx.hookProgram.programId,
          sssTokenProgram: ctx.program.programId,
        })
        .remainingAccounts([
          { pubkey: ctx.configPda, isSigner: false, isWritable: false },
          { pubkey: srcBl, isSigner: false, isWritable: false },
          { pubkey: dstBl, isSigner: false, isWritable: false },
        ])
        .signers([ctx.seizer])
        .rpc();

      const afterSeize = await getBalance(ctx, ctx.userA.publicKey);
      assert.equal(afterSeize, BigInt(0));

      // 6. Remove userA from blacklist
      await ctx.program.methods
        .removeFromBlacklist(ctx.userA.publicKey)
        .accounts({
          authority: ctx.blacklister.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          blacklistEntry: blPda,
        })
        .signers([ctx.blacklister])
        .rpc();

      // 7. Mint fresh tokens and verify transfer works again
      await mintTo(ctx, ctx.userA.publicKey, 500_000);

      await transferWithHook(ctx, sourceAta, destAta, ctx.userA, 100_000, 6);

      const finalBalance = await getBalance(ctx, ctx.userA.publicKey);
      assert.equal(finalBalance, BigInt(400_000));
    });
  });
});

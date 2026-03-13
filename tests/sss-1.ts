// tests/sss-1.ts
//
// SSS-1 (Minimal Stablecoin) test suite.
// Tests all core functionality without compliance features.

import {
  TestContext, createTestContext, initSSS1, mintTo, getBalance, expectError,
  assert, expect, BN, Keypair, PublicKey, SystemProgram, TOKEN_2022_PROGRAM_ID,
  findConfigPda, findExtraMetaListPda,
} from "./helpers/setup";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

describe("SSS-1: Minimal Stablecoin", () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  // ================================================================
  // INITIALIZATION
  // ================================================================

  describe("Initialize", () => {
    it("creates SSS-1 stablecoin with correct config", async () => {
      await initSSS1(ctx);

      const config = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      assert.equal(config.name, "Test USD");
      assert.equal(config.symbol, "TUSD");
      assert.equal(config.decimals, 6);
      assert.equal(config.enablePermanentDelegate, false);
      assert.equal(config.enableTransferHook, false);
      assert.equal(config.defaultAccountFrozen, false);
      assert.equal(config.isPaused, false);
      assert.ok(config.totalSupply.eq(new BN(0)));
      assert.ok(config.masterAuthority.equals(ctx.authority.publicKey));
      assert.equal(config.pendingMasterAuthority, null);
    });

    it("creates RoleManager with empty roles", async () => {
      const roles = await ctx.program.account.roleManager.fetch(ctx.rolesPda);
      assert.ok(roles.stablecoin.equals(ctx.configPda));
      assert.equal(roles.minters.length, 0);
      assert.equal(roles.burners.length, 0);
      assert.equal(roles.pausers.length, 0);
      assert.equal(roles.blacklisters.length, 0);
      assert.equal(roles.seizers.length, 0);
    });

    it("rejects empty name", async () => {
      const badMint = Keypair.generate();
      const [badConfig] = findConfigPda(badMint.publicKey, ctx.program.programId);

      await expectError(
        () => ctx.program.methods
          .initialize("", "X", "", 6, false, false, false)
          .accounts({
            payer: ctx.authority.publicKey,
            mint: badMint.publicKey,
            stablecoinConfig: badConfig,
            roleManager: PublicKey.findProgramAddressSync(
              [Buffer.from("roles"), badConfig.toBuffer()], ctx.program.programId
            )[0],
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.authority, badMint])
          .rpc(),
        "NameEmpty"
      );
    });

    it("rejects decimals > 9", async () => {
      const badMint = Keypair.generate();
      const [badConfig] = findConfigPda(badMint.publicKey, ctx.program.programId);

      await expectError(
        () => ctx.program.methods
          .initialize("X", "X", "", 10, false, false, false)
          .accounts({
            payer: ctx.authority.publicKey,
            mint: badMint.publicKey,
            stablecoinConfig: badConfig,
            roleManager: PublicKey.findProgramAddressSync(
              [Buffer.from("roles"), badConfig.toBuffer()], ctx.program.programId
            )[0],
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([ctx.authority, badMint])
          .rpc(),
        "InvalidDecimals"
      );
    });
  });

  // ================================================================
  // MINTING
  // ================================================================

  describe("Mint", () => {
    it("master authority can mint tokens", async () => {
      await mintTo(ctx, ctx.userA.publicKey, 1_000_000);

      const balance = await getBalance(ctx, ctx.userA.publicKey);
      assert.equal(balance, BigInt(1_000_000));

      const config = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      assert.ok(config.totalSupply.eq(new BN(1_000_000)));
    });

    it("registered minter can mint tokens", async () => {
      // Add minterA with 10M quota
      await ctx.program.methods
        .addMinter(ctx.minterA.publicKey, new BN(10_000_000))
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      await mintTo(ctx, ctx.userB.publicKey, 500_000, ctx.minterA);

      const balance = await getBalance(ctx, ctx.userB.publicKey);
      assert.equal(balance, BigInt(500_000));
    });

    it("rejects mint from unauthorized signer", async () => {
      await expectError(
        () => mintTo(ctx, ctx.userA.publicKey, 100, ctx.unauthorized),
        "UnauthorizedMinter"
      );
    });

    it("rejects zero amount", async () => {
      await expectError(
        () => mintTo(ctx, ctx.userA.publicKey, 0),
        "ZeroAmount"
      );
    });

    it("tracks total supply correctly across multiple mints", async () => {
      await mintTo(ctx, ctx.userA.publicKey, 2_000_000);

      const config = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      // 1M (first mint) + 500K (minter) + 2M = 3.5M
      assert.ok(config.totalSupply.eq(new BN(3_500_000)));
    });
  });

  // ================================================================
  // MINTER QUOTA ENFORCEMENT
  // ================================================================

  describe("Minter Quota", () => {
    it("enforces per-epoch quota", async () => {
      // minterA has 10M quota, already minted 500K
      // Mint up to the limit
      await mintTo(ctx, ctx.userA.publicKey, 9_500_000, ctx.minterA);

      // This should fail — exceeds quota
      await expectError(
        () => mintTo(ctx, ctx.userA.publicKey, 1, ctx.minterA),
        "MinterQuotaExceeded"
      );
    });

    it("master authority bypasses quota (unlimited)", async () => {
      // Master can always mint regardless of any quota
      await mintTo(ctx, ctx.userA.publicKey, 100_000_000);
      // No error means success
    });

    it("updates quota without resetting minted count", async () => {
      await ctx.program.methods
        .updateMinterQuota(ctx.minterA.publicKey, new BN(20_000_000))
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      // Can now mint more since quota increased
      await mintTo(ctx, ctx.userA.publicKey, 5_000_000, ctx.minterA);
    });
  });

  // ================================================================
  // BURNING
  // ================================================================

  describe("Burn", () => {
    it("master authority can burn tokens", async () => {
      // First mint some to authority's ATA
      await mintTo(ctx, ctx.authority.publicKey, 5_000_000);

      const beforeSupply = (await ctx.program.account.stablecoinConfig.fetch(ctx.configPda)).totalSupply;

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

      const afterSupply = (await ctx.program.account.stablecoinConfig.fetch(ctx.configPda)).totalSupply;
      assert.ok(afterSupply.eq(beforeSupply.sub(new BN(1_000_000))));
    });

    it("registered burner can burn own tokens", async () => {
      await ctx.program.methods
        .grantRole({ burner: {} }, ctx.burner.publicKey)
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      await mintTo(ctx, ctx.burner.publicKey, 1_000_000);

      const ata = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.burner.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      await ctx.program.methods
        .burnTokens(new BN(500_000))
        .accounts({
          authority: ctx.burner.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
          mint: ctx.mintKeypair.publicKey,
          tokenAccount: ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([ctx.burner])
        .rpc();

      const balance = await getBalance(ctx, ctx.burner.publicKey);
      assert.equal(balance, BigInt(500_000));
    });

    it("rejects burn from unauthorized signer", async () => {
      await mintTo(ctx, ctx.unauthorized.publicKey, 100);
      const ata = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.unauthorized.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      await expectError(
        () => ctx.program.methods
          .burnTokens(new BN(1))
          .accounts({
            authority: ctx.unauthorized.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
            mint: ctx.mintKeypair.publicKey,
            tokenAccount: ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([ctx.unauthorized])
          .rpc(),
        "UnauthorizedBurner"
      );
    });
  });

  // ================================================================
  // FREEZE / THAW
  // ================================================================

  describe("Freeze / Thaw", () => {
    it("master authority can freeze a token account", async () => {
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

      // Account should be frozen — transfer should fail
      // (Token-2022 enforces this, not our program)
    });

    it("master authority can thaw a frozen account", async () => {
      const ata = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
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

    it("rejects freeze from non-authority", async () => {
      const ata = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userA.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      await expectError(
        () => ctx.program.methods
          .freezeAccount()
          .accounts({
            authority: ctx.unauthorized.publicKey,
            stablecoinConfig: ctx.configPda,
            mint: ctx.mintKeypair.publicKey,
            tokenAccount: ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([ctx.unauthorized])
          .rpc(),
        "UnauthorizedAuthority"
      );
    });
  });

  // ================================================================
  // PAUSE / UNPAUSE
  // ================================================================

  describe("Pause / Unpause", () => {
    it("pauser can pause operations", async () => {
      await ctx.program.methods
        .grantRole({ pauser: {} }, ctx.pauser.publicKey)
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      await ctx.program.methods
        .pause()
        .accounts({
          authority: ctx.pauser.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.pauser])
        .rpc();

      const config = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      assert.equal(config.isPaused, true);
    });

    it("mint blocked while paused", async () => {
      await expectError(
        () => mintTo(ctx, ctx.userA.publicKey, 100),
        "StablecoinPaused"
      );
    });

    it("burn blocked while paused", async () => {
      const ata = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.authority.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      await expectError(
        () => ctx.program.methods
          .burnTokens(new BN(100))
          .accounts({
            authority: ctx.authority.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
            mint: ctx.mintKeypair.publicKey,
            tokenAccount: ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([ctx.authority])
          .rpc(),
        "StablecoinPaused"
      );
    });

    it("freeze ALLOWED while paused", async () => {
      const ata = getAssociatedTokenAddressSync(
        ctx.mintKeypair.publicKey, ctx.userB.publicKey, true, TOKEN_2022_PROGRAM_ID
      );
      // Should succeed — freeze is allowed during pause
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

      // Thaw it back
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

    it("role management ALLOWED while paused", async () => {
      // Should succeed — admin ops always work
      await ctx.program.methods
        .addMinter(ctx.minterB.publicKey, new BN(5_000_000))
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();
    });

    it("pauser CANNOT unpause", async () => {
      await expectError(
        () => ctx.program.methods
          .unpause()
          .accounts({
            authority: ctx.pauser.publicKey,
            stablecoinConfig: ctx.configPda,
          })
          .signers([ctx.pauser])
          .rpc(),
        "UnauthorizedAuthority"
      );
    });

    it("master authority can unpause", async () => {
      await ctx.program.methods
        .unpause()
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
        })
        .signers([ctx.authority])
        .rpc();

      const config = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      assert.equal(config.isPaused, false);
    });

    it("rejects pause when already paused", async () => {
      await ctx.program.methods
        .pause()
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      await expectError(
        () => ctx.program.methods
          .pause()
          .accounts({
            authority: ctx.authority.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
          })
          .signers([ctx.authority])
          .rpc(),
        "AlreadyPaused"
      );

      // Clean up
      await ctx.program.methods
        .unpause()
        .accounts({ authority: ctx.authority.publicKey, stablecoinConfig: ctx.configPda })
        .signers([ctx.authority])
        .rpc();
    });
  });

  // ================================================================
  // ROLE MANAGEMENT
  // ================================================================

  describe("Role Management", () => {
    it("adds and removes roles", async () => {
      const addr = Keypair.generate().publicKey;

      // Grant burner
      await ctx.program.methods
        .grantRole({ burner: {} }, addr)
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      let roles = await ctx.program.account.roleManager.fetch(ctx.rolesPda);
      assert.ok(roles.burners.some((b: PublicKey) => b.equals(addr)));

      // Revoke burner
      await ctx.program.methods
        .revokeRole({ burner: {} }, addr)
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
          roleManager: ctx.rolesPda,
        })
        .signers([ctx.authority])
        .rpc();

      roles = await ctx.program.account.roleManager.fetch(ctx.rolesPda);
      assert.ok(!roles.burners.some((b: PublicKey) => b.equals(addr)));
    });

    it("rejects duplicate role assignment", async () => {
      await expectError(
        () => ctx.program.methods
          .grantRole({ pauser: {} }, ctx.pauser.publicKey)
          .accounts({
            authority: ctx.authority.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
          })
          .signers([ctx.authority])
          .rpc(),
        "RoleAlreadyAssigned"
      );
    });

    it("rejects blacklister role on SSS-1 (feature gated)", async () => {
      await expectError(
        () => ctx.program.methods
          .grantRole({ blacklister: {} }, ctx.blacklister.publicKey)
          .accounts({
            authority: ctx.authority.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
          })
          .signers([ctx.authority])
          .rpc(),
        "ComplianceNotEnabled"
      );
    });

    it("rejects seizer role on SSS-1 (feature gated)", async () => {
      await expectError(
        () => ctx.program.methods
          .grantRole({ seizer: {} }, ctx.seizer.publicKey)
          .accounts({
            authority: ctx.authority.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
          })
          .signers([ctx.authority])
          .rpc(),
        "ComplianceNotEnabled"
      );
    });

    it("non-authority cannot manage roles", async () => {
      await expectError(
        () => ctx.program.methods
          .grantRole({ burner: {} }, ctx.unauthorized.publicKey)
          .accounts({
            authority: ctx.unauthorized.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
          })
          .signers([ctx.unauthorized])
          .rpc(),
        "UnauthorizedAuthority"
      );
    });
  });

  // ================================================================
  // AUTHORITY TRANSFER (Two-step)
  // ================================================================

  describe("Authority Transfer", () => {
    it("proposes authority transfer", async () => {
      const newAuth = Keypair.generate();
      const sig = await ctx.connection.requestAirdrop(newAuth.publicKey, 2 * 1e9);
      await ctx.connection.confirmTransaction(sig);

      await ctx.program.methods
        .transferAuthority(newAuth.publicKey)
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
        })
        .signers([ctx.authority])
        .rpc();

      const config = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      assert.ok(config.pendingMasterAuthority.equals(newAuth.publicKey));

      // Cancel it to restore state
      await ctx.program.methods
        .cancelAuthorityTransfer()
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
        })
        .signers([ctx.authority])
        .rpc();

      const config2 = await ctx.program.account.stablecoinConfig.fetch(ctx.configPda);
      assert.equal(config2.pendingMasterAuthority, null);
    });

    it("rejects accept from wrong signer", async () => {
      const newAuth = Keypair.generate();
      const sig = await ctx.connection.requestAirdrop(newAuth.publicKey, 2 * 1e9);
      await ctx.connection.confirmTransaction(sig);

      await ctx.program.methods
        .transferAuthority(newAuth.publicKey)
        .accounts({
          authority: ctx.authority.publicKey,
          stablecoinConfig: ctx.configPda,
        })
        .signers([ctx.authority])
        .rpc();

      await expectError(
        () => ctx.program.methods
          .acceptAuthority()
          .accounts({
            newAuthority: ctx.unauthorized.publicKey,
            stablecoinConfig: ctx.configPda,
          })
          .signers([ctx.unauthorized])
          .rpc(),
        "UnauthorizedPendingAuthority"
      );

      // Clean up
      await ctx.program.methods
        .cancelAuthorityTransfer()
        .accounts({ authority: ctx.authority.publicKey, stablecoinConfig: ctx.configPda })
        .signers([ctx.authority])
        .rpc();
    });
  });

  // ================================================================
  // SSS-2 FEATURE GATING ON SSS-1
  // ================================================================

  describe("Feature Gating (SSS-2 on SSS-1)", () => {
    it("blacklist add fails on SSS-1", async () => {
      const [blacklistPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("blacklist"), ctx.configPda.toBuffer(), ctx.userA.publicKey.toBuffer()],
        ctx.program.programId
      );

      await expectError(
        () => ctx.program.methods
          .addToBlacklist(ctx.userA.publicKey, "test")
          .accounts({
            authority: ctx.authority.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
            blacklistEntry: blacklistPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([ctx.authority])
          .rpc(),
        "ComplianceNotEnabled"
      );
    });

    it("seize fails on SSS-1", async () => {
      const [extraMetaList] = findExtraMetaListPda(
        ctx.mintKeypair.publicKey,
        ctx.hookProgram.programId
      );
      await expectError(
        () => ctx.program.methods
          .seize(new BN(100))
          .accounts({
            authority: ctx.authority.publicKey,
            stablecoinConfig: ctx.configPda,
            roleManager: ctx.rolesPda,
            mint: ctx.mintKeypair.publicKey,
            sourceTokenAccount: ctx.userAAta,
            destinationTokenAccount: ctx.userBAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            extraAccountMetaList: extraMetaList,
            transferHookProgram: ctx.hookProgram.programId,
            sssTokenProgram: ctx.program.programId,
          })
          .remainingAccounts([
            { pubkey: ctx.configPda, isSigner: false, isWritable: false },
            { pubkey: ctx.userA.publicKey, isSigner: false, isWritable: false },
            { pubkey: ctx.userB.publicKey, isSigner: false, isWritable: false },
          ])
          .signers([ctx.authority])
          .rpc(),
        "ComplianceNotEnabled"
      );
    });
  });
});

// Need anchor import for SYSVAR_RENT_PUBKEY reference
import * as anchor from "@coral-xyz/anchor";

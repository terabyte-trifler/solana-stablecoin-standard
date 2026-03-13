/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sss_token.json`.
 */
export type SssToken = {
  "address": "sW63DevsGFLUj9hsGutuqazT6zGJr7vvWG4FusG6tTk",
  "metadata": {
    "name": "sssToken",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana Stablecoin Standard — Modular stablecoin SDK with SSS-1 and SSS-2 presets"
  },
  "instructions": [
    {
      "name": "acceptAuthority",
      "discriminator": [
        107,
        86,
        198,
        91,
        33,
        12,
        107,
        160
      ],
      "accounts": [
        {
          "name": "newAuthority",
          "docs": [
            "Must be the pending_master_authority."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "addMinter",
      "discriminator": [
        75,
        86,
        218,
        40,
        219,
        6,
        141,
        29
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be master_authority."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "minter",
          "type": "pubkey"
        },
        {
          "name": "quota",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addToBlacklist",
      "discriminator": [
        90,
        115,
        98,
        231,
        173,
        119,
        117,
        176
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be master_authority or registered blacklister."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "blacklistEntry",
          "docs": [
            "The BlacklistEntry PDA to create.",
            "Seeds: [\"blacklist\", stablecoin_config, target_wallet_address]",
            "If this account already exists, Anchor's `init` will fail",
            "with \"already in use\" — that's our \"already blacklisted\" check."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  108,
                  97,
                  99,
                  107,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              },
              {
                "kind": "arg",
                "path": "address"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "address",
          "type": "pubkey"
        },
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "burnTokens",
      "discriminator": [
        76,
        15,
        51,
        254,
        229,
        215,
        121,
        66
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The operator signing this burn. Must be master_authority or burner.",
            "Also must be the owner of the token account being burned from."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "stablecoinConfig"
          ]
        },
        {
          "name": "tokenAccount",
          "docs": [
            "Token account to burn from. Must be owned by the signer."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelAuthorityTransfer",
      "discriminator": [
        94,
        131,
        125,
        184,
        183,
        24,
        125,
        229
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be current master_authority."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "freezeAccount",
      "discriminator": [
        253,
        75,
        82,
        133,
        167,
        238,
        43,
        130
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be master_authority."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "stablecoinConfig"
          ]
        },
        {
          "name": "tokenAccount",
          "docs": [
            "The token account to freeze. Can be any account for this mint."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "grantRole",
      "discriminator": [
        218,
        234,
        128,
        15,
        82,
        33,
        236,
        253
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "role",
          "type": {
            "defined": {
              "name": "roleType"
            }
          }
        },
        {
          "name": "grantee",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initHookAccounts",
      "docs": [
        "Initialize the transfer hook's ExtraAccountMetaList for SSS-2 mints.",
        "Must be called after `initialize` and before any token transfers."
      ],
      "discriminator": [
        221,
        172,
        21,
        121,
        134,
        255,
        161,
        2
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "The mint with transfer hook extension."
          ]
        },
        {
          "name": "extraAccountMetaList",
          "docs": [
            "The ExtraAccountMetaList PDA to be created.",
            "Seeds: [\"extra-account-metas\", mint] on the hook program."
          ],
          "writable": true
        },
        {
          "name": "hookProgram",
          "docs": [
            "The sss-transfer-hook program."
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "The wallet paying for account creation rent.",
            "Also becomes the initial master_authority."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "docs": [
            "The Token-2022 mint account. Must be a fresh keypair.",
            "We do NOT use Anchor's `init` here because we need manual",
            "control over extension initialization order."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "docs": [
            "StablecoinConfig PDA — seeds: [\"stablecoin\", mint]",
            "Anchor's `init` handles creation + space + rent."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "docs": [
            "RoleManager PDA — seeds: [\"roles\", stablecoin_config]"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Token-2022 program (NOT legacy SPL Token)."
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "docs": [
            "Rent sysvar — needed for mint account creation."
          ],
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "decimals",
          "type": "u8"
        },
        {
          "name": "enablePermanentDelegate",
          "type": "bool"
        },
        {
          "name": "enableTransferHook",
          "type": "bool"
        },
        {
          "name": "defaultAccountFrozen",
          "type": "bool"
        }
      ]
    },
    {
      "name": "mintTokens",
      "discriminator": [
        59,
        132,
        24,
        246,
        122,
        39,
        8,
        243
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "The operator signing this mint. Must be master_authority or a",
            "registered minter in the RoleManager."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "docs": [
            "The stablecoin configuration. Checked for pause state and mint match.",
            "Mutable because we update total_supply."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "docs": [
            "Role manager — checked for minter authorization.",
            "Mutable because we update the minter's quota tracking."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "The Token-2022 mint. Config PDA is the mint authority."
          ],
          "writable": true,
          "relations": [
            "stablecoinConfig"
          ]
        },
        {
          "name": "recipientTokenAccount",
          "docs": [
            "Recipient's token account. Must be the same mint.",
            "Does NOT need to be an ATA — any token account for this mint works."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pause",
      "discriminator": [
        211,
        22,
        221,
        251,
        74,
        121,
        193,
        47
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be master_authority or registered pauser."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "removeFromBlacklist",
      "discriminator": [
        47,
        105,
        20,
        10,
        165,
        168,
        203,
        219
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "blacklistEntry",
          "docs": [
            "The BlacklistEntry to close. Anchor's `close` sends rent to authority."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  108,
                  97,
                  99,
                  107,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              },
              {
                "kind": "arg",
                "path": "address"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "address",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "removeMinter",
      "discriminator": [
        241,
        69,
        84,
        16,
        164,
        232,
        131,
        79
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be master_authority."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "minter",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "revokeRole",
      "discriminator": [
        179,
        232,
        2,
        180,
        48,
        227,
        82,
        7
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "role",
          "type": {
            "defined": {
              "name": "roleType"
            }
          }
        },
        {
          "name": "revokee",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "seize",
      "discriminator": [
        129,
        159,
        143,
        31,
        161,
        224,
        241,
        84
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be master_authority or registered seizer."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "stablecoinConfig"
          ]
        },
        {
          "name": "sourceTokenAccount",
          "docs": [
            "The token account to seize FROM. Can be any account for this mint.",
            "The permanent delegate (config PDA) overrides ownership."
          ],
          "writable": true
        },
        {
          "name": "destinationTokenAccount",
          "docs": [
            "The treasury/destination token account."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "thawAccount",
      "discriminator": [
        115,
        152,
        79,
        213,
        213,
        169,
        184,
        35
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be master_authority."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "stablecoinConfig"
          ]
        },
        {
          "name": "tokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "transferAuthority",
      "discriminator": [
        48,
        169,
        76,
        72,
        229,
        180,
        55,
        161
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be current master_authority."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "unpause",
      "discriminator": [
        169,
        144,
        4,
        38,
        10,
        141,
        188,
        255
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be master_authority ONLY. Pausers cannot unpause."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "updateMinterQuota",
      "discriminator": [
        221,
        28,
        229,
        118,
        214,
        28,
        220,
        247
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must be master_authority."
          ],
          "signer": true
        },
        {
          "name": "stablecoinConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "stablecoin_config.mint",
                "account": "stablecoinConfig"
              }
            ]
          }
        },
        {
          "name": "roleManager",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  108,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stablecoinConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "minter",
          "type": "pubkey"
        },
        {
          "name": "newQuota",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "blacklistEntry",
      "discriminator": [
        218,
        179,
        231,
        40,
        141,
        25,
        168,
        189
      ]
    },
    {
      "name": "roleManager",
      "discriminator": [
        149,
        48,
        206,
        85,
        167,
        34,
        114,
        212
      ]
    },
    {
      "name": "stablecoinConfig",
      "discriminator": [
        127,
        25,
        244,
        213,
        1,
        192,
        101,
        6
      ]
    }
  ],
  "events": [
    {
      "name": "accountFrozen",
      "discriminator": [
        221,
        214,
        59,
        29,
        246,
        50,
        119,
        206
      ]
    },
    {
      "name": "accountThawed",
      "discriminator": [
        49,
        63,
        73,
        105,
        129,
        190,
        40,
        119
      ]
    },
    {
      "name": "addressBlacklisted",
      "discriminator": [
        170,
        43,
        25,
        117,
        253,
        193,
        194,
        231
      ]
    },
    {
      "name": "addressRemovedFromBlacklist",
      "discriminator": [
        90,
        81,
        92,
        252,
        3,
        126,
        255,
        6
      ]
    },
    {
      "name": "authorityTransferAccepted",
      "discriminator": [
        149,
        165,
        140,
        221,
        104,
        203,
        239,
        121
      ]
    },
    {
      "name": "authorityTransferCancelled",
      "discriminator": [
        31,
        228,
        187,
        148,
        20,
        99,
        237,
        48
      ]
    },
    {
      "name": "authorityTransferProposed",
      "discriminator": [
        103,
        244,
        27,
        116,
        177,
        4,
        100,
        119
      ]
    },
    {
      "name": "minterAdded",
      "discriminator": [
        140,
        185,
        72,
        194,
        3,
        99,
        122,
        172
      ]
    },
    {
      "name": "minterQuotaUpdated",
      "discriminator": [
        43,
        253,
        204,
        147,
        16,
        231,
        219,
        151
      ]
    },
    {
      "name": "minterRemoved",
      "discriminator": [
        157,
        21,
        47,
        29,
        4,
        195,
        30,
        77
      ]
    },
    {
      "name": "roleGranted",
      "discriminator": [
        220,
        183,
        89,
        228,
        143,
        63,
        246,
        58
      ]
    },
    {
      "name": "roleRevoked",
      "discriminator": [
        167,
        183,
        52,
        229,
        126,
        206,
        62,
        61
      ]
    },
    {
      "name": "stablecoinInitialized",
      "discriminator": [
        238,
        217,
        135,
        14,
        147,
        33,
        221,
        169
      ]
    },
    {
      "name": "stablecoinPaused",
      "discriminator": [
        72,
        123,
        16,
        187,
        50,
        214,
        82,
        198
      ]
    },
    {
      "name": "stablecoinUnpaused",
      "discriminator": [
        183,
        80,
        65,
        60,
        128,
        109,
        155,
        155
      ]
    },
    {
      "name": "tokensBurned",
      "discriminator": [
        230,
        255,
        34,
        113,
        226,
        53,
        227,
        9
      ]
    },
    {
      "name": "tokensMinted",
      "discriminator": [
        207,
        212,
        128,
        194,
        175,
        54,
        64,
        24
      ]
    },
    {
      "name": "tokensSeized",
      "discriminator": [
        51,
        129,
        131,
        114,
        206,
        234,
        140,
        122
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "nameTooLong",
      "msg": "Token name exceeds maximum length of 32 bytes"
    },
    {
      "code": 6001,
      "name": "nameEmpty",
      "msg": "Token name cannot be empty"
    },
    {
      "code": 6002,
      "name": "symbolTooLong",
      "msg": "Token symbol exceeds maximum length of 10 bytes"
    },
    {
      "code": 6003,
      "name": "symbolEmpty",
      "msg": "Token symbol cannot be empty"
    },
    {
      "code": 6004,
      "name": "uriTooLong",
      "msg": "Metadata URI exceeds maximum length of 200 bytes"
    },
    {
      "code": 6005,
      "name": "reasonTooLong",
      "msg": "Blacklist reason exceeds maximum length of 100 bytes"
    },
    {
      "code": 6006,
      "name": "reasonEmpty",
      "msg": "Blacklist reason cannot be empty"
    },
    {
      "code": 6007,
      "name": "unauthorizedAuthority",
      "msg": "Signer is not the master authority"
    },
    {
      "code": 6008,
      "name": "unauthorizedMinter",
      "msg": "Signer is not authorized to mint tokens"
    },
    {
      "code": 6009,
      "name": "unauthorizedBurner",
      "msg": "Signer is not authorized to burn tokens"
    },
    {
      "code": 6010,
      "name": "unauthorizedPauser",
      "msg": "Signer is not authorized to pause operations"
    },
    {
      "code": 6011,
      "name": "unauthorizedBlacklister",
      "msg": "Signer is not authorized to manage the blacklist"
    },
    {
      "code": 6012,
      "name": "unauthorizedSeizer",
      "msg": "Signer is not authorized to seize tokens"
    },
    {
      "code": 6013,
      "name": "unauthorizedPendingAuthority",
      "msg": "Signer is not the pending master authority"
    },
    {
      "code": 6014,
      "name": "noAuthorityTransferPending",
      "msg": "No authority transfer is currently pending"
    },
    {
      "code": 6015,
      "name": "complianceNotEnabled",
      "msg": "Compliance features are not enabled (requires SSS-2 preset)"
    },
    {
      "code": 6016,
      "name": "permanentDelegateNotEnabled",
      "msg": "Permanent delegate extension not enabled on this mint"
    },
    {
      "code": 6017,
      "name": "transferHookNotEnabled",
      "msg": "Transfer hook extension not enabled on this mint"
    },
    {
      "code": 6018,
      "name": "stablecoinPaused",
      "msg": "Stablecoin operations are currently paused"
    },
    {
      "code": 6019,
      "name": "alreadyPaused",
      "msg": "Stablecoin is already paused"
    },
    {
      "code": 6020,
      "name": "notPaused",
      "msg": "Stablecoin is not currently paused"
    },
    {
      "code": 6021,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6022,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6023,
      "name": "invalidDecimals",
      "msg": "Decimals must be between 0 and 9"
    },
    {
      "code": 6024,
      "name": "roleAlreadyAssigned",
      "msg": "This address already has the specified role"
    },
    {
      "code": 6025,
      "name": "roleNotFound",
      "msg": "This address does not have the specified role"
    },
    {
      "code": 6026,
      "name": "roleLimitExceeded",
      "msg": "Maximum number of entries for this role has been reached"
    },
    {
      "code": 6027,
      "name": "minterQuotaExceeded",
      "msg": "Minting this amount would exceed the minter's epoch quota"
    },
    {
      "code": 6028,
      "name": "alreadyBlacklisted",
      "msg": "This address is already blacklisted"
    },
    {
      "code": 6029,
      "name": "notBlacklisted",
      "msg": "This address is not on the blacklist"
    },
    {
      "code": 6030,
      "name": "addressBlacklisted",
      "msg": "Transfer blocked: address is blacklisted"
    },
    {
      "code": 6031,
      "name": "invalidMint",
      "msg": "Mint account does not match the stablecoin configuration"
    },
    {
      "code": 6032,
      "name": "invalidTokenAccount",
      "msg": "Token account is not associated with this stablecoin's mint"
    },
    {
      "code": 6033,
      "name": "insufficientBalance",
      "msg": "Insufficient token balance"
    }
  ],
  "types": [
    {
      "name": "accountFrozen",
      "docs": [
        "Emitted when a token account is frozen."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "tokenAccount",
            "docs": [
              "The token account that was frozen"
            ],
            "type": "pubkey"
          },
          {
            "name": "accountOwner",
            "docs": [
              "The wallet owner of the frozen account"
            ],
            "type": "pubkey"
          },
          {
            "name": "frozenBy",
            "docs": [
              "Who performed the freeze"
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "accountThawed",
      "docs": [
        "Emitted when a token account is thawed."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "tokenAccount",
            "type": "pubkey"
          },
          {
            "name": "accountOwner",
            "type": "pubkey"
          },
          {
            "name": "thawedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "addressBlacklisted",
      "docs": [
        "Emitted when an address is added to the blacklist."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "address",
            "docs": [
              "The wallet address that was blacklisted"
            ],
            "type": "pubkey"
          },
          {
            "name": "reason",
            "docs": [
              "Compliance reason"
            ],
            "type": "string"
          },
          {
            "name": "blacklistedBy",
            "docs": [
              "Who performed the blacklisting"
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "addressRemovedFromBlacklist",
      "docs": [
        "Emitted when an address is removed from the blacklist."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "pubkey"
          },
          {
            "name": "removedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "authorityTransferAccepted",
      "docs": [
        "Emitted when an authority transfer is accepted (step 2 of 2)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "previousAuthority",
            "docs": [
              "Previous master authority"
            ],
            "type": "pubkey"
          },
          {
            "name": "newAuthority",
            "docs": [
              "New master authority (who accepted)"
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "authorityTransferCancelled",
      "docs": [
        "Emitted when a pending authority transfer is cancelled."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "cancelledBy",
            "type": "pubkey"
          },
          {
            "name": "cancelledPending",
            "docs": [
              "The address that was pending (now cancelled)"
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "authorityTransferProposed",
      "docs": [
        "Emitted when an authority transfer is proposed (step 1 of 2)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "currentAuthority",
            "docs": [
              "Current master authority (who proposed)"
            ],
            "type": "pubkey"
          },
          {
            "name": "proposedAuthority",
            "docs": [
              "Proposed new authority"
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "blacklistEntry",
      "docs": [
        "A record of a blacklisted wallet address.",
        "",
        "# How the Transfer Hook Uses This",
        "",
        "The sss-transfer-hook program is invoked on every `transfer_checked`",
        "call for the SSS-2 mint. The hook:",
        "",
        "1. Receives the source token account, destination token account, and",
        "this program's extra account metas (which include the blacklist PDAs).",
        "2. For both source owner and destination owner, derives the BlacklistEntry",
        "PDA: `[\"blacklist\", config, owner]`.",
        "3. Checks if the PDA account has data (exists and is initialized).",
        "- If either PDA exists → the transfer is REJECTED.",
        "- If neither exists → the transfer proceeds normally.",
        "",
        "This \"existence check\" pattern is efficient: no deserialization needed,",
        "just check `account.data_len() > 0` or use `try_borrow_data()`.",
        "",
        "# Audit Trail",
        "",
        "Each entry stores who blacklisted the address and when, creating",
        "an immutable on-chain audit trail. The `reason` field holds the",
        "compliance rationale (e.g., \"OFAC SDN match\", \"Court order #789\").",
        "",
        "Even after removal (account closure), the event log retains the",
        "`AddressBlacklisted` and `AddressRemovedFromBlacklist` events",
        "permanently in Solana's ledger history."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stablecoin",
            "docs": [
              "The StablecoinConfig this blacklist entry belongs to.",
              "Stored for cross-validation — ensures this entry can only be",
              "used with the correct stablecoin instance."
            ],
            "type": "pubkey"
          },
          {
            "name": "address",
            "docs": [
              "The blacklisted wallet owner address.",
              "",
              "This is the OWNER of token accounts, not a token account itself.",
              "When the transfer hook checks blacklist status, it reads the owner",
              "field from the source/destination token accounts and looks up",
              "this PDA using that owner address.",
              "",
              "Format: a standard Solana wallet address (ed25519 public key).",
              "Could be a regular wallet, a multisig, or even a PDA (if a program",
              "owns token accounts and needs to be sanctioned)."
            ],
            "type": "pubkey"
          },
          {
            "name": "reason",
            "docs": [
              "Human-readable reason for blacklisting.",
              "",
              "Examples:",
              "- \"OFAC SDN match — address identified in sanctions list update 2025-03-01\"",
              "- \"Court order #12345 — asset freeze ordered by District Court\"",
              "- \"Internal compliance — suspicious activity flagged by monitoring\"",
              "",
              "Max length: MAX_REASON_LEN (100 bytes).",
              "This field is informational — the transfer hook doesn't read it.",
              "It exists for operators and auditors reviewing the blacklist."
            ],
            "type": "string"
          },
          {
            "name": "blacklistedAt",
            "docs": [
              "Unix timestamp (seconds) when this address was blacklisted.",
              "Set from `Clock::get()?.unix_timestamp` during `add_to_blacklist`.",
              "Used for audit trail and compliance reporting."
            ],
            "type": "i64"
          },
          {
            "name": "blacklistedBy",
            "docs": [
              "The wallet that performed the blacklisting action.",
              "Must be a registered blacklister or the master authority.",
              "Stored for accountability — \"who made this decision?\""
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "minterAdded",
      "docs": [
        "Emitted when a minter is added."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "minter",
            "type": "pubkey"
          },
          {
            "name": "quota",
            "docs": [
              "Per-epoch quota assigned (0 = unlimited)"
            ],
            "type": "u64"
          },
          {
            "name": "addedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "minterEntry",
      "docs": [
        "A single minter's configuration, including quota tracking.",
        "",
        "# Quota System",
        "",
        "Each minter has an independent quota that limits how much they can mint",
        "per Solana epoch (~2.5 days). This prevents a single compromised minter",
        "key from minting unlimited tokens.",
        "",
        "**How quota resets work:**",
        "- `quota` is the maximum amount this minter can mint per epoch",
        "- `minted` tracks how much they've minted in the current epoch",
        "- `last_reset_epoch` records which epoch `minted` was last reset in",
        "- When a minter calls `mint`, the handler checks:",
        "1. Is `current_epoch > last_reset_epoch`? If yes, reset `minted = 0`",
        "and set `last_reset_epoch = current_epoch` (automatic reset)",
        "2. Would `minted + amount > quota`? If yes, reject.",
        "3. Otherwise, `minted += amount` and proceed.",
        "",
        "**No manual reset needed** — the reset is triggered lazily during the",
        "next mint attempt after an epoch boundary. This means no cron job and",
        "no separate \"reset_quotas\" instruction.",
        "",
        "**Quota of 0 means unlimited** — useful for the master authority or",
        "trusted operators who shouldn't have artificial limits. Instruction",
        "handlers check: `if entry.quota > 0 { enforce_quota() }`.",
        "",
        "**Quota of u64::MAX effectively means unlimited** — but we use 0 as the",
        "sentinel for clarity. Both are documented."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "docs": [
              "The wallet address authorized to mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "quota",
            "docs": [
              "Maximum tokens this minter can mint per epoch.",
              "0 = unlimited (no quota enforcement)."
            ],
            "type": "u64"
          },
          {
            "name": "minted",
            "docs": [
              "Tokens minted so far in the current epoch.",
              "Reset to 0 when `last_reset_epoch < current_epoch`."
            ],
            "type": "u64"
          },
          {
            "name": "lastResetEpoch",
            "docs": [
              "The Solana epoch in which `minted` was last reset.",
              "Used for lazy quota reset — no cron job needed."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "minterQuotaUpdated",
      "docs": [
        "Emitted when a minter's quota is updated."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "minter",
            "type": "pubkey"
          },
          {
            "name": "oldQuota",
            "type": "u64"
          },
          {
            "name": "newQuota",
            "type": "u64"
          },
          {
            "name": "updatedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "minterRemoved",
      "docs": [
        "Emitted when a minter is removed."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "minter",
            "type": "pubkey"
          },
          {
            "name": "removedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "roleGranted",
      "docs": [
        "Generic event for adding/removing simple roles (burner, pauser, etc.)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "role",
            "docs": [
              "\"burner\", \"pauser\", \"blacklister\", \"seizer\""
            ],
            "type": "string"
          },
          {
            "name": "grantee",
            "docs": [
              "Address that received the role"
            ],
            "type": "pubkey"
          },
          {
            "name": "grantedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "roleManager",
      "docs": [
        "Manages all operator roles for a stablecoin instance.",
        "",
        "# Role Descriptions",
        "",
        "| Role | Can Do | SSS-1 | SSS-2 |",
        "|------|--------|-------|-------|",
        "| Minter | Mint new tokens (within quota) | ✅ | ✅ |",
        "| Burner | Burn tokens from own account | ✅ | ✅ |",
        "| Pauser | Pause stablecoin operations | ✅ | ✅ |",
        "| Blacklister | Add/remove addresses from blacklist | ❌ | ✅ |",
        "| Seizer | Seize tokens via permanent delegate | ❌ | ✅ |",
        "",
        "The master_authority (stored on StablecoinConfig) implicitly has ALL roles.",
        "It can also add/remove entries from any role vector.",
        "",
        "# Why Pubkey Vectors for simple roles?",
        "",
        "Minters need quota tracking, so they get a custom struct (MinterEntry).",
        "All other roles just need to answer \"is address X authorized?\" — a Vec<Pubkey>",
        "is the simplest way to do that. We search linearly, which is fine for ≤10",
        "entries (~320ns for 10 comparisons on Solana's runtime)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stablecoin",
            "docs": [
              "Points back to the StablecoinConfig this RoleManager belongs to.",
              "Used for validation: the RoleManager PDA is derived from the config,",
              "but we store the reference explicitly for cross-checks."
            ],
            "type": "pubkey"
          },
          {
            "name": "minters",
            "docs": [
              "Minters: can call `mint` instruction. Each has independent quota.",
              "Max: MAX_MINTERS (20).",
              "The master_authority can always mint regardless of this list."
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "minterEntry"
                }
              }
            }
          },
          {
            "name": "burners",
            "docs": [
              "Burners: can call `burn` instruction on their own token accounts.",
              "Max: MAX_BURNERS (10).",
              "The master_authority can always burn regardless."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "pausers",
            "docs": [
              "Pausers: can call `pause` instruction.",
              "Max: MAX_PAUSERS (10).",
              "NOTE: Only the master_authority can call `unpause` — pausers can",
              "halt operations but can't resume them. This is a safety net: if a",
              "pauser key is compromised, the attacker can only pause (safe), not",
              "unpause (which would require the master key)."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "blacklisters",
            "docs": [
              "Blacklisters (SSS-2 only): can call `add_to_blacklist` and",
              "`remove_from_blacklist`. Max: MAX_BLACKLISTERS (10).",
              "On SSS-1 configs, this vector is always empty and any attempt",
              "to add entries will fail with ComplianceNotEnabled."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "seizers",
            "docs": [
              "Seizers (SSS-2 only): can call `seize` instruction.",
              "Max: MAX_SEIZERS (10).",
              "On SSS-1 configs, this vector is always empty.",
              "Seize is the most destructive operation (moves tokens from any",
              "account), so it should be a very small, tightly controlled group."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "roleRevoked",
      "docs": [
        "Generic event for revoking simple roles."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "role",
            "type": "string"
          },
          {
            "name": "revokee",
            "type": "pubkey"
          },
          {
            "name": "revokedBy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "roleType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "burner"
          },
          {
            "name": "pauser"
          },
          {
            "name": "blacklister"
          },
          {
            "name": "seizer"
          }
        ]
      }
    },
    {
      "name": "stablecoinConfig",
      "docs": [
        "The core configuration account for a stablecoin instance.",
        "",
        "# Design Decisions",
        "",
        "**Why track `total_supply` manually?**",
        "Token-2022 stores supply on the Mint account, but reading it requires",
        "deserializing the full Mint (which includes extension data and is expensive",
        "in compute units). By tracking supply ourselves, any instruction or",
        "off-chain reader can get the supply from this small account without",
        "touching the Mint. We accept the consistency responsibility — every mint",
        "instruction increments, every burn decrements, nothing else touches it.",
        "",
        "**Why `pending_master_authority` exists (two-step transfer):**",
        "Single-step authority transfer is dangerous. If you typo the new authority,",
        "you lose the stablecoin forever. Two-step: current authority proposes (sets",
        "`pending_master_authority = Some(new_addr)`), then the new authority calls",
        "`accept_authority` to finalize. If the proposed address is wrong, the old",
        "authority can re-propose or cancel.",
        "",
        "**Why feature flags are immutable:**",
        "Token-2022 extensions are set at mint creation and cannot be added later.",
        "If `enable_transfer_hook` is false at init, the mint has no hook extension,",
        "so enabling it later is physically impossible. The config flags mirror the",
        "mint's actual extension state — they're immutable because the underlying",
        "extensions are immutable."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "docs": [
              "Human-readable name of the stablecoin (e.g., \"USD Coin\")",
              "Also written to the Token-2022 Metadata extension on the mint.",
              "Max length: MAX_NAME_LEN (32 bytes). Enforced in `initialize`."
            ],
            "type": "string"
          },
          {
            "name": "symbol",
            "docs": [
              "Ticker symbol (e.g., \"USDC\", \"MYUSD\")",
              "Also written to Token-2022 Metadata.",
              "Max length: MAX_SYMBOL_LEN (10 bytes). Enforced in `initialize`."
            ],
            "type": "string"
          },
          {
            "name": "uri",
            "docs": [
              "URI pointing to off-chain JSON metadata (image, description, etc.)",
              "Typically an Arweave or IPFS link.",
              "Max length: MAX_URI_LEN (200 bytes). Enforced in `initialize`."
            ],
            "type": "string"
          },
          {
            "name": "decimals",
            "docs": [
              "Number of decimal places (typically 6 for stablecoins on Solana).",
              "Set on the Token-2022 mint and stored here for convenient reads.",
              "USDC uses 6, USDT uses 6, but the SDK allows any value 0–9."
            ],
            "type": "u8"
          },
          {
            "name": "mint",
            "docs": [
              "The Token-2022 mint address this config governs.",
              "Stored explicitly so any instruction can verify it's operating on",
              "the correct mint without re-deriving the PDA."
            ],
            "type": "pubkey"
          },
          {
            "name": "enablePermanentDelegate",
            "docs": [
              "Whether the PermanentDelegate extension is enabled on the mint.",
              "Required for SSS-2 `seize` instruction (clawback/asset recovery).",
              "When true, the StablecoinConfig PDA is the permanent delegate and",
              "can transfer tokens from ANY token account of this mint."
            ],
            "type": "bool"
          },
          {
            "name": "enableTransferHook",
            "docs": [
              "Whether the TransferHook extension is enabled on the mint.",
              "Required for SSS-2 blacklist enforcement. When true, every",
              "`transfer_checked` call on this mint triggers the sss-transfer-hook",
              "program, which checks the sender and receiver against blacklist PDAs."
            ],
            "type": "bool"
          },
          {
            "name": "defaultAccountFrozen",
            "docs": [
              "Whether new token accounts start frozen by default.",
              "Uses Token-2022's DefaultAccountState extension.",
              "When true, recipients must be explicitly thawed before they can",
              "receive transfers. Useful for strict compliance regimes where",
              "every participant must be KYC-approved before transacting."
            ],
            "type": "bool"
          },
          {
            "name": "isPaused",
            "docs": [
              "Global pause switch. When true, ALL minting, burning, freezing,",
              "thawing, blacklisting, and seizing operations are blocked.",
              "Only `unpause` and `transfer_authority` still work while paused.",
              "",
              "NOTE: This does NOT pause transfers between users. Token transfers",
              "are handled by Token-2022 directly — we can't intercept them with",
              "a program flag. To halt transfers, you'd need to freeze individual",
              "accounts or use the transfer hook to check pause state (but that",
              "adds CPI overhead to every transfer)."
            ],
            "type": "bool"
          },
          {
            "name": "totalSupply",
            "docs": [
              "Manually tracked total supply of outstanding tokens.",
              "",
              "INVARIANT: This must always equal the mint's actual supply.",
              "- `mint` instruction: total_supply += amount",
              "- `burn` instruction: total_supply -= amount",
              "- `seize` instruction: does NOT change supply (it's a transfer)",
              "- No other instruction modifies this field.",
              "",
              "If this ever drifts from the Mint's supply (e.g., due to a bug),",
              "a `sync_supply` instruction can be added to re-read the mint."
            ],
            "type": "u64"
          },
          {
            "name": "masterAuthority",
            "docs": [
              "The master authority — the top-level admin key.",
              "Can: add/remove all roles, pause/unpause, transfer authority.",
              "This is typically a multisig in production.",
              "",
              "IMPORTANT: The master authority is NOT the same as the mint authority",
              "or freeze authority. Those are set to this PDA (StablecoinConfig),",
              "which the program controls. The master_authority is the human/multisig",
              "that signs transactions to operate the stablecoin."
            ],
            "type": "pubkey"
          },
          {
            "name": "pendingMasterAuthority",
            "docs": [
              "Pending authority for two-step transfer.",
              "",
              "Flow:",
              "1. Current master calls `transfer_authority(new_addr)` →",
              "sets pending_master_authority = Some(new_addr)",
              "2. New address calls `accept_authority()` →",
              "sets master_authority = new_addr, pending = None",
              "",
              "To cancel: current master calls `transfer_authority(current_master)`",
              "which resets pending to None (or a dedicated cancel instruction).",
              "",
              "WHY Option<Pubkey>:",
              "- None = no transfer in progress",
              "- Some(addr) = transfer proposed, waiting for acceptance",
              "- Costs 1 extra byte vs always storing a Pubkey (the Option tag)"
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "bump",
            "docs": [
              "The PDA bump seed. Stored so we never need to re-derive it.",
              "Anchor sets this automatically via `bump = config.bump` in",
              "seeds constraints. Saves ~4000 compute units per instruction",
              "vs calling `find_program_address` every time."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "stablecoinInitialized",
      "docs": [
        "Emitted when a new stablecoin is created via `initialize`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "docs": [
              "The StablecoinConfig PDA address"
            ],
            "type": "pubkey"
          },
          {
            "name": "mint",
            "docs": [
              "The Token-2022 mint address"
            ],
            "type": "pubkey"
          },
          {
            "name": "name",
            "docs": [
              "Token name"
            ],
            "type": "string"
          },
          {
            "name": "symbol",
            "docs": [
              "Token symbol"
            ],
            "type": "string"
          },
          {
            "name": "decimals",
            "docs": [
              "Number of decimals"
            ],
            "type": "u8"
          },
          {
            "name": "preset",
            "docs": [
              "\"SSS-1\", \"SSS-2\", or \"custom\""
            ],
            "type": "string"
          },
          {
            "name": "authority",
            "docs": [
              "The master authority that created this stablecoin"
            ],
            "type": "pubkey"
          },
          {
            "name": "permanentDelegate",
            "docs": [
              "Whether permanent delegate is enabled"
            ],
            "type": "bool"
          },
          {
            "name": "transferHook",
            "docs": [
              "Whether transfer hook is enabled"
            ],
            "type": "bool"
          },
          {
            "name": "timestamp",
            "docs": [
              "Timestamp of creation"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "stablecoinPaused",
      "docs": [
        "Emitted when the stablecoin is paused."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "pausedBy",
            "docs": [
              "Who triggered the pause"
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "stablecoinUnpaused",
      "docs": [
        "Emitted when the stablecoin is unpaused."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "unpausedBy",
            "docs": [
              "Who triggered the unpause (always master authority)"
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tokensBurned",
      "docs": [
        "Emitted when tokens are burned."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount burned"
            ],
            "type": "u64"
          },
          {
            "name": "burner",
            "docs": [
              "Who signed the burn transaction"
            ],
            "type": "pubkey"
          },
          {
            "name": "newTotalSupply",
            "docs": [
              "New total supply after burning"
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tokensMinted",
      "docs": [
        "Emitted when tokens are minted."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "docs": [
              "Who received the tokens"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount minted (in smallest unit, e.g., 1_000_000 = 1.0 USDC)"
            ],
            "type": "u64"
          },
          {
            "name": "minter",
            "docs": [
              "Who signed the mint transaction"
            ],
            "type": "pubkey"
          },
          {
            "name": "newTotalSupply",
            "docs": [
              "New total supply after minting"
            ],
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tokensSeized",
      "docs": [
        "Emitted when tokens are seized via permanent delegate."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "fromTokenAccount",
            "docs": [
              "Token account tokens were seized from"
            ],
            "type": "pubkey"
          },
          {
            "name": "fromOwner",
            "docs": [
              "Owner of the seized token account"
            ],
            "type": "pubkey"
          },
          {
            "name": "toTokenAccount",
            "docs": [
              "Treasury/destination token account"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount seized"
            ],
            "type": "u64"
          },
          {
            "name": "seizedBy",
            "docs": [
              "Who authorized the seizure"
            ],
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};

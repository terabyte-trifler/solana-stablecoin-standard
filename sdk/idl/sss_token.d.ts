export type SssToken = {
    address: "sW63DevsGFLUj9hsGutuqazT6zGJr7vvWG4FusG6tTk";
    metadata: {
        name: "sss_token";
        version: "0.1.0";
        spec: "0.1.0";
    };
    instructions: [
        {
            name: "accept_authority";
            discriminator: [107, 86, 198, 91, 33, 12, 107, 160];
            accounts: [
                {
                    name: "new_authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                    writable: true;
                }
            ];
            args: [];
        },
        {
            name: "add_minter";
            discriminator: [75, 86, 218, 40, 219, 6, 141, 29];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "role_manager";
                    writable: true;
                }
            ];
            args: [
                {
                    name: "minter";
                    type: "pubkey";
                },
                {
                    name: "quota";
                    type: "u64";
                }
            ];
        },
        {
            name: "add_to_blacklist";
            discriminator: [90, 115, 98, 231, 173, 119, 117, 176];
            accounts: [
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "role_manager";
                },
                {
                    name: "blacklist_entry";
                    writable: true;
                },
                {
                    name: "system_program";
                }
            ];
            args: [
                {
                    name: "address";
                    type: "pubkey";
                },
                {
                    name: "reason";
                    type: "string";
                }
            ];
        },
        {
            name: "burn_tokens";
            discriminator: [116, 110, 29, 56, 107, 219, 42, 93];
            accounts: [
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                    writable: true;
                },
                {
                    name: "role_manager";
                },
                {
                    name: "mint";
                    writable: true;
                },
                {
                    name: "token_account";
                    writable: true;
                },
                {
                    name: "token_program";
                }
            ];
            args: [{
                name: "amount";
                type: "u64";
            }];
        },
        {
            name: "cancel_authority_transfer";
            discriminator: [163, 193, 202, 120, 2, 235, 229, 159];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                    writable: true;
                }
            ];
            args: [];
        },
        {
            name: "freeze_account";
            discriminator: [88, 25, 251, 172, 77, 186, 140, 2];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "mint";
                    writable: true;
                },
                {
                    name: "token_account";
                    writable: true;
                },
                {
                    name: "token_program";
                }
            ];
            args: [];
        },
        {
            name: "grant_role";
            discriminator: [206, 149, 245, 118, 25, 35, 55, 28];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "role_manager";
                    writable: true;
                }
            ];
            args: [
                {
                    name: "role";
                    type: {
                        defined: {
                            name: "RoleType";
                        };
                    };
                },
                {
                    name: "grantee";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "init_hook_accounts";
            discriminator: [175, 135, 94, 221, 239, 122, 161, 231];
            accounts: [
                {
                    name: "payer";
                    writable: true;
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "mint";
                },
                {
                    name: "extra_account_meta_list";
                    writable: true;
                },
                {
                    name: "hook_program";
                },
                {
                    name: "system_program";
                }
            ];
            args: [];
        },
        {
            name: "initialize";
            discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
            accounts: [
                {
                    name: "payer";
                    writable: true;
                    signer: true;
                },
                {
                    name: "mint";
                    writable: true;
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                    writable: true;
                },
                {
                    name: "role_manager";
                    writable: true;
                },
                {
                    name: "token_program";
                },
                {
                    name: "system_program";
                },
                {
                    name: "rent";
                }
            ];
            args: [
                {
                    name: "name";
                    type: "string";
                },
                {
                    name: "symbol";
                    type: "string";
                },
                {
                    name: "uri";
                    type: "string";
                },
                {
                    name: "decimals";
                    type: "u8";
                },
                {
                    name: "enable_permanent_delegate";
                    type: "bool";
                },
                {
                    name: "enable_transfer_hook";
                    type: "bool";
                },
                {
                    name: "default_account_frozen";
                    type: "bool";
                }
            ];
        },
        {
            name: "mint_tokens";
            discriminator: [160, 168, 6, 77, 254, 83, 5, 114];
            accounts: [
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                    writable: true;
                },
                {
                    name: "role_manager";
                    writable: true;
                },
                {
                    name: "mint";
                    writable: true;
                },
                {
                    name: "recipient_token_account";
                    writable: true;
                },
                {
                    name: "token_program";
                }
            ];
            args: [{
                name: "amount";
                type: "u64";
            }];
        },
        {
            name: "pause";
            discriminator: [206, 46, 3, 107, 218, 102, 148, 150];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                    writable: true;
                },
                {
                    name: "role_manager";
                }
            ];
            args: [];
        },
        {
            name: "remove_from_blacklist";
            discriminator: [247, 88, 202, 102, 181, 39, 105, 187];
            accounts: [
                {
                    name: "authority";
                    writable: true;
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "role_manager";
                },
                {
                    name: "blacklist_entry";
                    writable: true;
                }
            ];
            args: [{
                name: "address";
                type: "pubkey";
            }];
        },
        {
            name: "remove_minter";
            discriminator: [107, 85, 215, 158, 39, 0, 31, 236];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "role_manager";
                    writable: true;
                }
            ];
            args: [{
                name: "minter";
                type: "pubkey";
            }];
        },
        {
            name: "revoke_role";
            discriminator: [27, 245, 2, 249, 210, 176, 117, 19];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "role_manager";
                    writable: true;
                }
            ];
            args: [
                {
                    name: "role";
                    type: {
                        defined: {
                            name: "RoleType";
                        };
                    };
                },
                {
                    name: "revokee";
                    type: "pubkey";
                }
            ];
        },
        {
            name: "seize";
            discriminator: [178, 210, 188, 237, 185, 78, 137, 4];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "role_manager";
                },
                {
                    name: "mint";
                    writable: true;
                },
                {
                    name: "source_token_account";
                    writable: true;
                },
                {
                    name: "destination_token_account";
                    writable: true;
                },
                {
                    name: "token_program";
                }
            ];
            args: [{
                name: "amount";
                type: "u64";
            }];
        },
        {
            name: "thaw_account";
            discriminator: [199, 35, 125, 222, 154, 134, 146, 208];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "mint";
                    writable: true;
                },
                {
                    name: "token_account";
                    writable: true;
                },
                {
                    name: "token_program";
                }
            ];
            args: [];
        },
        {
            name: "transfer_authority";
            discriminator: [91, 138, 234, 149, 159, 185, 10, 221];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                    writable: true;
                }
            ];
            args: [{
                name: "new_authority";
                type: "pubkey";
            }];
        },
        {
            name: "unpause";
            discriminator: [34, 142, 11, 253, 110, 227, 138, 222];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                    writable: true;
                }
            ];
            args: [];
        },
        {
            name: "update_minter_quota";
            discriminator: [234, 103, 67, 82, 20, 80, 2, 97];
            accounts: [
                {
                    name: "authority";
                    signer: true;
                },
                {
                    name: "stablecoin_config";
                },
                {
                    name: "role_manager";
                    writable: true;
                }
            ];
            args: [
                {
                    name: "minter";
                    type: "pubkey";
                },
                {
                    name: "new_quota";
                    type: "u64";
                }
            ];
        }
    ];
    accounts: [
        {
            name: "BlacklistEntry";
            discriminator: [90, 245, 188, 207, 156, 95, 210, 171];
        },
        {
            name: "RoleManager";
            discriminator: [174, 157, 11, 222, 185, 251, 40, 182];
        },
        {
            name: "StablecoinConfig";
            discriminator: [247, 131, 180, 146, 252, 113, 166, 179];
        }
    ];
    types: [
        {
            name: "RoleType";
            type: {
                kind: "enum";
                variants: [
                    {
                        name: "Burner";
                    },
                    {
                        name: "Pauser";
                    },
                    {
                        name: "Blacklister";
                    },
                    {
                        name: "Seizer";
                    }
                ];
            };
        }
    ];
};
//# sourceMappingURL=sss_token.d.ts.map
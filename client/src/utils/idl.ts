import { IdlAccounts, Idl } from '@project-serum/anchor';

export const IDL: Idl = {
  "version": "0.1.0",
  "name": "referral_staking",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "rewardRate",
          "type": "u64"
        },
        {
          "name": "unlockDuration",
          "type": "i64"
        },
        {
          "name": "earlyUnstakePenalty",
          "type": "u64"
        },
        {
          "name": "minStakeAmount",
          "type": "u64"
        },
        {
          "name": "referralRewardRate",
          "type": "u64"
        }
      ]
    },
    {
      "name": "registerUser",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "referrer",
          "type": {
            "option": "publicKey"
          }
        }
      ]
    },
    {
      "name": "stake",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
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
      "name": "unstake",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
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
      "name": "claimRewards",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "compoundRewards",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userInfo",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "GlobalState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "tokenMint",
            "type": "publicKey"
          },
          {
            "name": "vault",
            "type": "publicKey"
          },
          {
            "name": "rewardRate",
            "type": "u64"
          },
          {
            "name": "unlockDuration",
            "type": "i64"
          },
          {
            "name": "earlyUnstakePenalty",
            "type": "u64"
          },
          {
            "name": "minStakeAmount",
            "type": "u64"
          },
          {
            "name": "referralRewardRate",
            "type": "u64"
          },
          {
            "name": "totalStaked",
            "type": "u64"
          },
          {
            "name": "stakersCount",
            "type": "u64"
          },
          {
            "name": "rewardPool",
            "type": "u64"
          },
          {
            "name": "lastUpdateTime",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "UserInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "stakedAmount",
            "type": "u64"
          },
          {
            "name": "rewards",
            "type": "u64"
          },
          {
            "name": "lastStakeTime",
            "type": "i64"
          },
          {
            "name": "lastClaimTime",
            "type": "i64"
          },
          {
            "name": "referrer",
            "type": {
              "option": "publicKey"
            }
          },
          {
            "name": "referralCount",
            "type": "u64"
          },
          {
            "name": "totalReferralRewards",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InsufficientStakedAmount",
      "msg": "Not enough tokens staked for this operation"
    },
    {
      "code": 6001,
      "name": "AmountTooSmall",
      "msg": "Amount is smaller than the minimum stake amount"
    },
    {
      "code": 6002,
      "name": "NoRewardsToClaim",
      "msg": "No rewards to claim"
    },
    {
      "code": 6003,
      "name": "InsufficientRewardPool",
      "msg": "Insufficient tokens in the reward pool"
    }
  ]
};

export type ReferralStaking = {
  "version": "0.1.0",
  "name": "referral_staking",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "rewardRate",
          "type": "u64"
        },
        {
          "name": "unlockDuration",
          "type": "i64"
        },
        {
          "name": "earlyUnstakePenalty",
          "type": "u64"
        },
        {
          "name": "minStakeAmount",
          "type": "u64"
        },
        {
          "name": "referralRewardRate",
          "type": "u64"
        }
      ]
    },
    {
      "name": "registerUser",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "globalState",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "referrer",
          "type": {
            "option": "publicKey"
          }
        }
      ]
    },
    {
      "name": "stake",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
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
      "name": "unstake",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
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
      "name": "claimRewards",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userInfo",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "compoundRewards",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "globalState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userInfo",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "globalState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "tokenMint",
            "type": "publicKey"
          },
          {
            "name": "vault",
            "type": "publicKey"
          },
          {
            "name": "rewardRate",
            "type": "u64"
          },
          {
            "name": "unlockDuration",
            "type": "i64"
          },
          {
            "name": "earlyUnstakePenalty",
            "type": "u64"
          },
          {
            "name": "minStakeAmount",
            "type": "u64"
          },
          {
            "name": "referralRewardRate",
            "type": "u64"
          },
          {
            "name": "totalStaked",
            "type": "u64"
          },
          {
            "name": "stakersCount",
            "type": "u64"
          },
          {
            "name": "rewardPool",
            "type": "u64"
          },
          {
            "name": "lastUpdateTime",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "stakedAmount",
            "type": "u64"
          },
          {
            "name": "rewards",
            "type": "u64"
          },
          {
            "name": "lastStakeTime",
            "type": "i64"
          },
          {
            "name": "lastClaimTime",
            "type": "i64"
          },
          {
            "name": "referrer",
            "type": {
              "option": "publicKey"
            }
          },
          {
            "name": "referralCount",
            "type": "u64"
          },
          {
            "name": "totalReferralRewards",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InsufficientStakedAmount",
      "msg": "Not enough tokens staked for this operation"
    },
    {
      "code": 6001,
      "name": "AmountTooSmall",
      "msg": "Amount is smaller than the minimum stake amount"
    },
    {
      "code": 6002,
      "name": "NoRewardsToClaim",
      "msg": "No rewards to claim"
    },
    {
      "code": 6003,
      "name": "InsufficientRewardPool",
      "msg": "Insufficient tokens in the reward pool"
    }
  ]
};

export type GlobalState = IdlAccounts<ReferralStaking>["globalState"];
export type UserInfo = IdlAccounts<ReferralStaking>["userInfo"];

export type ReferralStaking = {
  "version": string;
  "name": string;
  "instructions": Array<{
    "name": string;
    "accounts": Array<{
      "name": string;
      "isMut": boolean;
      "isSigner": boolean;
    }>;
    "args": Array<{
      "name": string;
      "type": string | { "option": string };
    }>;
  }>;
  "accounts": Array<{
    "name": string;
    "type": {
      "kind": string;
      "fields": Array<{
        "name": string;
        "type": string | { "option": string };
      }>;
    };
  }>;
  "errors": Array<{
    "code": number;
    "name": string;
    "msg": string;
  }>;
};
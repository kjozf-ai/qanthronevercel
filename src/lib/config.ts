// QAN TestNet konfiguráció
export const QAN_CHAIN_ID = 1121;

export const QAN_NETWORK = {
  chainId:         "0x" + QAN_CHAIN_ID.toString(16),
  chainName:       "QAN TestNet",
  rpcUrls:         ["https://rpc-testnet.qanplatform.com"],
  nativeCurrency:  { name: "QANX", symbol: "QANX", decimals: 18 },
  blockExplorerUrls: ["https://testnet.qanscan.com"],
};

export const ENTRY_FEE_QANX = "0.001";
export const ENTRY_FEE_WEI  = "1000000000000000";

export const ACHIEVEMENTS: Record<number, { icon: string; name: string; desc: string; color: string }> = {
  1:  { icon: "sword",  name: "First Blood",      desc: "Elsoként foglaltad el a trónt",    color: "#ef4444" },
  2:  { icon: "crown",  name: "Triple Crown",      desc: "3x voltál király",                color: "#f5a623" },
  4:  { icon: "star",   name: "Legendary King",    desc: "5x voltál király",                color: "#fcd34d" },
  8:  { icon: "timer",  name: "Long Reign",         desc: "Több mint 1 órat uraltál",        color: "#8b5cf6" },
  16: { icon: "fire",   name: "Epic Reign",         desc: "Több mint 24 órat uraltál",       color: "#f97316" },
  32: { icon: "trophy", name: "Season Champion",   desc: "Megnyerted a szezont",             color: "#22c55e" },
};

export const POLL_INTERVAL_MS = 12000;

// Hardkodolt kontraktus cim - QAN TestNet
export const THRONE_CONTRACT_ADDRESS = "0xb83a0938921d2034b43425C144d0BC82ee1D205a";

export const NO_CONTRACT_MSG =
  "A QanThrone kontraktot még nem deployolták. Futtasd: npm run deploy";

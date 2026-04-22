import { useState, useEffect, useCallback, useRef } from "react";
import { ethers, Contract } from "ethers";
import { QAN_CHAIN_ID, QAN_NETWORK, ENTRY_FEE_WEI, POLL_INTERVAL_MS, THRONE_CONTRACT_ADDRESS } from "../lib/config";
import abiData from "../lib/abi/QanThrone.json";

// ── Típusok ───────────────────────────────────────────────────
export interface KingInfo {
  address:      string;
  nickname:     string;
  claimedAt:    number;
  reignSeconds: number;
  achievements: number;
}

export interface TopKing {
  address:      string;
  nickname:     string;
  timesClaimed: number;
  reignSeconds: number;
  achievements: number;
}

export interface FeedEvent {
  id:        string;
  type:      "claimed" | "achievement" | "season";
  king:      string;
  nickname:  string;
  extra?:    string;
  timestamp: number;
}

export interface SeasonInfo {
  number:     number;
  start:      number;
  ends:       number;
  pot:        string;   // ETH formatted
  remaining:  number;   // seconds
  totalKings: number;
  claims:     number;
}

// ── Hook ─────────────────────────────────────────────────────
export function useThrone() {
  const [wallet,      setWallet]      = useState<string>("");
  const [chainOk,     setChainOk]     = useState(false);
  const [currentKing, setCurrentKing] = useState<KingInfo | null>(null);
  const [topKings,    setTopKings]    = useState<TopKing[]>([]);
  const [feed,        setFeed]        = useState<FeedEvent[]>([]);
  const [season,      setSeason]      = useState<SeasonInfo | null>(null);
  const [txPending,   setTxPending]   = useState(false);
  const [error,       setError]       = useState<string>("");
  const [contractReady, setContractReady] = useState(false);

  // Hardkódolt cím — megbízható, nem függ az addresses.json betöltésétől
  const throneAddr = THRONE_CONTRACT_ADDRESS;
  const abi        = (abiData as any).abi as ethers.InterfaceAbi;

  // ── Contract elérhetőség ──────────────────────────────────
  const isContractConfigured = !!(throneAddr && throneAddr.length > 5 && abi.length > 0);

  // ── Read-only provider (nincs wallet szükséges) ──────────
  // batchMaxCount: 1 — QAN TestNet nem támogatja a batch JSON-RPC kéréseket
  const roProvider = useRef<ethers.JsonRpcProvider | null>(null);
  const roContract = useRef<Contract | null>(null);

  useEffect(() => {
    if (!isContractConfigured) return;
    try {
      roProvider.current = new ethers.JsonRpcProvider(
        "https://rpc-testnet.qanplatform.com",
        { chainId: QAN_CHAIN_ID, name: "qan-testnet" },
        { batchMaxCount: 1 }
      );
      roContract.current = new Contract(throneAddr, abi, roProvider.current);
      setContractReady(true);
      fetchAll();
    } catch (e) {
      console.error("RO provider init hiba:", e);
    }
  }, [isContractConfigured]);

  // ── Adatok lekérése ───────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!roContract.current) return;
    try {
      await Promise.all([fetchKing(), fetchTop(), fetchSeason(), fetchFeed()]);
    } catch (e) {
      console.warn("fetchAll hiba:", e);
    }
  }, []);

  const fetchKing = useCallback(async () => {
    if (!roContract.current) return;
    try {
      const [king, nickname, claimedAt, reignSec, achievements] =
        await roContract.current.getCurrentKing();
      setCurrentKing({
        address:      king as string,
        nickname:     nickname as string,
        claimedAt:    Number(claimedAt),
        reignSeconds: Number(reignSec),
        achievements: Number(achievements),
      });
    } catch (e) {
      console.warn("fetchKing hiba:", e);
    }
  }, []);

  const fetchTop = useCallback(async () => {
    if (!roContract.current) return;
    try {
      const [kings, nicknames, times, reigns, achs] =
        await roContract.current.getTopKings(10);
      const result: TopKing[] = [];
      for (let i = 0; i < (kings as string[]).length; i++) {
        if ((kings as string[])[i] === ethers.ZeroAddress) continue;
        result.push({
          address:      (kings as string[])[i],
          nickname:     (nicknames as string[])[i],
          timesClaimed: Number((times as bigint[])[i]),
          reignSeconds: Number((reigns as bigint[])[i]),
          achievements: Number((achs as number[])[i]),
        });
      }
      setTopKings(result);
    } catch (e) {
      console.warn("fetchTop hiba:", e);
    }
  }, []);

  const fetchSeason = useCallback(async () => {
    if (!roContract.current) return;
    try {
      const [num, start, ends, pot, rem, totalK, claims] =
        await roContract.current.getSeasonInfo();
      setSeason({
        number:     Number(num),
        start:      Number(start),
        ends:       Number(ends),
        pot:        ethers.formatEther(pot as bigint),
        remaining:  Number(rem),
        totalKings: Number(totalK),
        claims:     Number(claims),
      });
    } catch (e) {
      console.warn("fetchSeason hiba:", e);
    }
  }, []);

  // ── Feed: eseménynapló az events-ből ─────────────────────
  const fetchFeed = useCallback(async () => {
    if (!roContract.current || !roProvider.current) return;
    try {
      const latestBlock = await roProvider.current.getBlockNumber();
      const fromBlock   = Math.max(0, latestBlock - 5000);

      const claimedFilter = roContract.current.filters.ThroneClaimed();
      const claimedLogs   = await roContract.current.queryFilter(claimedFilter, fromBlock);

      const achFilter  = roContract.current.filters.AchievementUnlocked();
      const achLogs    = await roContract.current.queryFilter(achFilter, fromBlock);

      const seasonFilter = roContract.current.filters.SeasonEnded();
      const seasonLogs   = await roContract.current.queryFilter(seasonFilter, fromBlock);

      const events: FeedEvent[] = [];

      for (const log of claimedLogs) {
        const args = (log as ethers.EventLog).args;
        let ts = 0;
        try { ts = (await log.getBlock()).timestamp; } catch { ts = Math.floor(Date.now() / 1000); }
        events.push({
          id:        log.transactionHash + log.index,
          type:      "claimed",
          king:      args[0] as string,
          nickname:  args[2] as string,
          timestamp: ts,
        });
      }
      for (const log of achLogs) {
        const args = (log as ethers.EventLog).args;
        let ts = 0;
        try { ts = (await log.getBlock()).timestamp; } catch { ts = Math.floor(Date.now() / 1000); }
        events.push({
          id:        log.transactionHash + "a" + log.index,
          type:      "achievement",
          king:      args[0] as string,
          nickname:  "",
          extra:     args[2] as string,
          timestamp: ts,
        });
      }
      for (const log of seasonLogs) {
        const args = (log as ethers.EventLog).args;
        let ts = 0;
        try { ts = (await log.getBlock()).timestamp; } catch { ts = Math.floor(Date.now() / 1000); }
        events.push({
          id:        log.transactionHash + "s" + log.index,
          type:      "season",
          king:      args[0] as string,
          nickname:  "",
          extra:     `Szezon #${args[1]} vége — nyeremény: ${ethers.formatEther(args[3] as bigint)} QANX`,
          timestamp: ts,
        });
      }

      events.sort((a, b) => b.timestamp - a.timestamp);
      setFeed(events.slice(0, 30));
    } catch (e) {
      console.warn("fetchFeed hiba:", e);
    }
  }, []);

  // ── Wallet csatlakozás — raw window.ethereum (coin-flip mintájára) ──
  // NEM BrowserProvider wrapper — az okozta a "wallet must has at least one account" hibát
  const connectWallet = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setError("MetaMask nem található! Telepítsd: metamask.io");
      return;
    }
    try {
      setError("");
      // Raw EIP-1193 kérés — nincs ethers.js BrowserProvider közvetítő
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts.length) { setError("Nincs elérhető account a MetaMask-ban."); return; }

      const chainIdHex: string = await eth.request({ method: "eth_chainId" });
      const chainIdNum = parseInt(chainIdHex, 16);

      setWallet(accounts[0]);

      if (chainIdNum !== QAN_CHAIN_ID) {
        await switchToQAN(eth);
      } else {
        setChainOk(true);
      }
    } catch (e: any) {
      if (e?.code === 4001 || e?.message?.includes("rejected") || e?.message?.includes("denied")) {
        setError("Kapcsolatot visszautasítottad. Kérjük engedélyezd a MetaMask-ban!");
      } else {
        setError(e?.message || "Wallet csatlakozási hiba");
      }
    }
  }, []);

  const switchToQAN = async (eth: any) => {
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: QAN_NETWORK.chainId }],
      });
      setChainOk(true);
    } catch (switchErr: any) {
      if (switchErr.code === 4902) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [QAN_NETWORK],
          });
          setChainOk(true);
        } catch (addErr: any) {
          setError("QAN TestNet hozzáadása sikertelen: " + addErr.message);
        }
      } else {
        setError("Hálózat váltás sikertelen: " + switchErr.message);
      }
    }
  };

  // ── Trón foglalása — raw eth_sendTransaction (nincs estimateGas) ──
  const claimThrone = useCallback(async (nickname: string): Promise<boolean> => {
    const eth = (window as any).ethereum;
    if (!wallet)  { setError("Nem csatlakoztál walletre!"); return false; }
    if (!chainOk) { setError("Kapcsolódj a QAN TestNethez!"); return false; }
    if (nickname.trim().length < 2) { setError("A becenév legalább 2 karakter!"); return false; }
    if (!eth) { setError("MetaMask nem elérhető!"); return false; }

    setError("");
    setTxPending(true);
    try {
      // ABI enkódolás — ethers.js Interface segítségével
      const iface = new ethers.Interface(abi);
      const data  = iface.encodeFunctionData("claimThrone", [nickname.trim()]);

      // Raw eth_sendTransaction — nincs estimateGas, nincs BrowserProvider közvetítő
      // gas: 0x493E0 = 300000 decimálisan
      const txHash: string = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from:  wallet,
          to:    throneAddr,
          value: "0x" + BigInt(ENTRY_FEE_WEI).toString(16),
          data:  data,
          gas:   "0x493E0",
        }],
      });

      // Visszaigazolásra várunk a read-only provider segítségével
      if (roProvider.current) {
        await roProvider.current.waitForTransaction(txHash, 1, 120000);
      }

      setTxPending(false);
      await fetchAll();
      return true;
    } catch (e: any) {
      const msg: string = e?.reason || e?.message || "Tranzakció hiba";
      if (e?.code === 4001 || msg.includes("user rejected") || msg.includes("denied")) {
        setError("Tranzakciót visszautasítottad.");
      } else {
        setError(msg);
      }
      setTxPending(false);
      return false;
    }
  }, [wallet, chainOk, fetchAll]);


  // Poll
  useEffect(() => {
    if (!contractReady) return;
    const id = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [contractReady, fetchAll]);

  // MetaMask account/chain valtozas figyelese
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const onAccount = (accs: string[]) => {
      setWallet(accs[0] ?? "");
      if (!accs[0]) setChainOk(false);
    };
    const onChain = (cid: string) => {
      const ok = parseInt(cid, 16) === QAN_CHAIN_ID;
      setChainOk(ok);
    };
    eth.on("accountsChanged", onAccount);
    eth.on("chainChanged",    onChain);
    return () => {
      eth.removeListener("accountsChanged", onAccount);
      eth.removeListener("chainChanged",    onChain);
    };
  }, []);

  return {
    wallet, chainOk,
    currentKing, topKings, feed, season,
    txPending, error, isContractConfigured,
    connectWallet, claimThrone,
    refresh: fetchAll,
    clearError: () => setError(""),
  };
}

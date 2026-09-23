"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./SettingsPanel.module.css";

type ConsensusState = {
  writable: boolean;
  consensus: {
    configured: boolean;
    source: string;
    environmentManaged: boolean;
  };
};

type CodexState = {
  available: boolean;
  authenticated: boolean;
  mode?: string;
  reason?: string;
};

type CodexSession = {
  id: string;
  status: "starting" | "waiting" | "authenticated" | "error" | "cancelled";
  verificationUrl?: string;
  userCode?: string;
  error?: string;
  startedAt?: number;
};

type Profile = {
  name: string;
  role: string;
};

const emptyProfile: Profile = { name: "", role: "" };

export function SettingsPanel() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [profileMessage, setProfileMessage] = useState("");
  const [integrations, setIntegrations] = useState<ConsensusState | null>(null);
  const [consensusKey, setConsensusKey] = useState("");
  const [consensusBusy, setConsensusBusy] = useState(false);
  const [consensusMessage, setConsensusMessage] = useState("");
  const [consensusError, setConsensusError] = useState("");
  const [codex, setCodex] = useState<CodexState | null>(null);
  const [codexSession, setCodexSession] = useState<CodexSession | null>(null);
  const [codexBusy, setCodexBusy] = useState(false);
  const [codexError, setCodexError] = useState("");
  const [copied, setCopied] = useState(false);

  const refreshIntegrations = useCallback(async () => {
    const response = await fetch("/api/settings/integrations", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load integration settings.");
    setIntegrations(payload);
  }, []);

  const refreshCodex = useCallback(async () => {
    const response = await fetch("/api/settings/codex-auth", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load Codex authorization status.");
    setCodex(payload.codex ?? null);
    setCodexSession(payload.session ?? null);
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("observaire-profile");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Profile>;
        setProfile({
          name: typeof parsed.name === "string" ? parsed.name : "",
          role: typeof parsed.role === "string" ? parsed.role : "",
        });
      }
    } catch {
      // Profile preferences are optional and browser-local.
    }

    void refreshIntegrations().catch((error) => setConsensusError(error instanceof Error ? error.message : "Could not load settings."));
    void refreshCodex().catch((error) => setCodexError(error instanceof Error ? error.message : "Could not load Codex status."));
  }, [refreshCodex, refreshIntegrations]);

  useEffect(() => {
    if (codexSession?.status !== "starting" && codexSession?.status !== "waiting") return;
    const timer = window.setInterval(() => {
      void refreshCodex().catch((error) => setCodexError(error instanceof Error ? error.message : "Could not refresh Codex status."));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [codexSession?.status, refreshCodex]);

  function saveProfile() {
    const clean = {
      name: profile.name.trim().slice(0, 120),
      role: profile.role.trim().slice(0, 120),
    };
    setProfile(clean);
    try {
      window.localStorage.setItem("observaire-profile", JSON.stringify(clean));
      setProfileMessage("Profile preferences saved in this browser.");
    } catch {
      setProfileMessage("This browser did not allow profile storage.");
    }
  }

  async function consensusAction(action: "test-consensus" | "save-consensus") {
    if (!consensusKey.trim() || consensusBusy) return;
    setConsensusBusy(true);
    setConsensusError("");
    setConsensusMessage("");
    try {
      const response = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, apiKey: consensusKey.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Consensus settings update failed.");
      if (action === "test-consensus") {
        setConsensusMessage("Connection successful. The key can search Consensus.");
      } else {
        setConsensusKey("");
        setConsensusMessage("Consensus API key saved on the server for this workspace.");
        await refreshIntegrations();
      }
    } catch (error) {
      setConsensusError(error instanceof Error ? error.message : "Consensus settings update failed.");
    } finally {
      setConsensusBusy(false);
    }
  }

  async function clearConsensus() {
    if (consensusBusy) return;
    setConsensusBusy(true);
    setConsensusError("");
    setConsensusMessage("");
    try {
      const response = await fetch("/api/settings/integrations", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not clear Consensus settings.");
      setConsensusKey("");
      setConsensusMessage("Workspace-stored Consensus key cleared.");
      await refreshIntegrations();
    } catch (error) {
      setConsensusError(error instanceof Error ? error.message : "Could not clear Consensus settings.");
    } finally {
      setConsensusBusy(false);
    }
  }

  async function codexAction(action: "start" | "cancel" | "logout") {
    if (codexBusy) return;
    setCodexBusy(true);
    setCodexError("");
    try {
      const response = await fetch("/api/settings/codex-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Codex authorization action failed.");
      setCodex(payload.codex ?? codex);
      setCodexSession(payload.session ?? null);
      if (action === "logout") await refreshCodex();
    } catch (error) {
      setCodexError(error instanceof Error ? error.message : "Codex authorization action failed.");
    } finally {
      setCodexBusy(false);
    }
  }

  async function copyCode() {
    if (!codexSession?.userCode) return;
    try {
      await navigator.clipboard.writeText(codexSession.userCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCodexError("Could not copy the device code. Select and copy it manually.");
    }
  }

  const consensusConfigured = integrations?.consensus.configured ?? false;
  const consensusManagedByEnv = integrations?.consensus.environmentManaged ?? false;
  const canWriteConsensus = Boolean(integrations?.writable && !consensusManagedByEnv);
  const codexWaiting = codexSession?.status === "starting" || codexSession?.status === "waiting";
  const codexAuthenticated = codex?.authenticated || codexSession?.status === "authenticated";

  return (
    <div className={styles.shell}>
      <section className={`panel ${styles.card}`}>
        <header className={styles.cardHeader}>
          <div>
            <span className="kicker">Profile</span>
            <h2>Your research identity</h2>
            <p>Lightweight preferences for this browser. No account or secret is created.</p>
          </div>
          <span className={styles.badge}>browser-local</span>
        </header>

        <div className={styles.fields}>
          <label className={styles.field}>
            <span>Display name</span>
            <input className={styles.input} value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} placeholder="Your name" />
          </label>
          <label className={styles.field}>
            <span>Role <small>optional</small></span>
            <input className={styles.input} value={profile.role} onChange={(event) => setProfile((current) => ({ ...current, role: event.target.value }))} placeholder="Researcher, engineer, student…" />
          </label>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.buttonPrimary} onClick={saveProfile}>Save profile</button>
        </div>
        {profileMessage && <p className={`${styles.status} ${styles.success}`}>{profileMessage}</p>}
      </section>

      <section className={`panel ${styles.card}`}>
        <header className={styles.cardHeader}>
          <div>
            <span className="kicker">Integrations</span>
            <h2>Research services</h2>
            <p>Authorize Codex and configure Consensus without exposing credentials to client code.</p>
          </div>
          <span className={styles.badge}>server-side</span>
        </header>

        <div className={styles.integrationStack}>
          <article className={styles.integration}>
            <div className={styles.integrationTop}>
              <div>
                <strong>Consensus</strong>
                <span>{consensusConfigured ? `configured · ${integrations?.consensus.source}` : "not configured"}</span>
              </div>
              <span className={`${styles.badge} ${consensusConfigured ? styles.badgeReady : ""}`}>{consensusConfigured ? "ready" : "offline"}</span>
            </div>

            {consensusManagedByEnv ? (
              <p className={styles.status}>Consensus is managed by the server environment. The API key is never returned to this page.</p>
            ) : (
              <>
                <label className={`${styles.field} ${styles.fields}`}>
                  <span>Consensus API key <small>stored only in the git-ignored local workspace settings file</small></span>
                  <input className={styles.input} type="password" autoComplete="off" value={consensusKey} onChange={(event) => setConsensusKey(event.target.value)} placeholder={consensusConfigured ? "Enter a replacement key" : "Paste API key"} />
                </label>
                <div className={styles.actions}>
                  <button type="button" className={styles.button} disabled={!consensusKey.trim() || consensusBusy} onClick={() => void consensusAction("test-consensus")}>Test connection</button>
                  <button type="button" className={styles.buttonPrimary} disabled={!canWriteConsensus || !consensusKey.trim() || consensusBusy} onClick={() => void consensusAction("save-consensus")}>{consensusBusy ? "Working…" : "Save key"}</button>
                  {consensusConfigured && <button type="button" className={styles.buttonDanger} disabled={!canWriteConsensus || consensusBusy} onClick={() => void clearConsensus()}>Clear stored key</button>}
                </div>
              </>
            )}
            {!integrations?.writable && !consensusManagedByEnv && <p className={styles.status}>Settings writes are disabled in this environment. Configure the server environment or explicitly enable settings writes.</p>}
            {consensusMessage && <p className={`${styles.status} ${styles.success}`}>{consensusMessage}</p>}
            {consensusError && <p className={`${styles.status} ${styles.error}`}>{consensusError}</p>}
          </article>

          <article className={styles.integration}>
            <div className={styles.integrationTop}>
              <div>
                <strong>Codex</strong>
                <span>{codexAuthenticated ? `authorized${codex?.mode ? ` · ${codex.mode}` : ""}` : codex?.available ? "installed · authorization required" : "unavailable"}</span>
              </div>
              <span className={`${styles.badge} ${codexAuthenticated ? styles.badgeReady : ""}`}>{codexAuthenticated ? "ready" : codexWaiting ? "waiting" : "offline"}</span>
            </div>

            {codex?.reason && !codexWaiting && <p className={styles.status}>{codex.reason}</p>}

            {codexWaiting && (
              <div className={styles.device}>
                <strong>Complete Codex authorization</strong>
                <p className={styles.note}>Observaire started the local Codex CLI device authorization because you clicked Sign in. The one-time code expires in about 15 minutes.</p>
                {codexSession?.verificationUrl && <a className={styles.linkButton} href={codexSession.verificationUrl} target="_blank" rel="noreferrer">Open ChatGPT authorization ↗</a>}
                {codexSession?.userCode && (
                  <div className={styles.deviceCode}>
                    <code>{codexSession.userCode}</code>
                    <button type="button" className={styles.button} onClick={() => void copyCode()}>{copied ? "Copied ✓" : "Copy code"}</button>
                  </div>
                )}
              </div>
            )}

            {codexSession?.status === "error" && <p className={`${styles.status} ${styles.error}`}>{codexSession.error || "Codex authorization failed."}</p>}
            {codexError && <p className={`${styles.status} ${styles.error}`}>{codexError}</p>}

            <div className={styles.actions}>
              {!codexAuthenticated && !codexWaiting && <button type="button" className={styles.buttonPrimary} disabled={codexBusy || codex?.available === false} onClick={() => void codexAction("start")}>{codexBusy ? "Starting…" : "Sign in with ChatGPT"}</button>}
              {codexWaiting && <button type="button" className={styles.buttonDanger} disabled={codexBusy} onClick={() => void codexAction("cancel")}>Cancel authorization</button>}
              {codexAuthenticated && <button type="button" className={styles.buttonDanger} disabled={codexBusy} onClick={() => void codexAction("logout")}>{codexBusy ? "Signing out…" : "Disconnect Codex"}</button>}
              <button type="button" className={styles.button} disabled={codexBusy} onClick={() => void refreshCodex().catch((error) => setCodexError(error instanceof Error ? error.message : "Could not refresh Codex status."))}>Refresh status</button>
            </div>
          </article>
        </div>

        <p className={styles.securityNote}>Observaire never reads or returns Codex access tokens. Codex credentials remain in the Codex CLI credential store. Workspace-stored Consensus keys live under the git-ignored <code>.research-observer/</code> directory and are never sent to the browser after saving.</p>
      </section>
    </div>
  );
}

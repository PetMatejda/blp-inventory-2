import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Copy, KeyRound, Trash2, RefreshCw } from 'lucide-react';
import { auth } from '../../services/firebase';
import { useDialogs } from '../common/Dialogs';

// Settings › Přístup pro AI (MCP): personal tokens for Claude / Antigravity.
// Tokens are created and revoked by /api/mcp-tokens (server stores only a hash).

const SCOPE_LABEL = { read: 'jen čtení', write: 'čtení i zápis' };
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }) : '—');

async function api(method, path = '', body) {
  const user = auth.currentUser;
  if (!user) throw new Error('Nejste přihlášeni.');
  const idToken = await user.getIdToken();
  const res = await fetch(`/api/mcp-tokens${path}`, {
    method,
    headers: { Authorization: `Bearer ${idToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Chyba serveru (${res.status})`);
  return data;
}

const CopyRow = ({ label, value, onCopy }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-outline">{label}</span>
    <div className="flex gap-2 items-start">
      <code className="flex-1 min-w-0 break-all text-xs bg-card-bg border border-outline-variant rounded-lg p-2 text-on-surface">{value}</code>
      <button type="button" onClick={() => onCopy(value)} className="h-9 w-9 shrink-0 rounded-lg border border-outline-variant flex items-center justify-center text-on-surface" aria-label={`Zkopírovat: ${label}`}>
        <Copy className="w-4 h-4" />
      </button>
    </div>
  </div>
);

export const McpAccessSection = () => {
  const { confirm, toast } = useDialogs();
  const [tokens, setTokens] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState('read');
  const [created, setCreated] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try { setTokens((await api('GET')).tokens); } catch (e) { setError(e.message); setTokens([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast({ text: 'Zkopírováno' }); } catch { toast({ text: 'Kopírování se nepovedlo – označte text ručně.' }); }
  };

  const create = async () => {
    setBusy(true); setError('');
    try {
      const data = await api('POST', '', { label: label.trim() || 'AI klient', scope });
      setCreated(data);
      setLabel('');
      await load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const revoke = async (t) => {
    if (!(await confirm({ title: 'Zrušit token?', message: `„${t.label}“ přestane okamžitě fungovat. Klienti, kteří ho používají, se odpojí.`, confirmLabel: 'Zrušit token', danger: true }))) return;
    setBusy(true);
    try { await api('DELETE', `?id=${encodeURIComponent(t.id)}`); await load(); } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const mcpUrl = `${origin}/api/mcp`;

  return (
    <details className="bg-surface-container p-3 rounded-xl border border-outline-variant text-sm">
      <summary className="font-semibold text-on-surface cursor-pointer flex items-center gap-1.5">
        <Bot className="w-4 h-4 text-primary" /> Přístup pro AI (MCP)
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-xs text-on-surface-variant">
          Osobní token propojí Claude (Cowork, claude.ai, Claude Code) nebo Antigravity s BLP Inventory.
          Změny přes AI se zapisují pod vaším jménem. Token „jen čtení“ nic nezmění; „čtení i zápis“ umí
          zakládat zakázky a plánovat položky (vždy s náhledem a potvrzením).
        </p>

        {created && (
          <div className="flex flex-col gap-2 p-3 rounded-xl border border-primary bg-primary-container/20">
            <p className="text-xs font-bold text-on-surface flex items-center gap-1.5"><KeyRound className="w-4 h-4" /> Token „{created.record.label}“ ({SCOPE_LABEL[created.record.scope]}) – zobrazí se jen teď</p>
            <CopyRow label="Token" value={created.token} onCopy={copy} />
            <CopyRow label="Claude Cowork / claude.ai – URL vlastního konektoru (bez hlaviček)" value={`${mcpUrl}?key=${created.token}`} onCopy={copy} />
            <CopyRow label="Claude Code – příkaz do terminálu" value={`claude mcp add --scope user --transport http blp-inventory ${mcpUrl} --header "Authorization: Bearer ${created.token}"`} onCopy={copy} />
            <button type="button" onClick={() => setCreated(null)} className="h-10 rounded-xl border border-outline-variant text-on-surface font-semibold">Mám uloženo, skrýt</button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input
            value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60}
            placeholder="Název, např. Claude Cowork – notebook"
            className="h-11 px-3 rounded-xl border border-outline-variant bg-card-bg text-on-surface"
          />
          <div className="grid grid-cols-2 gap-2">
            {['read', 'write'].map((s) => (
              <button key={s} type="button" onClick={() => setScope(s)}
                className={`h-11 rounded-xl border text-xs font-bold ${scope === s ? 'bg-primary-container text-on-primary-container border-primary' : 'bg-card-bg text-outline border-outline-variant'}`}>
                {s === 'read' ? 'Jen čtení' : 'Čtení i zápis'}
              </button>
            ))}
          </div>
          <button type="button" onClick={create} disabled={busy}
            className="h-11 rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50">
            {busy ? 'Pracuji…' : 'Vytvořit token'}
          </button>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-outline uppercase font-bold">Moje tokeny</span>
          <button type="button" onClick={load} className="h-8 w-8 rounded-lg flex items-center justify-center text-outline" aria-label="Obnovit seznam"><RefreshCw className="w-4 h-4" /></button>
        </div>
        {tokens === null ? <p className="text-xs text-outline">Načítám…</p>
          : tokens.length === 0 ? <p className="text-xs text-outline">Zatím žádný token.</p>
            : (
              <ul className="flex flex-col gap-2">
                {tokens.map((t) => (
                  <li key={t.id} className={`flex items-center gap-2 p-2 rounded-lg border border-outline-variant ${t.revoked ? 'opacity-50' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-on-surface truncate">{t.label}</p>
                      <p className="text-xs text-outline">
                        {SCOPE_LABEL[t.scope] || t.scope} · vytvořen {fmt(t.createdAt)} · použit {fmt(t.lastUsedAt)}{t.revoked ? ' · zrušen' : ''}
                      </p>
                    </div>
                    {!t.revoked && (
                      <button type="button" onClick={() => revoke(t)} disabled={busy} className="h-9 w-9 shrink-0 rounded-lg border border-error/40 text-error flex items-center justify-center" aria-label={`Zrušit token ${t.label}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
      </div>
    </details>
  );
};

# MCP server na Vercelu – analýza a návrh

Stav: **návrh** (2026-11-15). Nic z toho zatím není implementováno.
Souvisí s [`VOICE_INTERFACE_PLAN.md`](./VOICE_INTERFACE_PLAN.md) – sdílí serverový základ `api/_lib`.

## 1. Cíl

Napojit BLP Inventory přes **MCP (Model Context Protocol)** na AI klienty, aby se dalo psát (nebo
mluvit) přímo v nich:

- **Claude** – Claude Code, Claude Desktop, claude.ai (vlastní konektor),
- **Google Antigravity** (IDE i CLI),
- případně další klienti s podporou vzdáleného MCP.

Příklady použití:
- „Co je na zakázce Granilla a kolik je naloženo?“
- „Kolik máme volných SkyPanelů 20.–22. 11.?“
- „Tady je e-mail od gaffera se seznamem světel – připrav podle něj zakázku Velká Amerika.“
- „Udělej novou zakázku podle Vodafone spotu, jen bez HMI a s dvojnásobkem kabelů.“

**Klíčový rozdíl proti hlasu v aplikaci:** jazyku tady rozumí model klienta (Claude, Gemini
v Antigravity). MCP server neobsahuje žádnou AI a **nepotřebuje Gemini ani žádný placený model** –
jen nabízí nástroje (hledat v katalogu, číst zakázky, navrhnout a zapsat změny).

## 2. Zásady

1. **Stejná pravidla jako aplikace.** Zápisy jdou přes `createInventoryActions` (a čisté funkce z
   `src/domain`) – stejné stavy, stejný audit. Žádná druhá implementace pravidel.
2. **Zápis vždy ve dvou krocích:** nástroj nejdřív vrátí **náhled** (`dryRun`, výchozí), skutečný
   zápis až s `confirm: true`. Klient (Claude) tak uživateli ukáže, co se změní, a čeká na souhlas.
3. **Úzký rozsah.** V první verzi jen čtení + příprava zakázek. Nakládka, derigging, sklad,
   naskladnění, inventura, mazání zakázek a úpravy katalogu přes MCP **ne**.
4. **Každý přístup patří konkrétnímu člověku ze schváleného seznamu** a je dohledatelný v auditu
   („Petr M. (MCP)“). Přístup jde kdykoli zrušit.
5. **Zdarma:** Vercel Hobby (pilot), Firestore Spark, žádná placená AI.

## 3. Architektura

```
 Claude Code / Desktop / claude.ai        Antigravity
          │  MCP, Streamable HTTP, HTTPS POST  │
          └──────────────┬─────────────────────┘
                         ▼
        https://<app>.vercel.app/api/mcp       (Vercel Function, bezstavová)
                         │
           1. ověření: osobní token (fáze A) / OAuth (fáze C)
           2. uživatel na schváleném seznamu?   (api/_lib/approvedEmails.js)
           3. MCP nástroj
                         │
                         ▼
        api/_lib/firestoreAdmin.js  (firebase-admin, servisní účet)
                         │  adminRepo: { newId, set, update, remove, commit }
                         ▼
        createInventoryActions({ repo: adminRepo, getState, getActor })
        src/domain/*  (items, voice, dostupnost)
                         │
                         ▼
                 Cloud Firestore  ──► aplikace na telefonech (realtime, jako dnes)
```

### 3.1 Transport a knihovna

- **Streamable HTTP v bezstavovém režimu** – každý požadavek je samostatný, sedí to na Vercel Functions
  (žádné trvalé spojení, žádná paměť mezi voláními).
- Knihovna: **oficiální MCP TypeScript SDK** (`@modelcontextprotocol/sdk`) v `api/mcp.js`.
  Vercel nabízí i vlastní `mcp-handler`, ale jeho dokumentace počítá hlavně s Next.js (projekt je
  Vite + `api/` funkce) – použití bez Next.js je potřeba ověřit. Proto **fáze 0 = spike**: minimální
  server s jedním nástrojem `ping`, nasadit na Vercel, připojit z Claude Code a z Antigravity, a teprve
  pak vybrat definitivně knihovnu.
- Vercel má k MCP vlastní návod („Deploy MCP servers to Vercel“, varianta s Vercel Functions).

### 3.2 Přístup k datům

- **firebase-admin** se servisním účtem (JSON klíč z Firebase Console → proměnná
  `FIREBASE_SERVICE_ACCOUNT` ve Vercelu). Funguje na bezplatném Spark plánu.
- Admin SDK **obchází `firestore.rules`** → autorizaci musí hlídat server sám (kap. 4). Proto úzký
  rozsah nástrojů a kontrola uživatele u každého volání.
- **`adminRepo`** – serverová obdoba `inventoryRepo.js` se stejným rozhraním (`newId`, `set`,
  `update`, `remove`, `commit`), převádí značky `{ __union }` / `{ __increment }` na `FieldValue`.
  Díky tomu se `createInventoryActions` použije beze změny.
- **`getState`** načte jen to, co nástroj potřebuje (zakázka + její položky, katalog). Katalog se
  drží v paměti funkce ~60 s (méně čtení z Firestore, limit Spark 50 000 čtení/den).
- Úprava kódu: `src/domain/stock.js` dnes importuje `utils/categoryIcons.jsx` (React) – výpočet
  dostupnosti se vyčlení do čistého modulu, aby šel spustit v Node. `inventoryActions.js` a
  `domain/items.js` jsou čisté už teď.

## 4. Přihlášení a oprávnění

Klienti se liší v tom, jak se přihlašují:

| Klient | Jak se připojí | Fáze |
|---|---|---|
| Claude Code | vzdálený HTTP server + hlavička `Authorization: Bearer <token>` | A |
| Antigravity | `mcp_config.json`: `serverUrl` + `headers` | A |
| Claude Desktop | přes místní most `mcp-remote` (npx) s hlavičkou, nebo jako konektor (OAuth) | A / C |
| claude.ai (web, mobil) | vlastní konektor – vyžaduje **OAuth** (nebo server bez přihlášení, což tu nepřipadá v úvahu) | C |

### Fáze A – osobní tokeny (jednoduché, hned)

- V aplikaci **Nastavení › Přístup pro AI (MCP)**: „Vytvořit token“ → aplikace vygeneruje náhodný
  token (např. `blp_mcp_…`, 32 bajtů), **ukáže ho jednou** a do Firestore uloží jen jeho SHA-256 hash:
  `mcpTokens/{hash}` = `{ uid, email, name, label: "Claude Code – notebook", createdAt, lastUsedAt, revoked }`.
- Seznam vlastních tokenů s tlačítkem **Zrušit**. Rules: uživatel smí vytvořit/číst/zrušit jen své.
- Server: hash z hlavičky → dokument → nezrušený → e-mail stále na schváleném seznamu → jméno pro audit.
- Volitelně rozsah tokenu: `read` / `write` (výchozí jen čtení).

### Fáze C – OAuth pro claude.ai a Claude Desktop konektory

- MCP autorizace podle specifikace (OAuth 2.1 + metadata `/.well-known/oauth-*`, dynamická registrace
  klienta). Přihlašovací stránka = stránka v aplikaci (`/mcp-login`), která použije **stávající
  Firebase přihlášení** (Google / e-mail), ověří schválený seznam a vydá kód → token.
- Tokeny podepsané tajným klíčem (`MCP_JWT_SECRET`), krátká platnost + refresh, zrušení v Nastavení.
- Je to nejpracnější část – dělá se až když fáze A funguje a bude jasné, že se MCP používá.

## 5. Nástroje (tools)

### Čtení (fáze B1)

| Nástroj | Vstup | Výstup |
|---|---|---|
| `list_jobs` | `status` (ACTIVE/ARCHIVED/ALL), `from`, `to`, `query` | zakázky: id, název, klient, termíny, fáze, průběh |
| `get_job` | `jobId` nebo `name` | zakázka + položky (plán, naloženo, stav, závady), souhrn po kategoriích |
| `search_catalog` | `query`, `category`, `limit` | položky katalogu: id, název, kategorie, aliasy, set? (složení) |
| `check_availability` | `items: [{catalogId, quantity}]`, `from`, `to`, `excludeJobId` | vlastněno / rezervováno jinde / chybí |
| `get_job_history` | `jobId`, `limit` | posledních N auditních záznamů |

### Zápis (fáze B2) – vždy náhled → potvrzení

| Nástroj | Vstup | Co dělá |
|---|---|---|
| `create_job` | název, klient, gaffer, BLP odpovědný, termíny | nová zakázka (`createJob`) |
| `duplicate_job` | `sourceJobId`, nové údaje | kopie zakázky ze vzoru (`duplicateJobAsTemplate`) |
| `plan_job_items` | `jobId`, `lines: [{catalogId \| name, quantity, op: ADD \| SET \| REMOVE}]`, `confirm` | stejná logika jako hlas (`applyVoicePlan`): bez `confirm` vrátí náhled „před → po“, nenalezené názvy, nedostatky skladu; s `confirm: true` zapíše jedním batchem |
| `add_adhoc_item` | `jobId`, název, kategorie, počet, `confirm` | Ad-Hoc položka |

Pravidla zápisu:
- Jen zakázky ve stavu `ACTIVE`; položky jen ve fázi `LOADING` (plánování). `REMOVE` jen u nenaložených.
- Náhled vrací i `previewId` (hash vstupu + verze dat); zápis s jiným stavem dat se odmítne
  („mezitím se zakázka změnila, zobraz náhled znovu“).
- Limity: max. 200 řádků na volání, max. N zápisů/min na token.
- MCP anotace: čtecí nástroje `readOnlyHint: true`; zápisové `destructiveHint` u `REMOVE`, aby
  klienti chtěli potvrzení.
- Audit: akce „… (MCP)“, `user` = jméno vlastníka tokenu, detail obsahuje název klienta (label tokenu).

### Volitelně později
- **Prompty (MCP prompts):** „Připrav zakázku z e-mailu/tabulky“, „Porovnej dvě zakázky“.
- **Zdroje (resources):** katalog jako čitelný dokument.
- Nakládka/derigging přes MCP – až bude důvod (na place se pracuje v aplikaci).

## 6. Konfigurace klientů (fáze A)

**Claude Code**
```bash
claude mcp add --transport http blp https://<app>.vercel.app/api/mcp --header "Authorization: Bearer blp_mcp_XXXX"
```

**Antigravity** – `mcp_config.json` (globálně v uživatelské konfiguraci Antigravity, nebo
`<workspace>/.agents/mcp_config.json`; přesné umístění podle verze – v Antigravity přes
„Manage MCP servers › View raw config“):
```json
{
  "mcpServers": {
    "blp-inventory": {
      "serverUrl": "https://<app>.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer blp_mcp_XXXX" }
    }
  }
}
```

**Claude Desktop (bez OAuth)** – `claude_desktop_config.json` přes most `mcp-remote`:
```json
{
  "mcpServers": {
    "blp-inventory": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<app>.vercel.app/api/mcp",
               "--header", "Authorization: Bearer blp_mcp_XXXX"]
    }
  }
}
```

**claude.ai / Claude Cowork** – Nastavení › Konektory › Přidat vlastní konektor → URL
`https://<app>.vercel.app/api/mcp`. Hlavička `Authorization` je u vlastních konektorů vyhrazená pro
OAuth, proto server přijímá token i v hlavičce **`X-BLP-Token: <token>`** (Request headers v dialogu).
Po fázi C se místo tokenu použije přihlášení přes BLP stránku (OAuth).

Token se nikdy necommituje do repa (Antigravity workspace config patří do `.gitignore`).

## 7. Bezpečnost

- Admin SDK obchází rules → **každé volání** ověří token/OAuth a schválený e-mail; nástroje pracují
  jen s kolekcemi `jobs`, `jobItems`, `catalog` (čtení), `auditLogs` (zápis), `stockLevels` (čtení).
- Servisní účet jen ve Vercel env; tokeny jen jako hash; zrušení okamžitě platí.
- Obsah z MCP (názvy, poznámky) může obsahovat cokoli, co do aplikace někdo napsal – klient ho má
  brát jako data. Server nevrací e-maily ostatních uživatelů ani tokeny.
- Zápis vždy dvoufázově (náhled → `confirm`), úzký rozsah, audit, limity.
- **Vercel Hobby** je podle podmínek pro nekomerční použití – pro pilot OK, před ostrým provozem rozhodnout.

## 8. Testování

- Unit testy: `adminRepo` (převod značek), nástroje proti in-memory repu (stejně jako testy akcí),
  ověření tokenu (platný / zrušený / e-mail mimo seznam), náhled vs. zápis, odmítnutí zastaralého náhledu.
- Integrace proti **Firestore emulátoru** (`npm run emulators` + seed) – MCP server lokálně
  (`vercel dev`) proti emulátoru, nikdy proti produkci.
- **MCP Inspector** (`npx @modelcontextprotocol/inspector`) na ruční zkoušení nástrojů.
- Ručně: Claude Code a Antigravity proti nasazené verzi s testovacím tokenem.

## 9. Postup po fázích

| Fáze | Obsah | Výsledek |
|---|---|---|
| **0 – spike** | `api/mcp.js` s nástrojem `ping`, nasazení na Vercel, připojení z Claude Code a Antigravity; výběr knihovny | ověřeno, že MCP na Vercel Hobby funguje |
| **A – tokeny** | `api/_lib` (e-maily, firestoreAdmin, ověření tokenu), Nastavení › Přístup pro AI, `mcpTokens` + rules | bezpečné připojení |
| **B1 – čtení** | `adminRepo`, `getState`, nástroje pro čtení, čistý modul dostupnosti | dotazy na zakázky, katalog, dostupnost |
| **B2 – zápis** | `create_job`, `duplicate_job`, `plan_job_items`, `add_adhoc_item` s náhledem a potvrzením | příprava zakázek z Claude / Antigravity |
| **C – OAuth** | OAuth 2.1 + `/mcp-login` přes Firebase | konektor v claude.ai a Claude Desktop |

Fáze A a B lze dělat souběžně s fázemi 0–1 hlasového rozhraní; společné je jen `api/_lib`.

## 9a. Spike (fáze 0) – stav

Hotovo v kódu: `api/mcp.js` (Streamable HTTP, bezstavový, odpovědi jako JSON, jen `POST`),
`api/_lib/mcpServer.js` (nástroj `ping`), ochrana jedním sdíleným tokenem `MCP_SPIKE_TOKEN`
v `Authorization: Bearer …` nebo `X-BLP-Token: …` (Claude konektory)
(bez něj server odpovídá 503, se špatným 401), `vercel.json` už nepřepisuje `/api/*` na `index.html`.
Knihovna: oficiální `@modelcontextprotocol/sdk` 1.32.2 + `zod` – funguje bez Next.js.

- Lokálně: `MCP_SPIKE_TOKEN=dev-token npm run mcp:local` → `http://localhost:3333/api/mcp`
  (napodobuje Vercel Node runtime, bez Vercel CLI).
- Testy: `tests/mcp.test.js` – oficiální MCP klient se připojí, vypíše nástroje, zavolá `ping`;
  ověřeno odmítnutí bez tokenu / se špatným tokenem / jiné metody než POST.
- Nasazení: proměnná `MCP_SPIKE_TOKEN` ve Vercelu (Production) + nasazení `main`; pak připojit
  Claude Code a Antigravity podle kap. 6 (místo `blp_mcp_XXXX` spike token).
- Spike token se ve fázi A nahradí osobními tokeny.

## 10. Otevřené

1. Servisní účet Firebase – vytvořit klíč (Firebase Console › Nastavení projektu › Servisní účty).
2. Má mít token rozsah jen pro čtení jako výchozí? (Návrh: ano, zápis se zapíná zvlášť.)
3. Kdo smí MCP používat – všichni schválení, nebo jen vybraní (např. vedoucí)?
4. Hosting pro ostrý provoz (stejné rozhodnutí jako u hlasu).

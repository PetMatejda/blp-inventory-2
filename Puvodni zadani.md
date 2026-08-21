# TECHNICKÁ A FUNKČNÍ SPECIFIKACE APLIKACE
## Systém pro operativní řízení a skladové hospodářství filmové osvětlovací techniky

---

### 1. Cíle projektu a produktová vize

* **Dlouhodobý cíl (Cílový stav):**
  Komplexní skladový systém zahrnující centrální evidenci zásob, správu zakázek, plánování kapacit, historii revizí a technických kontrol vybavení.
* **Cíl 1. fáze (MVP):**
  Mobilní aplikace pro operativní správu materiálu na konkrétních natáčeních (jobech) – od přípravy zakázky, přes nakládku, dynamické změny na place až po návrat na sklad a evidenci závad.

---

### 2. Architektura a technické požadavky

* **Platforma:** Mobilní aplikace primárně pro **Android** s architekturou připravenou na cross-platform kompilaci pro **iOS** (např. Flutter / React Native).
* **Offline-first přístup:** Plná funkčnost bez internetového připojení (natáčení v exteriérech, podzemí, halách). Automatická obousměrná synchronizace dat po obnovení připojení.
* **Hardwarová integrace:** Připravenost rozhraní na využití vestavěného fotoaparátu (pořizování fotodokumentace a budoucí skenování čárových/QR kódů).
* **Autentizace:** Individuální uživatelské účty pro přesné logování odpovědnosti a změn.

---

### 3. Funkční specifikace (Fáze 1 – MVP)

#### A. Správa zakázek (Jobů) a týmů
* **Tvorba a předpříprava jobu:** Zkušený pracovník může seznam techniky definovat předem v kanceláři; terénní tým na místě pouze otevře hotový seznam a provede nakládku.
* **Odpovědnost a role:** Každá zakázka má určeného hlavního vedoucího a přiřazený tým.
* **Flexibilní editace:** Kterýkoliv přihlášený člen týmu může do zakázky zasahovat a upravovat položky.

#### B. Práce s materiálem a sety
* **Katalog materiálu:** Rychlé fulltextové vyhledávání a filtrování podle kategorií.
* **Předdefinované sety (balíčky):** Šablony standardních konfigurací (např. *Matrace 8×6* automaticky načte konstrukci, světla, sadu kabelů a příslušenství).
* **Ad-hoc položky:** Možnost vložit do zakázky jednorázovou nestandardní položku volným textem (např. externí nářadí).
* **Servisní kufřík („Brácha“):** Modul pro kontrolu sbalení a stavu doplňování spotřebního materiálu (tejpy, izolačky, stahovačky).

#### C. Životní cyklus materiálu a barevné stavy
1. **Předpřipraveno (Šedá):** Položka je navolena, čeká na naložení ve skladu.
2. **Naloženo / Na setu (Zelená):** Položka byla naložena do auta a převezena na natáčení.
3. **Zabaleno k odvozu (Žlutá / Modrá):** Položka byla sbalena na place (de-rigging), čeká na odvoz zpět.
4. **Naskladněno (Odškrtnuto):** Fyzický návrat a potvrzení příjmu na centrálním skladu.
5. **Poškozeno (Červená):** Označeno jako poškozené/nefunkční.

#### D. Auditní log, fotodokumentace a reporting
* **Auditní historie:** Záznam každé změny (Kdo, Kdy, Co změnil / přidal / odebral).
* **Fotodokumentace:** Možnost přiložit k zakázce nebo položce fotku (stav poškození, uložení beden v autě).
* **Report poškození:** Centrální přehled vadné techniky s přiřazením k zakázce a možností označit opravu jako vyřešenou.
* **Přehled v reálném čase:** Dashboard s aktuálním umístěním techniky v terénu mimo centrální sklad.

---

### 4. Požadavky na UI/UX

* **Ergonomie v terénu:** Velké ovládací prvky, vysoký kontrast, možnost pohodlného ovládání jednou rukou.
* **Gesta (Swipe Actions):** Rychlé odbavování položek posunem prstu (např. swipe doprava = naloženo/potvrzeno; swipe doleva = poškozeno/úpravy).
* **Hromadná změna počtů:** Inkrementační tlačítka (+/-) kombinovaná s možností přímého zadání číselné hodnoty.
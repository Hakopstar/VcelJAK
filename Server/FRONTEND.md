# VcelJAK - Frontend

Frontend představuje primární vizuální rozhraní, které umožňuje uživateli přístup k informacím o stavu úlů, aktuálním měřením a historickým datům.

## Přehled

*   **Účel:** Poskytnout intuitivní a responzivní uživatelské rozhraní pro monitorování a správu včelstev.
*   **Technologie:**
    *   Framework: Next.js (verze 15.3.3)
    *   Programovací jazyk: TypeScript
    *   UI Komponenty: Shadcn UI
    *   Stylování: TailwindCSS
    *   Autentizace: NextAuth
    *   Vývojové prostředí pro skeleton: v0

## Klíčové Funkce a Stránky

### `/` (Dashboard)
Hlavní stránka po přihlášení, poskytující ucelený přehled o všech aktivních úlech.
*   Levý panel: Aktuální venkovní informace (např. data z meteostanice, tipy).
*   Pravý panel: Grafy a schémata jednotlivých úlů (po rozkliknutí úlu).
*   Získávání dat: Volání na Backend API `/sapi/beehives` a `/sapi/sensor-history` (s parametry).

### Přihlašování a Správa Relací
*   Využívá JWT access tokeny a session cookies generované NextAuth.
*   Požadavek na Backend pro ověření přihlašovacích údajů.
*   Zabezpečená komunikace přes HTTPS (pokud je nakonfigurováno).

### Odhlášení
*   Zrušení JWT tokenu v NextAuth.
*   Odeslání požadavku na Backend pro invalidaci backendového tokenu.
*   Možnost odhlášení v hlavičce webu nebo v chráněné části.

### `/admin/*` (Chráněná Administrační Sekce)
Přístup k těmto stránkám je možný pouze po úspěšné autentizaci. Přístupová práva jsou řízena pomocí NextAuth a Middleware v Next.js. Pro správné fungování jsou nutné platné tokeny: NextAuth JWT, Backend JWT a CSRF verifikační token.

*   **`/admin/hubs` (Správa Hardwarových Hubů):**
    *   Zobrazení informací o hubech (UUID, počet senzorů, čas poslední aktualizace).
    *   Možnost přidávat, odstraňovat nebo regenerovat autentizační klíč hubu. Klíč je ukládán jako hash.
*   **`/admin/sensorsandhubs` (Aktuální Dění Senzorů a Hubů):**
    *   Zobrazení aktuálně přijatých hodnot ze senzorů.
    *   Informace o stavu hardwarových hubů.
    *   Možnost filtrování dat, zobrazení času poslední aktualizace.
*   **`/admin/groups` (Správa Včelích Úlů):**
    *   Zobrazení a úprava údajů o skupinách (meteostanice, úly, obecné).
    *   Přiřazování senzorů pravidel ke skupinám.
    *   Možnost přejmenování, deaktivace, odstranění skupin.
*   **`/admin/rules` (Správa pravidel):**
    *   Úprava a správa pravidel, vytvoření pravidel, inciatorů a přidání akcí
*   **`/admin/schedules` (Správa kalendáře a plánů):**
    *   Úprava základního nastavení serveru (jednotky pro zobrazované hodnoty, limity pro příjem dat ze senzorů).
*   **`/admin/session` (Správa Aktuálních Relací Hardwarových Hubů):**
    *   Zobrazení informací o aktivních relacích (čas vzniku, časový limit).
    *   Možnost rušení relací.
*   **`/admin/tags` (Správa všech typů štítků):**
    *   Úprava štítků, vytvoření nových, přejmenování etc.
*   **`/admin/config` (Konfigurace Serveru):**
    *   Úprava základního nastavení serveru (jednotky pro zobrazované hodnoty, limity pro příjem dat ze senzorů).

## Autentizace
*   Implementována prostřednictvím NextAuth.
*   Využívá Next.js Middleware pro dynamické řízení přístupu k chráněným stránkám.
*   Kombinace JWT access tokenů a session cookies.
*   Při neplatnosti některého z tokenů (NextAuth JWT, Backend JWT, CSRF) je uživatel vyzván k opětovnému přihlášení.

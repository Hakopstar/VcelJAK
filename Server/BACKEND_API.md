# VcelJAK - Backend API

Backend API je postaveno na frameworku Flask v Pythonu a slouží jako hlavní rozhraní pro zpracování dat, komunikaci s databázemi a obsluhu požadavků z frontendu a hardwarových hubů. Aktuální stabilní verze API pro komunikaci s hardwarovými huby je **3.1**. Verze <3.1 nejsou zpětně kompatibilní.

## Přehled

*   **Účel:** Zpracování surových dat z hardwarových hubů, poskytování API pro frontend, správa databází, autentizace a autorizace.
*   **Technologie:** Python, Flask, SQLAlchemy, InfluxDB Python Client.
*   **Hlavní API prefixy:** `/hive`, `/api`, `/access`.

## Obecné Koncepty

*   **Rate Limiting:** Některé API endpointy (zejména pod `/api` a `/hive`) jsou chráněny rate limitingem na základě IP adresy. Informace o limitech jsou ukládány v Memcached.
*   **Bezpečnost:**
    *   Použití JWT (JSON Web Tokens) pro autentizaci uživatelů na `/access/*` endpointy.
    *   Hashování citlivých údajů (např. klíče hardwarových hubů, uživatelská hesla) pomocí serverové soli před uložením do databáze.
    *   SQLAlchemy ORM pomáhá předcházet SQL injection útokům.
*   **Formát Dat:** Většina API endpointů vrací data ve formátu JSON.

## API Endpoints

### Komunikace s Hardwarovým Hubem (`/hive/*`)
Tyto endpointy slouží primárně pro komunikaci mezi backendem a hardwarovým hubem.

*   **`POST /hive/session`**: Navázání nové relace mezi hardwarovým hubem a backendem.
    *   **Tělo požadavku (JSON, API v3.1):**
        Požadavek musí obsahovat verzi API, klíč hardwarového hubu (`key`), unikátní identifikátor hubu (`system_id`), aktuální konfiguraci hubu (`config` – včetně dostupných typů měření a definovaných jednotek) a případná kalibrační nastavení (`calibration_settings`).
        *Příklad struktury naleznete v souboru: `example_inputs/hive_session_request_v3.1.json`*
    *   **Zpracování:**
        1.  Validace dat a verze API.
        2.  Ověření `key` (hubového klíče) a `system_id` (UUID hubu) proti záznamům v PostgreSQL.
        3.  Vytvoření nové relace: generování ID relace (`sessionId`) a autentizačního klíče relace (`sessionKey`). Klíč relace je šifrován serverovou solí a jeho hash je uložen.
    *   **Odpověď (JSON, 200 OK):**
        *   `sessionId` (string): Přidělené ID relace.
        *   `sessionKey` (string): Vygenerovaný klíč relace (v čisté formě, pro použití hubem).
        *   `configuration` (object): Případná konfigurace ze serveru pro hub.
    *   **Chyby:** 400 Bad Request, 401 Unauthorized.

*   **`POST /hive/sensor`**: Příjem dat ze senzorů připojených k hardwarovému hubu.
    *   **Autentizace:** Basic Auth (uživatelské jméno = `sessionId`, heslo = `sessionKey`).
    *   **Hlavičky:** Může obsahovat hlavičku `X-API-Version` s hodnotou `3.1`.
    *   **Tělo požadavku (JSON, API v3.1):**
        Požadavek obsahuje objekt `info` s verzí API a pole `data`, kde každý prvek reprezentuje jedno měření. Každé měření má svůj lokální `id`, časové razítko `time` (ISO 8601 UTC), typ měření `unit` (např. "temperature", "humidity") a naměřenou `value`.
        *Příklad struktury naleznete v souboru: `example_inputs/hive_sensor_data_request_v3.1.json`*
    *   **Zpracování:**
        1.  Autorizace pomocí údajů z Basic Auth.
        2.  Validace formátu JSON a verze API.
        3.  Konverze měřených hodnot do jednotek definovaných v konfiguraci serveru. Odmítnutí, pokud hodnoty přesáhnou povolený rozsah.
        4.  Ověření registrace senzoru (nebo typu měření) v PostgreSQL, přiřazení k úlu (případně k systémovému úlu ID 0 "system").
        5.  Uložení dat (čas, ID senzoru/měření, ID hardwaru, ID úlu, měřená veličina, hodnota) do InfluxDB.
    *   **Odpověď:** 200 OK při úspěchu, chybové kódy při selhání (např. 400, 401, 403).

*   **`GET /hive/sse`**: Odesílání událostí Server-Sent Events (SSE).
    *   Primárně určeno pro sledování stavu meteostanice připojené k úlu.
    *   Veřejně přístupné, bez šifrování nebo autentizace.

### Veřejné Datové API (`/api/*`)
Tyto endpointy poskytují zpracované informace a jsou veřejně přístupné (mohou být chráněny rate limitingem).

*   **`GET /api/sensors`**: Vrací JSON soubor obsahující nejnovější měření všech senzorů.
*   **`GET /api/sensors?beehiveId=<ID_VCELSTVA>&timeScale=<CASOVY_ROZSAH>`**: Vrací JSON soubor s daty pro specifické včelstvo a časové rozmezí.
    *   **Parametry:**
        *   `beehiveId` (string): ID včelstva.
        *   `timeScale` (string): `day`, `week`, `month`, `year`.
    *   Odmítnutí požadavku, pokud parametry chybí nebo jsou neplatné.

### Administrační API (`/access/*`)
Tyto endpointy slouží ke správě a administraci serveru a vyžadují platný JWT token v `Authorization: Bearer <token>` hlavičce (kromě `/access/login`). Interakce s těmito endpointy automaticky prodlužuje expiraci JWT tokenu.

*   **`POST /access/login`**: Přihlášení uživatele.
    *   **Tělo požadavku (JSON):** `username`, `password`.
    *   **Odpověď (JSON):** JWT token.
*   **`POST /access/logout`**: Odhlášení uživatele (invalidace JWT tokenu).
*   **`GET /access/get_hubs`**: Získá informace o všech hardwarových hubech.
*   **`GET /access/get_beehives`**: Získá informace o všech registrovaných včelstvech.
*   **`GET /access/get_config`**: Vrací aktuální konfigurační nastavení serveru.
*   **`GET /access/get_sessions`**: Poskytuje informace o aktuálně běžících relacích hardwarových hubů.
*   **`POST /access/new_hub`**: Vytvoření nového hardwarového hubu.
    *   **Tělo požadavku (JSON):** `name`, `location` (nepovinné).
    *   **Odpověď (JSON):** UUID nového hubu, vygenerovaný hardwarový klíč (hash klíče uložen v DB).
*   **`POST /access/save_config`**: Uložení nové konfigurace serveru.
    *   **Tělo požadavku (JSON):** Nová konfigurace.
    *   **Odpověď:** 200 OK při úspěchu.
*   **`POST /access/rename_hub`**: Přejmenování hardwarového hubu.
    *   **Tělo požadavku (JSON):** `hubId`, `newName`.
*   **`POST /access/edit_beehive`**: Úprava informací o včelím úlu.
    *   **Tělo požadavku (JSON):** `action` (`add`, `edit`, `update_inspection`), `beehiveId` (pro editaci/inspekci), `name`, `location`, `inspectionTime` (dle akce).
*   **`POST /access/change_api_key`**: Vygenerování nového API klíče pro hardwarový hub.
    *   **Tělo požadavku (JSON):** `hubId`.
    *   **Odpověď (JSON):** Nový API klíč (hash uložen v DB).
*   **`POST /access/change_password`**: Změna hesla administrátora.
    *   **Tělo požadavku (JSON):** `oldPassword`, `newPassword`.
*   **`POST /access/calibrate_sensor`**: Kalibrace senzoru.
    *   **Tělo požadavku (JSON):** `sensorId`, `calibrationValue`.
*   **`POST /access/assign_sensor`**: Přiřazení senzoru k včelímu úlu.
    *   **Tělo požadavku (JSON):** `sensorId`, `beehiveId`.
    *   Pozn.: Pro InfluxDB probíhá kopírování dat na nové `beehiveId` a následné smazání z původního.
*   **`POST /access/unassign_sensor`**: Přiřazení senzoru do systémového úlu (ID 0). Původní měření nejsou přenášena ani mazána.
    *   **Tělo požadavku (JSON):** `sensorId`.
*   **`POST /access/delete_hub`**: Odstranění hardwarového hubu.
    *   **Tělo požadavku (JSON):** `hubId`.
*   **`POST /access/delete_beehive`**: Odstranění včelího úlu.
    *   **Tělo požadavku (JSON):** `beehiveId`.
*   **`POST /access/terminate_sessions`**: Ukončení relace hardwarového hubu.
    *   **Tělo požadavku (JSON):** `sessionId`.
*   **`GET /access/token_verify`**: Ověření platnosti aktuálně používaného JWT tokenu.
    *   **Odpověď:** 200 OK pokud je platný, 400 "invalid credentials" pokud neplatný.

---

# VcelJAK - Databáze

Serverová část projektu VcelJAK využívá tři hlavní databázové systémy pro ukládání a správu dat.

## PostgreSQL

*   **Účel:** Primární relační databáze pro ukládání strukturovaných dat, která nejsou časovými řadami. Zajišťuje konzistenci a vztahy mezi různými entitami systému.
*   **ORM:** Pro interakci s PostgreSQL je v backendu (Flask) využívána knihovna SQLAlchemy, která usnadňuje manipulaci s daty a zvyšuje bezpečnost (např. ochrana proti SQL injection).
*   **Knihovna (Driver):** `psycopg3` jako driver pro Python.

### Přehled Tabulek a Jejich Účelu

Následuje popis hlavních tabulek definovaných pomocí SQLAlchemy modelů:

*   **`session_auth`**: Uchovává informace o aktivních relacích hardwarových hubů.
    *   `client_id` (Text): Identifikátor hardwarového hubu (cizí klíč na `available_sensors_database`).
    *   `session_id` (Text, Primární klíč): Unikátní identifikátor aktivní relace.
    *   `session_key_hash` (Text): Hash klíče relace pro autentizaci.
    *   `available` (Text): Informace o dostupných senzorech/typech měření pro danou relaci.
    *   `session_end` (Text): Čas, kdy relace vyprší.
    *   `system_privileges` (Text): Případná specifická oprávnění pro danou relaci.

*   **`available_sensors_database`**: Registr všech hardwarových hubů komunikujících se systémem.
    *   `client_id` (Text, Primární klíč): Unikátní identifikátor hardwarového hubu (UUID).
    *   `client_name` (Text): Uživatelsky definovaný název hubu.
    *   `client_key_hash` (Text): Hash hlavního autentizačního klíče hubu.
    *   `client_last_session` (Text): Čas poslední úspěšné relace.
    *   `client_active` (Text): Status aktivity hubu.
    *   `client_access_key` (Text): Může sloužit pro další úrovně přístupu nebo specifické operace.

*   **`config`**: Konfigurace specifické pro jednotlivé hardwarové huby (jak hub reportuje své jednotky).
    *   `client_id` (Text, Primární klíč): Identifikátor hardwarového hubu.
    *   `system_time_unit` (Text): Jednotka času používaná hubem.
    *   `temperature_unit` (Text): Jednotka teploty používaná hubem.
    *   `pressure_unit` (Text): Jednotka tlaku používaná hubem.
    *   `voltage_unit` (Text): Jednotka napětí používaná hubem.
    *   `power_unit` (Text): Jednotka výkonu používaná hubem.
    *   `speed_unit` (Text): Jednotka rychlosti používaná hubem.
    *   `weight_unit` (Text): Jednotka hmotnosti používaná hubem.
    *   `sound_pressure_level_unit` (Text): Jednotka hladiny akustického tlaku používaná hubem.
    *   `network_strenght_unit` (Text): Jednotka síly sítě používaná hubem.
    *   `memory_unit` (Text): Jednotka paměti používaná hubem.

*   **`users`**: Uchovává přihlašovací údaje uživatelů webového rozhraní.
    *   `client_id` (Text, Primární klíč): Uživatelské jméno.
    *   `client_hash` (Text): Hash hesla uživatele.

*   **`jwt_blocklist`**: Seznam neplatných (blokovaných) JWT tokenů pro zajištění bezpečného odhlášení.
    *   `id` (Integer, Primární klíč, Auto-increment): Interní identifikátor.
    *   `jti` (Text, Unikátní): JWT ID (identifikátor tokenu).
    *   `created_at` (DateTime): Čas, kdy byl token přidán na blocklist.

*   **`beehives`**: Evidence včelích úlů.
    *   `id` (Integer, Primární klíč, Auto-increment Identity): Unikátní identifikátor úlu.
    *   `name` (String): Název úlu.
    *   `location` (String): Umístění úlu.
    *   `last_inspection` (String): Datum poslední inspekce.
    *   `sensors` (Relationship): Vztah k senzorům přiřazeným k tomuto úlu (one-to-many).

*   **`sensors`**: Evidence jednotlivých senzorů a jejich přiřazení k úlům.
    *   `id` (String, Primární klíč): Unikátní identifikátor senzoru (často kombinace typu a lokálního označení).
    *   `client_id` (String): Identifikátor hardwarového hubu, ke kterému senzor patří.
    *   `measurement` (String): Typ měřené veličiny (např. "temperature", "humidity").
    *   `calibration_value` (Float, Nepovinné): Hodnota použitá pro kalibraci senzoru.
    *   `beehive_id` (Integer, Cizí klíč na `beehives.id`): ID úlu, ke kterému je senzor přiřazen.

*   **`server_config`**: Globální konfigurační nastavení serveru.
    *   `config_name` (String, Primární klíč): Název konfiguračního parametru (např. typ měření jako "temperature").
    *   `units` (String, Nepovinné): Standardní jednotky, ve kterých server interně pracuje nebo zobrazuje data pro daný `config_name`.
    *   `lowest_acceptable` (String, Nepovinné): Nejnižší přijatelná hodnota pro data z tohoto typu měření.
    *   `highest_acceptable` (String, Nepovinné): Nejvyšší přijatelná hodnota.
    *   `accuracy` (String, Nepovinné): Požadovaná přesnost nebo počet desetinných míst.
    *   `value` (String, Nepovinné): Obecná hodnota pro daný konfigurační parametr.

*   **`tips`**: Tipy a doporučení pro včelaře zobrazované ve frontendové aplikaci.
    *   `tip_id` (String, Primární klíč): Unikátní identifikátor tipu.
    *   `tip_title` (String, Nepovinné): Název tipu.
    *   `tip_description` (String, Nepovinné): Popis tipu.
    *   `tip_priority` (String, Nepovinné): Priorita tipu pro účely zobrazení.

## InfluxDB

*   **Účel:** Časově-řadová databáze (TSDB) optimalizovaná pro ukládání, dotazování a vizualizaci velkých objemů telemetrických dat ze senzorů.
*   **Použití:**
    *   Ukládání veškerých měřených hodnot ze senzorů (teplota, vlhkost, hmotnost, atd.) s časovým razítkem.

*   **Struktura ukládaných dat (Points):**
    Každý datový bod (point) v InfluxDB se skládá z:
    *   **Measurement:** Identifikátor měření, často odpovídající typu dat nebo zdroji measurement_id což odpovídá hardware_id hardwarového hubu.
    *   **Time:** Časové razítko měření (`sensor['time']`).
    *   **Tags (indexované, slouží k filtrování a grupování):**
        *   `id` (Tag): Identifikátor konkrétního senzoru nebo měřicího bodu v rámci hubu (`sensor['id']`).
        *   `bid` (Tag): Identifikátor včelího úlu (`sensor_beehive`), ke kterému data náleží.
        *   `unit` (Tag): Typ měřené veličiny (např. "temperature", "humidity", "weight"). V kontextu InfluxDB je to spíše označení typu dat než fyzikální jednotka, která se může řešit při zpracování nebo vizualizaci.
    *   **Fields (neindexované hodnoty, samotná naměřená data):**
        *   `value` (Field): Naměřená hodnota (`value`).

*   **Dotazování:** Pro komplexnější operace a dotazy se využívá dotazovací jazyk FLUX.
*   **Knihovna:** `influxdb-client` pro Python.

## Redis

*   **Účel:** Distribuovaný in-memory caching systém.
*   **Použití:**
    *   **Caching:** Ukládání často dotazovaných dat do operační paměti pro zrychlení odpovědí (např. výsledky některých API volání).
    *   **Rate Limiting:** Ukládání informací o počtu požadavků z jednotlivých IP adres pro implementaci rate limitingu na `/api` a `/hive` endpointy.
    *   **SSE Channels** Ukládání informací SSE - zdraví a další informace.
    *   Dočasné uchovávání stavových informací, které nevyžadují persistentní uložení v PostgreSQL nebo InfluxDB.

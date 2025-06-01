
# VcelJAK - Databáze

Serverová část projektu VcelJAK využívá tři hlavní databázové systémy pro ukládání a správu dat.

## PostgreSQL

*   **Účel:** Primární relační databáze pro ukládání strukturovaných dat, která nejsou časovými řadami. Zajišťuje konzistenci a vztahy mezi různými entitami systému.
*   **ORM:** Pro interakci s PostgreSQL je v backendu (Flask) využívána knihovna SQLAlchemy, která usnadňuje manipulaci s daty a zvyšuje bezpečnost (např. ochrana proti SQL injection).
*   **Knihovna (Driver):** `psycopg3` jako driver pro Python.

### Přehled Tabulek a Jejich Účelu

Následuje popis hlavních tabulek definovaných pomocí SQLAlchemy modelů (verze 0.95):

*   **`users`**: Uchovává přihlašovací údaje uživatelů webového rozhraní.
    *   `client_id` (Text, Primární klíč): Uživatelské jméno.
    *   `client_hash` (Text): Hash hesla uživatele.

*   **`available_sensors_database`**: Registr všech hardwarových hubů (Sensor Client Systems) komunikujících se systémem.
    *   `client_id` (Text, Primární klíč): Unikátní identifikátor hardwarového hubu.
    *   `client_name` (Text): Uživatelsky definovaný název hubu.
    *   `client_key_hash` (Text): Hash hlavního autentizačního klíče hubu.
    *   `client_last_session` (Text): Čas poslední úspěšné relace (může být textový formát data).
    *   `client_active` (Boolean): Status aktivity hubu (výchozí hodnota `True`).
    *   `client_access_key` (Text): Může sloužit pro další úrovně přístupu nebo specifické operace.
    *   `last_heard_from` (DateTime): Časové razítko poslední komunikace s hubem (s časovou zónou).
    *   Vztahy: k `session_auth` (one-to-many), `config` (one-to-one), `sensors` (one-to-many).

*   **`session_auth`**: Uchovává informace o aktivních relacích hardwarových hubů.
    *   `session_id` (Text, Primární klíč): Unikátní identifikátor aktivní relace.
    *   `client_id` (Text, Cizí klíč na `available_sensors_database.client_id`): Identifikátor hardwarového hubu.
    *   `session_key_hash` (Text): Hash klíče relace pro autentizaci.
    *   `available` (Text): Informace o dostupných senzorech/typech měření pro danou relaci.
    *   `session_end` (DateTime): Čas, kdy relace vyprší (s časovou zónou).
    *   `system_privileges` (Text): Případná specifická oprávnění pro danou relaci.
    *   Vztah: k `available_sensors_database` (many-to-one).

*   **`config`**: Konfigurace specifické pro jednotlivé hardwarové huby (jak hub reportuje své jednotky).
    *   `client_id` (Text, Primární klíč, Cizí klíč na `available_sensors_database.client_id`): Identifikátor hardwarového hubu.
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
    *   Vztah: k `available_sensors_database` (one-to-one).

*   **`sensors`**: Evidence jednotlivých senzorů a jejich základních informací.
    *   `id` (Text, Primární klíč): Unikátní identifikátor senzoru.
    *   `client_id` (Text, Cizí klíč na `available_sensors_database.client_id`, nepovinné): Identifikátor hardwarového hubu, ke kterému senzor patří.
    *   `measurement` (Text): Typ měřené veličiny (např. "Temperature", "Humidity").
    *   `calibration_value` (Float, Nepovinné): Hodnota použitá pro kalibraci senzoru.
    *   `last_reading_time` (DateTime, Nepovinné): Čas posledního odečtu (s časovou zónou).
    *   `last_reading_value` (Float, Nepovinné): Hodnota posledního odečtu.
    *   `last_reading_unit` (Text, Nepovinné): Jednotka posledního odečtu.
    *   `group_id` (Text, Cizí klíč na `groups.id`, nepovinné, ondelete SET NULL): ID skupiny (např. úlu), ke které je senzor přiřazen.
    *   Vztahy: k `groups` (many-to-one), `available_sensors_database` (many-to-one).

*   **`groups`**: Hlavní tabulka pro organizaci entit jako jsou včelí úly, meteostanice, podskupiny atd.
    *   `id` (Text, Primární klíč): Unikátní identifikátor skupiny.
    *   `name` (Text): Název skupiny.
    *   `type` (Text): Typ skupiny (např. 'beehive', 'meteostation', 'hive', 'generic').
    *   `parent_id` (Text, Cizí klíč na `groups.id`, nepovinné, ondelete SET NULL): ID nadřazené skupiny pro hierarchické uspořádání.
    *   `description` (Text, Nepovinné): Popis skupiny.
    *   `location` (Text, Nepovinné): Umístění skupiny.
    *   `automatic_mode` (Boolean, Výchozí `False`): Indikuje, zda jsou pro skupinu aktivní automatická pravidla (např. pro monitorování úlu).
    *   `beehive_type` (Text, Nepovinné): Specifický typ úlu (pro `type='beehive'`).
    *   `mode` (Text, Nepovinné): Obecný režim skupiny.
    *   `health` (Integer, Nepovinné, CheckConstraint 0-100): Zdravotní stav (např. úlu).
    *   `last_inspection` (Date, Nepovinné): Datum poslední inspekce.
    *   `is_main` (Boolean, Výchozí `False`): Označuje hlavní meteostanici (pro `type='meteostation'`).
    *   Vztahy: k sobě samé (`parent`/`subgroups`), `group_events` (one-to-many), `schedules` (many-to-many přes `schedule_assigned_groups`), `rules` (many-to-many přes `group_rules`), `rule_sets` (many-to-many přes `group_rule_sets`), `tags` (many-to-many přes `group_tags`), `sensors` (one-to-many), `schedule_conditions` (one-to-many).

*   **`tags`**: Štítky pro kategorizaci a bližší specifikaci různých entit.
    *   `id` (Text, Primární klíč): Unikátní identifikátor štítku.
    *   `name` (Text): Název štítku.
    *   `type` (Text): Typ štítku (např. 'purpose', 'mode', 'status').
    *   `description` (Text, Nepovinné): Popis štítku.
    *   Vztahy: k `groups` (many-to-many přes `group_tags`), `rule_initiators` (many-to-many přes `initiator_tags`).

*   **`schedules`**: Plány pro úkoly, události nebo pravidelné činnosti.
    *   `id` (Text, Primární klíč): Unikátní identifikátor plánu.
    *   `name` (Text): Název plánu.
    *   `description` (Text, Nepovinné): Popis plánu.
    *   `category` (Text, Nepovinné): Kategorie plánu.
    *   `season` (Text, Nepovinné): Sezóna, ke které se plán vztahuje.
    *   `due_date` (Date, Nepovinné): Termín splnění.
    *   `status` (Text, Výchozí 'pending'): Stav plánu (např. 'pending', 'in_progress', 'completed').
    *   `progress` (Integer, Výchozí 0, CheckConstraint 0-100): Postup plnění v procentech.
    *   `priority` (Text, Výchozí 'medium'): Priorita plánu.
    *   `recommendations` (ARRAY(Text), Nepovinné): Doporučení k plánu.
    *   `notes` (Text, Nepovinné): Poznámky.
    *   `created_at` (DateTime): Čas vytvoření (s časovou zónou, automaticky).
    *   `last_modified` (DateTime): Čas poslední modifikace (s časovou zónou, automaticky).
    *   `completion_date` (Date, Nepovinné): Datum dokončení.
    *   Vztahy: k `schedule_conditions` (one-to-many), `groups` (many-to-many přes `schedule_assigned_groups`).

*   **`schedule_conditions`**: Podmínky, které musí být splněny v rámci plánů.
    *   `condition_id` (Integer, Primární klíč): Unikátní identifikátor podmínky.
    *   `schedule_id` (Text, Cizí klíč na `schedules.id`, ondelete CASCADE): ID plánu, ke kterému podmínka patří.
    *   `type` (Text, Nepovinné): Typ podmínky.
    *   `operator` (Text, Nepovinné): Operátor pro vyhodnocení podmínky.
    *   `value` (Text, Nepovinné): Hodnota pro porovnání.
    *   `unit` (Text, Nepovinné): Jednotka hodnoty.
    *   `duration` (Integer, Nepovinné): Doba trvání (pokud relevantní).
    *   `duration_unit` (Text, Nepovinné): Jednotka doby trvání.
    *   `group_id` (Text, Cizí klíč na `groups.id`, nepovinné, ondelete SET NULL): ID skupiny (např. meteostanice) poskytující data pro podmínku.
    *   `actual_value` (Text, Nepovinné): Aktuální hodnota zjištěná pro podmínku.
    *   `last_update` (DateTime): Čas poslední aktualizace (s časovou zónou, automaticky).
    *   Vztahy: k `schedules` (many-to-one), `groups` (many-to-one).

*   **`group_events`**: Záznamy událostí týkajících se skupin.
    *   `event_table_id` (Integer, Primární klíč): Unikátní identifikátor záznamu události.
    *   `group_id` (Text, Cizí klíč na `groups.id`, ondelete CASCADE): ID skupiny, ke které se událost váže.
    *   `event_ref_id` (Text, Nepovinné): Referenční ID události.
    *   `event_date` (Date): Datum události.
    *   `event_type` (Text, Nepovinné): Typ události.
    *   `description` (Text, Nepovinné): Popis události.
    *   Vztah: k `groups` (many-to-one).

*   **`rule_sets`**: Sady pravidel pro automatizované akce a logiku.
    *   `id` (Text, Primární klíč): Unikátní identifikátor sady pravidel.
    *   `name` (Text): Název sady pravidel.
    *   `description` (Text, Nepovinné): Popis sady pravidel.
    *   `is_active` (Boolean, Výchozí `True`): Určuje, zda je sada pravidel aktivní.
    *   Vztahy: k `rules` (many-to-many přes `ruleset_rules`), `groups` (many-to-many přes `group_rule_sets`).

*   **`rules`**: Jednotlivá pravidla definující podmínky a akce.
    *   `id` (Text, Primární klíč): Unikátní identifikátor pravidla.
    *   `name` (Text, Výchozí ''): Název pravidla.
    *   `description` (Text, Výchozí ''): Popis pravidla.
    *   `logical_operator` (Text, Výchozí 'and'): Logický operátor pro kombinaci iniciátorů ('and'/'or').
    *   `is_active` (Boolean, Výchozí `True`): Určuje, zda je pravidlo aktivní.
    *   `applies_to` (Text, Výchozí 'all'): Určuje, na co se pravidlo vztahuje (např. 'all', 'specific_groups', 'tags').
    *   `rule_set_id` (Text, Cizí klíč na `rule_sets.id`, nepovinné, ondelete SET NULL): ID sady pravidel, do které pravidlo patří.
    *   `priority` (Integer, Výchozí 5): Priorita pravidla.
    *   Vztahy: k `rule_initiators` (one-to-many), `rule_actions` (one-to-many), `rule_sets` (many-to-many přes `ruleset_rules`), `groups` (many-to-many přes `group_rules` pro přímo aplikovaná pravidla).

*   **`rule_initiators`**: Spouštěče (podmínky), které aktivují pravidla.
    *   `initiator_table_id` (Integer, Primární klíč): Unikátní identifikátor spouštěče.
    *   `rule_id` (Text, Cizí klíč na `rules.id`, ondelete CASCADE): ID pravidla, ke kterému spouštěč patří.
    *   `initiator_ref_id` (Text, Nepovinné): Referenční ID (např. ID senzoru, ID štítku).
    *   `type` (Text, Výchozí ''): Typ spouštěče (např. 'measurement', 'schedule', 'tag_change').
    *   `operator` (Text, Výchozí ''): Operátor pro porovnání (např. '>', '<', '==', 'between').
    *   `value` (Numeric, Výchozí 0): Prahová hodnota nebo hodnota pro porovnání.
    *   `value2` (Numeric, Nepovinné): Druhá prahová hodnota (pro operátory jako 'between').
    *   `schedule_type` (Text, Nepovinné): Typ plánu pro spouštěče typu 'schedule' (např. 'interval', 'cron').
    *   `schedule_value` (Text, Nepovinné): Hodnota plánu.
    *   Vztahy: k `rules` (many-to-one), `tags` (many-to-many přes `initiator_tags`).

*   **`rule_actions`**: Akce, které se provedou po splnění podmínek pravidla.
    *   `action_id` (Integer, Primární klíč): Unikátní identifikátor akce.
    *   `rule_id` (Text, Cizí klíč na `rules.id`, ondelete CASCADE): ID pravidla, ke kterému akce patří.
    *   `action_type` (Text): Typ akce (např. 'send_notification', 'set_tag', 'run_script').
    *   `action_params` (JSONB, Nepovinné): Parametry akce uložené jako JSON.
    *   `execution_order` (Integer, Výchozí 0): Pořadí provedení akce v rámci pravidla.
    *   Vztah: k `rules` (many-to-one).

*   **`server_config`**: Globální konfigurační nastavení serveru.
    *   `config_name` (Text, Primární klíč): Název konfiguračního parametru (např. 'system_autoBackup', 'measurements_temperature_unit').
    *   `units` (Text, Nepovinné): Standardní jednotky pro daný `config_name`.
    *   `lowest_acceptable` (Text, Nepovinné): Nejnižší přijatelná hodnota pro data.
    *   `highest_acceptable` (Text, Nepovinné): Nejvyšší přijatelná hodnota.
    *   `accuracy` (Text, Nepovinné): Požadovaná přesnost nebo počet desetinných míst.
    *   `value` (Text, Nepovinné): Obecná hodnota pro daný konfigurační parametr (ukládá všechny konfigurační hodnoty jako text).

*   **`jwt_blocklist`**: Seznam neplatných (blokovaných) JWT tokenů pro zajištění bezpečného odhlášení.
    *   `id` (Integer, Primární klíč, Auto-increment): Interní identifikátor.
    *   `jti` (Text, Unikátní): JWT ID (identifikátor tokenu).
    *   `created_at` (DateTime): Čas, kdy byl token přidán na blocklist (s časovou zónou, automaticky).

*   **Asociační tabulky (Many-to-Many):**
    *   **`schedule_assigned_groups`**: Propojuje `schedules` a `groups`.
        *   `schedule_id` (Text, Cizí klíč na `schedules.id`)
        *   `group_id` (Text, Cizí klíč na `groups.id`)
    *   **`ruleset_rules`**: Propojuje `rule_sets` and `rules`.
        *   `ruleset_id` (Text, Cizí klíč na `rule_sets.id`)
        *   `rule_id` (Text, Cizí klíč na `rules.id`)
    *   **`initiator_tags`**: Propojuje `rule_initiators` a `tags`.
        *   `initiator_table_id` (Integer, Cizí klíč na `rule_initiators.initiator_table_id`)
        *   `tag_id` (Text, Cizí klíč na `tags.id`)
    *   **`group_rules`**: Propojuje `groups` a `rules` (pro pravidla přímo aplikovaná na skupiny).
        *   `group_id` (Text, Cizí klíč na `groups.id`)
        *   `rule_id` (Text, Cizí klíč na `rules.id`)
    *   **`group_rule_sets`**: Propojuje `groups` a `rule_sets`.
        *   `group_id` (Text, Cizí klíč na `groups.id`)
        *   `ruleset_id` (Text, Cizí klíč na `rule_sets.id`)
    *   **`group_tags`**: Propojuje `groups` a `tags`.
        *   `group_id` (Text, Cizí klíč na `groups.id`)
        *   `tag_id` (Text, Cizí klíč na `tags.id`)

## InfluxDB

*   **Účel:** Časově-řadová databáze (TSDB) optimalizovaná pro ukládání, dotazování a vizualizaci velkých objemů telemetrických dat ze senzorů.
*   **Použití:**
    *   Ukládání veškerých měřených hodnot ze senzorů (teplota, vlhkost, hmotnost, atd.) s časovým razítkem.

*   **Struktura ukládaných dat (Points):**
    Každý datový bod (point) v InfluxDB se skládá z:
    *   **Measurement:** `"sensor_measurement"` (pevný název pro měření senzorů).
    *   **Time:** Časové razítko měření (`timestamp_dt`), ukládáno s přesností na nanosekundy (WritePrecision.NS).
    *   **Tags (indexované, slouží k filtrování a grupování):**
        *   `client_id` (Tag): Identifikátor hardwarového hubu, ke kterému senzor patří.
        *   `sensor_id` (Tag): Identifikátor konkrétního senzoru.
        *   `measurement_type` (Tag): Typ měřené veličiny (např. "temperature", "humidity").
        *   `standard_unit` (Tag, nepovinné): Standardizovaná jednotka, ve které je hodnota uložena (pokud byla provedena konverze).
    *   **Fields (neindexované hodnoty, samotná naměřená data):**
        *   `value` (Field): Naměřená a zpracovaná hodnota.
        *   `original_value_numeric` (Field, nepovinné): Původní hodnota ze senzoru jako numerický typ (float), pokud je to možné. Slouží pro referenci.
        *   `original_value_str` (Field, nepovinné): Původní hodnota ze senzoru jako textový řetězec, pokud ji nebylo možné převést na numerický typ. Slouží pro referenci.
        *   `original_unit` (Field, nepovinné): Původní jednotka měření ze senzoru (textový řetězec). Slouží pro referenci.

*   **Dotazování:** Pro komplexnější operace a dotazy se využívá dotazovací jazyk FLUX.
*   **Knihovna:** `influxdb-client` pro Python.

## Redis

*   **Účel:** Distribuovaný in-memory caching systém.
*   **Použití:**
    *   **Caching:** Ukládání často dotazovaných dat do operační paměti pro zrychlení odpovědí (např. výsledky některých API volání).
    *   **Rate Limiting:** Ukládání informací o počtu požadavků z jednotlivých IP adres pro implementaci rate limitingu na `/api` a `/hive` endpointy.
    *   **SSE Channels:** Ukládání informací pro Server-Sent Events (SSE) - například o zdraví systému a další dynamické informace.
    *   Dočasné uchovávání stavových informací, které nevyžadují persistentní uložení v PostgreSQL nebo InfluxDB.

---

# Funkce
Dokumentace funkcí, které jsou k dispozici
Revize 1.8v
> **_NOTE:_** Všechny platné funkce a nutné funkce lze najít v [jsonschemas.py](../FLASK-Container/app/json_schemas.py)

#### Generální poznámky
1. `measurement` v influxdb je sender ID v Open Auth.
2. `id` jsou identifikační symboli sensoru, pevně dány, nemění se.
3. `group_id` je identifikační číslo skupiny, napsáno číslem

| group_id | jméno | rozdělení |
| :---: | :---: | :---: | 
| `0` | `globální skupina` | `všechny sensory, které nejsou zařazeny` | 
| `1-99` | `ostatní skupiny` | `všechny ostatní skupiny` |
> **_NOTE:_** group_id není povinné, ale sensor bude automaticky zařazen do 0 skupiny.
## Obsah
- [Funkce](#funkce)
      - [Generální poznámky](#generální-poznámky)
  - [Obsah](#obsah)
- [Info:](#info)
  - [General Information](#general-information)
    - [caused\_by:](#caused_by)
    - [time_to_generate](#time_to_generate)
  - [System Information:](#system-information)
    - [version](#version)
    - [connected\_devices](#connected_devices)
    - [registered\_devices](#registered_devices)
  - [Configuration](#configuration)
  - [Status](#status)
    - [Power](#power)
      - [power\_mode](#power_mode)
      - [power\_usage\_mode](#power_usage_mode)
      - [using](#using)
      - [Battery](#battery)
        - [available](#available)
        - [charging](#charging)
        - [percentage](#percentage)
        - [voltage](#voltage)
      - [Solar](#solar)
        - [available](#available-1)
        - [solar\_status](#solar_status)
        - [solar\_wattage](#solar_wattage)
    - [Network](#network)
    - [Signal Strenght](#signal-strenght)
      - [connected](#connected)
      - [main](#main)
      - [connected\_sensors](#connected_sensors)
- [Data](#data)
  - [sensor](#sensor)
  - [exception](#exception)
- [Validation](#validation)
  - [Server Validation](#server-validation) 
  - [Client Validation](#client-validation)

* * *
# Info:
Povinný parametr, informační část objektu, převážně diagnostická.
Rozdělení:
* [General information](#general-information)
* [System information](#system-information)
* [Configuration](#configuration) 
* [Status](#status)

## General Information
Skládá se ze základních informacích, 
* [caused_by](#caused_by)
* [time_to_generate](#time_to_generate)


### caused_by:
U diagnostického objektu vypíše funkci, která ji zavolala, ale u chybového vypíše funkci, která selhala.
Funkce, jenž mohou volat tuto funkci: `server`, `time_interval`, `start_up`, `shutdown`, `power_failure`, `{exception}`, `sensor_connect`, `sensor_reconnect`, `sensor_disconnect`, `system_failure`.

> **_NOTE:_** Povinné pouze u diagnostického a chybového objektu.
### sender:
Identifikační číslo odesílatele, unikátní.
> **_NOTE:_** Povinné u všech objektů, string
> Od API Verze 2.1 spadá pod Open Auth
### packet:
Identifikační číslo packetu. První dvě čísla tohoto čísla se určují podle typu json objektu:
| packet | typ |
| :---: | :------: | 
| `01` | Datový |
| `02` | Diagnostický |
| `03` | Testovací |
| `04` | Chybový |
> **_NOTE:_** Povinné u všech objektů, string.
> Od API Verze 2.1 spadá pod Open Auth
### time_to_generate:
Za jak dlouho se vygeneruje diagnostický objekt od zavolání.
> **_NOTE:_** Povinné pouze u diagnostického objektu, number.
> od Verze 2.1 přejmenováno na time_to_generate


## System Information:
Skládá se ze informací o systému,
* [version](#version)
* [connected_devices](#connected_devices)
* [registered_devices](#registered_devices)

### version: 
Verze systému klienta.
> **_NOTE:_** Povinné pouze u diagnostického objektu, string.
### api_version:
Verze systému komunikace mezi serverem a clientem
> **_NOTE:_** Povinné u všech objektů, string.
> Verze < 2.1 nejsou podporované.


### connected_devices 
Připojené zařízení na systému
> **_NOTE:_** Povinné pouze u diagnostického objektu, number.

* * *
## Configuration
Flexibilní část objektu, platné parametry:
`system_time_unit`,`temperature_unit`,`voltage_unit`,`power_unit`,`weight_unit`,`sound_pressure_level_unit`,`network_strenght_unit`
> **_NOTE:_** Povinné pouze u diagnostického objektu, ale nemusí obsahovat informace, string.
* * *
## Status
Aktualní status systému
> **_NOTE:_** Povinné pouze diagnostického objektu.
> U Diagnostického objektu se rozděluje na dvě části
> * [Power](#power)
> * [Network](#network)
### Power
Část zaměřena na elektřinu v systému
* [power_mode](#power_mode)
* [power_usage_mode](#power_usage_mode)
* [using](#using)
* [Battery](#battery)
* [Solar](#solar)
#### power_mode
Ukazuje co napájí systém, platné výrazy `AC`, `SOLAR`, `BATTERY`, `FAILED`
> **_NOTE:_** Povinné pouze u diagnostického objektu, string.

#### power_usage_mode
Ukazuje mod zátěže systému, platné výrazy `overclocked`, `normal`, `sleep`, `deepsleep`, `shuttingdown`, `startup`
> **_NOTE:_** Povinné pouze u diagnostického objektu, string.

#### using
Ukazuje spotřebu systému
> **_NOTE:_** Povinné pouze u diagnostického objektu, number.

#### Battery
Ukazuje informace o baterii
* [available](#available)
* [charging](#charging)
* [percentage](#percentage)
* [voltage](#voltage)
> **_NOTE:_** Povinné pouze u diagnostického objektu.
> charging, percentage a voltage jsou přítomné pouze u přitomné baterie
##### available
Binární hodnota ukazující jestli je baterie přítomna
> **_NOTE:_** Povinné pouze u diagnostického objektu, boolean.
##### charging
Binární hodnota ukazující jestli se baterie nabíjí
> **_NOTE:_** Povinné pouze u diagnostického objektu a přítomné baterie, boolean.
##### percentage
Hodnota ukazují procenta baterie
> **_NOTE:_** Povinné pouze u diagnostického objektu a přítomné baterie, number.
##### voltage
Hodnota ukazující napětí baterie
> **_NOTE:_** Povinné pouze u diagnostického objektu a přítomné baterie, number.

#### Solar
Ukazuje informace o baterii
* [available](#available-1)
* [solar_status](#solar_status)
* [solar wattage](#solar_wattage)
> **_NOTE:_** Povinné pouze u diagnostického objektu.
> Solar status a Solar wattage jen u přitomného solaru
##### available
Binární hodnota ukazující jestli je solar přítomnen
> **_NOTE:_** Povinné pouze u diagnostického objektu a přítomného solaru, boolean.
##### solar_status
Hodnota ukazují stav solaru, platné hodnoty: `Active`, `NotActive`, `Failed`, `LowVoltage`, `HighVoltage`
> **_NOTE:_** Povinné pouze u diagnostického objektu a přítomného solaru, string.
##### solar_wattage
Hodnota ukazují výkon solaru
> **_NOTE:_** Povinné pouze u diagnostického objektu a přítomného solaru, number.


### Network
Ukazuje informace o síti a síle signálu.
### Signal Strenght
Ukazuje sílu signálu,
* [connected](#connected)
* [main](#main)
* [connected_sensors](#connected_sensors)
#### connected
Binární hodnota, ukazující jestli je zařízení připojené
> **_NOTE:_** Povinné pouze u diagnostického objektu, boolean.
#### main
Ukazuje sílu signálu mezi systémem a nejbližšímu přístupovému bodu (db)
> **_NOTE:_** Povinné pouze u diagnostického objektu, number.
> Ve API Verzi 2.1 přejmenováno na main_signal
#### connected_sensors
List připojených sensorů ve formátu: 
| id | name | signal_value | wired |
| :---: | :---: | :---: | :---: | 
| `identifikační číslo sensoru` | `jméno sensoru` | `síla signalu` | `vedeno drátem` |
| `XXXXXX` | `XXXXX` | `72` | `true/false`|
| `string` | `string` | `number` | `boolean` |  
> **_NOTE:_** Povinné pouze u diagnostického objektu.
* * *
# Data
Přenašeč informací o senzorech, chybách či nových testovacích protokolech
* [sensor](#sensor)
* [exception](#exception)
> **_NOTE:_** Data od verze 2.1 jsou povinná pouze u senzorového a chybového objektu.
> **_NOTE:_** U datového objektu můžou být data prázdná, protože parametry jsou nepovinné.
> **_NOTE:_** U chybového objektu je jen možný pouze jeden parametr `exception` a ten je povinný
## sensor
Zápis dat ze souborů, vyskytuje se u senzorového objektu
| id | time | unit | value |
| :---: | :---: | :---: | :---: |
| `identifikační číslo sensoru` | `čas` | `typ hodnoty` | `hodnota` |
| `XXXXXX` | ISO 8601 | `XXXXXX` | `0` |
| `string` | `string` | `string` | `number` |
> **_NOTE:_** typy hodnot, které server přijímá jsou tyto:

| hodnota | velikost | popis |
| :---: | :---: | :---: |
| `humidity` | 0-100% | velikost vlhkosti v prostředí |
| `temperature` | XX | velikost teploty v prostředí |
| `pressure` | 0-X | velikost tlaku v prostředí |
| `wind_speed` | 0 - 100 | rychlost větru |
| `wind_vane` | 0 - 360 | směr větru |
| `storm` | 0/1 | detekování bouřky |
| `weight` | 0 - X | hmotnost úlu |
## exception
Zápis chyb(y) u chybového objektu.
* * *
# Validation
Probíhá v Open Auth, http modulu
* [Validace Clienta](#client_validation)
* [Validace Server](#server_validation)
## Client Validation
Ověření identity clienta - proběhne přes Secret RSA klíče
## Server Validation
Ověrení identity server - proběhne přes HTTPS
> **_NOTE:_** Od API Verze 2.1 je Open AUTH povinná
* * *

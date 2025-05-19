# Dokumentace JSON odesílaného objektu.

## Obsah
1. [Úvod](#úvod)
2. [Objekty](#objekty)
     * [Diagnostický objekt](#diagnostický-objekt)
     * [Datový objekt](#datový-objekt)
     * [Testovací objekt](#testovací-objekt)
     * [Chybový objekt](#chybový-objekt)
     * [Audio objekt]
3. [Funkce](/Server-side/Examples_Documentation/functions.md)


# Úvod


Server dokáže příjmat následující json objekty:
| packet | označení | typ |popis |
| :---: | :---: | :------: | ---------- |
| `01` | `beehive-data` | Datový | Odesílá základní informace o sensorech |
| `02` | `beehive-session` | Datový | Posílá údaje sloužící k registraci nové session |
| `03` | `beehivefull-data` | Diagnostický | Odesílá veškerou telemetrii |
| `04` | `beehive-calibration` | Diagnostický | Slouží ke kalibraci senzorů |
| `05` | `beehive-test` | Testovací | Odesílá specifické informace pro testování |
| `06` | `beehive-malfunction` | Chybový | Odesílá informace při selhání funkce/sensoru |


# Posílané Objekty


## Datové objekty
Posílájí se pravidelně. Slouží ke frekventovanému komunikování senzorů se serverem.
Zatím existují dva typy datových: 
| packet | označení | popis |
| :---: | :---: | ---------- |
| `01` | `beehive-data` | Odesílá základní informace o sensorech |
| `02` | `beehive-session` | Posílá údaje sloužící k registraci nové session |


### Datový objekt beehive-data
Složí ke generálním frekventováným komunikacím mezi serverem a klientem.

### Struktura datového objektu beehive-data

```beehive full data
└─── info  
|    └── api version
|
└── data 
    ├── sensor 
    |   └── id, time, unit, value
    |
    ├── sensor 
    |   └── id, time, unit, value
    |
    ├── sensor 
    |   └── id, time, unit, value
    |
    └── sensor
        └── id, time, unit, weight value
    
```


### Exemplář datového objektu

```json
{
    "info": {
        "api_version": 3.1
    },
    "data": [
        {"id": "72f924fg", "time": "2023-04-28T17:25:50Z", "unit": "humidity", "value": 82},
        {"id": "72f922fg", "time": "2023-04-30T16:15:50Z", "unit": "temperature", "value": 82},
        {"id": "72f922fg", "time": "2023-04-30T16:15:50Z", "unit": "pressure", "value": 1002},
        {"id": "72f921fg", "time": "2023-04-28T17:25:50Z", "unit": "wind_speed", "value": 7},
        {"id": "72f926fg", "time": "2023-04-30T16:15:50Z", "unit": "wind_vane", "value": 190},
        {"id": "72f925fg", "time": "2023-04-28T17:25:50Z", "unit": "storm", "value": 1},
        {"id": "72f928fg", "time": "2023-04-30T16:15:50Z", "unit": "weight", "value": 120}

        ]
}

```




## Diagnostický objekt
Diagnostický objekt posílá veškerou telemetrii, která je k dispozici.
Objekt se posílá za dlouhý časový úsek(napříkad 1x za 5 hodin, přesný čas bude poté určený) nebo když je volán nějakou funkcí.
Posílán na http://example.xxx:81/hive/diagnostics



### Struktura Beehivefull-data objektu

```Beehive Diagnostics
├── general information 
|   ├── caused by    
|   └── time to generate
|
├── system information
|   ├── version
|   ├── api version
|   └── connected devices
|    
├── configuration information
|   └── unit configuration
|    
└── status
    ├── power
    |   ├── power mode
    |   ├── power usage mode
    |   ├── circuit wattage
    |   ├── battery
    |   |   ├── availability
    |   |   ├── charging status
    |   |   ├── battery percentage
    |   |   └── circuit voltage
    |   |
    |   └── solar
    |       ├── availability
    |       ├── solar status
    |       └── solar wattage
    |      
    └── network
        └── signal strenght
            ├── sender
            └── connected devices

```
### Exemplář Beehivefull-data objektu

```json
{
    "general_information": {
        "caused_by": "server",
        "time_to_generate": 1283
    },
    "system_information": {
        "version": "0.75",
        "api_version": "2.1",
        "connected_devices": 5
    },
    "configuration": {
        "system_time_unit": "ms",
        "temperature_unit": "C",
        "voltage_unit": "V",
        "power_unit": "W",
        "speed_unit": "m/s",
        "weight_unit": "kg",
        "sound_pressure_level_unit": "db",
        "network_strenght_unit": "db"},
    "status": {
        "power": {
            "power_mode": "AC",
            "power_usage_mode": "Normal",
            "using": 1.3,
            "battery": {
                "available": true,
                "charging": true,
                "percentage": 10,
                "voltage": 1.2},
            "solar": {
                "available": true,
                "solar_status": "Active",
                "solar_wattage": 0.3
        }},
        "network": {
            "signal_strenght": {
                "connected": true,
                "main_signal": 92,
                "connected_sensors": [
                    {"id": "82f91fa", "name": "Outside_1_temp", "signal_value": "0", "wired": true},
                    {"id": "12fsdfa", "name": "Inside_1_hum",  "signal_value": "0", "wired": true},
                    {"id": "22f91fb", "name": "Outside_3_wind", "signal_value": "30", "wired": false},
                    {"id": "72f91fg", "name": "Inside_4_temp",  "signal_value": "40", "wired": false},
                    {"id": "72f92fg", "name": "Outside_2_hum", "signal_value": "40", "wired": false}
                ]
            }}
    }
}
```







## Testovací objekt
Experimentální objekt, nemá definovou žádnou strukturu, příjmán na adrese
http://example.xxx:81/hive/test, ale v produkční verzy bude odmítán


## Chybový objekt
Je odesílán v případě chyby systému.

Posílán na http://example.xxx:81/hive/failure

### Struktura datového objektu

```beehive full data
└─── info 
|    ├── general information  
|    |   ├── caused by
|    |   ├── sender id
|    |   └── packet
|    |  
|    └── system information
|        ├── version
|        ├── connected devices
|        └── registered devices
|
├─── data 
|    └──  exception
|
└─── validation
     └── hash
    
```

### Exemplář chybového objektu
     
```json
{
    "beh-malf": {
        "info": {
            "general_information": {
                "caused_by": "Main Process",
                "sender": "1AFG5D2713",
                "packet": "0289381jfaf"
            },
            "system_information": {
                "version": "0.11",
                "connected_devices": 5,
                "registered_devices" : 7}
            },
        "data" : {
            "Exception": "{Exception}"
        },

        "validation": {
            "hash": "jsdjsfiosjfio12981"
        }
    }
}
```
## Audio Objekt
Odesílá audio objekty do databáse

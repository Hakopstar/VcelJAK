# VčelJAK - AI Modul pro Analýzu Zdraví Včelstev (Experimentální Fáze)

Tento adresář obsahuje kód a popis experimentálního AI modulu vyvíjeného v rámci projektu VčelJAK. Cílem tohoto modulu je automaticky vyhodnocovat zdravotní stav včelstev na základě senzorických dat a zvukových nahrávek z úlů.

**Důležité Upozornění:**
*   **Stav Projektu:** Modul je momentálně v aktivní vývojové a experimentální fázi. Probíhá ověřování různých architektur neuronových sítí a optimalizace postupů sběru dat.
*   **Nejaktuálnější Informace:** Vzhledem k dynamické povaze vývoje naleznete nejaktuálnější informace, kód a konfigurace přímo v tomto GitHub repozitáři.
*   **Integrace:** Tento AI modul zatím není plně integrován do hlavního serverového systému VčelJAK a slouží primárně pro testování a výzkum architektur.

## Motivace a Cíl

Hlavním cílem je vyvinout model schopný co nejpřesněji určit:
1.  **Celkový zdravotní stav včelstva** (Health-score).
2.  **Specifické statusové štítky** (např. přítomnost matky, rojení, nemoc).

Výzkum se opírá o poznatky z relevantních studií v oblasti monitoringu včelstev pomocí AI. 

## Popis Testované Architektury Neuronové Sítě

Níže je popsána testovaná architektura, která kombinuje zpracování audio dat a dat ze senzorů pomocí dvou specializovaných větví, jejichž výstupy jsou následně fúzovány.

### 1. Audio-větev (Zpracování Zvuku pomocí CNN)

Tato větev analyzuje zvukové nahrávky z úlu pomocí konvoluční neuronové sítě (CNN).

*   **Vstupní Data:**
    *   Krátké zvukové úseky: typicky 5s, 10s. Pro dosažení nejlepší přesnosti se testuje délka 30s.
    *   Formát: WAV, vzorkovací frekvence 16 kHz, 24 kHz nebo 48 kHz.
*   **Předzpracování Vstupu:**
    1.  Segmentace zvuku na krátká okna (délka 25 ms, krok 10 ms).
    2.  Aplikace Krátkodobé Fourierovy Transformace (STFT) na každé okno.
    3.  Převod na log-Mel-spektrogram (typicky 128 Mel pásem).
    4.  Normalizace spektrogramu (průměr 0, rozptyl 1).
    5.  Výpočet Mel-frekvenčních kepstrálních koeficientů (MFCC).
*   **Architektura Konvolučních Bloků (celkem 6 bloků):**
    *   **Blok 1:** Konvoluce (3x3 filtry, 32 kanálů) → ReLU aktivace → Batch Normalization → Max Pooling (2x2)
    *   **Blok 2:** Konvoluce (3x3 filtry, 64 kanálů) → ReLU aktivace → Batch Normalization → Max Pooling (2x2)
    *   **Blok 3:** Konvoluce (3x3 filtry, 128 kanálů) → ReLU aktivace → Batch Normalization → Max Pooling (2x2)
    *   **Blok 4:** Konvoluce (3x3 filtry, 256 kanálů) → ReLU aktivace → Batch Normalization → Max Pooling (2x2)
    *   **Blok 5:** Konvoluce (3x3 filtry, 512 kanálů) → ReLU aktivace → Batch Normalization
    *   **Blok 6:** Konvoluce (3x3 filtry, 512 kanálů) → ReLU aktivace → Batch Normalization
*   **Shrnutí Rysů (Feature Summarization):**
    1.  **Global Average Pooling:** Převede výstupní prostorové mapy z konvolučních bloků na jednorozměrný vektor (délka 512).
    2.  **Plně Propojená Vrstva (Dense):** Redukuje délku vektoru na 256.
    3.  **Dropout:** Aplikován s mírou 30 % pro regularizaci.
    *Výstupem této větve je **audio-vektor** o délce 256.*

### 2. Senzorová Větev (Zpracování Časových Řad pomocí LSTM)

Tato větev analyzuje časové řady dat ze senzorů (teplota, vlhkost, hmotnost) pomocí rekurentní sítě Long Short-Term Memory (LSTM).

*   **Vstupní Data:**
    *   Posloupnost posledních `T` snímků senzorických dat. Například `T=24` vzorků, které pokrývají data za poslední den.
    *   Každý snímek obsahuje trojici hodnot: (teplota, vlhkost, hmotnost).
*   **Architektura LSTM:**
    *   **První LSTM Vrstva:**
        *   64 paměťových jednotek.
        *   Vrací celou sekvenci výstupů (`return_sequences=True`).
        *   Dropout na vstupu (0.2) a na rekurentních spojeních (0.2).
    *   **Druhá LSTM Vrstva:**
        *   64 paměťových jednotek.
        *   Vrací pouze poslední skrytý stav (`return_sequences=False`).
        *   Dropout na vstupu (0.2) a na rekurentních spojeních (0.2).
*   **Výstupní Hlava pro Senzory (Dense Head):**
    1.  Plně Propojená Vrstva (Dense) s 32 neurony.
    2.  ReLU aktivace.
    *Výstupem této větve je **senzorový vektor** o délce 32.*

### 3. Fúze Dat a Výstupní Hlava

Výstupy z obou větví jsou zkombinovány a zpracovány společnou výstupní hlavou.

*   **Spojení Vektorů (Concatenation):**
    *   Audio-vektor (délka 256) a senzorový vektor (délka 32) jsou spojeny do jednoho vektoru o délce 288.
*   **Společná Vrstva:**
    1.  Plně Propojená Vrstva (Dense) se 128 neurony.
    2.  ReLU aktivace.
    3.  Dropout s mírou 30 %.
*   **Výstupy Modelu:**
    *   **Health-score:**
        *   Jedna neuronová jednotka.
        *   Sigmoid aktivační funkce (výstup v rozsahu 0–1, kde 0 značí špatný stav a 1 optimální stav).
    *   **Statusové Štítky (Status Labels):**
        *   Počet neuronových jednotek odpovídá počtu definovaných tříd stavů (např. "Klid", "Rojení", "Bez matky", "Nemoc").
        *   Softmax aktivační funkce (převede výstup na pravděpodobnostní rozdělení, kde součet pravděpodobností všech tříd je 1).

## Další Kroky a Budoucí Vývoj

*   Testování různých hyperparametrů a variant architektur.
*   Optimalizace předzpracování dat.
*   Sběr a anotace většího množství dat pro trénování a validaci.
*   Průzkum technik pro interpretovatelnost modelu.
*   Příprava na integraci nejúspěšnějšího modelu do produkčního systému VčelJAK.


---

Tento dokument bude aktualizován s postupem vývoje.
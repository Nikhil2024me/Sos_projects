# ESP32 + LoRa village warning link

This folder connects the Adivasi Suraksha website to a village receiver.
The website is still the dashboard; the device feed is the part that carries a
warning over LoRa.

## Data path

```
NASA FIRMS / Open-Meteo / USGS / Ambee
              |
              v
   Adivasi Suraksha server (this PC, `node serve.js`)
              |  Wi-Fi (HTTP, ~22 bytes)
              v
   Gateway ESP32 + SX1278  --- LoRa 433 MHz --->  Village ESP32 + SX1278
                                                        |
                                                        v
                                              Serial / LED / buzzer
```

A browser cannot talk to a LoRa module directly, so the gateway ESP32 is the
bridge. It needs Wi-Fi; the village receiver does not. LoRa is one-way here:
the village node receives warnings and does not send data back.

> **NASA GPM rainfall and the wider hazards (GDACS, NASA EONET, ReliefWeb) are
> not part of this link.** They are web-only extras in the dashboard. They are
> not encoded in AS1/AS2, do not raise the alarm and do not change the buzzer.

> **Cities are web-only too.** The dashboard also monitors 32 cities, but the
> LoRa packet carries one of the **30 tribal districts** only (indexes 01–30).
> The village receiver's index table stays tribal, so a city never reaches the
> radio link.

### What you need

* 2 × ESP32 development boards
* 2 × SX1278 / RFM95 LoRa modules on the **same frequency** (usually 433 MHz)
* 2 × antennas (never power a LoRa module without one)
* 1 × active buzzer and 1 × LED for the village node (the ESP32 has an onboard
  LED on GPIO 2)
* A Wi-Fi network that both the server PC and the gateway ESP32 can join

The gateway and receiver both need a microcontroller because SX1278 modules use
SPI. A USB/UART LoRa module (for example an E32) can be driven directly from the
PC instead, but that needs a serial bridge rather than these sketches.

## 1. Start the server

```powershell
node serve.js
```

`serve.js` now listens on all network interfaces and prints the exact device URL:

```
Adivasi Suraksha running at http://127.0.0.1:5173
Device feed (use from the ESP32 on the same Wi-Fi):
  http://192.168.1.5:5173/api/lora?district=bastar
```

Use the `192.168.…` address in the ESP32 sketch, not `127.0.0.1`. If Windows
Firewall asks, allow Node.js on **private networks**. The phone/ESP32 and the PC
must be on the same Wi-Fi.

If the ESP32 cannot reach the server, double-click **`firewall-allow.bat`** in
this folder and approve the administrator prompt. It opens only TCP port 5173 on
private/domain networks. The Wi-Fi must be marked **Private**, not Public.

First request can take ~20 seconds because the server fetches the live feeds.
After that it is cached for 10 minutes.

The air-quality digit needs the Ambee key in `server-secrets.js` (or the
`AMBEE_KEY` environment variable). If the key is missing or the daily quota is
used up, the server simply sends the five-hazard **AS1** packet and the village
link keeps working.

## 2. Device endpoints

| Endpoint | Purpose | Example response |
| --- | --- | --- |
| `/api/health` | Is the feed ready? | JSON with `ready`, `ageSeconds`, source status |
| `/api/districts` | District list with packet index | 30 districts |
| `/api/alerts` | All districts + packets | JSON |
| `/api/alerts?district=bastar` | One district with weather and air | JSON |
| `/api/alerts/1` | Same by packet index | JSON |
| `/api/lora?district=bastar` | **Packet for LoRa** | `AS2,01,0,000002,162006` |
| `/api/lora?district=bastar&format=json` | Packet + decoded fields | JSON |
| `/api/air?district=bastar` | Cached Ambee air quality | JSON |
| `/api/gpm?district=bastar` | NASA GPM rainfall (web only, not in the packet) | JSON |
| `/api/hazards?district=bastar` | GDACS/EONET/ReliefWeb wider hazards (web only, not in the packet) | JSON |

The feed has no login. Keep it on the local Wi-Fi and do not forward the port
from your router. See the main `README.md` for deployment notes.

## 3. Packet format

Both versions are valid. The server uses **AS2** when an Ambee air reading is
available, and falls back to **AS1** when it is not.

```
AS1,18,2,20000,162006
 |   |  |  |||||  |
 |   |  |  |||||  +-- DDHHMM in IST (16th, 20:06)
 |   |  |  |||||----- fire, rain, wind, heat, quake (one digit each)
 |   |  +----------- overall: 0 safe, 1 watch, 2 warning, 3 severe
 |   +-------------- district index, 01-30
 +------------------ protocol version

AS2,18,2,200002,171230
 |   |  |  ||||| |  |
 |   |  |  ||||| |  +-- DDHHMM in IST (17th, 12:30)
 |   |  |  ||||| +----- air quality digit (extra information)
 |   |  |  |||||------- fire, rain, wind, heat, quake (one digit each)
 |   |  +------------- overall: 0 safe, 1 watch, 2 warning, 3 severe
 |   +---------------- district index, 01-30
 +-------------------- protocol version
```

* Max length is 22 bytes for all 30 districts, well below the 51-byte LoRa
  payload limit at common settings.
* Severity digits: `0` safe, `1` watch, `2` warning, `3` severe.
* Hazard order is **FIRE, RAIN, WIND, HEAT, QUAKE**, then **AIR** in AS2.
* The air digit is informational. It **does not raise the overall alarm**, and
  it does not change the LED/buzzer pattern. The receiver prints
  `AIR (extra): …` so the demo can show the Ambee reading.
* The time is when the server built the snapshot, so the receiver can detect a
  stale packet.
* LoRa itself has a CRC; the packet does not add another checksum.

Example: `AS2,18,2,200002,171230` means district 18, overall **warning**, forest
fire **warning**, air quality **watch**, generated at 12:30 IST on the 17th.
`AS1,18,2,20000,162006` is the same kind of packet without an air reading.

## 4. District indexes

| # | id | District | State |
| --- | --- | --- | --- |
| 1 | bastar | Bastar | Chhattisgarh |
| 2 | dantewada | Dantewada | Chhattisgarh |
| 3 | jhabua | Jhabua | Madhya Pradesh |
| 4 | dindori | Dindori | Madhya Pradesh |
| 5 | alirajpur | Alirajpur | Madhya Pradesh |
| 6 | khunti | Khunti | Jharkhand |
| 7 | gumla | Gumla | Jharkhand |
| 8 | west-singhbhum | West Singhbhum | Jharkhand |
| 9 | koraput | Koraput | Odisha |
| 10 | malkangiri | Malkangiri | Odisha |
| 11 | kandhamal | Kandhamal | Odisha |
| 12 | mayurbhanj | Mayurbhanj | Odisha |
| 13 | gadchiroli | Gadchiroli | Maharashtra |
| 14 | nandurbar | Nandurbar | Maharashtra |
| 15 | dahod | Dahod | Gujarat |
| 16 | banswara | Banswara | Rajasthan |
| 17 | paderu | Paderu (ASR) | Andhra Pradesh |
| 18 | bhadrachalam | Bhadrachalam | Telangana |
| 19 | karbi-anglong | Karbi Anglong | Assam |
| 20 | dima-hasao | Dima Hasao | Assam |
| 21 | west-garo-hills | West Garo Hills | Meghalaya |
| 22 | mon | Mon | Nagaland |
| 23 | tamenglong | Tamenglong | Manipur |
| 24 | lunglei | Lunglei | Mizoram |
| 25 | dhalai | Dhalai | Tripura |
| 26 | tirap | Tirap | Arunachal Pradesh |
| 27 | wayanad | Wayanad | Kerala |
| 28 | nilgiris | Nilgiris | Tamil Nadu |
| 29 | kinnaur | Kinnaur | Himachal Pradesh |
| 30 | pithoragarh | Pithoragarh | Uttarakhand |

The live list is always at `/api/districts`.

## 5. Wiring

Both boards use the same SX1278 / RFM95 SPI wiring:

| SX1278 pin | ESP32 pin |
| --- | --- |
| VCC | 3.3 V |
| GND | GND |
| NSS / CS | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| RESET | GPIO 14 |
| DIO0 | GPIO 26 |

* Use **3.3 V only**. Do not power the LoRa module from 5 V.
* Fit the antenna before powering up.
* If the ESP32 resets while transmitting, power the LoRa module from a separate
  3.3 V supply with a common ground, or add a 100 µF capacitor across 3.3 V/GND.
* The gateway and receiver must use the same frequency (`433E6`) and sync word
  (`0x12`). If your modules are 865/868 MHz, change `LORA_FREQ` on both.
* In India the license-free band is **865–867 MHz**; use `865E6` if your modules
  support it. Many low-cost school modules are 433 MHz — match both ends and
  follow your local radio rules.
* The village receiver uses GPIO 2 for the LED and GPIO 27 for an active buzzer.
  Change `BUZZER_ON` to `LOW` if your buzzer board is active-low.

## 6. Flash the sketches

Arduino IDE → Library Manager → install **LoRa by Sandeep Mistry**.

### Gateway (`gateway_esp32/gateway_esp32.ino`)

1. Set `WIFI_SSID` and `WIFI_PASSWORD`.
2. Set `FEED_URL` to the LAN URL printed by `serve.js`, for your district.
3. Select **ESP32 Dev Module** and the correct COM port, then upload.
4. Open Serial Monitor at **115200 baud**.
5. Send `s` to fetch and transmit immediately; it also fetches every 10 minutes.

Expected output:

```
TX OK  AS2,18,2,200002,171230  (22 bytes)
```

The gateway accepts both `AS1,` and `AS2,` payloads and only forwards them; the
receiver does the parsing.

### Receiver (`village_esp32/village_esp32.ino`)

1. Upload to the second ESP32.
2. Open Serial Monitor at **115200 baud**.
3. The LED and buzzer follow the overall severity:
   * safe — off
   * watch — one short beep every 4 s
   * warning — two beeps every 3 s
   * severe — three beeps every 2 s

Expected output:

```
========== Adivasi Suraksha ==========
District index : 18
Overall        : WARNING
  FIRE: WARNING
AIR (extra)    : WATCH (packet AS2, no alarm)
Generated      : day 17, 12:30 IST
Radio          : RSSI -62 dBm, SNR 8.25
Raw            : AS2,18,2,200002,171230
======================================
```

## 7. Five-minute classroom demo

1. Run `start.bat` (or `node serve.js`) on the PC.
2. Note the LAN URL printed in the console, for example
   `http://192.168.1.5:5173`.
3. Set `FEED_URL` in the gateway sketch to that URL for your district, then
   flash both ESP32s.
4. Open both Serial Monitors at **115200 baud**.
5. On the gateway, send **`t`**. This sends a fixed test packet:
   `AS2,18,3,333332,010000` — a severe alert on every disaster hazard and a
   watch-level air digit, clearly marked as a test. The receiver should show
   **SEVERE**, three beeps, and the LED pattern. Air is shown as an extra line
   but does not change the alarm.
6. On the gateway, send **`s`** to fetch the live packet for the configured
   district. The receiver now shows the real severity and, when Ambee is
   available, the live air digit.
7. Open `/api/alerts?district=…` in the browser to show the full weather, air
   quality and alert data behind that small packet.

If the live district happens to be safe, the receiver stays silent — that is
correct behaviour. Use `t` to demonstrate the alarm path, and `s` to show live
data.

## 8. Test without hardware

With the server running:

```powershell
node test/api-check.js
```

This checks all 30 AS1 packets, decodes them, verifies the severity digits
against the alert list, and confirms each packet fits one LoRa frame. It then
checks that a per-district request adds the AS2 air digit when Ambee is
available. It writes `test/api-report.json`.

`node test/ambee-check.js` checks the live air endpoint and its one-hour cache
without spending more than two Ambee calls.

`node test/gpm-check.js` checks the NASA GPM endpoint and its cache. If the
Earthdata account has not approved the GES DISC EULA yet, it checks the clear
`eula_required` message instead. GPM does not affect the LoRa packet, so a GPM
failure must never block the device link.

`node test/hazards-check.js` checks the GDACS/EONET parsers offline and, when
the server is running, the `/api/hazards` endpoint. Wider hazards are web-only
extras and a failure there must never block the device link.

Quick manual checks:

```powershell
Invoke-WebRequest "http://127.0.0.1:5173/api/lora?district=bhadrachalam" -UseBasicParsing
Invoke-WebRequest "http://127.0.0.1:5173/api/air?district=bhadrachalam" -UseBasicParsing
Invoke-WebRequest "http://127.0.0.1:5173/api/hazards?district=bhadrachalam" -UseBasicParsing
Invoke-WebRequest "http://127.0.0.1:5173/api/alerts?district=bhadrachalam" -UseBasicParsing
```

## 9. Troubleshooting

| Problem | Check |
| --- | --- |
| ESP32 cannot connect | Use the PC's `192.168.…` IP, same Wi-Fi, allow Node.js through the firewall |
| `HTTP error -1` | Server not running, wrong IP/port, or phone hotspot client isolation |
| `LoRa init failed` | 3.3 V supply, SPI wiring, antenna, correct board selected |
| Receiver prints nothing | Both ends use the same `LORA_FREQ` and `LORA_SYNC`; gateway serial shows `TX OK` |
| Packet is `AS1,..,0,...` | District is genuinely safe, or Ambee air is unavailable; try `bhadrachalam` when it has a fire alert |
| Packet is `AS1` but the site shows air | Server was restarted without `server-secrets.js`/`AMBEE_KEY`, or the Ambee daily guard/quota was reached |
| Rainfall card says GPM needs approval | One-time NASA GES DISC EULA; the device feed and LoRa packet are unaffected. See the main README |
| Map tiles blocked | Cosmetic only; the device feed does not use the map. The site now uses Esri with an OSM France fallback |

## 10. Why not Wi-Fi in the village?

If the village node has Wi-Fi, it can skip LoRa and read
`/api/alerts?district=…` directly. The LoRa link is for places where there is no
network coverage: the gateway sits where there is Wi-Fi, and the village node
only needs power and radio range.

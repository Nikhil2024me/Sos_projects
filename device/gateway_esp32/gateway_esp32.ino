/*
 * Adivasi Suraksha — LoRa gateway (ESP32 + SX1278 / RFM95)
 * ---------------------------------------------------------
 * This ESP32 has Wi-Fi. It fetches the small alert packet from the Adivasi
 * Suraksha server and transmits it over LoRa to the village receiver.
 *
 * Library needed (Arduino IDE -> Library Manager):
 *   "LoRa" by Sandeep Mistry
 *
 * Board: ESP32 Dev Module. Use 3.3 V logic only. Connect the antenna before
 * powering the LoRa module.
 *
 * Data flow:
 *   website server (PC) --Wi-Fi--> this ESP32 --LoRa 433 MHz--> village ESP32
 *
 * Packet:
 *   AS1,18,2,20000,162006              five disaster hazards
 *   AS2,18,2,200002,171230             same, plus one air-quality digit
 * Both versions fit in one LoRa frame. The gateway only forwards what the
 * server sends; it does not need to decode the fields.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <LoRa.h>

/* ------------------------------------------------------------------ */
/* 1. Wi-Fi and server                                                 */
/* ------------------------------------------------------------------ */

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Use one of the "Device feed" URLs printed by serve.js.
// Example: http://192.168.1.5:5173/api/lora?district=bastar
const char* FEED_URL = "http://192.168.1.5:5173/api/lora?district=bastar";

// How often to fetch a new packet. The server itself caches for 10 minutes.
const unsigned long FETCH_INTERVAL_MS = 10UL * 60UL * 1000UL;

/* ------------------------------------------------------------------ */
/* 2. LoRa SX1278 wiring (change to match your board)                  */
/* ------------------------------------------------------------------ */

#define LORA_SS     5    // NSS / CS
#define LORA_RST    14   // RESET
#define LORA_DIO0   26   // DIO0
#define LORA_FREQ   433E6  // 433 MHz. Use 865E6 or 868E6 for those modules.
#define LORA_SYNC   0x12   // private network; must match the receiver

#define STATUS_LED  2    // most ESP32 dev boards have an LED on GPIO 2

/* ------------------------------------------------------------------ */
/* 3. State                                                            */
/* ------------------------------------------------------------------ */

unsigned long lastFetch = 0;
unsigned long lastWifiAttempt = 0;
bool loraReady = false;

/* ------------------------------------------------------------------ */
/* 4. Helpers                                                          */
/* ------------------------------------------------------------------ */

void connectWiFi() {
  lastWifiAttempt = millis();
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected. Gateway IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi failed. Will retry in the main loop.");
  }
}

bool initLoRa() {
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init failed. Check wiring, 3.3 V power and the antenna.");
    return false;
  }
  LoRa.setSyncWord(LORA_SYNC);
  LoRa.setTxPower(17);
  LoRa.enableCrc();
  Serial.print("LoRa ready at ");
  Serial.print(LORA_FREQ / 1000000);
  Serial.println(" MHz.");
  return true;
}

void sendPacket(const String& packet) {
  LoRa.beginPacket();
  LoRa.print(packet);
  int ok = LoRa.endPacket();  // 1 = sent, 0 = failed

  if (ok) {
    Serial.print("TX OK  ");
  } else {
    Serial.print("TX FAIL  ");
  }
  Serial.print(packet);
  Serial.print("  (");
  Serial.print(packet.length());
  Serial.println(" bytes)");
}

bool fetchAndSend() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("No Wi-Fi. Packet not fetched.");
    return false;
  }
  if (!loraReady) {
    loraReady = initLoRa();
    if (!loraReady) return false;
  }

  HTTPClient http;
  http.setTimeout(40000);  // the first request may warm the server cache
  http.begin(FEED_URL);
  http.setUserAgent("AdivasiSuraksha-Gateway/1.0");

  int status = http.GET();
  if (status != 200) {
    Serial.print("HTTP error ");
    Serial.println(status);
    http.end();
    return false;
  }

  String packet = http.getString();
  http.end();
  packet.trim();

  // Accept only the compact protocol line. Reject HTML error pages.
  // AS2 is the normal packet when Ambee air quality is available; AS1 is
  // still accepted when the air reading is missing.
  if ((!packet.startsWith("AS1,") && !packet.startsWith("AS2,")) || packet.length() > 51) {
    Serial.print("Bad payload: ");
    Serial.println(packet);
    return false;
  }

  sendPacket(packet);
  return true;
}

/* ------------------------------------------------------------------ */
/* 5. Arduino lifecycle                                                */
/* ------------------------------------------------------------------ */

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  Serial.println();
  Serial.println("Adivasi Suraksha — LoRa gateway");
  Serial.println("Serial commands: 's' = fetch and transmit now, 't' = radio test packet.");

  connectWiFi();
  loraReady = initLoRa();

  if (fetchAndSend()) {
    digitalWrite(STATUS_LED, HIGH);
    delay(150);
    digitalWrite(STATUS_LED, LOW);
  }
  lastFetch = millis();
}

void loop() {
  // Wi-Fi recovery
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiAttempt > 15000) {
    connectWiFi();
  }

  // Periodic fetch
  if (millis() - lastFetch >= FETCH_INTERVAL_MS) {
    lastFetch = millis();
    if (fetchAndSend()) {
      digitalWrite(STATUS_LED, HIGH);
      delay(150);
      digitalWrite(STATUS_LED, LOW);
    }
  }

  // Manual commands for a classroom demo
  if (Serial.available()) {
    char command = Serial.read();

    if (command == 's' || command == 'S') {
      Serial.println("Manual fetch requested.");
      if (fetchAndSend()) {
        digitalWrite(STATUS_LED, HIGH);
        delay(150);
        digitalWrite(STATUS_LED, LOW);
      }
    }

    if (command == 't' || command == 'T') {
      if (!loraReady) {
        loraReady = initLoRa();
      }
      if (loraReady) {
        Serial.println("TEST packet: severe disaster alert, air quality = watch. Not live data.");
        sendPacket("AS2,18,3,333332,010000");
      }
    }
  }

  delay(20);
}

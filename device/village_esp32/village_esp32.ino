/*
 * Adivasi Suraksha — village receiver (ESP32 + SX1278 / RFM95)
 * ------------------------------------------------------------
 * Receives the compact alert packet from the gateway and shows it on Serial,
 * an LED and an active buzzer. No Wi-Fi is needed in the village.
 *
 * Library needed (Arduino IDE -> Library Manager):
 *   "LoRa" by Sandeep Mistry
 *
 * Board: ESP32 Dev Module. Use 3.3 V logic only. Connect the antenna before
 * powering the LoRa module.
 *
 * Packet received (both versions are accepted):
 *
 *   AS1,18,2,20000,162006
 *   AS2,18,2,200002,171230
 *   |   |  |  ||||| |  |
 *   |   |  |  ||||| |  +-- DDHHMM in IST (17th, 12:30)
 *   |   |  |  ||||| +----- air quality: 0-3 (AS2 only, extra information)
 *   |   |  |  |||||------- fire, rain, wind, heat, quake severity (0-3)
 *   |   |  +-------------- overall alarm severity (0 safe, 1 watch, 2 warning, 3 severe)
 *   |   +----------------- district index 1-30 (see device/README.md)
 *   +--------------------- protocol version
 *
 * The AS2 air digit never raises the alarm. The LED and buzzer follow only the
 * overall five-hazard alarm, so city pollution does not sound an emergency
 * alert all day.
 */

#include <LoRa.h>

/* ------------------------------------------------------------------ */
/* 1. LoRa SX1278 wiring (must match the gateway)                      */
/* ------------------------------------------------------------------ */

#define LORA_SS     5
#define LORA_RST    14
#define LORA_DIO0   26
#define LORA_FREQ   433E6
#define LORA_SYNC   0x12

/* ------------------------------------------------------------------ */
/* 2. Village outputs                                                  */
/* ------------------------------------------------------------------ */

#define LED_PIN     2    // onboard LED; use an external LED if you prefer
#define BUZZER_PIN  27   // active buzzer (+ to GPIO 27, - to GND)
#define BUZZER_ON   HIGH // change to LOW if your buzzer module is active-low

/* ------------------------------------------------------------------ */
/* 3. Packet model                                                     */
/* ------------------------------------------------------------------ */

const int DISTRICT_COUNT = 30;
const char* HAZARD_NAMES[5] = { "FIRE", "RAIN", "WIND", "HEAT", "QUAKE" };
const char* SEVERITY_NAMES[4] = { "SAFE", "WATCH", "WARNING", "SEVERE" };

struct Alert {
  bool valid;
  bool hasAir;
  int district;
  int overall;
  int hazards[5];
  int air;
  int day;
  int hour;
  int minute;
  String raw;
  unsigned long receivedAt;
};

Alert lastAlert;

/* ------------------------------------------------------------------ */
/* 4. Parsing                                                          */
/* ------------------------------------------------------------------ */

bool allDigits(const String& value) {
  if (value.length() == 0) return false;
  for (unsigned int i = 0; i < value.length(); i++) {
    if (value[i] < '0' || value[i] > '9') return false;
  }
  return true;
}

Alert parsePacket(const String& raw) {
  Alert alert;
  alert.valid = false;
  alert.hasAir = false;
  alert.district = 0;
  alert.overall = 0;
  alert.air = 0;
  alert.day = 0;
  alert.hour = 0;
  alert.minute = 0;
  alert.raw = raw;
  alert.receivedAt = millis();
  for (int i = 0; i < 5; i++) alert.hazards[i] = 0;

  bool hasAir = raw.startsWith("AS2,");
  if (!hasAir && !raw.startsWith("AS1,")) return alert;

  int c1 = raw.indexOf(',');
  int c2 = raw.indexOf(',', c1 + 1);
  int c3 = raw.indexOf(',', c2 + 1);
  int c4 = raw.indexOf(',', c3 + 1);
  if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) return alert;
  if (raw.indexOf(',', c4 + 1) >= 0) return alert;  // too many fields

  String districtText = raw.substring(c1 + 1, c2);
  String overallText  = raw.substring(c2 + 1, c3);
  String hazardText   = raw.substring(c3 + 1, c4);
  String stampText    = raw.substring(c4 + 1);

  if (!allDigits(districtText) || !allDigits(overallText)) return alert;
  int hazardDigits = hasAir ? 6 : 5;
  if ((int)hazardText.length() != hazardDigits || stampText.length() != 6) return alert;

  int district = districtText.toInt();
  int overall = overallText.toInt();
  if (district < 1 || district > DISTRICT_COUNT) return alert;
  if (overall < 0 || overall > 3) return alert;

  for (int i = 0; i < 5; i++) {
    char code = hazardText[i];
    if (code < '0' || code > '3') return alert;
    alert.hazards[i] = code - '0';
  }

  if (hasAir) {
    char airCode = hazardText[5];
    if (airCode < '0' || airCode > '3') return alert;
    alert.air = airCode - '0';
  }

  if (!allDigits(stampText)) return alert;
  alert.day    = stampText.substring(0, 2).toInt();
  alert.hour   = stampText.substring(2, 4).toInt();
  alert.minute = stampText.substring(4, 6).toInt();
  if (alert.hour > 23 || alert.minute > 59) return alert;

  alert.hasAir = hasAir;
  alert.district = district;
  alert.overall = overall;
  alert.valid = true;
  return alert;
}

/* ------------------------------------------------------------------ */
/* 5. Display and alarm                                                */
/* ------------------------------------------------------------------ */

void printAlert(const Alert& alert, int rssi, float snr) {
  Serial.println();
  Serial.println("========== Adivasi Suraksha ==========");
  Serial.print("District index : ");
  Serial.println(alert.district);
  Serial.print("Overall        : ");
  Serial.println(SEVERITY_NAMES[alert.overall]);
  for (int i = 0; i < 5; i++) {
    if (alert.hazards[i] == 0) continue;
    Serial.print("  ");
    Serial.print(HAZARD_NAMES[i]);
    Serial.print(": ");
    Serial.println(SEVERITY_NAMES[alert.hazards[i]]);
  }
  Serial.print("AIR (extra)    : ");
  if (alert.hasAir) {
    Serial.print(SEVERITY_NAMES[alert.air]);
    Serial.println(" (packet AS2, no alarm)");
  } else {
    Serial.println("not in this packet (AS1)");
  }
  Serial.print("Generated      : day ");
  Serial.print(alert.day);
  Serial.print(", ");
  if (alert.hour < 10) Serial.print('0');
  Serial.print(alert.hour);
  Serial.print(':');
  if (alert.minute < 10) Serial.print('0');
  Serial.print(alert.minute);
  Serial.println(" IST");
  Serial.print("Radio          : RSSI ");
  Serial.print(rssi);
  Serial.print(" dBm, SNR ");
  Serial.println(snr, 2);
  Serial.print("Raw            : ");
  Serial.println(alert.raw);
  Serial.println("======================================");
}

// On/off pattern for the buzzer and LED. Non-blocking.
bool alarmOn(unsigned long phase, int level) {
  if (level <= 0) return false;
  if (level == 1) return phase < 120;
  if (level == 2) return phase < 250 || (phase >= 450 && phase < 700);
  return phase < 250 || (phase >= 450 && phase < 700) || (phase >= 900 && phase < 1150);
}

void updateAlarm() {
  if (!lastAlert.valid || lastAlert.overall == 0) {
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, !BUZZER_ON);
    return;
  }

  unsigned long period;
  if (lastAlert.overall == 1) period = 4000;       // one short beep
  else if (lastAlert.overall == 2) period = 3000;  // two beeps
  else period = 2000;                              // three beeps

  bool on = alarmOn(millis() % period, lastAlert.overall);
  digitalWrite(LED_PIN, on ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, on ? BUZZER_ON : !BUZZER_ON);
}

/* ------------------------------------------------------------------ */
/* 6. Arduino lifecycle                                                */
/* ------------------------------------------------------------------ */

void setup() {
  Serial.begin(115200);
  delay(300);

  lastAlert.valid = false;
  lastAlert.overall = 0;

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, !BUZZER_ON);

  // Short self-test: proves the LED and buzzer are wired correctly.
  digitalWrite(LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, BUZZER_ON);
  delay(200);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, !BUZZER_ON);

  Serial.println();
  Serial.println("Adivasi Suraksha — village receiver");
  Serial.println("LED/buzzer self-test done. Waiting for a LoRa packet...");

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init failed. Check wiring, 3.3 V power and the antenna.");
    while (true) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      delay(400);
    }
  }
  LoRa.setSyncWord(LORA_SYNC);
  LoRa.enableCrc();
  Serial.print("LoRa listening at ");
  Serial.print(LORA_FREQ / 1000000);
  Serial.println(" MHz.");
}

void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize > 0) {
    String raw;
    while (LoRa.available()) {
      raw += (char)LoRa.read();
    }

    Alert alert = parsePacket(raw);
    if (alert.valid) {
      lastAlert = alert;
      printAlert(alert, LoRa.packetRssi(), LoRa.packetSnr());
      digitalWrite(LED_PIN, HIGH);
      delay(250);
    } else {
      Serial.print("Rejected packet: ");
      Serial.println(raw);
    }
  }

  updateAlarm();
  delay(5);
}

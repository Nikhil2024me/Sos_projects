#include <SPI.h>
#include <LoRa.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128  // OLED width
#define SCREEN_HEIGHT 64  // OLED height
#define OLED_RESET -1     // Shared reset pin
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// LoRa pins
#define ss 5
#define rst 14
#define dio0 2

void setup() {
  Serial.begin(115200);
  while (!Serial); // Wait for Serial Monitor

  // Initialize OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED failed!");
    while (1);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.display();
  delay(1000);

  // Initialize LoRa
  LoRa.setPins(ss, rst, dio0);
  while (!LoRa.begin(433E6)) { // Adjust frequency for your region
    Serial.println("LoRa init failed. Retrying...");
    delay(1000);
  }
  LoRa.setSyncWord(0xA5); // Sync word to match sender
  Serial.println("LoRa initialized!");
}

void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String receivedData = LoRa.readString(); // Read incoming data
    int rssi = LoRa.packetRssi(); // Get signal strength

    // Print to Serial Monitor
    Serial.print("sos type '");
    Serial.print(receivedData);
    Serial.print("' with RSSI ");
    Serial.println(rssi);

    // Print to OLED
    display.clearDisplay();
    display.setCursor(0, 0);
    display.print("sos type '");
    display.print(receivedData);
    display.setCursor(0, 50);
    display.print("' with RSSI ");
    display.print(rssi);
    display.display(); // Render on OLED
  }
}
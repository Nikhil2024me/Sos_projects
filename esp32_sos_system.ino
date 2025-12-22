/*******************************************************************************
 * ESP32 SOS Emergency System with FreeRTOS Architecture
 * 
 * This system provides emergency service selection and notification via:
 * - TFT Display (ILI9341) with touch interface (XPT2046)
 * - LoRa communication (SX1278)
 * - Physical button for emergency trigger
 * 
 * Refactored with FreeRTOS tasks for better resource management
 ******************************************************************************/

//==============================================================================
// SECTION 1: INCLUDES & FREERTOS CONFIG
//==============================================================================
#include <TJpg_Decoder.h>
#include <FS.h>
#include <WiFi.h>
#include <LoRa.h>
#include <SPI.h>

#ifdef ESP32
#include "SPIFFS.h"
#endif
#include <TFT_eSPI.h>

// FreeRTOS is included by default in ESP32 Arduino Core
// No explicit include needed

//==============================================================================
// SECTION 2: PIN DEFINITIONS & MACROS
//==============================================================================

// LoRa pins
#define LORA_SS    5
#define LORA_RST   17
#define LORA_DIO0  16

// Button pin
#define BUTTON_PIN 12  // Physical button connected to pin 12 and GND

// FreeRTOS timing macros
#define MS_TO_TICKS(ms) pdMS_TO_TICKS(ms)
#define DEBOUNCE_DELAY_MS 300
#define DISPLAY_UPDATE_RATE_MS 100
#define LORA_CHECK_RATE_MS 50
#define INPUT_CHECK_RATE_MS 10
#define POWER_CHECK_RATE_MS 1000

//==============================================================================
// SECTION 3: SYSTEM STATES, STRUCTS & ENUMS
//==============================================================================

// Service types
enum Service { 
  AMBULANCE, 
  FIRE_ENGINE, 
  POLICE, 
  EMERGENCY 
};

// System states
enum SystemState {
  STATE_IDLE,
  STATE_SERVICE_SELECT,
  STATE_CALLING,
  STATE_MESSAGE_SENT,
  STATE_ERROR
};

// Display update command structure
struct DisplayCommand {
  enum Type {
    UPDATE_SERVICE,
    SHOW_CALLING,
    SHOW_SENT,
    REFRESH_SCREEN
  } type;
  Service service;
};

// LoRa message structure
struct LoRaMessage {
  char message[64];
  uint32_t timestamp;
};

// Input event structure
struct InputEvent {
  enum Type {
    BUTTON_PRESS,
    TOUCH_EVENT
  } type;
  uint16_t x;  // For touch events
  uint16_t y;
};

//==============================================================================
// SECTION 4: FREERTOS HANDLES (TASKS, QUEUES, EVENTS, MUTEXES)
//==============================================================================

// Task handles
TaskHandle_t displayTaskHandle = NULL;
TaskHandle_t loraTaskHandle = NULL;
TaskHandle_t inputTaskHandle = NULL;
TaskHandle_t powerTaskHandle = NULL;
TaskHandle_t sosLogicTaskHandle = NULL;

// Queue handles
QueueHandle_t displayQueue = NULL;  // For display commands
QueueHandle_t loraQueue = NULL;     // For LoRa messages to send
QueueHandle_t inputQueue = NULL;    // For input events

// Event group handle
EventGroupHandle_t systemEvents = NULL;

// Event group bits
#define EVENT_EMERGENCY_TRIGGERED  (1 << 0)
#define EVENT_SERVICE_CHANGED      (1 << 1)
#define EVENT_MESSAGE_SENT         (1 << 2)
#define EVENT_LORA_READY          (1 << 3)
#define EVENT_DISPLAY_READY       (1 << 4)

// Mutex handles
SemaphoreHandle_t tftMutex = NULL;
SemaphoreHandle_t loraMutex = NULL;

// Global state (protected by SOS logic task)
volatile Service currentService = AMBULANCE;
volatile SystemState currentState = STATE_IDLE;

// TFT object
TFT_eSPI tft = TFT_eSPI();

//==============================================================================
// SECTION 5: BITMAP DATA (Icon Images)
//==============================================================================

// Ambulance icon
const unsigned char epd_bitmap_1[] PROGMEM = {0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff};

// Fire Engine icon
const unsigned char epd_bitmap_2[] PROGMEM = {0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff};

// Police icon
const unsigned char epd_bitmap_3[] PROGMEM = {0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff};

// Emergency icon
const unsigned char epd_bitmap_4[] PROGMEM = {0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 
	0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff};

//==============================================================================
// SECTION 6: DISPLAY FUNCTIONS
//==============================================================================

// Helper function for JPEG decoding callback (TFT_eSPI integration)
bool tft_output(int16_t x, int16_t y, uint16_t w, uint16_t h, uint16_t* bitmap) {
  if (y >= tft.height()) return 0;
  tft.pushImage(x, y, w, h, bitmap);
  return 1;
}

// Draw service slide with bitmap and text
void drawServiceScreen(Service service) {
  if (xSemaphoreTake(tftMutex, MS_TO_TICKS(100)) == pdTRUE) {
    tft.fillScreen(TFT_ORANGE);
    tft.setTextSize(2);
    tft.setTextColor(TFT_WHITE);

    const char* message;
    const unsigned char* bitmap;
    
    switch (service) {
      case AMBULANCE:
        message = "AMBULANCE";
        bitmap = epd_bitmap_1;
        break;
      case FIRE_ENGINE:
        message = "FIRE ENGINE";
        bitmap = epd_bitmap_2;
        break;
      case POLICE:
        message = "POLICE";
        bitmap = epd_bitmap_3;
        break;
      case EMERGENCY:
        message = "EMERGENCY SERVICE";
        bitmap = epd_bitmap_4;
        break;
      default:
        message = "UNKNOWN";
        bitmap = epd_bitmap_1;
        break;
    }
    
    tft.drawBitmap(0, 0, bitmap, 320, 240, TFT_WHITE);
    tft.setCursor(0, 220);
    tft.print(message);
    
    xSemaphoreGive(tftMutex);
  }
}

// Show calling screen
void drawCallingScreen() {
  if (xSemaphoreTake(tftMutex, MS_TO_TICKS(100)) == pdTRUE) {
    tft.fillScreen(TFT_GREEN);
    tft.setTextColor(TFT_WHITE);
    tft.setTextSize(2);
    const char* message = "Calling...";
    int16_t x = (tft.width() - tft.textWidth(message)) / 2;
    int16_t y = 120;
    tft.setCursor(x, y);
    tft.print(message);
    
    xSemaphoreGive(tftMutex);
  }
}

// Show message sent confirmation
void drawSentScreen() {
  if (xSemaphoreTake(tftMutex, MS_TO_TICKS(100)) == pdTRUE) {
    tft.fillScreen(TFT_BLUE);
    tft.setTextColor(TFT_WHITE);
    tft.setTextSize(2);
    const char* message = "Message Sent!";
    int16_t x = (tft.width() - tft.textWidth(message)) / 2;
    int16_t y = 120;
    tft.setCursor(x, y);
    tft.print(message);
    
    xSemaphoreGive(tftMutex);
  }
}

//==============================================================================
// SECTION 7: LORA FUNCTIONS
//==============================================================================

// Initialize LoRa module
bool initLoRa() {
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  
  if (!LoRa.begin(433E6)) {  // 433 MHz frequency
    Serial.println("LoRa init failed!");
    return false;
  }
  
  LoRa.setSyncWord(0xA5);  // Set sync word for security
  Serial.println("LoRa initialized successfully");
  return true;
}

// Send message via LoRa
bool sendLoRaPacket(const char* message) {
  if (xSemaphoreTake(loraMutex, MS_TO_TICKS(100)) == pdTRUE) {
    Serial.print("Sending LoRa packet: ");
    Serial.println(message);
    
    LoRa.beginPacket();
    LoRa.print(message);
    LoRa.endPacket();
    
    Serial.println("LoRa packet sent");
    
    xSemaphoreGive(loraMutex);
    return true;
  }
  return false;
}

// Check for incoming LoRa messages
int receiveLoRaPacket(char* buffer, size_t bufferSize) {
  if (xSemaphoreTake(loraMutex, MS_TO_TICKS(10)) == pdTRUE) {
    int packetSize = LoRa.parsePacket();
    
    if (packetSize > 0) {
      int idx = 0;
      while (LoRa.available() && idx < bufferSize - 1) {
        buffer[idx++] = (char)LoRa.read();
      }
      buffer[idx] = '\0';
      
      xSemaphoreGive(loraMutex);
      return idx;
    }
    
    xSemaphoreGive(loraMutex);
  }
  return 0;
}

//==============================================================================
// SECTION 8: POWER MANAGEMENT FUNCTIONS
//==============================================================================

// Configure wake-up sources
void configurePowerManagement() {
  // Configure button as wake-up source
  esp_sleep_enable_ext0_wakeup((gpio_num_t)BUTTON_PIN, 0); // Wake on LOW
  
  // Could add timer wake-up for periodic checks
  // esp_sleep_enable_timer_wakeup(60 * 1000000); // 60 seconds
}

// Enter light sleep mode (quick wake-up)
void enterLightSleep(uint32_t sleepTimeMs) {
  Serial.println("Entering light sleep...");
  esp_sleep_enable_timer_wakeup(sleepTimeMs * 1000);
  esp_light_sleep_start();
  Serial.println("Woke from light sleep");
}

// Check if we should enter power-saving mode
bool shouldEnterPowerSave() {
  // Could check battery level, inactivity timer, etc.
  // For now, always stay active
  return false;
}

//==============================================================================
// SECTION 9: TASK IMPLEMENTATIONS
//==============================================================================

/*------------------------------------------------------------------------------
 * Display Task (Priority: 1 - Low)
 * Handles all TFT display updates
 *----------------------------------------------------------------------------*/
void displayTask(void* parameter) {
  DisplayCommand cmd;
  
  Serial.println("Display Task started");
  
  // Signal that display is ready
  xEventGroupSetBits(systemEvents, EVENT_DISPLAY_READY);
  
  for (;;) {
    // Wait for display commands from queue
    if (xQueueReceive(displayQueue, &cmd, MS_TO_TICKS(DISPLAY_UPDATE_RATE_MS)) == pdTRUE) {
      
      switch (cmd.type) {
        case DisplayCommand::UPDATE_SERVICE:
          drawServiceScreen(cmd.service);
          break;
          
        case DisplayCommand::SHOW_CALLING:
          drawCallingScreen();
          break;
          
        case DisplayCommand::SHOW_SENT:
          drawSentScreen();
          break;
          
        case DisplayCommand::REFRESH_SCREEN:
          drawServiceScreen(currentService);
          break;
      }
    }
    
    // Yield to other tasks
    vTaskDelay(MS_TO_TICKS(10));
  }
}

/*------------------------------------------------------------------------------
 * LoRa / Communication Task (Priority: 2 - Medium)
 * Handles LoRa message transmission and reception
 *----------------------------------------------------------------------------*/
void loraTask(void* parameter) {
  LoRaMessage msg;
  char rxBuffer[64];
  
  Serial.println("LoRa Task started");
  
  // Signal that LoRa is ready
  xEventGroupSetBits(systemEvents, EVENT_LORA_READY);
  
  for (;;) {
    // Check for outgoing messages
    if (xQueueReceive(loraQueue, &msg, 0) == pdTRUE) {
      if (sendLoRaPacket(msg.message)) {
        // Notify that message was sent
        xEventGroupSetBits(systemEvents, EVENT_MESSAGE_SENT);
      }
    }
    
    // Check for incoming messages
    int rxLen = receiveLoRaPacket(rxBuffer, sizeof(rxBuffer));
    if (rxLen > 0) {
      Serial.print("Received LoRa message: ");
      Serial.println(rxBuffer);
      // Could process incoming messages here
    }
    
    vTaskDelay(MS_TO_TICKS(LORA_CHECK_RATE_MS));
  }
}

/*------------------------------------------------------------------------------
 * Sensor & Input Task (Priority: 2 - Medium)
 * Handles button presses and touch events with debouncing
 *----------------------------------------------------------------------------*/
void inputTask(void* parameter) {
  static uint32_t lastButtonPress = 0;
  static uint32_t lastTouchEvent = 0;
  uint16_t touchX, touchY;
  InputEvent event;
  
  Serial.println("Input Task started");
  
  for (;;) {
    uint32_t now = millis();
    
    // Check for button press (with debouncing)
    if (digitalRead(BUTTON_PIN) == LOW) {
      if (now - lastButtonPress > DEBOUNCE_DELAY_MS) {
        lastButtonPress = now;
        
        event.type = InputEvent::BUTTON_PRESS;
        xQueueSend(inputQueue, &event, 0);
        
        Serial.println("Button pressed");
      }
    }
    
    // Check for touch events (with debouncing)
    if (tft.getTouch(&touchX, &touchY)) {
      if (now - lastTouchEvent > DEBOUNCE_DELAY_MS) {
        lastTouchEvent = now;
        
        event.type = InputEvent::TOUCH_EVENT;
        event.x = touchX;
        event.y = touchY;
        xQueueSend(inputQueue, &event, 0);
        
        Serial.print("Touch at: ");
        Serial.print(touchX);
        Serial.print(", ");
        Serial.println(touchY);
      }
    }
    
    vTaskDelay(MS_TO_TICKS(INPUT_CHECK_RATE_MS));
  }
}

/*------------------------------------------------------------------------------
 * Power Management Task (Priority: 0 - Lowest/Idle)
 * Handles sleep modes and power optimization
 *----------------------------------------------------------------------------*/
void powerTask(void* parameter) {
  Serial.println("Power Management Task started");
  
  for (;;) {
    // Check if we should enter power-saving mode
    if (shouldEnterPowerSave()) {
      // Notify other tasks before sleep
      Serial.println("Preparing for power save mode");
      
      // Could suspend non-critical tasks here
      // vTaskSuspend(displayTaskHandle);
      
      // Enter light sleep
      enterLightSleep(5000); // 5 seconds
      
      // Resume tasks after wake
      // vTaskResume(displayTaskHandle);
    }
    
    // Run this check infrequently
    vTaskDelay(MS_TO_TICKS(POWER_CHECK_RATE_MS));
  }
}

/*------------------------------------------------------------------------------
 * Core SOS Logic Task (Priority: 3 - Highest)
 * Main state machine and decision making
 * Coordinates all other tasks
 *----------------------------------------------------------------------------*/
void sosLogicTask(void* parameter) {
  InputEvent inputEvent;
  DisplayCommand displayCmd;
  LoRaMessage loraMsg;
  
  Serial.println("SOS Logic Task started");
  
  // Wait for all subsystems to be ready
  xEventGroupWaitBits(
    systemEvents,
    EVENT_LORA_READY | EVENT_DISPLAY_READY,
    pdFALSE,  // Don't clear bits
    pdTRUE,   // Wait for all bits
    portMAX_DELAY
  );
  
  Serial.println("All subsystems ready");
  
  // Show initial screen
  displayCmd.type = DisplayCommand::UPDATE_SERVICE;
  displayCmd.service = currentService;
  xQueueSend(displayQueue, &displayCmd, MS_TO_TICKS(100));
  
  for (;;) {
    // Process input events
    if (xQueueReceive(inputQueue, &inputEvent, MS_TO_TICKS(10)) == pdTRUE) {
      
      switch (inputEvent.type) {
        case InputEvent::TOUCH_EVENT:
          // Touch changes service
          currentService = static_cast<Service>((currentService + 1) % 4);
          
          displayCmd.type = DisplayCommand::UPDATE_SERVICE;
          displayCmd.service = currentService;
          xQueueSend(displayQueue, &displayCmd, MS_TO_TICKS(100));
          
          xEventGroupSetBits(systemEvents, EVENT_SERVICE_CHANGED);
          break;
          
        case InputEvent::BUTTON_PRESS:
          // Button triggers emergency call
          Serial.println("Emergency triggered!");
          
          // Update display to show calling
          displayCmd.type = DisplayCommand::SHOW_CALLING;
          xQueueSend(displayQueue, &displayCmd, MS_TO_TICKS(100));
          
          // Prepare LoRa message
          switch (currentService) {
            case AMBULANCE:
              strcpy(loraMsg.message, "AMBULANCE");
              break;
            case FIRE_ENGINE:
              strcpy(loraMsg.message, "FIRE ENGINE");
              break;
            case POLICE:
              strcpy(loraMsg.message, "POLICE");
              break;
            case EMERGENCY:
              strcpy(loraMsg.message, "EMERGENCY SERVICE");
              break;
          }
          loraMsg.timestamp = millis();
          
          // Send via LoRa
          xQueueSend(loraQueue, &loraMsg, MS_TO_TICKS(100));
          
          xEventGroupSetBits(systemEvents, EVENT_EMERGENCY_TRIGGERED);
          break;
      }
    }
    
    // Check if message was sent
    EventBits_t bits = xEventGroupGetBits(systemEvents);
    if (bits & EVENT_MESSAGE_SENT) {
      // Clear the bit
      xEventGroupClearBits(systemEvents, EVENT_MESSAGE_SENT);
      
      // Show sent confirmation
      displayCmd.type = DisplayCommand::SHOW_SENT;
      xQueueSend(displayQueue, &displayCmd, MS_TO_TICKS(100));
      
      // Wait a bit then return to service screen
      vTaskDelay(MS_TO_TICKS(2000));
      
      displayCmd.type = DisplayCommand::UPDATE_SERVICE;
      displayCmd.service = currentService;
      xQueueSend(displayQueue, &displayCmd, MS_TO_TICKS(100));
    }
    
    vTaskDelay(MS_TO_TICKS(10));
  }
}

//==============================================================================
// SECTION 10: SETUP FUNCTION (TASK CREATION ONLY)
//==============================================================================

void setup() {
  // Initialize serial for debugging
  Serial.begin(115200);
  while (!Serial && millis() < 3000); // Wait up to 3s for Serial
  Serial.println("\n\n=== ESP32 SOS System with FreeRTOS ===");
  
  // Initialize hardware peripherals
  Serial.println("Initializing hardware...");
  
  // Initialize LoRa
  if (!initLoRa()) {
    Serial.println("ERROR: LoRa init failed!");
    // Continue anyway - will be handled by task
  }
  
  // Initialize TFT display
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(2);
  tft.setCursor(20, 100);
  tft.print("Initializing...");
  
  // Configure button pin
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Configure power management
  configurePowerManagement();
  
  // Create FreeRTOS primitives
  Serial.println("Creating FreeRTOS objects...");
  
  // Create mutexes
  tftMutex = xSemaphoreCreateMutex();
  loraMutex = xSemaphoreCreateMutex();
  
  if (tftMutex == NULL || loraMutex == NULL) {
    Serial.println("ERROR: Failed to create mutexes!");
    while (1);
  }
  
  // Create queues
  displayQueue = xQueueCreate(10, sizeof(DisplayCommand));
  loraQueue = xQueueCreate(5, sizeof(LoRaMessage));
  inputQueue = xQueueCreate(10, sizeof(InputEvent));
  
  if (displayQueue == NULL || loraQueue == NULL || inputQueue == NULL) {
    Serial.println("ERROR: Failed to create queues!");
    while (1);
  }
  
  // Create event group
  systemEvents = xEventGroupCreate();
  if (systemEvents == NULL) {
    Serial.println("ERROR: Failed to create event group!");
    while (1);
  }
  
  // Create tasks
  Serial.println("Creating tasks...");
  
  // Display Task - Priority 1 (Low)
  xTaskCreatePinnedToCore(
    displayTask,
    "DisplayTask",
    4096,              // Stack size
    NULL,
    1,                 // Priority (low)
    &displayTaskHandle,
    1                  // Core 1
  );
  
  // LoRa Task - Priority 2 (Medium)
  xTaskCreatePinnedToCore(
    loraTask,
    "LoRaTask",
    3072,
    NULL,
    2,                 // Priority (medium)
    &loraTaskHandle,
    1                  // Core 1
  );
  
  // Input Task - Priority 2 (Medium)
  xTaskCreatePinnedToCore(
    inputTask,
    "InputTask",
    2048,
    NULL,
    2,                 // Priority (medium)
    &inputTaskHandle,
    1                  // Core 1
  );
  
  // Power Management Task - Priority 0 (Lowest)
  xTaskCreatePinnedToCore(
    powerTask,
    "PowerTask",
    2048,
    NULL,
    0,                 // Priority (lowest)
    &powerTaskHandle,
    1                  // Core 1
  );
  
  // SOS Logic Task - Priority 3 (Highest)
  xTaskCreatePinnedToCore(
    sosLogicTask,
    "SOSLogicTask",
    3072,
    NULL,
    3,                 // Priority (highest)
    &sosLogicTaskHandle,
    0                  // Core 0 (separate from other tasks)
  );
  
  Serial.println("Setup complete - FreeRTOS scheduler running");
  Serial.println("Tasks created:");
  Serial.println("  - Display Task (Priority 1)");
  Serial.println("  - LoRa Task (Priority 2)");
  Serial.println("  - Input Task (Priority 2)");
  Serial.println("  - Power Task (Priority 0)");
  Serial.println("  - SOS Logic Task (Priority 3)");
}

//==============================================================================
// SECTION 11: LOOP FUNCTION (EMPTY - ALL WORK IN TASKS)
//==============================================================================

void loop() {
  // Empty - all functionality is handled by FreeRTOS tasks
  // The FreeRTOS idle task will run when no other tasks are ready
  // This saves CPU cycles and power
  
  // Optional: Add watchdog feed or minimal monitoring here if needed
  vTaskDelay(portMAX_DELAY);
}

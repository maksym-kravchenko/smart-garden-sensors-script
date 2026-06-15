#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <BH1750.h>
#include <esp_system.h>
#include "secrets.h"

#define SOIL_PIN 34
#define SOIL2_PIN 32
#define SDA_PIN 21
#define SCL_PIN 22
#define PUMP_RELAY_PIN 26
#define SOIL_DRY_THRESHOLD  30   // start watering below this %
#define SOIL_WET_THRESHOLD  50   // stop once above this %
#define TANK_WET_THRESHOLD  50   // tank sensor must read >= this % to allow pumping
#define SOIL2_MIN_VALID_RAW 300  // below this raw = sensor 2 unplugged -> treat as 0%
#define PUMP_RUN_MS 5000   // water for 5 s per pulse
#define PUMP_SOAK_MS 60000  // then wait 60 s before re-checking

const uint8_t TANK_STABLE_FRAMES = 3;   // ~6 s at 2 s/loop
uint8_t tankOkCount = 0;

bool pumpRunning = false;
unsigned long pumpStartMs = 0;
unsigned long pumpStopMs  = 0;

bool autoMode = true; 
bool manualPumpOn = false;

WiFiClient espClient;
PubSubClient client(espClient);
BH1750 lightMeter;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.println("Connecting to WiFi...");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void setPump(bool on) {
  if (on == pumpRunning) return;
  digitalWrite(PUMP_RELAY_PIN, on ? HIGH : LOW);
  pumpRunning = on;
  if (on) pumpStartMs = millis();
  else    pumpStopMs  = millis();
  client.publish("smartgarden/pump", on ? "on" : "off");
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  String t = String(topic);

  if (t == "smartgarden/auto") {
    autoMode = (msg == "true" || msg == "1" || msg == "auto");
  } else if (t == "smartgarden/pump/set") {
    manualPumpOn = (msg == "on" || msg == "1");
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");

    if (client.connect("ESP32Client", "smartgarden", "smartgarden")) {
      Serial.println("connected");
      client.subscribe("smartgarden/auto");
      client.subscribe("smartgarden/pump/set");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" -> retry in 2 seconds");
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(PUMP_RELAY_PIN, OUTPUT);
  digitalWrite(PUMP_RELAY_PIN, LOW);

  Wire.begin(SDA_PIN, SCL_PIN);

  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("BH1750 initialized");
  } else {
    Serial.println("Error initializing BH1750");
  }

  analogReadResolution(12); // 0-4095

  // Internal pull-down so an unplugged sensor 2 reads ~0 (tank "empty") instead of floating.
  pinMode(SOIL2_PIN, INPUT_PULLDOWN);

  Serial.println("System ready");

 // setup_wifi();
  //client.setServer(mqtt_server, 1883);
  //client.setCallback(mqttCallback);
}

void loop() {
  if (!client.connected()) {
    //reconnect();
  }
  //client.loop();

  // Soil sensor
  int soilRaw = analogRead(SOIL_PIN);

  int soilPercent = map(soilRaw, 3500, 1500, 0, 100);
  soilPercent = constrain(soilPercent, 0, 100);

  // Soil sensor 2
  int soil2Raw = analogRead(SOIL2_PIN);

  int soil2Percent = map(soil2Raw, 3500, 1500, 0, 100);
  soil2Percent = constrain(soil2Percent, 0, 100);

  // Fail-safe: unplugged sensor (pin pulled to ~0) force 0% so the pump stays off.
  bool soil2Connected = (soil2Raw > SOIL2_MIN_VALID_RAW);
  if (!soil2Connected) {
    soil2Percent = 0;
  }

  unsigned long now = millis();

  bool tankRaw = soil2Connected && (soil2Percent >= TANK_WET_THRESHOLD);
  if (tankRaw) {
    if (tankOkCount < TANK_STABLE_FRAMES) tankOkCount++;
  } else {
    tankOkCount = 0;
  }
  bool tankHasWater = (tankOkCount >= TANK_STABLE_FRAMES);

  if (!tankHasWater) {
    setPump(false);
  } else if (autoMode) {
    // Soil-driven: pulse then soak
    if (pumpRunning) {
      if (now - pumpStartMs >= PUMP_RUN_MS) {   // pulse finished
        setPump(false);
      }
    } else {
      bool soakDone = (now - pumpStopMs) >= PUMP_SOAK_MS;
      if (soilPercent < SOIL_DRY_THRESHOLD && soakDone) {
        setPump(true);
      }
    }
  } else {
    // Manual: follow the MQTT command directly
    setPump(manualPumpOn);
  }

  // Light sensor
  float lux = lightMeter.readLightLevel();

  // Serial output
  Serial.print("Mode: ");
  Serial.print(autoMode ? "AUTO" : "MANUAL");
  Serial.print(" | Pump: ");
  Serial.print(pumpRunning ? "ON" : "OFF");
  Serial.print(" | Soil Raw: ");
  Serial.print(soilRaw);
  Serial.print(" | Soil %: ");
  Serial.print(soilPercent);
  Serial.print("% | Soil2 Raw: ");
  Serial.print(soil2Raw);
  Serial.print(" | Soil2 %: ");
  Serial.print(soil2Percent);
  Serial.print("% | Tank: ");
  Serial.print(!soil2Connected ? "NO SENSOR" : (tankHasWater ? "OK" : "EMPTY"));
  Serial.print(" | Light: ");
  Serial.print(lux);
  Serial.println(" lux");

  // MQTT publish
  String soilString = String(soilPercent);
  String lightString = String(lux, 2);

  client.publish("smartgarden/soil", soilString.c_str());
  client.publish("smartgarden/tank", tankHasWater ? "ok" : "empty");
  client.publish("smartgarden/light", lightString.c_str());
  client.publish("smartgarden/pump", pumpRunning ? "on" : "off");

  delay(2000);
}
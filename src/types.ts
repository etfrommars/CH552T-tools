/**
 * CH552T 6-in-1 Multi-function USB Adapter Types & Definitions
 */

export type AdapterMode = 'I2C' | 'SPI' | 'RS485' | 'ONEWIRE' | 'GPIO' | 'ADC_PWM';

export interface ModeInfo {
  id: AdapterMode;
  dipCode: string; // '001', '010', etc.
  dipVal: number;  // 1 to 6
  name: string;
  nameEn: string;
  desc: string;
  iconName: string;
  primaryPins: { pin: string; func: string; desc: string }[];
}

export interface ChipPin {
  pinNumber: number;
  pinName: string;
  package: 'TSSOP-20';
  defaultFunc: string;
  description: string;
  modeFunctions: {
    I2C?: string;
    SPI?: string;
    RS485?: string;
    ONEWIRE?: string;
    GPIO?: string;
    ADC_PWM?: string;
  };
}

export interface SerialConnectionStatus {
  isConnected: boolean;
  isSimulated: boolean;
  portName?: string;
  baudRate: number;
  activeMode: AdapterMode;
  hardwareDipMode: number; // 0=Auto/Web Control, 1-6=Hardware DIP
  modeControlSource: 'WEB' | 'DIP';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  direction: 'TX' | 'RX' | 'INFO' | 'ERR';
  mode: AdapterMode | 'SYS';
  summary: string;
  rawHex?: string;
}

// I2C Types
export interface I2CDeviceMatch {
  address: number;
  hex: string;
  name: string;
  category: string;
  typicalUse: string;
}

// SPI Types
export interface FlashJedecInfo {
  manufacturerId: number;
  memoryType: number;
  capacityId: number;
  manufacturerName: string;
  chipModel: string;
  sizeBytes: number;
  sizeText: string;
}

// RS485 / Modbus Types
export interface ModbusRegister {
  address: number;
  name: string;
  value: number;
  unit?: string;
  desc?: string;
  readonly?: boolean;
}

// 1-Wire Types
export interface OneWireDevice {
  romId: string;
  familyCode: number;
  deviceType: 'DS18B20' | 'DS1990A' | 'DS2431' | 'Unknown';
  description: string;
  temperature?: number;
  resolution?: number;
}

// GPIO Types
export type GpioPinMode = 'QUASI_BIDIR' | 'PUSH_PULL' | 'OPEN_DRAIN' | 'INPUT_HIZ';

export interface GpioPinState {
  index: number;
  name: string; // P1.0 - P1.7
  mode: GpioPinMode;
  level: 0 | 1;
}

// PWM / ADC Types
export interface PwmChannelState {
  channel: 1 | 2;
  pin: string;
  enabled: boolean;
  frequency: number; // Hz (1Hz - 100kHz)
  dutyPercent: number; // 0.0 - 100.0%
}

export interface AdcChannelState {
  channel: number; // 0 - 3 (AIN0 - AIN3)
  pin: string;
  name: string;
  raw: number; // 0 - 255
  voltage: number; // 0.00 - 3.30V
  minVoltage: number;
  maxVoltage: number;
}

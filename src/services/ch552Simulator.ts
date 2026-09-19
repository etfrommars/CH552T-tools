/**
 * CH552T MCU Hardware Simulation Engine
 * Emulates the 6 peripheral modes of the CH552T MCU in pure TypeScript for instant browser testing.
 */

import { AdapterMode, GpioPinState, ModbusRegister, OneWireDevice, FlashJedecInfo } from '../types';
import {
  calculateModbusCRC,
  calculateOneWireCRC,
  bytesToHex,
  CMD_SYS_GET_INFO,
  CMD_SYS_SET_MODE,
  CMD_SYS_GET_DIP,
  CMD_I2C_SCAN,
  CMD_I2C_READ_REG,
  CMD_I2C_WRITE_REG,
  CMD_SPI_FLASH_READ_ID,
  CMD_SPI_FLASH_READ,
  CMD_SPI_FLASH_WRITE,
  CMD_SPI_FLASH_ERASE,
  CMD_SPI_XFER,
  CMD_RS485_SEND_RAW,
  CMD_RS485_MODBUS_MASTER,
  CMD_1WIRE_RESET,
  CMD_1WIRE_SEARCH_ROM,
  CMD_1WIRE_READ_DS18B20,
  CMD_GPIO_SET_MODE,
  CMD_GPIO_WRITE,
  CMD_GPIO_READ,
  CMD_PWM_SET,
  CMD_ADC_READ,
} from './ch552Protocol';

export class CH552Simulator {
  // System State
  public activeMode: AdapterMode = 'I2C';
  public dipSwitchVal: number = 0; // 0=Auto (Web controlled), 1-6=hardware pin DIP
  public firmwareVersion: string = 'v1.4.2 (CH552T-E8051-24MHz)';

  // I2C Virtual Memory
  private eeprom24C02: Uint8Array = new Uint8Array(256);
  private sht30Temp: number = 24.6;
  private sht30Hum: number = 55.4;

  // SPI Virtual Flash (W25Q64 emulation - 4KB sector)
  private flashSector0: Uint8Array = new Uint8Array(4096);

  // Modbus Virtual Registers (Holding Registers 40001 - 40010)
  public modbusRegisters: ModbusRegister[] = [
    { address: 0, name: '40001: 环境温度(x10)', value: 254, unit: '0.1°C', desc: 'SHT30采集温度 25.4°C' },
    { address: 1, name: '40002: 环境湿度(x10)', value: 582, unit: '0.1%RH', desc: 'SHT30采集湿度 58.2%RH' },
    { address: 2, name: '40003: 交流母线电压', value: 2206, unit: '0.1V', desc: '电网电压 220.6V' },
    { address: 3, name: '40004: 运行状态继电器', value: 1, unit: 'BOOL', desc: '0=停止, 1=运行中' },
    { address: 4, name: '40005: 报警代码', value: 0, unit: 'CODE', desc: '0=正常无故障' },
    { address: 5, name: '40006: 累计运行时间(h)', value: 1420, unit: 'h', desc: '总累计通电小时' },
    { address: 6, name: '40007: PWM1预设占空比', value: 500, unit: '0.1%', desc: '50.0%' },
    { address: 7, name: '40008: 模拟通道AIN0', value: 184, unit: 'RAW', desc: '8位ADC读数 (0-255)' },
  ];

  // 1-Wire Virtual Devices
  public oneWireDevices: OneWireDevice[] = [
    {
      romId: '28-AA-4B-12-00-00-00-9B',
      familyCode: 0x28,
      deviceType: 'DS18B20',
      description: '数字可编程分辨率温度传感器 (12-bit)',
      temperature: 24.8,
      resolution: 12,
    },
    {
      romId: '01-7E-82-41-09-00-00-1F',
      familyCode: 0x01,
      deviceType: 'DS1990A',
      description: 'iButton 电子信息钮扣 / 唯一身份ID',
    },
  ];

  // GPIO Pins (P1.0 - P1.7)
  public gpioPins: GpioPinState[] = [
    { index: 0, name: 'P1.0', mode: 'PUSH_PULL', level: 0 },
    { index: 1, name: 'P1.1', mode: 'PUSH_PULL', level: 1 },
    { index: 2, name: 'P1.2', mode: 'QUASI_BIDIR', level: 0 },
    { index: 3, name: 'P1.3', mode: 'QUASI_BIDIR', level: 1 },
    { index: 4, name: 'P1.4', mode: 'OPEN_DRAIN', level: 1 },
    { index: 5, name: 'P1.5', mode: 'INPUT_HIZ', level: 0 },
    { index: 6, name: 'P1.6', mode: 'PUSH_PULL', level: 1 },
    { index: 7, name: 'P1.7', mode: 'PUSH_PULL', level: 0 },
  ];

  // PWM State
  public pwm1Freq = 1000; // 1kHz
  public pwm1Duty = 50; // 50%
  public pwm2Freq = 5000;
  public pwm2Duty = 25;

  constructor() {
    this.initVirtualMemory();
  }

  private initVirtualMemory() {
    // Fill EEPROM with sample config strings & test patterns
    const sampleText = 'CH552T-USB-I2C-ADAPTER-EEPROM-DEMO-DATA-OK!';
    for (let i = 0; i < sampleText.length; i++) {
      this.eeprom24C02[i] = sampleText.charCodeAt(i);
    }
    for (let i = 64; i < 96; i++) {
      this.eeprom24C02[i] = i;
    }

    // Fill Flash Sector 0 with sample boot header
    const flashHeader = 'W25Q64 FLASH SECTOR 0 VALID BOOT IMAGE SIGNATURE: 0x55AA';
    for (let i = 0; i < flashHeader.length; i++) {
      this.flashSector0[i] = flashHeader.charCodeAt(i);
    }
  }

  /**
   * Dispatches command to virtual MCU peripheral
   */
  public handleCommand(mode: AdapterMode | 'SYS', cmd: number, payload: Uint8Array): Uint8Array {
    switch (mode) {
      case 'SYS':
        return this.handleSysCommand(cmd, payload);
      case 'I2C':
        return this.handleI2CCommand(cmd, payload);
      case 'SPI':
        return this.handleSPICommand(cmd, payload);
      case 'RS485':
        return this.handleRS485Command(cmd, payload);
      case 'ONEWIRE':
        return this.handleOneWireCommand(cmd, payload);
      case 'GPIO':
        return this.handleGPIOCommand(cmd, payload);
      case 'ADC_PWM':
        return this.handleAdcPwmCommand(cmd, payload);
      default:
        return new Uint8Array([0xFF, 0x01]); // Error unknown mode
    }
  }

  // SYSTEM
  private handleSysCommand(cmd: number, payload: Uint8Array): Uint8Array {
    if (cmd === CMD_SYS_GET_INFO) {
      const modeId = ['SYS', 'I2C', 'SPI', 'RS485', 'ONEWIRE', 'GPIO', 'ADC_PWM'].indexOf(this.activeMode);
      return new Uint8Array([0x00, modeId, this.dipSwitchVal, 0x01, 0x04]);
    }
    if (cmd === CMD_SYS_SET_MODE) {
      const targetModeNum = payload[0];
      const modes: AdapterMode[] = ['I2C', 'SPI', 'RS485', 'ONEWIRE', 'GPIO', 'ADC_PWM'];
      if (targetModeNum >= 1 && targetModeNum <= 6) {
        this.activeMode = modes[targetModeNum - 1];
        return new Uint8Array([0x00, targetModeNum]);
      }
      return new Uint8Array([0x01]);
    }
    if (cmd === CMD_SYS_GET_DIP) {
      return new Uint8Array([0x00, this.dipSwitchVal]);
    }
    return new Uint8Array([0x00]);
  }

  // I2C
  private handleI2CCommand(cmd: number, payload: Uint8Array): Uint8Array {
    if (cmd === CMD_I2C_SCAN) {
      // Return detected addresses in virtual scan
      // 0x3C (SSD1306), 0x50 (24C02), 0x44 (SHT30)
      return new Uint8Array([0x00, 3, 0x3C, 0x44, 0x50]);
    }
    if (cmd === CMD_I2C_READ_REG) {
      // payload: [devAddr, regAddr, length]
      const dev = payload[0];
      const reg = payload[1];
      const len = Math.min(payload[2] || 1, 64);
      const res = new Uint8Array(len + 1);
      res[0] = 0x00; // Success ACK

      if (dev === 0x50) {
        // Read AT24C02
        for (let i = 0; i < len; i++) {
          res[i + 1] = this.eeprom24C02[(reg + i) & 0xFF];
        }
      } else if (dev === 0x44) {
        // SHT30 readout simulation
        // Return 6 bytes: [TempMSB, TempLSB, CRC, HumMSB, HumLSB, CRC]
        const tempRaw = Math.round(((this.sht30Temp + 45) / 175) * 65535);
        const humRaw = Math.round((this.sht30Hum / 100) * 65535);
        return new Uint8Array([
          0x00,
          (tempRaw >> 8) & 0xFF,
          tempRaw & 0xFF,
          0xB2,
          (humRaw >> 8) & 0xFF,
          humRaw & 0xFF,
          0x8A,
        ]);
      } else {
        // Default device read
        for (let i = 0; i < len; i++) {
          res[i + 1] = (reg + i * 3) & 0xFF;
        }
      }
      return res;
    }
    if (cmd === CMD_I2C_WRITE_REG) {
      // payload: [devAddr, regAddr, ...data]
      const dev = payload[0];
      const reg = payload[1];
      const data = payload.subarray(2);
      if (dev === 0x50) {
        for (let i = 0; i < data.length; i++) {
          this.eeprom24C02[(reg + i) & 0xFF] = data[i];
        }
      }
      return new Uint8Array([0x00, data.length]); // Success ACK
    }
    return new Uint8Array([0x00]);
  }

  // SPI
  private handleSPICommand(cmd: number, payload: Uint8Array): Uint8Array {
    if (cmd === CMD_SPI_FLASH_READ_ID) {
      // Return Winbond W25Q64 JEDEC ID:
      // Manufacturer: 0xEF, MemoryType: 0x40, Capacity: 0x17 (8MBytes)
      return new Uint8Array([0x00, 0xEF, 0x40, 0x17]);
    }
    if (cmd === CMD_SPI_FLASH_READ) {
      // payload: [addrHigh, addrMid, addrLow, len]
      const addr = (payload[0] << 16) | (payload[1] << 8) | payload[2];
      const len = Math.min(payload[3] || 16, 64);
      const res = new Uint8Array(len + 1);
      res[0] = 0x00;
      for (let i = 0; i < len; i++) {
        res[i + 1] = this.flashSector0[(addr + i) % this.flashSector0.length];
      }
      return res;
    }
    if (cmd === CMD_SPI_FLASH_WRITE) {
      // payload: [addrHigh, addrMid, addrLow, ...data]
      const addr = (payload[0] << 16) | (payload[1] << 8) | payload[2];
      const data = payload.subarray(3);
      for (let i = 0; i < data.length; i++) {
        this.flashSector0[(addr + i) % this.flashSector0.length] = data[i];
      }
      return new Uint8Array([0x00, data.length]);
    }
    if (cmd === CMD_SPI_FLASH_ERASE) {
      // Sector erase 4KB
      this.flashSector0.fill(0xFF);
      return new Uint8Array([0x00]);
    }
    if (cmd === CMD_SPI_XFER) {
      // Generic duplex transceive: return inverted echo or simulated response
      const res = new Uint8Array(payload.length + 1);
      res[0] = 0x00;
      for (let i = 0; i < payload.length; i++) {
        res[i + 1] = (~payload[i]) & 0xFF;
      }
      return res;
    }
    return new Uint8Array([0x00]);
  }

  // RS485 / Modbus
  private handleRS485Command(cmd: number, payload: Uint8Array): Uint8Array {
    if (cmd === CMD_RS485_SEND_RAW || cmd === CMD_RS485_MODBUS_MASTER) {
      // Handle Modbus RTU Slave response simulation
      if (payload.length >= 4) {
        const slaveId = payload[0];
        const funcCode = payload[1];
        const startAddr = (payload[2] << 8) | payload[3];
        const count = payload.length >= 6 ? (payload[4] << 8) | payload[5] : 1;

        if (slaveId === 1 || slaveId === 0) {
          // Function 03: Read Holding Registers
          if (funcCode === 0x03 || funcCode === 0x04) {
            const byteCount = count * 2;
            const resp = new Uint8Array(3 + byteCount + 2);
            resp[0] = slaveId || 1;
            resp[1] = funcCode;
            resp[2] = byteCount;
            for (let i = 0; i < count; i++) {
              const regIndex = (startAddr + i) % this.modbusRegisters.length;
              const val = this.modbusRegisters[regIndex]?.value ?? 0;
              resp[3 + i * 2] = (val >> 8) & 0xFF;
              resp[3 + i * 2 + 1] = val & 0xFF;
            }
            const crc = calculateModbusCRC(resp.subarray(0, 3 + byteCount));
            resp[3 + byteCount] = crc & 0xFF;
            resp[3 + byteCount + 1] = (crc >> 8) & 0xFF;
            
            // return with success status
            const out = new Uint8Array(resp.length + 1);
            out[0] = 0x00;
            out.set(resp, 1);
            return out;
          }
          // Function 06: Write Single Register
          if (funcCode === 0x06) {
            const val = (payload[4] << 8) | payload[5];
            const regIndex = startAddr % this.modbusRegisters.length;
            if (this.modbusRegisters[regIndex]) {
              this.modbusRegisters[regIndex].value = val;
            }
            // Echo back request as valid Modbus response
            const resp = new Uint8Array(8);
            resp.set(payload.subarray(0, 6), 0);
            const crc = calculateModbusCRC(resp.subarray(0, 6));
            resp[6] = crc & 0xFF;
            resp[7] = (crc >> 8) & 0xFF;
            const out = new Uint8Array(resp.length + 1);
            out[0] = 0x00;
            out.set(resp, 1);
            return out;
          }
        }
      }
      // Default raw echo response
      return new Uint8Array([0x00, ...payload]);
    }
    return new Uint8Array([0x00]);
  }

  // 1-Wire
  private handleOneWireCommand(cmd: number, payload: Uint8Array): Uint8Array {
    if (cmd === CMD_1WIRE_RESET) {
      // Status 0x00 = Presence Pulse Detected! (Duration ~120µs)
      return new Uint8Array([0x00, 120]);
    }
    if (cmd === CMD_1WIRE_SEARCH_ROM) {
      // Returns 2 discovered ROM IDs
      // DS18B20: 28 AA 4B 12 00 00 00 9B
      // DS1990A: 01 7E 82 41 09 00 00 1F
      return new Uint8Array([
        0x00, 2, // 2 devices
        0x28, 0xAA, 0x4B, 0x12, 0x00, 0x00, 0x00, 0x9B,
        0x01, 0x7E, 0x82, 0x41, 0x09, 0x00, 0x00, 0x1F,
      ]);
    }
    if (cmd === CMD_1WIRE_READ_DS18B20) {
      // Dynamic simulated temperature: 24.5°C + random slight jitter (-0.2 to +0.2)
      const currentTemp = 24.5 + (Math.sin(Date.now() / 3000) * 1.5) + (Math.random() * 0.2 - 0.1);
      const rawTemp = Math.round(currentTemp * 16); // 1/16th degree Celsius resolution
      const tempLSB = rawTemp & 0xFF;
      const tempMSB = (rawTemp >> 8) & 0xFF;

      // Full Scratchpad: [TempLSB, TempMSB, TH, TL, Config(12-bit: 0x7F), 0xFF, 0x00, 0x10, CRC]
      const scratch = new Uint8Array([tempLSB, tempMSB, 75, 0, 0x7F, 0xFF, 0x00, 0x10, 0x00]);
      scratch[8] = calculateOneWireCRC(scratch, 8);

      const out = new Uint8Array(scratch.length + 1);
      out[0] = 0x00;
      out.set(scratch, 1);
      return out;
    }
    return new Uint8Array([0x00]);
  }

  // GPIO
  private handleGPIOCommand(cmd: number, payload: Uint8Array): Uint8Array {
    if (cmd === CMD_GPIO_SET_MODE) {
      // payload: [pinIndex, modeCode]
      const pinIdx = payload[0];
      const modeMap = ['QUASI_BIDIR', 'PUSH_PULL', 'OPEN_DRAIN', 'INPUT_HIZ'] as const;
      if (this.gpioPins[pinIdx] && modeMap[payload[1]]) {
        this.gpioPins[pinIdx].mode = modeMap[payload[1]];
      }
      return new Uint8Array([0x00]);
    }
    if (cmd === CMD_GPIO_WRITE) {
      // payload: [pinIndex, level] or [portByte]
      if (payload.length === 2) {
        const pinIdx = payload[0];
        if (this.gpioPins[pinIdx]) {
          this.gpioPins[pinIdx].level = payload[1] ? 1 : 0;
        }
      } else if (payload.length === 1) {
        const byte = payload[0];
        for (let i = 0; i < 8; i++) {
          this.gpioPins[i].level = ((byte >> i) & 1) ? 1 : 0;
        }
      }
      return new Uint8Array([0x00]);
    }
    if (cmd === CMD_GPIO_READ) {
      let byte = 0;
      for (let i = 0; i < 8; i++) {
        byte |= (this.gpioPins[i].level << i);
      }
      return new Uint8Array([0x00, byte]);
    }
    return new Uint8Array([0x00]);
  }

  // PWM & ADC
  private handleAdcPwmCommand(cmd: number, payload: Uint8Array): Uint8Array {
    if (cmd === CMD_PWM_SET) {
      // payload: [channel, freqMSB, freqLSB, duty]
      const ch = payload[0];
      const freq = (payload[1] << 8) | payload[2];
      const duty = payload[3];
      if (ch === 1) {
        this.pwm1Freq = freq;
        this.pwm1Duty = duty;
      } else {
        this.pwm2Freq = freq;
        this.pwm2Duty = duty;
      }
      return new Uint8Array([0x00]);
    }
    if (cmd === CMD_ADC_READ) {
      // Samples all 4 ADC channels (AIN0 - AIN3)
      const t = Date.now() / 1000;
      // AIN0: Sine wave 0.5V - 2.8V
      const ain0V = 1.65 + Math.sin(t * 2) * 1.15;
      // AIN1: Ramp wave 0.2V - 3.1V
      const ain1V = 0.2 + ((t % 2) / 2) * 2.9;
      // AIN2: Potentiometer ~ 1.65V with small adjustment
      const ain2V = 1.65 + Math.sin(t * 0.3) * 0.4;
      // AIN3: 3.3V DC Rail with slight 20mV ripple
      const ain3V = 3.28 + (Math.random() * 0.04 - 0.02);

      const toRaw = (v: number) => Math.max(0, Math.min(255, Math.round((v / 3.3) * 255)));

      return new Uint8Array([
        0x00,
        toRaw(ain0V),
        toRaw(ain1V),
        toRaw(ain2V),
        toRaw(ain3V),
      ]);
    }
    return new Uint8Array([0x00]);
  }
}

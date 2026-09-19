/**
 * CH552T Communication Protocol & CRC Utils
 * 
 * Frame Format:
 * [SYNC0: 0xAA] [SYNC1: 0x55] [LEN: 1B] [MODE: 1B] [CMD: 1B] [PAYLOAD: NB] [CHKSUM: 1B]
 * Checksum = (LEN + MODE + CMD + sum(PAYLOAD)) & 0xFF
 */

import { AdapterMode } from '../types';

export const PROTOCOL_SYNC0 = 0xAA;
export const PROTOCOL_SYNC1 = 0x55;

export const MODE_CODES: Record<AdapterMode | 'SYS', number> = {
  SYS: 0x00,
  I2C: 0x01,
  SPI: 0x02,
  RS485: 0x03,
  ONEWIRE: 0x04,
  GPIO: 0x05,
  ADC_PWM: 0x06,
};

export const CODE_TO_MODE: Record<number, AdapterMode | 'SYS'> = {
  0x00: 'SYS',
  0x01: 'I2C',
  0x02: 'SPI',
  0x03: 'RS485',
  0x04: 'ONEWIRE',
  0x05: 'GPIO',
  0x06: 'ADC_PWM',
};

// System Commands
export const CMD_SYS_GET_INFO = 0x01;
export const CMD_SYS_SET_MODE = 0x02;
export const CMD_SYS_GET_DIP = 0x03;
export const CMD_SYS_RESET = 0x0F;

// I2C Commands
export const CMD_I2C_SCAN = 0x10;
export const CMD_I2C_READ_REG = 0x11;
export const CMD_I2C_WRITE_REG = 0x12;
export const CMD_I2C_SET_SPEED = 0x13;
export const CMD_I2C_RAW_XFER = 0x14;

// SPI Commands
export const CMD_SPI_XFER = 0x20;
export const CMD_SPI_FLASH_READ_ID = 0x21;
export const CMD_SPI_FLASH_READ = 0x22;
export const CMD_SPI_FLASH_WRITE = 0x23;
export const CMD_SPI_FLASH_ERASE = 0x24;
export const CMD_SPI_SET_CONFIG = 0x25;

// RS485 / Modbus Commands
export const CMD_RS485_SEND_RAW = 0x30;
export const CMD_RS485_SET_BAUD = 0x31;
export const CMD_RS485_MODBUS_MASTER = 0x32;
export const CMD_RS485_SET_FLOW = 0x33;

// 1-Wire Commands
export const CMD_1WIRE_RESET = 0x40;
export const CMD_1WIRE_SEARCH_ROM = 0x41;
export const CMD_1WIRE_READ_ROM = 0x42;
export const CMD_1WIRE_READ_DS18B20 = 0x43;
export const CMD_1WIRE_WRITE_BYTE = 0x44;
export const CMD_1WIRE_READ_BYTE = 0x45;

// GPIO Commands
export const CMD_GPIO_SET_MODE = 0x50;
export const CMD_GPIO_WRITE = 0x51;
export const CMD_GPIO_READ = 0x52;
export const CMD_GPIO_PULSE = 0x53;

// PWM & ADC Commands
export const CMD_PWM_SET = 0x60;
export const CMD_ADC_READ = 0x61;
export const CMD_ADC_STREAM_START = 0x62;
export const CMD_ADC_STREAM_STOP = 0x63;

export interface ProtocolPacket {
  mode: AdapterMode | 'SYS';
  cmd: number;
  data: Uint8Array;
}

/**
 * Builds a binary protocol frame
 */
export function buildFrame(mode: AdapterMode | 'SYS', cmd: number, payload: number[] | Uint8Array = []): Uint8Array {
  const data = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const len = data.length;
  const modeCode = MODE_CODES[mode];
  
  let chk = (len + modeCode + cmd) & 0xFF;
  for (let i = 0; i < len; i++) {
    chk = (chk + data[i]) & 0xFF;
  }

  const frame = new Uint8Array(5 + len + 1);
  frame[0] = PROTOCOL_SYNC0;
  frame[1] = PROTOCOL_SYNC1;
  frame[2] = len;
  frame[3] = modeCode;
  frame[4] = cmd;
  frame.set(data, 5);
  frame[5 + len] = chk;

  return frame;
}

/**
 * Converts a byte array into hex string with optional spaces
 */
export function bytesToHex(bytes: Uint8Array | number[], space = true): string {
  const arr = Array.from(bytes);
  return arr.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(space ? ' ' : '');
}

/**
 * Parses a hex string like "AA 55 01 02" or "AA550102" into byte array
 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Calculates Modbus RTU CRC-16 (Polynomial 0xA001)
 */
export function calculateModbusCRC(data: Uint8Array | number[]): number {
  let crc = 0xFFFF;
  const len = data.length;
  for (let i = 0; i < len; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  }
  return crc;
}

/**
 * Calculates 1-Wire Dallas CRC8 (Polynomial x^8 + x^5 + x^4 + 1 = 0x8C)
 */
export function calculateOneWireCRC(data: Uint8Array | number[], length = data.length): number {
  let crc = 0;
  for (let i = 0; i < length; i++) {
    let inbyte = data[i];
    for (let j = 0; j < 8; j++) {
      const mix = (crc ^ inbyte) & 0x01;
      crc >>= 1;
      if (mix) crc ^= 0x8C;
      inbyte >>= 1;
    }
  }
  return crc;
}

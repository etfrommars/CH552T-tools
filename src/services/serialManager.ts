/**
 * Serial Port & Virtual Device Manager
 * Bridges Web Serial API (for physical CH552T hardware) and CH552Simulator (for in-browser preview)
 */

import { AdapterMode, LogEntry, SerialConnectionStatus } from '../types';
import {
  buildFrame,
  bytesToHex,
  PROTOCOL_SYNC0,
  PROTOCOL_SYNC1,
  CODE_TO_MODE,
  CMD_SYS_SET_MODE,
  CMD_SYS_GET_DIP,
} from './ch552Protocol';
import { CH552Simulator } from './ch552Simulator';

type LogCallback = (entry: LogEntry) => void;
type StatusCallback = (status: SerialConnectionStatus) => void;

export class SerialManager {
  private static instance: SerialManager;

  public simulator: CH552Simulator;
  public isConnected: boolean = false;
  public isSimulated: boolean = true; // Default to interactive virtual simulation for browser preview
  public activeMode: AdapterMode = 'I2C';
  public baudRate: number = 115200;
  public hardwareDipMode: number = 0; // 0=Web control, 1-6=Hardware DIP
  public modeControlSource: 'WEB' | 'DIP' = 'WEB';
  public portName: string = '虚拟仿真设备 (CH552T-Virtual)';

  // Physical serial port references
  private serialPort: any = null;
  private reader: any = null;
  private writer: any = null;
  private rxBuffer: number[] = [];

  private logCallbacks: Set<LogCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();

  private constructor() {
    this.simulator = new CH552Simulator();
    this.simulator.activeMode = this.activeMode;
    this.isConnected = true;
  }

  public static getInstance(): SerialManager {
    if (!SerialManager.instance) {
      SerialManager.instance = new SerialManager();
    }
    return SerialManager.instance;
  }

  public onLog(cb: LogCallback): () => void {
    this.logCallbacks.add(cb);
    return () => this.logCallbacks.delete(cb);
  }

  public onStatus(cb: StatusCallback): () => void {
    this.statusCallbacks.add(cb);
    cb(this.getStatus());
    return () => this.statusCallbacks.delete(cb);
  }

  private notifyStatus() {
    const st = this.getStatus();
    this.statusCallbacks.forEach(cb => cb(st));
  }

  private notifyLog(direction: 'TX' | 'RX' | 'INFO' | 'ERR', mode: AdapterMode | 'SYS', summary: string, raw?: Uint8Array | number[]) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0'),
      direction,
      mode,
      summary,
      rawHex: raw ? bytesToHex(raw) : undefined,
    };
    this.logCallbacks.forEach(cb => cb(entry));
  }

  public getStatus(): SerialConnectionStatus {
    return {
      isConnected: this.isConnected,
      isSimulated: this.isSimulated,
      portName: this.portName,
      baudRate: this.baudRate,
      activeMode: this.activeMode,
      hardwareDipMode: this.hardwareDipMode,
      modeControlSource: this.modeControlSource,
    };
  }

  /**
   * Switch between Physical Web Serial port and Virtual Simulator
   */
  public async setSimulatedMode(simulated: boolean): Promise<void> {
    if (simulated) {
      if (this.serialPort) {
        await this.disconnectPhysical();
      }
      this.isSimulated = true;
      this.isConnected = true;
      this.portName = '虚拟仿真设备 (CH552T-Virtual)';
      this.notifyLog('INFO', 'SYS', '已切换为 CH552T 纯前端高保真仿真模式');
      this.notifyStatus();
    } else {
      await this.connectPhysical();
    }
  }

  /**
   * Connect to real physical CH552T via Web Serial API
   */
  public async connectPhysical(baud = 115200): Promise<boolean> {
    if (!('serial' in navigator)) {
      this.notifyLog('ERR', 'SYS', '当前浏览器不支持 Web Serial API，请使用 Chrome/Edge 或继续使用仿真模式');
      return false;
    }

    try {
      this.notifyLog('INFO', 'SYS', '正在请求用户授权并连接物理串口...');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: baud });

      this.serialPort = port;
      this.baudRate = baud;
      this.isSimulated = false;
      this.isConnected = true;
      this.portName = 'CH552T USB CDC 串口';
      this.writer = port.writable.getWriter();

      this.startPhysicalReader(port);
      this.notifyLog('INFO', 'SYS', `物理硬件连接成功，波特率: ${baud} bps`);
      this.notifyStatus();
      return true;
    } catch (err: any) {
      this.notifyLog('ERR', 'SYS', `串口打开失败: ${err.message || err}`);
      return false;
    }
  }

  public async disconnectPhysical(): Promise<void> {
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
      if (this.serialPort) {
        await this.serialPort.close();
        this.serialPort = null;
      }
    } catch (e) {
      console.warn(e);
    }
    this.isConnected = false;
    this.notifyLog('INFO', 'SYS', '物理串口已断开');
    this.notifyStatus();
  }

  private async startPhysicalReader(port: any) {
    try {
      while (port.readable && this.isConnected && !this.isSimulated) {
        this.reader = port.readable.getReader();
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            this.handleIncomingBytes(value);
          }
        }
      }
    } catch (err) {
      console.warn('Reader error:', err);
    }
  }

  private handleIncomingBytes(bytes: Uint8Array) {
    for (let i = 0; i < bytes.length; i++) {
      this.rxBuffer.push(bytes[i]);
    }
    // Simple frame parser
    while (this.rxBuffer.length >= 6) {
      if (this.rxBuffer[0] !== PROTOCOL_SYNC0 || this.rxBuffer[1] !== PROTOCOL_SYNC1) {
        this.rxBuffer.shift();
        continue;
      }
      const len = this.rxBuffer[2];
      const totalLen = 5 + len + 1;
      if (this.rxBuffer.length < totalLen) {
        break; // Wait for more bytes
      }
      const frame = this.rxBuffer.splice(0, totalLen);
      const modeCode = frame[3];
      const cmd = frame[4];
      const payload = new Uint8Array(frame.slice(5, 5 + len));
      const mode = CODE_TO_MODE[modeCode] || 'SYS';

      this.notifyLog('RX', mode, `收到指令应答 0x${cmd.toString(16).toUpperCase()}`, payload);
    }
  }

  /**
   * Set active functional mode (Web command or DIP sync)
   */
  public async setActiveMode(mode: AdapterMode, source: 'WEB' | 'DIP' = 'WEB'): Promise<boolean> {
    this.activeMode = mode;
    this.modeControlSource = source;
    this.simulator.activeMode = mode;

    const modeNumber = ['SYS', 'I2C', 'SPI', 'RS485', 'ONEWIRE', 'GPIO', 'ADC_PWM'].indexOf(mode);
    if (this.isConnected) {
      await this.sendPacket('SYS', CMD_SYS_SET_MODE, [modeNumber]);
    }

    this.notifyLog('INFO', 'SYS', `已切换工作模式为 [${mode}] (来源: ${source === 'WEB' ? '上位机软件' : '板载拨码开关'})`);
    this.notifyStatus();
    return true;
  }

  /**
   * Set hardware DIP switch simulation state
   */
  public setDipSwitch(val: number) {
    this.hardwareDipMode = val;
    this.simulator.dipSwitchVal = val;
    const modeMap: Record<number, AdapterMode> = {
      1: 'I2C',
      2: 'SPI',
      3: 'RS485',
      4: 'ONEWIRE',
      5: 'GPIO',
      6: 'ADC_PWM',
    };
    if (val >= 1 && val <= 6 && modeMap[val]) {
      this.setActiveMode(modeMap[val], 'DIP');
    } else if (val === 0) {
      this.modeControlSource = 'WEB';
      this.notifyLog('INFO', 'SYS', '拨码开关置为 000 (上位机全权软控模式)');
      this.notifyStatus();
    }
  }

  /**
   * Send command packet to device (real or simulated) and receive response
   */
  public async sendPacket(
    mode: AdapterMode | 'SYS',
    cmd: number,
    payload: number[] | Uint8Array = [],
    summary = ''
  ): Promise<Uint8Array> {
    const frame = buildFrame(mode, cmd, payload);
    const dataBytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);

    this.notifyLog('TX', mode, summary || `发送命令 0x${cmd.toString(16).toUpperCase()}`, frame);

    if (this.isSimulated) {
      // Simulate typical USB micro-delay (1-8ms)
      await new Promise(r => setTimeout(r, 6));
      const respPayload = this.simulator.handleCommand(mode, cmd, dataBytes);
      this.notifyLog('RX', mode, `应答 0x${cmd.toString(16).toUpperCase()} (${respPayload.length} 字节)`, respPayload);
      return respPayload;
    }

    // Physical Serial transmission
    if (!this.writer) {
      throw new Error('串口未连接');
    }

    await this.writer.write(frame);
    return new Uint8Array([0x00]);
  }
}

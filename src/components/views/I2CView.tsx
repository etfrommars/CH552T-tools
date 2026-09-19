import React, { useState } from 'react';
import { 
  Cpu, 
  Search, 
  Play, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Thermometer, 
  Database,
  RefreshCw
} from 'lucide-react';
import { SerialManager } from '../../services/serialManager';
import { bytesToHex, hexToBytes, CMD_I2C_SCAN, CMD_I2C_READ_REG, CMD_I2C_WRITE_REG } from '../../services/ch552Protocol';

const KNOWN_I2C_DEVICES: Record<number, { name: string; type: string; desc: string }> = {
  0x3C: { name: 'SSD1306 / SH1106', type: 'OLED 显示屏', desc: '0.96寸 128x64 单色图形OLED驱动IC' },
  0x3D: { name: 'SSD1306 (Alt)', type: 'OLED 显示屏', desc: '交替地址 0x3D' },
  0x44: { name: 'SHT30 / SHT31', type: '温湿度传感器', desc: 'Sensirion 高精度数字温湿度芯片' },
  0x48: { name: 'ADS1115 / PCF8591', type: '高精度ADC', desc: '16位ADC转换器或8位AD/DA' },
  0x50: { name: 'AT24C02 / 24Cxx', type: 'I2C EEPROM', desc: '2Kbit (256字节) 串行非易失存储器' },
  0x68: { name: 'MPU6050 / DS3231', type: '六轴陀螺仪 / RTC', desc: '运动传感器或高精度实时时钟' },
  0x76: { name: 'BMP280 / BME280', type: '气压传感器', desc: '博世气压/温度测量芯片' },
};

export const I2CView: React.FC = () => {
  const serial = SerialManager.getInstance();

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [foundAddresses, setFoundAddresses] = useState<number[]>([0x3C, 0x44, 0x50]);
  const [speed, setSpeed] = useState<'100k' | '400k' | '50k'>('100k');

  // Register RW state
  const [targetDev, setTargetDev] = useState('0x50');
  const [targetReg, setTargetReg] = useState('0x00');
  const [readLength, setReadLength] = useState('8');
  const [writeDataHex, setWriteDataHex] = useState('57 43 48 20 43 48 35 35');
  const [readResultHex, setReadResultHex] = useState<string>('43 48 35 35 32 54 2D 55');
  const [readResultAscii, setReadResultAscii] = useState<string>('CH552T-U');
  const [statusMsg, setStatusMsg] = useState<string>('就绪：已挂载I2C总线 (SCL=P1.0, SDA=P1.1)');

  // EEPROM Quick View (256 bytes)
  const [eepromData, setEepromData] = useState<number[]>(() => {
    const arr = new Array(64).fill(0);
    const demo = 'CH552T-USB-I2C-ADAPTER-EEPROM-DEMO-DATA-OK!';
    for (let i = 0; i < demo.length; i++) arr[i] = demo.charCodeAt(i);
    for (let i = 44; i < 64; i++) arr[i] = i;
    return arr;
  });

  // SHT30 Quick Sensor Reading
  const [sht30Data, setSht30Data] = useState<{ temp: number; hum: number } | null>(null);

  // Trigger Bus Scan
  const handleScan = async () => {
    setScanning(true);
    setStatusMsg('正在扫描 I2C 7位从机地址总线 (0x08 - 0x77)...');
    try {
      const resp = await serial.sendPacket('I2C', CMD_I2C_SCAN, [], 'I2C从机总线扫描');
      if (resp.length >= 2 && resp[0] === 0x00) {
        const count = resp[1];
        const addrs = Array.from(resp.slice(2, 2 + count));
        setFoundAddresses(addrs);
        setStatusMsg(`扫描完成：共发现 ${count} 个活动 I2C 从机设备！`);
      } else {
        setStatusMsg('未检测到从机设备响应或总线拉死');
      }
    } catch (e: any) {
      setStatusMsg(`扫描出错: ${e.message}`);
    } finally {
      setScanning(false);
    }
  };

  // Read Register
  const handleReadReg = async () => {
    const dev = parseInt(targetDev, 16);
    const reg = parseInt(targetReg, 16);
    const len = parseInt(readLength, 10) || 1;
    if (isNaN(dev) || isNaN(reg)) {
      setStatusMsg('错误：请输入合法的十六进制设备与寄存器地址');
      return;
    }

    try {
      const resp = await serial.sendPacket('I2C', CMD_I2C_READ_REG, [dev, reg, len], `读取 I2C [0x${dev.toString(16)}] 寄存器 0x${reg.toString(16)}`);
      if (resp[0] === 0x00) {
        const dataBytes = resp.slice(1);
        const hex = bytesToHex(dataBytes);
        const ascii = Array.from(dataBytes).map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
        setReadResultHex(hex);
        setReadResultAscii(ascii);
        setStatusMsg(`成功读取 ${dataBytes.length} 字节数据`);
      } else {
        setStatusMsg('读取失败：设备未响应 ACK');
      }
    } catch (e: any) {
      setStatusMsg(`读取异常: ${e.message}`);
    }
  };

  // Write Register
  const handleWriteReg = async () => {
    const dev = parseInt(targetDev, 16);
    const reg = parseInt(targetReg, 16);
    const dataBytes = hexToBytes(writeDataHex);
    if (isNaN(dev) || isNaN(reg)) {
      setStatusMsg('错误：请输入合法的十六进制地址');
      return;
    }

    try {
      const payload = [dev, reg, ...dataBytes];
      const resp = await serial.sendPacket('I2C', CMD_I2C_WRITE_REG, payload, `写入 I2C [0x${dev.toString(16)}] 寄存器 0x${reg.toString(16)}`);
      if (resp[0] === 0x00) {
        setStatusMsg(`成功写入 ${dataBytes.length} 字节到从机 0x${dev.toString(16).toUpperCase()}`);
        // If writing to 0x50, refresh local EEPROM view
        if (dev === 0x50) {
          const next = [...eepromData];
          for (let i = 0; i < dataBytes.length; i++) {
            next[(reg + i) % next.length] = dataBytes[i];
          }
          setEepromData(next);
        }
      }
    } catch (e: any) {
      setStatusMsg(`写入失败: ${e.message}`);
    }
  };

  // Read SHT30 Demo
  const handleReadSHT30 = async () => {
    try {
      const resp = await serial.sendPacket('I2C', CMD_I2C_READ_REG, [0x44, 0x2C, 6], '读取SHT30温湿度');
      if (resp[0] === 0x00 && resp.length >= 7) {
        const rawTemp = (resp[1] << 8) | resp[2];
        const rawHum = (resp[4] << 8) | resp[5];
        const temp = -45 + 175 * (rawTemp / 65535);
        const hum = 100 * (rawHum / 65535);
        setSht30Data({ temp: parseFloat(temp.toFixed(2)), hum: parseFloat(hum.toFixed(2)) });
        setStatusMsg(`SHT30 采集成功: ${temp.toFixed(2)} °C, ${hum.toFixed(2)} %RH`);
      }
    } catch (e: any) {
      setStatusMsg(`读取SHT30失败: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Pin Mapping & Speed */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              USB转I2C适配器工作台
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                DIP: 001
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              硬件分配: <span className="text-amber-400 font-mono">P1.0=SCL</span> (Pin 13), <span className="text-amber-400 font-mono">P1.1=SDA</span> (Pin 14) · 外接4.7kΩ上拉电阻
            </p>
          </div>
        </div>

        {/* Speed & Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>时钟速率:</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 text-cyan-300 text-xs rounded px-2 py-1 focus:outline-none"
            >
              <option value="50k">50 kHz (低速长距离)</option>
              <option value="100k">100 kHz (标准模式)</option>
              <option value="400k">400 kHz (快速模式 Fast-Mode)</option>
            </select>
          </div>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm shadow-cyan-900/40"
          >
            <Search className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? '正在扫描总线...' : '扫描I2C从机设备'}
          </button>
        </div>
      </div>

      {/* Main Grid: Scanner & Register Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: I2C Bus Scanner & Found Devices */}
        <div className="lg:col-span-5 space-y-4">
          {/* Detected Devices List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
              <span>已识别的活动从机 ({foundAddresses.length})</span>
              <span className="text-[11px] font-mono text-slate-500">7-Bit Addr</span>
            </h3>

            {foundAddresses.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                未扫描到设备，请点击上方“扫描I2C从机设备”或检查硬件上拉电阻
              </div>
            ) : (
              <div className="space-y-2">
                {foundAddresses.map((addr) => {
                  const hexStr = '0x' + addr.toString(16).toUpperCase().padStart(2, '0');
                  const match = KNOWN_I2C_DEVICES[addr] || {
                    name: '通用 I2C 从机',
                    type: '未知类型',
                    desc: '标准7位响应设备',
                  };

                  return (
                    <div
                      key={addr}
                      onClick={() => setTargetDev(hexStr)}
                      className="group p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-cyan-950/70 border border-cyan-800 flex items-center justify-center font-mono font-bold text-cyan-400 text-xs">
                          {hexStr}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                            {match.name}
                          </div>
                          <div className="text-[11px] text-slate-400">{match.desc}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                        {match.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Sensor Card: SHT30 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">SHT30 实时温湿度传感器调试</span>
              </div>
              <button
                onClick={handleReadSHT30}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                读取一次
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
                <span className="text-[11px] text-slate-400">当前环境温度</span>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                  {sht30Data ? `${sht30Data.temp} °C` : '24.62 °C'}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
                <span className="text-[11px] text-slate-400">当前相对湿度</span>
                <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                  {sht30Data ? `${sht30Data.hum} %` : '55.40 %'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Register Read / Write & EEPROM Explorer */}
        <div className="lg:col-span-7 space-y-4">
          {/* Register Read/Write Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
              <span>寄存器读写控制台</span>
              <span className="text-xs text-slate-400 font-mono">{statusMsg}</span>
            </h3>

            {/* Input Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">从机地址 (7-Bit)</label>
                <input
                  type="text"
                  value={targetDev}
                  onChange={(e) => setTargetDev(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"
                  placeholder="0x50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">寄存器/内存地址</label>
                <input
                  type="text"
                  value={targetReg}
                  onChange={(e) => setTargetReg(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"
                  placeholder="0x00"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">读取字节数</label>
                <input
                  type="number"
                  min={1}
                  max={64}
                  value={readLength}
                  onChange={(e) => setReadLength(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleReadReg}
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center justify-center gap-1 transition-all"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  读取
                </button>
                <button
                  onClick={handleWriteReg}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center justify-center gap-1 transition-all"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  写入
                </button>
              </div>
            </div>

            {/* Write Data Hex Box */}
            <div className="mb-4">
              <label className="block text-[11px] text-slate-400 mb-1">写入数据 (HEX 格式，以空格分隔)</label>
              <input
                type="text"
                value={writeDataHex}
                onChange={(e) => setWriteDataHex(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                placeholder="AA BB CC 01 02"
              />
            </div>

            {/* Read Result Output */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                <span>读取返回数据</span>
                <span className="font-mono text-cyan-400 text-[10px]">ASCII: {readResultAscii}</span>
              </div>
              <div className="font-mono text-xs text-amber-400 break-all select-all">
                {readResultHex || '无数据'}
              </div>
            </div>
          </div>

          {/* AT24C02 EEPROM Memory Map Explorer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">AT24C02 EEPROM 内存映射视图 (前64字节)</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">从机: 0x50</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[10px] font-mono text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="py-1 px-2 text-left">偏移</th>
                    {['0', '1', '2', '3', '4', '5', '6', '7'].map((n) => (
                      <th key={n} className="py-1 px-1.5 text-center">+{n}</th>
                    ))}
                    <th className="py-1 px-2 text-left">ASCII</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 8, 16, 24, 32, 40, 48, 56].map((rowOffset) => {
                    const slice = eepromData.slice(rowOffset, rowOffset + 8);
                    const asciiStr = slice
                      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
                      .join('');

                    return (
                      <tr key={rowOffset} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                        <td className="py-1 px-2 text-cyan-400 font-bold">
                          0x{rowOffset.toString(16).padStart(2, '0').toUpperCase()}
                        </td>
                        {slice.map((byte, idx) => (
                          <td key={idx} className="py-1 px-1.5 text-center text-slate-300">
                            {byte.toString(16).padStart(2, '0').toUpperCase()}
                          </td>
                        ))}
                        <td className="py-1 px-2 text-slate-400 font-mono">{asciiStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

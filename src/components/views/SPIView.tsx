import React, { useState } from 'react';
import { 
  Layers, 
  Cpu, 
  Send, 
  HardDrive, 
  RefreshCw, 
  Trash2, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Zap 
} from 'lucide-react';
import { SerialManager } from '../../services/serialManager';
import { bytesToHex, hexToBytes, CMD_SPI_FLASH_READ_ID, CMD_SPI_FLASH_READ, CMD_SPI_FLASH_WRITE, CMD_SPI_FLASH_ERASE, CMD_SPI_XFER } from '../../services/ch552Protocol';

export const SPIView: React.FC = () => {
  const serial = SerialManager.getInstance();

  // SPI Configuration
  const [spiMode, setSpiMode] = useState<0 | 1 | 2 | 3>(0);
  const [clkDiv, setClkDiv] = useState<number>(2); // 24MHz / 2 = 12MHz

  // Flash Memory State
  const [flashInfo, setFlashInfo] = useState<{
    mfg: string;
    model: string;
    capacity: string;
    rawId: string;
  } | null>({
    mfg: 'Winbond (华邦电子)',
    model: 'W25Q64JVSSIQ (NOR Flash)',
    capacity: '64 Mbit (8 MB)',
    rawId: 'EF 40 17',
  });

  const [sectorData, setSectorData] = useState<string>('57 32 35 51 36 34 20 46 4C 41 53 48 20 53 45 43 54 4F 52 20 30 20 56 41 4C 49 44 20 42 4F 4F 54');
  const [sectorAscii, setSectorAscii] = useState<string>('W25Q64 FLASH SECTOR 0 VALID BOOT');
  const [flashWriteHex, setFlashWriteHex] = useState('AA 55 12 34 56 78 9A BC');
  const [flashAddress, setFlashAddress] = useState('0x000000');

  // Raw SPI Transceive
  const [txHex, setTxHex] = useState('9F 00 00 00');
  const [rxHex, setRxHex] = useState('');
  const [statusMsg, setStatusMsg] = useState('就绪：CH552T硬件SPI主机模式 (最高12MHz速率)');

  // Read JEDEC ID (0x9F)
  const handleReadID = async () => {
    setStatusMsg('正在发送 0x9F JEDEC ID 指令...');
    try {
      const resp = await serial.sendPacket('SPI', CMD_SPI_FLASH_READ_ID, [], 'SPI Flash读取JEDEC ID');
      if (resp[0] === 0x00 && resp.length >= 4) {
        const mfgId = resp[1];
        const memType = resp[2];
        const capId = resp[3];
        const raw = `${mfgId.toString(16).toUpperCase()} ${memType.toString(16).toUpperCase()} ${capId.toString(16).toUpperCase()}`;

        let mfgName = '未知厂商';
        let chipModel = 'SPI Flash';
        let capStr = '未知容量';

        if (mfgId === 0xEF) {
          mfgName = 'Winbond (华邦电子)';
          if (capId === 0x17) { chipModel = 'W25Q64 (64Mbit)'; capStr = '8 MBytes'; }
          else if (capId === 0x18) { chipModel = 'W25Q128 (128Mbit)'; capStr = '16 MBytes'; }
          else if (capId === 0x16) { chipModel = 'W25Q32 (32Mbit)'; capStr = '4 MBytes'; }
        } else if (mfgId === 0xC8) {
          mfgName = 'GigaDevice (兆易创新)';
          chipModel = `GD25Q${1 << (capId - 0x10)}`;
        }

        setFlashInfo({
          mfg: mfgName,
          model: chipModel,
          capacity: capStr,
          rawId: raw,
        });
        setStatusMsg(`识别成功: ${chipModel} (${capStr})`);
      }
    } catch (e: any) {
      setStatusMsg(`读取ID失败: ${e.message}`);
    }
  };

  // Read Flash Sector
  const handleReadSector = async () => {
    try {
      const addr = parseInt(flashAddress, 16) || 0;
      const payload = [(addr >> 16) & 0xFF, (addr >> 8) & 0xFF, addr & 0xFF, 32];
      const resp = await serial.sendPacket('SPI', CMD_SPI_FLASH_READ, payload, `读取Flash扇区数据`);
      if (resp[0] === 0x00) {
        const data = resp.slice(1);
        setSectorData(bytesToHex(data));
        setSectorAscii(Array.from(data).map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join(''));
        setStatusMsg(`成功读取 32 字节数据 (地址: 0x${addr.toString(16).toUpperCase()})`);
      }
    } catch (e: any) {
      setStatusMsg(`读取失败: ${e.message}`);
    }
  };

  // Write Flash Data
  const handleWriteFlash = async () => {
    try {
      const addr = parseInt(flashAddress, 16) || 0;
      const bytes = hexToBytes(flashWriteHex);
      const payload = [(addr >> 16) & 0xFF, (addr >> 8) & 0xFF, addr & 0xFF, ...bytes];
      const resp = await serial.sendPacket('SPI', CMD_SPI_FLASH_WRITE, payload, `写入Flash扇区`);
      if (resp[0] === 0x00) {
        setStatusMsg(`成功写入 ${bytes.length} 字节到Flash`);
        handleReadSector(); // Auto refresh
      }
    } catch (e: any) {
      setStatusMsg(`写入失败: ${e.message}`);
    }
  };

  // Erase Flash Sector
  const handleEraseSector = async () => {
    try {
      const resp = await serial.sendPacket('SPI', CMD_SPI_FLASH_ERASE, [], '擦除Flash扇区 (4KB)');
      if (resp[0] === 0x00) {
        setStatusMsg('4KB 扇区已成功擦除为 0xFF');
        setSectorData(new Array(32).fill('FF').join(' '));
        setSectorAscii(new Array(32).fill('.').join(''));
      }
    } catch (e: any) {
      setStatusMsg(`擦除失败: ${e.message}`);
    }
  };

  // Generic SPI Transceive
  const handleSendRaw = async () => {
    try {
      const bytes = hexToBytes(txHex);
      const resp = await serial.sendPacket('SPI', CMD_SPI_XFER, bytes, `SPI全双工收发 ${bytes.length} 字节`);
      if (resp[0] === 0x00) {
        const rx = resp.slice(1);
        setRxHex(bytesToHex(rx));
        setStatusMsg(`全双工传输完成: 发送 ${bytes.length} 字节，接收 ${rx.length} 字节`);
      }
    } catch (e: any) {
      setStatusMsg(`传输出错: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              USB转SPI适配器工作台
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                DIP: 010
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              引脚映射: <span className="text-amber-400 font-mono">SCK=P1.0</span> (Pin 13), <span className="text-amber-400 font-mono">MOSI=P1.1</span> (Pin 14), <span className="text-amber-400 font-mono">MISO=P1.2</span> (Pin 15), <span className="text-amber-400 font-mono">CS=P1.3</span> (Pin 16)
            </p>
          </div>
        </div>

        {/* SPI Config Modes */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span>SPI 模式:</span>
            <select
              value={spiMode}
              onChange={(e) => setSpiMode(parseInt(e.target.value) as any)}
              className="bg-slate-950 border border-slate-700 text-indigo-300 text-xs rounded px-2 py-1 focus:outline-none"
            >
              <option value={0}>Mode 0 (CPOL=0, CPHA=0)</option>
              <option value={1}>Mode 1 (CPOL=0, CPHA=1)</option>
              <option value={2}>Mode 2 (CPOL=1, CPHA=0)</option>
              <option value={3}>Mode 3 (CPOL=1, CPHA=1)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span>串行时钟分频:</span>
            <select
              value={clkDiv}
              onChange={(e) => setClkDiv(parseInt(e.target.value))}
              className="bg-slate-950 border border-slate-700 text-indigo-300 text-xs rounded px-2 py-1 focus:outline-none"
            >
              <option value={2}>12 MHz (Fsys / 2)</option>
              <option value={4}>6 MHz (Fsys / 4)</option>
              <option value={8}>3 MHz (Fsys / 8)</option>
              <option value={16}>1.5 MHz (Fsys / 16)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: SPI Flash (W25Qxx) Debugger */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-200">SPI Flash 固件芯片调试 (W25Qxx)</h3>
              </div>
              <button
                onClick={handleReadID}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1 transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                读取 JEDEC ID (0x9F)
              </button>
            </div>

            {/* Flash Info Card */}
            {flashInfo && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs mb-4">
                <div>
                  <span className="text-slate-400">制造厂商:</span>
                  <div className="font-semibold text-white mt-0.5">{flashInfo.mfg}</div>
                </div>
                <div>
                  <span className="text-slate-400">芯片型号:</span>
                  <div className="font-semibold text-indigo-300 mt-0.5">{flashInfo.model}</div>
                </div>
                <div>
                  <span className="text-slate-400">存储容量:</span>
                  <div className="font-semibold text-emerald-400 mt-0.5">{flashInfo.capacity}</div>
                </div>
                <div>
                  <span className="text-slate-400">JEDEC 原始特征码:</span>
                  <div className="font-mono text-amber-400 mt-0.5">{flashInfo.rawId}</div>
                </div>
              </div>
            )}

            {/* Flash Operations */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] text-slate-400 mb-1">起始操作地址 (HEX)</label>
                  <input
                    type="text"
                    value={flashAddress}
                    onChange={(e) => setFlashAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-400 focus:outline-none"
                    placeholder="0x000000"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleReadSector}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center gap-1 transition-all"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    读扇区
                  </button>
                  <button
                    onClick={handleEraseSector}
                    className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800/80 rounded text-xs font-medium flex items-center gap-1 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    擦除4KB
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">写入数据 (HEX 格式，页编程 0x02)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={flashWriteHex}
                    onChange={(e) => setFlashWriteHex(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none"
                  />
                  <button
                    onClick={handleWriteFlash}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center gap-1 transition-all"
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                    写入
                  </button>
                </div>
              </div>

              {/* Data Hex Viewer */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div className="text-[11px] text-slate-400 mb-1 flex justify-between">
                  <span>当前扇区数据预览 (32字节)</span>
                  <span className="font-mono text-slate-400">{sectorAscii}</span>
                </div>
                <div className="font-mono text-xs text-amber-400 break-all select-all">
                  {sectorData}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Generic SPI Duplex Transceiver */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
              <span>全双工通用 SPI 收发控制台</span>
              <span className="text-xs text-slate-400 font-mono">{statusMsg}</span>
            </h3>

            {/* Transmit Section */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">MOSI 发送数据 (HEX，以空格分隔)</label>
                <textarea
                  rows={3}
                  value={txHex}
                  onChange={(e) => setTxHex(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-indigo-500"
                  placeholder="9F 00 00 00"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-mono">
                  片选CS: 传输时自动拉低，完成后自动拉高
                </span>
                <button
                  onClick={handleSendRaw}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-900/40"
                >
                  <Send className="w-3.5 h-3.5" />
                  发送并接收全双工响应
                </button>
              </div>

              {/* Receive Output */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">MISO 同步接收返回数据 (HEX)</label>
                <div className="w-full min-h-20 bg-slate-950 border border-slate-800 rounded p-3 text-xs font-mono text-emerald-400 break-all select-all">
                  {rxHex || '等待发送以捕获全双工 MISO 信号...'}
                </div>
              </div>

              {/* Timing Simulation preview */}
              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg">
                <span className="text-[11px] font-semibold text-slate-300 block mb-2">SPI 总线时序逻辑示意</span>
                <div className="space-y-1.5 font-mono text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-slate-400">/CS :</span>
                    <span className="text-amber-400 font-bold">▔▔▔▔\________/▔▔▔▔</span>
                    <span className="text-[9px] text-slate-500">(P1.3)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-slate-400">SCK :</span>
                    <span className="text-indigo-400 font-bold">____/‾\_/‾\_/‾\_/‾\____</span>
                    <span className="text-[9px] text-slate-500">(P1.0)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-slate-400">MOSI:</span>
                    <span className="text-cyan-400 font-bold">____[D7][D6][D5][D0]____</span>
                    <span className="text-[9px] text-slate-500">(P1.1)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-slate-400">MISO:</span>
                    <span className="text-emerald-400 font-bold">____[B7][B6][B5][B0]____</span>
                    <span className="text-[9px] text-slate-500">(P1.2)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

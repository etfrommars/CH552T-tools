import React, { useState } from 'react';
import { 
  Network, 
  Send, 
  Settings2, 
  Check, 
  Clock, 
  Database, 
  HelpCircle,
  Table,
  Cpu,
  ArrowRight
} from 'lucide-react';
import { SerialManager } from '../../services/serialManager';
import { calculateModbusCRC, bytesToHex, hexToBytes, CMD_RS485_MODBUS_MASTER, CMD_RS485_SEND_RAW } from '../../services/ch552Protocol';
import { ModbusRegister } from '../../types';

export const RS485ModbusView: React.FC = () => {
  const serial = SerialManager.getInstance();

  // Comm parameters
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [parity, setParity] = useState<'NONE' | 'EVEN' | 'ODD'>('NONE');
  const [deDelay, setDeDelay] = useState<number>(15); // us flow delay

  // Modbus Master Request
  const [slaveId, setSlaveId] = useState<number>(1);
  const [funcCode, setFuncCode] = useState<number>(3); // 03 Read Holding Registers
  const [startAddr, setStartAddr] = useState<number>(0); // Address 0 (40001)
  const [regCount, setRegCount] = useState<number>(4);
  const [writeVal, setWriteVal] = useState<number>(100);

  // Response & Log State
  const [rawTxFrame, setRawTxFrame] = useState<string>('01 03 00 00 00 04 44 09');
  const [rawRxFrame, setRawRxFrame] = useState<string>('01 03 08 00 FE 02 46 08 9E 00 01 D7 84');
  const [decodedRegisters, setDecodedRegisters] = useState<{ addr: number; dec: number; hex: string }[]>([
    { addr: 40001, dec: 254, hex: '0x00FE' },
    { addr: 40002, dec: 582, hex: '0x0246' },
    { addr: 40003, dec: 2206, hex: '0x089E' },
    { addr: 40004, dec: 1, hex: '0x0001' },
  ]);
  const [statusMsg, setStatusMsg] = useState<string>('就绪：RS485已就绪，自动流控DE/RE引脚绑定 P3.4');

  // Slave Simulator Local Registers
  const [slaveRegs, setSlaveRegs] = useState<ModbusRegister[]>(serial.simulator.modbusRegisters);

  // Execute Modbus Master Request
  const handleSendModbus = async () => {
    try {
      let pdu: number[] = [];
      if (funcCode === 3 || funcCode === 4) {
        // Read Holding/Input Registers: [SlaveID, Func, AddrHi, AddrLo, CntHi, CntLo]
        pdu = [
          slaveId,
          funcCode,
          (startAddr >> 8) & 0xFF,
          startAddr & 0xFF,
          (regCount >> 8) & 0xFF,
          regCount & 0xFF,
        ];
      } else if (funcCode === 6) {
        // Write Single Register: [SlaveID, 06, AddrHi, AddrLo, ValHi, ValLo]
        pdu = [
          slaveId,
          funcCode,
          (startAddr >> 8) & 0xFF,
          startAddr & 0xFF,
          (writeVal >> 8) & 0xFF,
          writeVal & 0xFF,
        ];
      }

      // Calculate CRC16
      const crc = calculateModbusCRC(pdu);
      const fullFrame = new Uint8Array([...pdu, crc & 0xFF, (crc >> 8) & 0xFF]);
      setRawTxFrame(bytesToHex(fullFrame));

      setStatusMsg(`正在通过 RS485 发送 Modbus RTU 帧... (DE高电平启动)`);
      const resp = await serial.sendPacket('RS485', CMD_RS485_MODBUS_MASTER, fullFrame, `Modbus 主机请求 [功能码 0x0${funcCode}]`);

      if (resp[0] === 0x00 && resp.length > 3) {
        const frameData = resp.slice(1);
        setRawRxFrame(bytesToHex(frameData));

        // Parse Response
        const respSlave = frameData[0];
        const respFunc = frameData[1];

        if (respFunc === 3 || respFunc === 4) {
          const byteCount = frameData[2];
          const regs: { addr: number; dec: number; hex: string }[] = [];
          for (let i = 0; i < byteCount; i += 2) {
            const val = (frameData[3 + i] << 8) | frameData[3 + i + 1];
            regs.push({
              addr: 40001 + startAddr + (i / 2),
              dec: val,
              hex: '0x' + val.toString(16).padStart(4, '0').toUpperCase(),
            });
          }
          setDecodedRegisters(regs);
          setStatusMsg(`Modbus 成功接收: 从机 ${respSlave} 返回 ${regs.length} 个寄存器数据`);
        } else if (respFunc === 6) {
          setStatusMsg(`Modbus 写入成功: 寄存器 4000${startAddr + 1} 成功写入 ${writeVal}`);
        }
      } else {
        setStatusMsg('RS485 未收到从机应答 (超时或CRC校验不匹配)');
      }
    } catch (e: any) {
      setStatusMsg(`请求出错: ${e.message}`);
    }
  };

  // Modify local register in slave simulator
  const handleUpdateSlaveReg = (index: number, val: number) => {
    const next = [...slaveRegs];
    next[index].value = val;
    setSlaveRegs(next);
    serial.simulator.modbusRegisters = next;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              USB转RS485 / Modbus RTU 工作台
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                DIP: 011
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              引脚映射: <span className="text-amber-400 font-mono">TXD=P3.1</span> (Pin 12), <span className="text-amber-400 font-mono">RXD=P3.0</span> (Pin 11), <span className="text-amber-400 font-mono">DE/~RE=P3.4</span> (Pin 8 收发流控)
            </p>
          </div>
        </div>

        {/* Baud & Parity controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span>波特率:</span>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(parseInt(e.target.value))}
              className="bg-slate-950 border border-slate-700 text-emerald-400 text-xs rounded px-2 py-1 focus:outline-none font-mono"
            >
              <option value={9600}>9600 bps</option>
              <option value={19200}>19200 bps</option>
              <option value={38400}>38400 bps</option>
              <option value={115200}>115200 bps</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span>校验位:</span>
            <select
              value={parity}
              onChange={(e) => setParity(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 text-emerald-400 text-xs rounded px-2 py-1 focus:outline-none"
            >
              <option value="NONE">None (8N1 无校验)</option>
              <option value="EVEN">Even (8E1 偶校验)</option>
              <option value="ODD">Odd (8O1 奇校验)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span>DE延时:</span>
            <span className="font-mono text-cyan-400">{deDelay} µs</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Modbus RTU Master Console */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
              <span>Modbus RTU 主机请求发起控制台</span>
              <span className="text-xs text-slate-400 font-mono">{statusMsg}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">从机地址 (1-247)</label>
                <input
                  type="number"
                  min={1}
                  max={247}
                  value={slaveId}
                  onChange={(e) => setSlaveId(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">功能码 (Function)</label>
                <select
                  value={funcCode}
                  onChange={(e) => setFuncCode(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-emerald-400 focus:outline-none"
                >
                  <option value={3}>03 读保持寄存器</option>
                  <option value={4}>04 读输入寄存器</option>
                  <option value={6}>06 写单个寄存器</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">起始地址 (Offset)</label>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={startAddr}
                  onChange={(e) => setStartAddr(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                {funcCode === 6 ? (
                  <>
                    <label className="block text-[11px] text-slate-400 mb-1">写入数值</label>
                    <input
                      type="number"
                      value={writeVal}
                      onChange={(e) => setWriteVal(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-amber-400 focus:outline-none"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-[11px] text-slate-400 mb-1">读取数量 (1-32)</label>
                    <input
                      type="number"
                      min={1}
                      max={32}
                      value={regCount}
                      onChange={(e) => setRegCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
                    />
                  </>
                )}
              </div>
            </div>

            <button
              onClick={handleSendModbus}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-sm shadow-emerald-900/40 mb-4"
            >
              <Send className="w-3.5 h-3.5" />
              打包并发送 Modbus RTU 报文 (自动计算CRC-16)
            </button>

            {/* Hex Frames */}
            <div className="space-y-2 mb-4">
              <div className="bg-slate-950 border border-slate-800 rounded p-2 text-xs">
                <div className="text-[10px] text-slate-500 mb-0.5">TX 发送报文 (含CRC16低位在前):</div>
                <div className="font-mono text-cyan-400 break-all">{rawTxFrame}</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded p-2 text-xs">
                <div className="text-[10px] text-slate-500 mb-0.5">RX 接收从机应答报文:</div>
                <div className="font-mono text-emerald-400 break-all">{rawRxFrame}</div>
              </div>
            </div>

            {/* Parsed Registers Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <span className="text-xs font-semibold text-slate-300 block mb-2">解析寄存器数据列表</span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-left">
                      <th className="py-1 px-2">寄存器编号</th>
                      <th className="py-1 px-2">十进制值 (Dec)</th>
                      <th className="py-1 px-2">十六进制 (Hex)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decodedRegisters.map((reg) => (
                      <tr key={reg.addr} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                        <td className="py-1.5 px-2 text-cyan-400 font-bold">{reg.addr}</td>
                        <td className="py-1.5 px-2 text-white font-semibold">{reg.dec}</td>
                        <td className="py-1.5 px-2 text-amber-400">{reg.hex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Modbus RTU Slave Simulator & Register Map */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">Modbus 从机仿真器与寄存器映射表 (Slave ID: 1)</h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                在线应答
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              可在下方直接编辑从机保持寄存器数值，左侧主机发起查询时将实时响应对应数据：
            </p>

            <div className="space-y-2">
              {slaveRegs.map((reg, idx) => (
                <div
                  key={reg.address}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-200 truncate">{reg.name}</div>
                    <div className="text-[11px] text-slate-500">{reg.desc}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={reg.value}
                      onChange={(e) => handleUpdateSlaveReg(idx, parseInt(e.target.value) || 0)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-emerald-400 text-right focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[11px] font-mono text-slate-400 w-12 text-right">
                      {reg.unit || ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

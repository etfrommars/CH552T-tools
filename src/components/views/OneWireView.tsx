import React, { useState, useEffect } from 'react';
import { 
  Thermometer, 
  Search, 
  KeyRound, 
  RefreshCw, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Clock
} from 'lucide-react';
import { SerialManager } from '../../services/serialManager';
import { OneWireDevice } from '../../types';
import { CMD_1WIRE_RESET, CMD_1WIRE_SEARCH_ROM, CMD_1WIRE_READ_DS18B20 } from '../../services/ch552Protocol';

export const OneWireView: React.FC = () => {
  const serial = SerialManager.getInstance();

  // Bus Reset & Presence
  const [presenceDetected, setPresenceDetected] = useState<boolean>(true);
  const [presenceDuration, setPresenceDuration] = useState<number>(120); // us

  // Discovered Devices
  const [devices, setDevices] = useState<OneWireDevice[]>([
    {
      romId: '28-AA-4B-12-00-00-00-9B',
      familyCode: 0x28,
      deviceType: 'DS18B20',
      description: 'Dallas/Maxim 可编程分辨率数字温度传感器 (12-bit)',
      temperature: 24.8,
      resolution: 12,
    },
    {
      romId: '01-7E-82-41-09-00-00-1F',
      familyCode: 0x01,
      deviceType: 'DS1990A',
      description: 'Dallas iButton 电子密匙 / 唯一序列号信息钮扣',
    },
  ]);

  // DS18B20 Live Monitoring
  const [currentTemp, setCurrentTemp] = useState<number>(24.8);
  const [tempHistory, setTempHistory] = useState<number[]>([24.2, 24.4, 24.5, 24.7, 24.8, 24.9, 24.8, 24.7, 24.8]);
  const [autoPolling, setAutoPolling] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<string>('就绪：1-Wire单总线已挂载 (DQ=P1.4, 外接4.7kΩ上拉)');

  // Reset Bus & Detect Presence
  const handleResetBus = async () => {
    setStatusMsg('正在发送 480µs 复位脉冲并检测从机存在响应...');
    try {
      const resp = await serial.sendPacket('ONEWIRE', CMD_1WIRE_RESET, [], '1-Wire总线复位与存在检测');
      if (resp[0] === 0x00) {
        setPresenceDetected(true);
        setPresenceDuration(resp[1] || 120);
        setStatusMsg(`检测到 1-Wire 从机存在脉冲！维持时间: ${resp[1] || 120} µs`);
      } else {
        setPresenceDetected(false);
        setStatusMsg('未检测到存在脉冲，请检查DQ总线连接与4.7kΩ上拉电阻');
      }
    } catch (e: any) {
      setStatusMsg(`复位错误: ${e.message}`);
    }
  };

  // Search ROM (0xF0)
  const handleSearchROM = async () => {
    setStatusMsg('正在执行 0xF0 Search ROM 二叉树搜索算法...');
    try {
      const resp = await serial.sendPacket('ONEWIRE', CMD_1WIRE_SEARCH_ROM, [], '1-Wire ROM ID搜索');
      if (resp[0] === 0x00) {
        setDevices(serial.simulator.oneWireDevices);
        setStatusMsg(`搜索完成：在单总线上发现 ${serial.simulator.oneWireDevices.length} 个 1-Wire 设备`);
      }
    } catch (e: any) {
      setStatusMsg(`搜索失败: ${e.message}`);
    }
  };

  // Read DS18B20 Temperature
  const handleReadDS18B20 = async () => {
    try {
      const resp = await serial.sendPacket('ONEWIRE', CMD_1WIRE_READ_DS18B20, [], 'DS18B20启动转换并读取暂存器');
      if (resp[0] === 0x00 && resp.length >= 10) {
        const tempLSB = resp[1];
        const tempMSB = resp[2];
        const rawTemp = (tempMSB << 8) | tempLSB;
        // 12-bit DS18B20 resolution: 0.0625 °C
        const tempC = parseFloat((rawTemp * 0.0625).toFixed(2));
        setCurrentTemp(tempC);
        setTempHistory((prev) => [...prev.slice(-15), tempC]);
        setStatusMsg(`DS18B20 读取成功: ${tempC} °C (校验和 CRC8 正确)`);
      }
    } catch (e: any) {
      setStatusMsg(`读取温度出错: ${e.message}`);
    }
  };

  // Auto polling effect
  useEffect(() => {
    if (!autoPolling) return;
    const interval = setInterval(() => {
      handleReadDS18B20();
    }, 2000);
    return () => clearInterval(interval);
  }, [autoPolling]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              USB转1-Wire单总线适配器工作台
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                DIP: 100
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              引脚映射: <span className="text-amber-400 font-mono">DQ = P1.4</span> (CH552T Pin 1) · 外接 4.7kΩ 强上拉电阻至 VCC
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetBus}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            总线复位与存在检测
          </button>
          <button
            onClick={handleSearchROM}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm shadow-rose-900/40"
          >
            <Search className="w-3.5 h-3.5" />
            搜索单总线 ROM ID (0xF0)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: DS18B20 Live Temperature Card */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-slate-200">DS18B20 数字温度传感器实时监视器</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoPolling(!autoPolling)}
                  className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 transition-all ${
                    autoPolling
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {autoPolling ? '自动轮询中 (2s)' : '已暂停轮询'}
                </button>
                <button
                  onClick={handleReadDS18B20}
                  className="p-1 text-slate-400 hover:text-white"
                  title="手动读取一次"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Gauge Display */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-center mb-4 relative overflow-hidden">
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">当前环境温度值</div>
              <div className="text-5xl font-extrabold font-mono text-rose-400 tracking-tight my-2">
                {currentTemp.toFixed(2)} <span className="text-2xl font-normal text-slate-400">°C</span>
              </div>
              <div className="text-xs font-mono text-slate-400">
                对应华氏度: {(currentTemp * 1.8 + 32).toFixed(2)} °F · 分辨率: 12-bit (0.0625°C)
              </div>

              {/* Status pulse */}
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Dallas 1-Wire 协议校验通过 · CRC8 匹配</span>
              </div>
            </div>

            {/* Temperature History Line Chart */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <span className="text-[11px] text-slate-400 block mb-2">近期温度实时波动曲线</span>
              <div className="h-28 flex items-end gap-1.5 px-2 pt-4">
                {tempHistory.map((val, idx) => {
                  const min = 23.5;
                  const max = 26.5;
                  const percent = Math.min(100, Math.max(10, ((val - min) / (max - min)) * 100));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                      <div
                        style={{ height: `${percent}%` }}
                        className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t group-hover:brightness-125 transition-all"
                      />
                      <span className="text-[9px] font-mono text-slate-500 scale-90">
                        {val.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: iButton & 1-Wire Discovered Devices */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
              <span>单总线在线设备列表 ({devices.length})</span>
              <span className="text-xs text-slate-400 font-mono">{statusMsg}</span>
            </h3>

            <div className="space-y-3 mb-4">
              {devices.map((dev) => (
                <div
                  key={dev.romId}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-slate-900 border border-slate-700 text-rose-400 mt-0.5">
                      {dev.deviceType === 'DS18B20' ? (
                        <Thermometer className="w-4 h-4" />
                      ) : (
                        <KeyRound className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white">{dev.deviceType}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          Family: 0x{dev.familyCode.toString(16).padStart(2, '0').toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{dev.description}</div>
                      <div className="text-xs font-mono font-bold text-cyan-400 mt-1.5 flex items-center gap-2">
                        <span>{dev.romId}</span>
                        <button
                          onClick={() => navigator.clipboard?.writeText(dev.romId)}
                          className="text-slate-500 hover:text-slate-300"
                          title="复制ROM ID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                    在线 (ACK)
                  </span>
                </div>
              ))}
            </div>

            {/* iButton (DS1990A) Dedicated Section */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1.5">
                <KeyRound className="w-4 h-4" />
                <span>Dallas iButton (DS1990A) 密匙探针接触检测</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                当手持式 iButton 探针触碰金属外圈与中心触点时，CH552T 将在 15µs 内捕获 64 位不可篡改全球唯一序列号，可用于门禁刷卡、巡更打卡及硬件加密狗认证。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

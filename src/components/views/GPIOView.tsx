import React, { useState, useEffect, useRef } from 'react';
import { 
  Sliders, 
  ToggleLeft, 
  ToggleRight, 
  Activity, 
  Play, 
  Square, 
  Zap, 
  RefreshCw,
  Cpu
} from 'lucide-react';
import { SerialManager } from '../../services/serialManager';
import { GpioPinMode, GpioPinState } from '../../types';
import { CMD_GPIO_SET_MODE, CMD_GPIO_WRITE, CMD_GPIO_READ } from '../../services/ch552Protocol';

export const GPIOView: React.FC = () => {
  const serial = SerialManager.getInstance();

  const [pins, setPins] = useState<GpioPinState[]>(serial.simulator.gpioPins);
  const [pulseFreq, setPulseFreq] = useState<number>(1000); // 1kHz
  const [selectedPulsePin, setSelectedPulsePin] = useState<number>(0); // P1.0
  const [isPulsing, setIsPulsing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('就绪：8路独立GPIO通用输入/输出端口 (P1.0 - P1.7)');

  // Logic Analyzer canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineHistory = useRef<number[][]>([]); // Array of [p0..p7] states

  // Toggle Output Level
  const handleToggleLevel = async (pinIndex: number) => {
    const current = pins[pinIndex];
    const newLevel = current.level === 1 ? 0 : 1;

    try {
      await serial.sendPacket('GPIO', CMD_GPIO_WRITE, [pinIndex, newLevel], `写入 GPIO ${current.name} = ${newLevel}`);
      const next = [...pins];
      next[pinIndex].level = newLevel as any;
      setPins(next);
      serial.simulator.gpioPins = next;
      setStatusMsg(`已更新 ${current.name} 输出电平为: ${newLevel ? '高电平 (3.3V)' : '低电平 (0V)'}`);
    } catch (e: any) {
      setStatusMsg(`写入电平失败: ${e.message}`);
    }
  };

  // Change Pin Mode
  const handleChangeMode = async (pinIndex: number, mode: GpioPinMode) => {
    const modeCodeMap: Record<GpioPinMode, number> = {
      QUASI_BIDIR: 0,
      PUSH_PULL: 1,
      OPEN_DRAIN: 2,
      INPUT_HIZ: 3,
    };

    try {
      await serial.sendPacket('GPIO', CMD_GPIO_SET_MODE, [pinIndex, modeCodeMap[mode]], `设置 GPIO 模式`);
      const next = [...pins];
      next[pinIndex].mode = mode;
      setPins(next);
      serial.simulator.gpioPins = next;
      setStatusMsg(`已配置 ${pins[pinIndex].name} 模式为: ${mode}`);
    } catch (e: any) {
      setStatusMsg(`配置模式失败: ${e.message}`);
    }
  };

  // Pulse generator simulation loop
  useEffect(() => {
    let timer: any;
    if (isPulsing) {
      timer = setInterval(() => {
        setPins((prev) => {
          const next = [...prev];
          next[selectedPulsePin].level = next[selectedPulsePin].level === 1 ? 0 : 1;
          serial.simulator.gpioPins = next;
          return next;
        });
      }, Math.max(10, Math.floor(1000 / (pulseFreq || 10))));
    }
    return () => clearInterval(timer);
  }, [isPulsing, pulseFreq, selectedPulsePin]);

  // Logic Analyzer Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const render = () => {
      // Record current snapshot
      const currentLevels = pins.map((p) => p.level);
      timelineHistory.current.push(currentLevels);
      if (timelineHistory.current.length > 120) {
        timelineHistory.current.shift();
      }

      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const channelHeight = canvas.height / 8;
      const history = timelineHistory.current;

      // Draw Grid & Channel Waves
      pins.forEach((pin, chIdx) => {
        const yBase = chIdx * channelHeight + channelHeight - 4;
        const yHigh = chIdx * channelHeight + 6;

        // Label
        ctx.fillStyle = '#64748b';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(pin.name, 6, yBase - 4);

        // Divider
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, (chIdx + 1) * channelHeight);
        ctx.lineTo(canvas.width, (chIdx + 1) * channelHeight);
        ctx.stroke();

        // Waveform
        ctx.strokeStyle = pin.level === 1 ? '#06b6d4' : '#64748b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const stepX = (canvas.width - 50) / 120;
        const startX = 45;

        for (let i = 0; i < history.length; i++) {
          const level = history[i][chIdx];
          const x = startX + i * stepX;
          const y = level === 1 ? yHigh : yBase;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const prevLevel = history[i - 1][chIdx];
            const prevY = prevLevel === 1 ? yHigh : yBase;
            if (prevLevel !== level) {
              ctx.lineTo(x, prevY); // Vertical step edge
            }
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [pins]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              USB转多路GPIO控制适配器工作台
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                DIP: 101
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              引脚映射: <span className="text-amber-400 font-mono">P1.0 - P1.7</span> (8路物理引脚) · 支持准双向/推挽/开漏/高阻配置
            </p>
          </div>
        </div>

        {/* Status Msg */}
        <span className="text-xs font-mono text-cyan-400">{statusMsg}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 8-Pin Controls Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
              <span>8通道 GPIO 状态监控与控制矩阵</span>
              <span className="text-[11px] font-mono text-slate-400">CH552T Port 1 (P1DIR / P1_PU)</span>
            </h3>

            <div className="space-y-2.5">
              {pins.map((pin) => (
                <div
                  key={pin.name}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs"
                >
                  {/* Pin Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        pin.level === 1
                          ? 'bg-cyan-400 shadow-md shadow-cyan-500/50'
                          : 'bg-slate-700'
                      }`}
                    />
                    <div className="font-mono font-bold text-white w-10">{pin.name}</div>
                  </div>

                  {/* Mode Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 hidden sm:inline">工作模式:</span>
                    <select
                      value={pin.mode}
                      onChange={(e) => handleChangeMode(pin.index, e.target.value as GpioPinMode)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="PUSH_PULL">推挽输出 (Push-Pull)</option>
                      <option value="QUASI_BIDIR">准双向模式 (Quasi-Bidir)</option>
                      <option value="OPEN_DRAIN">开漏模式 (Open-Drain)</option>
                      <option value="INPUT_HIZ">高阻输入 (Hi-Z Input)</option>
                    </select>
                  </div>

                  {/* Level Switch Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleLevel(pin.index)}
                      className={`px-3 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                        pin.level === 1
                          ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                      }`}
                    >
                      {pin.level === 1 ? 'HIGH (1)' : 'LOW (0)'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pulse Generator Sub-tool */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-200">方波脉冲发生器 (Pulse Generator)</h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">目标输出引脚</label>
                <select
                  value={selectedPulsePin}
                  onChange={(e) => setSelectedPulsePin(parseInt(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-400"
                >
                  {pins.map((p) => (
                    <option key={p.name} value={p.index}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">脉冲翻转频率 (Hz)</label>
                <input
                  type="number"
                  min={1}
                  max={50000}
                  value={pulseFreq}
                  onChange={(e) => setPulseFreq(parseInt(e.target.value) || 100)}
                  className="w-28 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-amber-400"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setIsPulsing(!isPulsing)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isPulsing
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {isPulsing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isPulsing ? '停止脉冲' : '启动方波输出'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Digital Logic Analyzer Visual Canvas */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-200">8通道逻辑分析仪实时波形</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Live Timeline</span>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 p-1">
              <canvas
                ref={canvasRef}
                width={400}
                height={300}
                className="w-full h-auto block"
              />
            </div>

            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              实时捕捉并渲染 8 个 GPIO 引脚的电平跳变波形。当在左侧切换电平或开启方波脉冲时，右侧示波器逻辑窗口将同步记录并呈现数字时序脉冲。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Sliders, 
  Gauge, 
  Play, 
  Pause, 
  Download, 
  RefreshCw,
  Zap
} from 'lucide-react';
import { SerialManager } from '../../services/serialManager';
import { AdcChannelState, PwmChannelState } from '../../types';
import { CMD_PWM_SET, CMD_ADC_READ } from '../../services/ch552Protocol';

export const PwmAdcView: React.FC = () => {
  const serial = SerialManager.getInstance();

  // PWM State
  const [pwm1, setPwm1] = useState<PwmChannelState>({
    channel: 1,
    pin: 'P1.0 (Pin 13)',
    enabled: true,
    frequency: 1000,
    dutyPercent: 50,
  });

  const [pwm2, setPwm2] = useState<PwmChannelState>({
    channel: 2,
    pin: 'P3.4 (Pin 8)',
    enabled: true,
    frequency: 5000,
    dutyPercent: 25,
  });

  // ADC State (4 Channels: AIN0 - AIN3)
  const [adcChannels, setAdcChannels] = useState<AdcChannelState[]>([
    { channel: 0, pin: 'P1.4 (Pin 1)', name: 'AIN0: 动态交流正弦信号', raw: 128, voltage: 1.65, minVoltage: 0.52, maxVoltage: 2.78 },
    { channel: 1, pin: 'P1.5 (Pin 2)', name: 'AIN1: 三角锯齿波扫描', raw: 95, voltage: 1.23, minVoltage: 0.21, maxVoltage: 3.05 },
    { channel: 2, pin: 'P1.6 (Pin 3)', name: 'AIN2: 电位器模拟分压', raw: 140, voltage: 1.81, minVoltage: 1.25, maxVoltage: 2.05 },
    { channel: 3, pin: 'P1.7 (Pin 4)', name: 'AIN3: 3.3V供电基准轨', raw: 254, voltage: 3.28, minVoltage: 3.26, maxVoltage: 3.30 },
  ]);

  const [isSampling, setIsSampling] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<string>('就绪：PWM双路硬件波形发生器与4通道ADC高速采样');

  // Oscilloscope Canvas Ref & data buffer
  const oscCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const adcHistory = useRef<{ ch0: number; ch1: number; ch2: number; ch3: number }[]>([]);

  // Update PWM Settings
  const handleUpdatePwm = async (ch: 1 | 2, freq: number, duty: number) => {
    try {
      const payload = [ch, (freq >> 8) & 0xFF, freq & 0xFF, duty];
      await serial.sendPacket('ADC_PWM', CMD_PWM_SET, payload, `配置 PWM 通道 ${ch}: ${freq}Hz, ${duty}%`);
      if (ch === 1) {
        setPwm1((p) => ({ ...p, frequency: freq, dutyPercent: duty }));
      } else {
        setPwm2((p) => ({ ...p, frequency: freq, dutyPercent: duty }));
      }
      setStatusMsg(`已更新 PWM${ch} 参数: 频率=${freq}Hz, 占空比=${duty}%`);
    } catch (e: any) {
      setStatusMsg(`PWM设置失败: ${e.message}`);
    }
  };

  // Poll ADC Samples
  useEffect(() => {
    if (!isSampling) return;
    const interval = setInterval(async () => {
      try {
        const resp = await serial.sendPacket('ADC_PWM', CMD_ADC_READ, [], 'ADC 采样');
        if (resp[0] === 0x00 && resp.length >= 5) {
          const raw0 = resp[1];
          const raw1 = resp[2];
          const raw2 = resp[3];
          const raw3 = resp[4];

          const v0 = parseFloat(((raw0 / 255) * 3.3).toFixed(2));
          const v1 = parseFloat(((raw1 / 255) * 3.3).toFixed(2));
          const v2 = parseFloat(((raw2 / 255) * 3.3).toFixed(2));
          const v3 = parseFloat(((raw3 / 255) * 3.3).toFixed(2));

          adcHistory.current.push({ ch0: v0, ch1: v1, ch2: v2, ch3: v3 });
          if (adcHistory.current.length > 100) {
            adcHistory.current.shift();
          }

          setAdcChannels((prev) => [
            { ...prev[0], raw: raw0, voltage: v0, minVoltage: Math.min(prev[0].minVoltage, v0), maxVoltage: Math.max(prev[0].maxVoltage, v0) },
            { ...prev[1], raw: raw1, voltage: v1, minVoltage: Math.min(prev[1].minVoltage, v1), maxVoltage: Math.max(prev[1].maxVoltage, v1) },
            { ...prev[2], raw: raw2, voltage: v2, minVoltage: Math.min(prev[2].minVoltage, v2), maxVoltage: Math.max(prev[2].maxVoltage, v2) },
            { ...prev[3], raw: raw3, voltage: v3, minVoltage: Math.min(prev[3].minVoltage, v3), maxVoltage: Math.max(prev[3].maxVoltage, v3) },
          ]);
        }
      } catch (e) {
        console.warn(e);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isSampling]);

  // Render Oscilloscope
  useEffect(() => {
    const canvas = oscCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const colors = ['#06b6d4', '#ec4899', '#eab308', '#22c55e'];

    const render = () => {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid Lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;

      // 4 horizontal voltage grid lines (0V, 1V, 2V, 3V)
      for (let v = 0; v <= 3.3; v += 1.0) {
        const y = canvas.height - (v / 3.3) * (canvas.height - 20) - 10;
        ctx.beginPath();
        ctx.moveTo(35, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText(`${v.toFixed(1)}V`, 5, y + 3);
      }

      // Draw Waveforms
      const data = adcHistory.current;
      if (data.length > 1) {
        const stepX = (canvas.width - 45) / 100;
        const startX = 40;

        (['ch0', 'ch1', 'ch2', 'ch3'] as const).forEach((chKey, idx) => {
          ctx.strokeStyle = colors[idx];
          ctx.lineWidth = 1.8;
          ctx.beginPath();

          for (let i = 0; i < data.length; i++) {
            const v = data[i][chKey];
            const x = startX + i * stepX;
            const y = canvas.height - (v / 3.3) * (canvas.height - 20) - 10;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        });
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'TimeIndex,AIN0_V,AIN1_V,AIN2_V,AIN3_V\n';
    adcHistory.current.forEach((row, i) => {
      csv += `${i},${row.ch0},${row.ch1},${row.ch2},${row.ch3}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ch552t_adc_samples_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              USB转PWM与ADC适配器工作台
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                DIP: 110
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              引脚映射: <span className="text-amber-400 font-mono">PWM1=P1.0</span>, <span className="text-amber-400 font-mono">PWM2=P3.4</span>, <span className="text-amber-400 font-mono">AIN0-AIN3=P1.4-P1.7</span> (8位SAR ADC)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-cyan-400">{statusMsg}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dual PWM Generators */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-200">双路硬件 PWM 波形发生器</h3>
            </div>

            {/* PWM Channel 1 */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">通道 1 (PWM1 / P1.0)</span>
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800">
                  Timer2 硬件输出
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>频率: {pwm1.frequency} Hz</span>
                  <span>占空比: {pwm1.dutyPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pwm1.dutyPercent}
                  onChange={(e) => handleUpdatePwm(1, pwm1.frequency, parseInt(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Wave Preview Box */}
              <div className="h-9 bg-slate-900 rounded border border-slate-800 flex items-center px-2">
                <div className="w-full h-4 flex">
                  <div style={{ width: `${pwm1.dutyPercent}%` }} className="bg-cyan-500 h-full rounded-l-xs" />
                  <div style={{ width: `${100 - pwm1.dutyPercent}%` }} className="bg-slate-800 h-full rounded-r-xs" />
                </div>
              </div>
            </div>

            {/* PWM Channel 2 */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">通道 2 (PWM2 / P3.4)</span>
                <span className="text-[10px] font-mono bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800">
                  Timer1 硬件输出
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>频率: {pwm2.frequency} Hz</span>
                  <span>占空比: {pwm2.dutyPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pwm2.dutyPercent}
                  onChange={(e) => handleUpdatePwm(2, pwm2.frequency, parseInt(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              {/* Wave Preview Box */}
              <div className="h-9 bg-slate-900 rounded border border-slate-800 flex items-center px-2">
                <div className="w-full h-4 flex">
                  <div style={{ width: `${pwm2.dutyPercent}%` }} className="bg-amber-500 h-full rounded-l-xs" />
                  <div style={{ width: `${100 - pwm2.dutyPercent}%` }} className="bg-slate-800 h-full rounded-r-xs" />
                </div>
              </div>
            </div>
          </div>

          {/* ADC Stats Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-300 mb-2.5">4通道当前采样瞬时读数</h4>
            <div className="grid grid-cols-2 gap-2.5">
              {adcChannels.map((ch, idx) => {
                const colors = ['text-cyan-400', 'text-pink-400', 'text-amber-400', 'text-emerald-400'];
                return (
                  <div key={ch.channel} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400 truncate">{ch.pin}</div>
                    <div className={`text-lg font-bold font-mono ${colors[idx]} mt-0.5`}>
                      {ch.voltage.toFixed(2)} V
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                      RAW: {ch.raw} (8-Bit)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: 4-Channel Dynamic Oscilloscope */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-200">4通道实时示波器监视器 (0.00V ~ 3.30V)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSampling(!isSampling)}
                  className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
                    isSampling
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}
                >
                  {isSampling ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {isSampling ? '暂停采样' : '继续采样'}
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center gap-1 transition-all"
                  title="导出采样数据为CSV"
                >
                  <Download className="w-3 h-3" />
                  导出CSV
                </button>
              </div>
            </div>

            {/* Canvas Oscilloscope */}
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 p-1 mb-3">
              <canvas
                ref={oscCanvasRef}
                width={500}
                height={260}
                className="w-full h-auto block"
              />
            </div>

            {/* Legends */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                <span>AIN0 (P1.4): 正弦波</span>
              </div>
              <div className="flex items-center gap-1.5 text-pink-400">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-400"></span>
                <span>AIN1 (P1.5): 锯齿波</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span>AIN2 (P1.6): 电位器</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span>AIN3 (P1.7): 3.3V直流</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

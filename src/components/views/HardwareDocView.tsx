import React, { useState } from 'react';
import { 
  CircuitBoard, 
  Cpu, 
  Layers, 
  Check, 
  Download, 
  Info, 
  Layers2, 
  Sliders, 
  Table 
} from 'lucide-react';
import { CH552T_PINS, BOM_LIST, MODES_LIST } from '../../data/hardwareData';
import { AdapterMode } from '../../types';

export const HardwareDocView: React.FC = () => {
  const [selectedHighlightMode, setSelectedHighlightMode] = useState<AdapterMode>('I2C');

  // Check if a pin is active in current selected highlight mode
  const isPinActiveInMode = (pinNum: number) => {
    const pin = CH552T_PINS.find((p) => p.pinNumber === pinNum);
    if (!pin) return false;
    return !!pin.modeFunctions[selectedHighlightMode];
  };

  const getActivePinFunction = (pinNum: number) => {
    const pin = CH552T_PINS.find((p) => p.pinNumber === pinNum);
    if (!pin) return '';
    return pin.modeFunctions[selectedHighlightMode] || '';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <CircuitBoard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              CH552T 硬件IO分配、原理图与电路规格
            </h2>
            <p className="text-xs text-slate-400">
              采用 TSSOP-20 封装 · 兼容 3.3V / 5V 宽工作电压 · 硬件免定制即可软件/拨码开关全模式复用
            </p>
          </div>
        </div>

        {/* Mode Selector for Pinout Highlighting */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-400">引脚高亮模式:</span>
          <select
            value={selectedHighlightMode}
            onChange={(e) => setSelectedHighlightMode(e.target.value as AdapterMode)}
            className="bg-transparent text-xs font-semibold text-amber-400 focus:outline-none"
          >
            {MODES_LIST.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                {m.name} ({m.dipCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Interactive Chip Graphic & Pinout Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* TSSOP-20 Visual Package View */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-200">CH552T TSSOP-20 封装引脚动态映射图</h3>
            </div>
            <span className="text-xs font-mono text-cyan-400">24MHz E8051</span>
          </div>

          <div className="flex justify-center my-6">
            <div className="flex items-stretch gap-2 font-mono text-xs">
              {/* Left Pins (1 to 10) */}
              <div className="flex flex-col justify-between space-y-1.5 text-right">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((pinNum) => {
                  const active = isPinActiveInMode(pinNum);
                  const pin = CH552T_PINS.find((p) => p.pinNumber === pinNum);
                  return (
                    <div key={pinNum} className="flex items-center justify-end gap-1.5 h-6">
                      <span className={`text-[11px] font-medium truncate max-w-[120px] ${active ? 'text-cyan-300 font-bold' : 'text-slate-400'}`}>
                        {pin?.pinName} {active ? `(${getActivePinFunction(pinNum)})` : ''}
                      </span>
                      <div className={`w-3.5 h-2 rounded-l-xs border-y border-l ${active ? 'bg-cyan-400 border-cyan-300' : 'bg-slate-700 border-slate-600'}`} />
                      <span className="text-[10px] text-slate-500 w-4 text-center">{pinNum}</span>
                    </div>
                  );
                })}
              </div>

              {/* IC Body */}
              <div className="w-32 bg-slate-950 border-2 border-slate-700 rounded-lg p-3 flex flex-col items-center justify-between shadow-2xl relative">
                {/* Notch */}
                <div className="w-4 h-2 bg-slate-800 rounded-b-full border-b border-x border-slate-600 absolute top-0" />
                <div className="mt-4 text-center">
                  <div className="text-xs font-bold text-slate-200 tracking-wider">WCH</div>
                  <div className="text-sm font-black text-amber-400 tracking-widest mt-0.5">CH552T</div>
                  <div className="text-[9px] text-slate-500 mt-1">TSSOP-20</div>
                </div>
                <div className="text-[9px] font-mono text-slate-600 mb-2">2408-CHN</div>
              </div>

              {/* Right Pins (20 down to 11) */}
              <div className="flex flex-col justify-between space-y-1.5 text-left">
                {[20, 19, 18, 17, 16, 15, 14, 13, 12, 11].map((pinNum) => {
                  const active = isPinActiveInMode(pinNum);
                  const pin = CH552T_PINS.find((p) => p.pinNumber === pinNum);
                  return (
                    <div key={pinNum} className="flex items-center justify-start gap-1.5 h-6">
                      <span className="text-[10px] text-slate-500 w-4 text-center">{pinNum}</span>
                      <div className={`w-3.5 h-2 rounded-r-xs border-y border-r ${active ? 'bg-cyan-400 border-cyan-300' : 'bg-slate-700 border-slate-600'}`} />
                      <span className={`text-[11px] font-medium truncate max-w-[120px] ${active ? 'text-cyan-300 font-bold' : 'text-slate-400'}`}>
                        {pin?.pinName} {active ? `(${getActivePinFunction(pinNum)})` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300">
            <span className="text-amber-400 font-bold block mb-1">当前高亮模式：{selectedHighlightMode}</span>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
              {CH552T_PINS.filter((p) => p.modeFunctions[selectedHighlightMode]).map((p) => (
                <li key={p.pinNumber}>
                  <strong className="text-slate-200">Pin {p.pinNumber} ({p.pinName}):</strong>{' '}
                  <span className="text-cyan-400 font-mono">{p.modeFunctions[selectedHighlightMode]}</span> — {p.description}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Hardware Schematic SVG Viewer */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CircuitBoard className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-200">系统原理图核心架构 (Schematic Circuit)</h3>
            </div>
            <span className="text-xs text-emerald-400 font-mono">USB-C + LDO + SP3485</span>
          </div>

          {/* Clean High-Resolution SVG Schematic Diagram */}
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 p-2">
            <svg viewBox="0 0 540 340" className="w-full h-auto text-slate-200 select-none">
              {/* Grid background */}
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="540" height="340" fill="#020617" />
              <rect width="540" height="340" fill="url(#grid)" />

              {/* USB Type-C Block */}
              <rect x="20" y="30" width="100" height="90" rx="4" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1.5" />
              <text x="70" y="50" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">Type-C USB</text>
              <text x="30" y="70" fill="#94a3b8" fontSize="8">VBUS (5V)</text>
              <text x="30" y="85" fill="#94a3b8" fontSize="8">D- (UD-)</text>
              <text x="30" y="100" fill="#94a3b8" fontSize="8">D+ (UD+)</text>
              <text x="30" y="115" fill="#94a3b8" fontSize="8">CC1/2 (5.1k)</text>

              {/* LDO 3.3V Block */}
              <rect x="150" y="30" width="80" height="50" rx="4" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
              <text x="190" y="48" fill="#34d399" fontSize="9" fontWeight="bold" textAnchor="middle">ME6211C33</text>
              <text x="190" y="62" fill="#64748b" fontSize="8" textAnchor="middle">5V -&gt; 3.3V LDO</text>

              {/* CH552T MCU Core Block */}
              <rect x="170" y="110" width="180" height="150" rx="6" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
              <text x="260" y="130" fill="#fbbf24" fontSize="12" fontWeight="bold" textAnchor="middle">U1: CH552T (8051)</text>
              <text x="260" y="145" fill="#94a3b8" fontSize="8" textAnchor="middle">Internal 24MHz USB Device</text>

              {/* MCU Ports inside */}
              <text x="180" y="170" fill="#cbd5e1" fontSize="9">P1.0: SCL / SCK / PWM1</text>
              <text x="180" y="185" fill="#cbd5e1" fontSize="9">P1.1: SDA / MOSI / IO1</text>
              <text x="180" y="200" fill="#cbd5e1" fontSize="9">P1.2: MISO / IO2</text>
              <text x="180" y="215" fill="#cbd5e1" fontSize="9">P1.3: CS / NSS / IO3</text>
              <text x="180" y="230" fill="#cbd5e1" fontSize="9">P1.4: DQ / AIN0 / IO4</text>
              <text x="180" y="245" fill="#cbd5e1" fontSize="9">P3.0/P3.1: 485 RXD/TXD</text>

              {/* SP3485 RS485 Transceiver Block */}
              <rect x="390" y="40" width="120" height="75" rx="4" fill="#0f172a" stroke="#a855f7" strokeWidth="1.5" />
              <text x="450" y="60" fill="#c084fc" fontSize="10" fontWeight="bold" textAnchor="middle">U2: SP3485 (485)</text>
              <text x="400" y="80" fill="#94a3b8" fontSize="8">RO &lt;- P3.0 (RXD)</text>
              <text x="400" y="93" fill="#94a3b8" fontSize="8">DI -&gt; P3.1 (TXD)</text>
              <text x="400" y="106" fill="#94a3b8" fontSize="8">DE/RE &lt;- P3.4</text>

              {/* DIP-3P Switch Block */}
              <rect x="30" y="190" width="90" height="70" rx="4" fill="#0f172a" stroke="#ef4444" strokeWidth="1.5" />
              <text x="75" y="210" fill="#f87171" fontSize="10" fontWeight="bold" textAnchor="middle">SW1: DIP-3P</text>
              <text x="40" y="228" fill="#94a3b8" fontSize="8">SW1 -&gt; P3.2</text>
              <text x="40" y="242" fill="#94a3b8" fontSize="8">SW2 -&gt; P3.3</text>
              <text x="40" y="256" fill="#94a3b8" fontSize="8">SW3 -&gt; P3.5</text>

              {/* Output Multi-pin Header J1 */}
              <rect x="390" y="150" width="125" height="110" rx="4" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
              <text x="452" y="170" fill="#22d3ee" fontSize="10" fontWeight="bold" textAnchor="middle">J1: 10P 总线排针</text>
              <text x="400" y="190" fill="#cbd5e1" fontSize="8">1: 3.3V / 5V</text>
              <text x="400" y="205" fill="#cbd5e1" fontSize="8">2: GND</text>
              <text x="400" y="220" fill="#cbd5e1" fontSize="8">3: SCL / SCK (P1.0)</text>
              <text x="400" y="235" fill="#cbd5e1" fontSize="8">4: SDA / MOSI (P1.1)</text>
              <text x="400" y="250" fill="#cbd5e1" fontSize="8">5: MISO (P1.2)</text>
              <text x="465" y="190" fill="#cbd5e1" fontSize="8">6: CS (P1.3)</text>
              <text x="465" y="205" fill="#cbd5e1" fontSize="8">7: DQ / AIN0</text>
              <text x="465" y="220" fill="#cbd5e1" fontSize="8">8: AIN1 (P1.5)</text>
              <text x="465" y="235" fill="#cbd5e1" fontSize="8">9: AIN2 (P1.6)</text>
              <text x="465" y="250" fill="#cbd5e1" fontSize="8">10: AIN3 (P1.7)</text>

              {/* Connecting signal lines */}
              <path d="M 120 75 L 170 75 L 170 120" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" />
              <path d="M 350 170 L 390 170" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
              <path d="M 350 215 L 390 90" fill="none" stroke="#c084fc" strokeWidth="1" />
              <path d="M 120 225 L 170 225" fill="none" stroke="#f87171" strokeWidth="1" />

              <text x="270" y="315" fill="#64748b" fontSize="9" textAnchor="middle">
                CH552T USB-CDC 多功能总线转换适配器硬件电气原理架构图
              </text>
            </svg>
          </div>
        </div>
      </div>

      {/* Bill of Materials (BOM) Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">元器件清单与选型推荐 (Bill of Materials)</h3>
          </div>
          <span className="text-xs text-slate-400">总计元件种类: {BOM_LIST.length} 项</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2 px-3">序号</th>
                <th className="py-2 px-3">位号 (RefDes)</th>
                <th className="py-2 px-3">型号 / 规格</th>
                <th className="py-2 px-3">封装 (Package)</th>
                <th className="py-2 px-3">数量</th>
                <th className="py-2 px-3">功能与选用说明</th>
              </tr>
            </thead>
            <tbody>
              {BOM_LIST.map((item) => (
                <tr key={item.item} className="border-b border-slate-800/40 hover:bg-slate-800/20 font-mono">
                  <td className="py-2 px-3 text-slate-500">{item.item}</td>
                  <td className="py-2 px-3 text-cyan-400 font-bold">{item.designator}</td>
                  <td className="py-2 px-3 text-white">{item.name}</td>
                  <td className="py-2 px-3 text-amber-400">{item.package}</td>
                  <td className="py-2 px-3 text-slate-300 font-bold">{item.qty}</td>
                  <td className="py-2 px-3 text-slate-400 font-sans">{item.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hardware Design & Layout Tips */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400" />
          硬件设计要点与 PCB 布线注意事项
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <h4 className="font-semibold text-slate-200 mb-1 text-cyan-400">1. USB 差分对阻抗控制</h4>
            <p className="leading-relaxed">
              CH552T 的 UD+ (Pin 20) 与 UD- (Pin 19) 内部集成 1.5kΩ 上拉和终端匹配，外部无需串接电阻，但走线需保持 90Ω 差分阻抗，走线尽量等长且远离高频时钟干扰源。
            </p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <h4 className="font-semibold text-slate-200 mb-1 text-emerald-400">2. V33 片内稳压退耦</h4>
            <p className="leading-relaxed">
              Pin 17 (V33) 为内部 3.3V LDO 输出，作为片内 USB 物理层供电。<strong>必须外接 0.1µF 陶瓷退耦电容</strong>且紧靠芯片引脚就近接地，否则 USB 无法稳定枚举。
            </p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <h4 className="font-semibold text-slate-200 mb-1 text-purple-400">3. RS485 差分隔离与保护</h4>
            <p className="leading-relaxed">
              RS485 A/B 差分总线需预留 120Ω 终端跳线电阻，并在 A/B 线对地加入 TVS 瞬态二极管 (如 SMAJ5.0CA) 和自恢复保险丝，以防工控环境浪涌打坏收发芯片。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

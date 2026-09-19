import React from 'react';

interface DipSwitchControlProps {
  value: number; // 0 to 7
  onChange: (val: number) => void;
  disabled?: boolean;
}

export const DipSwitchControl: React.FC<DipSwitchControlProps> = ({ value, onChange, disabled }) => {
  // Bits: bit0 (P3.2), bit1 (P3.3), bit2 (P3.5)
  const isBit0On = (value & 1) !== 0;
  const isBit1On = (value & 2) !== 0;
  const isBit2On = (value & 4) !== 0;

  const toggleBit = (bitIndex: number) => {
    if (disabled) return;
    const newVal = value ^ (1 << bitIndex);
    onChange(newVal);
  };

  const getModeLabel = (v: number) => {
    switch (v) {
      case 0: return '000: 上位机软控 (Auto)';
      case 1: return '001: I2C适配器';
      case 2: return '010: SPI适配器';
      case 3: return '011: RS485/Modbus';
      case 4: return '100: 1-Wire单总线';
      case 5: return '101: 多路GPIO';
      case 6: return '110: PWM与ADC';
      default: return '111: 保留/自检';
    }
  };

  return (
    <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span className="text-xs font-semibold tracking-wider text-slate-300">板载拨码开关 (DIP-3P)</span>
        </div>
        <span className="text-[11px] font-mono text-cyan-400 mt-0.5">{getModeLabel(value)}</span>
      </div>

      {/* Realistic 3-switch DIP package */}
      <div className="flex bg-red-800 border-2 border-red-950 rounded p-1 shadow-inner gap-1.5 items-center">
        {/* Bit 2 (SW3 / P3.5) */}
        <div 
          onClick={() => toggleBit(2)} 
          className={`flex flex-col items-center cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          title="SW3 (P3.5) - Bit 2"
        >
          <span className="text-[9px] font-bold text-white leading-none mb-0.5">3</span>
          <div className="w-4 h-9 bg-slate-950 rounded-sm p-0.5 flex flex-col justify-between shadow-inner">
            <div className={`w-3 h-4 rounded-xs transition-transform duration-150 ${isBit2On ? 'bg-white shadow translate-y-4' : 'bg-slate-300 translate-y-0'}`} />
          </div>
          <span className="text-[8px] font-mono text-red-200 mt-0.5">{isBit2On ? 'ON' : 'OFF'}</span>
        </div>

        {/* Bit 1 (SW2 / P3.3) */}
        <div 
          onClick={() => toggleBit(1)} 
          className={`flex flex-col items-center cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          title="SW2 (P3.3) - Bit 1"
        >
          <span className="text-[9px] font-bold text-white leading-none mb-0.5">2</span>
          <div className="w-4 h-9 bg-slate-950 rounded-sm p-0.5 flex flex-col justify-between shadow-inner">
            <div className={`w-3 h-4 rounded-xs transition-transform duration-150 ${isBit1On ? 'bg-white shadow translate-y-4' : 'bg-slate-300 translate-y-0'}`} />
          </div>
          <span className="text-[8px] font-mono text-red-200 mt-0.5">{isBit1On ? 'ON' : 'OFF'}</span>
        </div>

        {/* Bit 0 (SW1 / P3.2) */}
        <div 
          onClick={() => toggleBit(0)} 
          className={`flex flex-col items-center cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          title="SW1 (P3.2) - Bit 0"
        >
          <span className="text-[9px] font-bold text-white leading-none mb-0.5">1</span>
          <div className="w-4 h-9 bg-slate-950 rounded-sm p-0.5 flex flex-col justify-between shadow-inner">
            <div className={`w-3 h-4 rounded-xs transition-transform duration-150 ${isBit0On ? 'bg-white shadow translate-y-4' : 'bg-slate-300 translate-y-0'}`} />
          </div>
          <span className="text-[8px] font-mono text-red-200 mt-0.5">{isBit0On ? 'ON' : 'OFF'}</span>
        </div>
      </div>
    </div>
  );
};

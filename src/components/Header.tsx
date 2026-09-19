import React from 'react';
import { 
  Usb, 
  Cpu, 
  Layers, 
  Network, 
  Thermometer, 
  Sliders, 
  Activity, 
  FileCode2, 
  CircuitBoard, 
  Sparkles,
  RefreshCw,
  TerminalSquare
} from 'lucide-react';
import { AdapterMode, SerialConnectionStatus } from '../types';
import { DipSwitchControl } from './DipSwitchControl';
import { MODES_LIST } from '../data/hardwareData';

interface HeaderProps {
  status: SerialConnectionStatus;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onToggleSimulated: (simulated: boolean) => void;
  onConnectPhysical: () => void;
  onDisconnectPhysical: () => void;
  onSetMode: (mode: AdapterMode) => void;
  onSetDip: (val: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  currentTab,
  onSelectTab,
  onToggleSimulated,
  onConnectPhysical,
  onDisconnectPhysical,
  onSetMode,
  onSetDip,
}) => {
  const getIcon = (id: AdapterMode) => {
    switch (id) {
      case 'I2C': return <Cpu className="w-4 h-4" />;
      case 'SPI': return <Layers className="w-4 h-4" />;
      case 'RS485': return <Network className="w-4 h-4" />;
      case 'ONEWIRE': return <Thermometer className="w-4 h-4" />;
      case 'GPIO': return <Sliders className="w-4 h-4" />;
      case 'ADC_PWM': return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/30 border border-cyan-400/30">
            <Usb className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-wide">CH552T 多功能USB适配器</h1>
              <span className="text-[10px] uppercase font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/80 px-2 py-0.5 rounded-full">
                6-in-1 Suite
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              WCH 8051 USB MCU · 24MHz · TSSOP-20 · Web Serial API
            </p>
          </div>
        </div>

        {/* Hardware Status & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* DIP Switch Component */}
          <DipSwitchControl 
            value={status.hardwareDipMode} 
            onChange={onSetDip} 
          />

          {/* Connection Mode Pill */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => onToggleSimulated(true)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                status.isSimulated
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              虚拟硬件仿真
            </button>
            <button
              onClick={() => {
                if (status.isSimulated || !status.isConnected) {
                  onConnectPhysical();
                } else {
                  onDisconnectPhysical();
                }
              }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                !status.isSimulated && status.isConnected
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Usb className="w-3.5 h-3.5" />
              {!status.isSimulated && status.isConnected ? '物理串口已连接' : '连接真实CH552T'}
            </button>
          </div>

          {/* Mode Selector for Web Control */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-slate-400">活动模式:</span>
            <select
              value={status.activeMode}
              onChange={(e) => {
                const newMode = e.target.value as AdapterMode;
                onSetMode(newMode);
                onSelectTab(newMode);
              }}
              className="bg-transparent text-xs font-semibold text-cyan-400 focus:outline-none cursor-pointer"
            >
              {MODES_LIST.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                  {m.name} ({m.dipCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 border-t border-slate-800/80 flex overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1 py-1.5">
          {MODES_LIST.map((mode) => {
            const isActive = currentTab === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  onSelectTab(mode.id);
                  onSetMode(mode.id);
                }}
                className={`px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {getIcon(mode.id)}
                <span>{mode.name}</span>
                <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                  {mode.dipCode}
                </span>
              </button>
            );
          })}

          <div className="h-5 w-px bg-slate-800 self-center mx-1" />

          {/* Hardware Schematic Tab */}
          <button
            onClick={() => onSelectTab('HARDWARE')}
            className={`px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
              currentTab === 'HARDWARE'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CircuitBoard className="w-4 h-4 text-amber-400" />
            <span>引脚定义与原理图</span>
          </button>

          {/* Firmware & Docs Tab */}
          <button
            onClick={() => onSelectTab('FIRMWARE')}
            className={`px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
              currentTab === 'FIRMWARE'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileCode2 className="w-4 h-4 text-indigo-400" />
            <span>固件源码与下载</span>
          </button>
        </nav>
      </div>
    </header>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Github, ExternalLink } from 'lucide-react';
import { Header } from './components/Header';
import { LogTerminal } from './components/LogTerminal';
import { I2CView } from './components/views/I2CView';
import { SPIView } from './components/views/SPIView';
import { RS485ModbusView } from './components/views/RS485ModbusView';
import { OneWireView } from './components/views/OneWireView';
import { GPIOView } from './components/views/GPIOView';
import { PwmAdcView } from './components/views/PwmAdcView';
import { HardwareDocView } from './components/views/HardwareDocView';
import { FirmwareDocView } from './components/views/FirmwareDocView';
import { SerialManager } from './services/serialManager';
import { AdapterMode, SerialConnectionStatus } from './types';

export default function App() {
  const serial = SerialManager.getInstance();

  const [currentTab, setCurrentTab] = useState<string>('I2C');
  const [status, setStatus] = useState<SerialConnectionStatus>(serial.getStatus());

  useEffect(() => {
    const unsub = serial.onStatus((st) => {
      setStatus(st);
    });
    return unsub;
  }, [serial]);

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
  };

  const handleToggleSimulated = async (sim: boolean) => {
    await serial.setSimulatedMode(sim);
  };

  const handleConnectPhysical = async () => {
    await serial.connectPhysical();
  };

  const handleDisconnectPhysical = async () => {
    await serial.disconnectPhysical();
  };

  const handleSetMode = async (mode: AdapterMode) => {
    await serial.setActiveMode(mode, 'WEB');
  };

  const handleSetDip = (val: number) => {
    serial.setDipSwitch(val);
    const modeMap: Record<number, string> = {
      1: 'I2C',
      2: 'SPI',
      3: 'RS485',
      4: 'ONEWIRE',
      5: 'GPIO',
      6: 'ADC_PWM',
    };
    if (val >= 1 && val <= 6 && modeMap[val]) {
      setCurrentTab(modeMap[val]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      {/* Top Main Header */}
      <Header
        status={status}
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onToggleSimulated={handleToggleSimulated}
        onConnectPhysical={handleConnectPhysical}
        onDisconnectPhysical={handleDisconnectPhysical}
        onSetMode={handleSetMode}
        onSetDip={handleSetDip}
      />

      {/* Main Workbench Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {currentTab === 'I2C' && <I2CView />}
        {currentTab === 'SPI' && <SPIView />}
        {currentTab === 'RS485' && <RS485ModbusView />}
        {currentTab === 'ONEWIRE' && <OneWireView />}
        {currentTab === 'GPIO' && <GPIOView />}
        {currentTab === 'ADC_PWM' && <PwmAdcView />}
        {currentTab === 'HARDWARE' && <HardwareDocView />}
        {currentTab === 'FIRMWARE' && <FirmwareDocView />}
      </main>

      {/* Bottom Protocol Transaction Log Console */}
      <LogTerminal />

      {/* Global App Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 text-slate-400 py-3 px-4 sm:px-6 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-300 font-medium">CH552T 多功能USB适配器</span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">Web Serial 硬件综合调试上位机 (6-in-1 Suite)</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/etfrommars/CH552T-tools"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-300 hover:text-cyan-400 transition-colors text-[11px] group"
            >
              <Github className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              <span className="font-mono">github.com/etfrommars/CH552T-tools</span>
              <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

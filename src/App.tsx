/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
    </div>
  );
}

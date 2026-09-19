import React, { useState, useEffect, useRef } from 'react';
import { TerminalSquare, Trash2, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { LogEntry } from '../types';
import { SerialManager } from '../services/serialManager';

export const LogTerminal: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const serial = SerialManager.getInstance();
    const unsub = serial.onLog((entry) => {
      setLogs((prev) => [...prev.slice(-100), entry]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isExpanded) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  const handleClear = () => {
    setLogs([]);
  };

  const handleCopyAll = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.direction}] [${l.mode}] ${l.summary} ${l.rawHex ? 'DATA: ' + l.rawHex : ''}`).join('\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border-t border-slate-800 text-slate-200">
      {/* Terminal Title Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <TerminalSquare className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200 tracking-wide">底层总线通信报文日志 (Live Bus Log)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            {logs.length} 条报文
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800"
            title="复制全部日志"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="text-[11px]">{copied ? '已复制' : '复制'}</span>
          </button>
          <button
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800"
            title="清空日志"
          >
            <Trash2 className="w-3 h-3" />
            <span className="text-[11px]">清空</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Terminal Log Area */}
      {isExpanded && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
          <div className="h-32 bg-slate-950 border border-slate-800 rounded-lg p-2.5 overflow-y-auto font-mono text-[11px] space-y-1">
            {logs.length === 0 ? (
              <div className="text-slate-500 text-center py-8">
                暂无通信数据，进行I2C扫描、SPI读写、485交互或采样时将实时记录
              </div>
            ) : (
              logs.map((log) => {
                let badgeClass = 'text-cyan-400 bg-cyan-950/80 border-cyan-800';
                if (log.direction === 'TX') badgeClass = 'text-indigo-400 bg-indigo-950/80 border-indigo-800';
                if (log.direction === 'ERR') badgeClass = 'text-red-400 bg-red-950/80 border-red-800';
                if (log.direction === 'RX') badgeClass = 'text-emerald-400 bg-emerald-950/80 border-emerald-800';

                return (
                  <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/40 py-0.5 px-1 rounded">
                    <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                    <span className={`px-1 rounded border text-[9px] font-bold shrink-0 ${badgeClass}`}>
                      {log.direction}
                    </span>
                    <span className="text-amber-400 shrink-0">[{log.mode}]</span>
                    <span className="text-slate-300 flex-1">{log.summary}</span>
                    {log.rawHex && (
                      <span className="text-slate-400 shrink-0 text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {log.rawHex}
                      </span>
                    )}
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>
        </div>
      )}
    </div>
  );
};

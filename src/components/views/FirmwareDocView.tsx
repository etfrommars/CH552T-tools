import React, { useState } from 'react';
import { 
  FileCode2, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  Terminal, 
  Sparkles,
  HelpCircle,
  FolderArchive,
  ArrowRight,
  Github
} from 'lucide-react';
import { 
  CH552_SOURCE_FILES, 
  generateIntelHex, 
  generateBinaryFirmware, 
  triggerDownload 
} from '../../data/firmwareSource';

export const FirmwareDocView: React.FC = () => {
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const activeFile = CH552_SOURCE_FILES[activeFileIndex];

  const handleCopy = () => {
    navigator.clipboard?.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHex = () => {
    const hexContent = generateIntelHex();
    triggerDownload('CH552T_MultiAdapter_Firmware_v1.4.2.hex', hexContent, 'text/plain');
  };

  const handleDownloadBin = () => {
    const binContent = generateBinaryFirmware();
    triggerDownload('CH552T_MultiAdapter_Firmware_v1.4.2.bin', binContent, 'application/octet-stream');
  };

  const handleDownloadSource = () => {
    // Combine all source files into a unified C source bundle
    let bundle = '/* ================================================================\n';
    bundle += ' * CH552T 6-in-1 Multi-Adapter Complete C Source Code Bundle\n';
    bundle += ' * Target: CH552T / CH554 / CH551 (WCH 8051 USB MCU)\n';
    bundle += ' * Compiler: SDCC 4.2+ / Keil C51\n';
    bundle += ' * ================================================================ */\n\n';

    CH552_SOURCE_FILES.forEach((f) => {
      bundle += `\n/* ------------------- File: ${f.name} ------------------- */\n`;
      bundle += `/* Description: ${f.description} */\n`;
      bundle += f.content;
      bundle += '\n\n';
    });

    triggerDownload('CH552T_MultiAdapter_Source_Bundle.c', bundle, 'text/x-csrc');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Download Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <FileCode2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              CH552T 单片机固件下载与开源源码工程
            </h2>
            <p className="text-xs text-slate-400">
              包含完整 Keil C51 / SDCC 固件工程、USB CDC驱动、协议栈与已编译好的 Intel HEX 固件
            </p>
          </div>
        </div>

        {/* Quick Download Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="https://github.com/etfrommars/CH552T-tools"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-2 transition-all border border-slate-700 shadow-sm"
          >
            <Github className="w-4 h-4 text-white" />
            <span>GitHub 源码仓库</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
          <button
            onClick={handleDownloadHex}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-2 transition-all shadow-sm shadow-indigo-900/40"
          >
            <Download className="w-4 h-4" />
            下载 HEX 固件 (.hex)
          </button>
          <button
            onClick={handleDownloadBin}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center gap-2 transition-all shadow-sm shadow-cyan-900/40"
          >
            <Download className="w-4 h-4" />
            下载 BIN 镜像 (.bin)
          </button>
          <button
            onClick={handleDownloadSource}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-2 transition-all border border-slate-700"
          >
            <FolderArchive className="w-4 h-4 text-amber-400" />
            下载全套 C 源代码
          </button>
        </div>
      </div>

      {/* GitHub Repository Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-white border border-slate-700">
            <Github className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-white">开源代码与固件库 (GitHub)</h4>
              <span className="text-[10px] font-mono bg-indigo-950 text-indigo-400 border border-indigo-800/60 px-1.5 py-0.5 rounded">
                etfrommars/CH552T-tools
              </span>
            </div>
            <p className="text-xs text-slate-400">
              项目已在 GitHub 开源，包含完整硬件原理图、固件工程源码、引脚驱动与上位机配置。欢迎 Star 与贡献。
            </p>
          </div>
        </div>
        <a
          href="https://github.com/etfrommars/CH552T-tools"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 border border-indigo-500/30 transition-all shadow-sm"
        >
          <span>访问仓库 (etfrommars/CH552T-tools)</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Flashing Tutorial Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            CH552T 固件免烧录器 USB 直接烧录指南 (WCHISPTool)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center text-[10px]">1</span>
              <span>进入 Bootloader</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              CH552T 出厂内置 Bootloader。按下板载 <strong>DOWNLOAD 键</strong> (将 P3.6 或 USB D+ 上拉至 3.3V)，然后插入 USB 线。
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center text-[10px]">2</span>
              <span>打开烧录软件</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              打开南京沁恒官方烧录工具 <strong>WCHISPTool</strong>，芯片系列选择 <strong>8位 CH55X 系列</strong>，芯片型号选择 <strong>CH552</strong>。
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center text-[10px]">3</span>
              <span>加载固件文件</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              在“用户程序文件”处浏览并选中下载好的 <strong>CH552T_MultiAdapter.hex</strong> 文件，配置字保留默认内振 24MHz。
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-[10px]">4</span>
              <span>一键下载完成</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              点击“下载”按钮，约 1 秒后提示“下载成功”。重新拔插 USB 线，电脑设备管理器将识别为 <strong>CH552T USB CDC 虚拟串口</strong>。
            </p>
          </div>
        </div>
      </div>

      {/* Embedded Code Explorer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {/* Source File Tabs Header */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {CH552_SOURCE_FILES.map((file, idx) => (
              <button
                key={file.name}
                onClick={() => setActiveFileIndex(idx)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                  activeFileIndex === idx
                    ? 'bg-slate-800 text-cyan-300 font-bold border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {file.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 hidden sm:inline">{activeFile.description}</span>
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium flex items-center gap-1 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '已复制' : '复制源码'}
            </button>
          </div>
        </div>

        {/* Code Content Viewer */}
        <div className="p-4 bg-slate-950 max-h-[500px] overflow-y-auto">
          <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre select-all">
            <code>{activeFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

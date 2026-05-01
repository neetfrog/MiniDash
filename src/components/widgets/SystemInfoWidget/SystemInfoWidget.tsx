'use client';

import { useState, useEffect } from 'react';
import TerminalBox from '@/components/ui/TerminalBox';
import { Cpu } from 'lucide-react';
import styles from './SystemInfoWidget.module.css';

const DEFAULT_ASCII_ART = `
       .---.
      /     \
     | () () |
      \  ^  /
       |||||
       |||||
`;

function getOsAsciiArt(os: string) {
  const key = os.toLowerCase();
  if (key.includes('windows')) {
    return `
      [Windows]
      _________
     |  _   _  |
     | (_) (_) |
     |   ___   |
     |__|   |__|
    `;
  }
  if (key.includes('mac') || key.includes('darwin')) {
    return `
      [macOS]
       _____
      /  _  \
     |  /_\  |
     |  \_/  |
      \_____/
    `;
  }
  if (key.includes('linux')) {
    return `
      [Linux]
       .--.
      |o_o |
      |:_/ |
      |\_/ |
      |   |\
      |___|/
    `;
  }
  return DEFAULT_ASCII_ART;
}

function simplifyGpuRenderer(renderer: string, vendor: string) {
  const value = (renderer || '').trim();
  if (!value) return 'Unavailable';

  const angleMatch = value.match(/^ANGLE \(([^,]+),\s*([^,]+)(?:,.*)?\)$/i);
  if (angleMatch) {
    let gpuName = angleMatch[2];
    gpuName = gpuName.replace(/\s*\([^)]*\)/g, '').replace(/\s+(Direct3D|OpenGL|Vulkan|Metal).*$/i, '').trim();
    return gpuName || angleMatch[1] || vendor || 'Unknown';
  }

  if (vendor && value.toLowerCase().startsWith(vendor.toLowerCase())) {
    return value.substring(vendor.length).trim() || value;
  }

  return value;
}

function getWebGLInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return { renderer: 'Unavailable', vendor: 'Unavailable' };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info') as any;
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string;
      return { renderer: renderer || 'Unknown', vendor: vendor || 'Unknown' };
    }
    return { renderer: 'Restricted', vendor: 'Restricted' };
  } catch (e) {
    return { renderer: 'Unavailable', vendor: 'Unavailable' };
  }
}

function getSystemInfo() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      os: 'Unknown',
      browser: 'Unknown',
      screen: '0x0',
      viewport: '0x0',
      platform: 'Unknown',
      cpuCores: 'Unavailable',
      deviceMemory: 'Unavailable',
      pixelRatio: 1,
      languages: 'Unknown',
      timeZone: 'Unknown',
      touchPoints: 0,
    };
  }

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || 'Unknown';
  const screen = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  const viewport = `${window.innerWidth || 0}x${window.innerHeight || 0}`;

  let os = 'Unknown';
  if (platform.includes('Win')) os = 'Windows';
  else if (platform.includes('Mac')) os = 'macOS';
  else if (platform.includes('Linux')) os = 'Linux';

  let browser = 'Unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  const cpuCores = (navigator as any).hardwareConcurrency || 'Unavailable';
  const deviceMemory = (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'Unavailable';
  const pixelRatio = window.devicePixelRatio || 1;
  const languages = (navigator.languages && navigator.languages.length) ? navigator.languages.join(', ') : navigator.language || 'Unknown';
  const timeZone = Intl?.DateTimeFormat?.().resolvedOptions()?.timeZone || 'Unknown';
  const touchPoints = (navigator as any).maxTouchPoints || 0;

  return {
    os,
    browser,
    screen,
    viewport,
    platform,
    cpuCores,
    deviceMemory,
    pixelRatio,
    languages,
    timeZone,
    touchPoints,
  };
}

export default function SystemInfoWidget() {
  const [uptime, setUptime] = useState(0);
  const [info, setInfo] = useState(() => ({
    os: 'Unknown',
    browser: 'Unknown',
    screen: '0x0',
    viewport: '0x0',
    platform: 'Unknown',
    cpuCores: 'Unavailable',
    deviceMemory: 'Unavailable',
    pixelRatio: 1,
    languages: 'Unknown',
    timeZone: 'Unknown',
    touchPoints: 0,
  }));

  const [battery, setBattery] = useState<string>('Unavailable');
  const [connection, setConnection] = useState<string>('Unavailable');
  const [storage, setStorage] = useState<string>('Unavailable');
  const [gpu, setGpu] = useState<string>('Unavailable');
  const [cpuDesc, setCpuDesc] = useState<string>('Unknown');

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setInfo(getSystemInfo());
  }, []);

  useEffect(() => {
    // Battery
    if ((navigator as any).getBattery) {
      (navigator as any).getBattery().then((bat: any) => {
        setBattery(`${Math.round(bat.level * 100)}% ${bat.charging ? '(charging)' : ''}`.trim());
      }).catch(() => {});
    }

    // Connection
    const conn = (navigator as any).connection;
    if (conn) {
      const parts = [] as string[];
      if (conn.effectiveType) parts.push(conn.effectiveType);
      if (conn.downlink) parts.push(`${conn.downlink}Mb/s`);
      if (conn.rtt) parts.push(`${conn.rtt}ms RTT`);
      setConnection(parts.join(' | ') || 'Unknown');
    }

    // Storage
    if ((navigator as any).storage && (navigator as any).storage.estimate) {
      (navigator as any).storage.estimate().then((est: any) => {
        const used = est.usage || 0;
        const quota = est.quota || 0;
        const percent = quota ? Math.round((used / quota) * 100) : 0;
        setStorage(`${Math.round(used / (1024*1024))}MB / ${Math.round(quota / (1024*1024))}MB (${percent}%)`);
      }).catch(() => {});
    }

    // GPU
    const info = getWebGLInfo();
    setGpu(simplifyGpuRenderer(info.renderer, info.vendor));

    // CPU model / architecture (best-effort using User-Agent Client Hints)
    const uaData = (navigator as any).userAgentData;
    if (uaData && typeof uaData.getHighEntropyValues === 'function') {
      uaData.getHighEntropyValues(['architecture', 'model']).then((vals: any) => {
        const arch = vals.architecture || '';
        const model = vals.model || '';
        const combined = `${model} ${arch}`.trim();
        if (combined) setCpuDesc(combined);
      }).catch(() => {});
    } else {
      // Fallback: try to extract any hint from userAgent
      const ua = navigator.userAgent || '';
      const cpuMatch = ua.match(/(Intel\w*|AMD\w*|Apple\w*|ARM\w*|ARM64\w*|M\d{1,2}\s+CPU)/i);
      if (cpuMatch) setCpuDesc(cpuMatch[0]);
    }
  }, []);

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <TerminalBox
      title="neofetch"
      icon={<Cpu size={14} />}
      status={`Uptime: ${formatUptime(uptime)}`}
    >
      <div className={styles.container}>
        <div className={styles.info}>
          <div className={styles.infoLine}>
            <span className={styles.label}>OS:</span>
            <span className={styles.value}>{info.os}</span>
          </div>
          <div className={styles.infoLine}>
            <span className={styles.label}>Browser:</span>
            <span className={styles.value}>{info.browser}</span>
          </div>
          <div className={styles.infoLine}>
            <span className={styles.label}>Resolution:</span>
            <span className={styles.value}>{info.screen}</span>
          </div>
          <div className={styles.infoLine}>
            <span className={styles.label}>Viewport:</span>
            <span className={styles.value}>{info.viewport}</span>
          </div>

          <div className={styles.infoLine}>
            <span className={styles.label}>CPU cores:</span>
            <span className={styles.value}>{info.cpuCores}</span>
          </div>

          <div className={styles.infoLine}>
            <span className={styles.label}>CPU:</span>
            <span className={styles.value}>{cpuDesc}</span>
          </div>

          <div className={styles.infoLine}>
            <span className={styles.label}>Memory:</span>
            <span className={styles.value}>{info.deviceMemory}</span>
          </div>

          <div className={styles.infoLine}>
            <span className={styles.label}>GPU:</span>
            <span className={styles.value}>{gpu}</span>
          </div>

          <div className={styles.infoLine}>
            <span className={styles.label}>Battery:</span>
            <span className={styles.value}>{battery}</span>
          </div>

          <div className={styles.infoLine}>
            <span className={styles.label}>Network:</span>
            <span className={styles.value}>{connection}</span>
          </div>

          <div className={styles.infoLine}>
            <span className={styles.label}>Storage:</span>
            <span className={styles.value}>{storage}</span>
          </div>

          <div className={styles.infoLine}>
            <span className={styles.label}>Timezone:</span>
            <span className={styles.value}>{info.timeZone}</span>
          </div>

          <div className={styles.infoLine}>
            <span className={styles.label}>Languages:</span>
            <span className={styles.value}>{info.languages}</span>
          </div>

          <div className={styles.infoLine}>
            <span className={styles.label}>Platform:</span>
            <span className={styles.value}>{info.platform}</span>
          </div>
        </div>
      </div>
    </TerminalBox>
  );
}
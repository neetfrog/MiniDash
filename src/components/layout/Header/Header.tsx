'use client';

import ThemeToggle from '@/components/ui/ThemeToggle';
import ClockWidget from '@/components/widgets/ClockWidget';
import WidgetsManager from '@/components/layout/WidgetsManager/WidgetsManager';
import { useWidgets } from '@/context/WidgetContext';
import styles from './Header.module.css';

interface HeaderProps {
  onOpenCli?: () => void;
}

const ASCII_LOGO = `
╔═══════════════════════════════════════════════════════════════╗
║  ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗ ║
║  ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║ ║
║     ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║ ║
║     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║ ║
║     ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███╗║
║     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══╝║
║              ══════ DIGITAL DETOX HUB ══════                  ║
╚═══════════════════════════════════════════════════════════════╝`;

const ASCII_LOGO_MOBILE = `
┌─────────────────────┐
│  TERMINAL DETOX     │
│  ════════════════   │
│  digital essentials │
└─────────────────────┘`;

export default function Header({ onOpenCli }: HeaderProps) {
  const { widgets } = useWidgets();
  const activeFlags = widgets.length > 0 ? widgets.map(w => `--${w.id}`).join(' ') : '--none';

  return (
    <header className={styles.header}>
      <div className={styles.logoContainer}>
        <pre className={styles.logo} aria-label="Terminal Detox">{ASCII_LOGO}</pre>
        <pre className={styles.logoMobile} aria-label="Terminal Detox">{ASCII_LOGO_MOBILE}</pre>
      </div>
      <div className={styles.headerContent}>
        <ClockWidget />
        <div className={styles.controls}>
          <ThemeToggle />
          <WidgetsManager />
          {onOpenCli && (
            <button onClick={onOpenCli} className={styles.cliButton}>
              [⌘] cli
            </button>
          )}
          <a href="#" className={styles.helpLink}>[?] help</a>
        </div>
      </div>
      <div className={styles.tagline}>
        <span className={styles.prompt}>$</span>
        <span className={styles.command}>fetch</span>
        <span className={styles.args}>{activeFlags}</span>
        <span className={styles.cursor}>▋</span>
      </div>
    </header>
  );
}

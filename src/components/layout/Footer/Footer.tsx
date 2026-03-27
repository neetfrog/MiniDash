import { useState } from 'react';
import styles from './Footer.module.css';

export default function Footer() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <div className={styles.links}>
          <a href="https://github.com/ignasnefas" target="_blank" rel="noopener noreferrer">[github]</a>
          <span className={styles.separator}>│</span>
          <a href="https://github.com/ignasnefas/MiniDash/raw/refs/heads/main/android/APK/MiniDash_Mar27.apk" className={styles.apkLink}>[download apk]</a>
          <span className={styles.separator}>│</span>
          <button
            className={styles.aboutBtn}
            onClick={() => setIsAboutOpen(true)}
            type="button"
          >
            [about]
          </button>
        </div>
      </div>

      {isAboutOpen && (
        <div className={styles.overlay} onClick={() => setIsAboutOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>About MiniDash</span>
              <button className={styles.close} onClick={() => setIsAboutOpen(false)} type="button">✕</button>
            </div>
            <div className={styles.modalContent}>
              <p>MiniDash is a minimal dashboard concept built with Next.js and React.</p>
              <p>It includes widgets for weather, news, crypto, world clocks, and a command-line interface.</p>
              <p>Use the UI toolbar to toggle theme, widgets, and CLI commands.</p>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}

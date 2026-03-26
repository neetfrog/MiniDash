'use client';

import { useState } from 'react';
import { useWidgets } from '@/context/WidgetContext';
import styles from './WidgetsManager.module.css';

export default function WidgetsManager() {
  const { availableWidgets, toggleWidget, isEnabled, widgets, moveWidget, enableAllWidgets, disableAllWidgets, resetWidgets } = useWidgets();
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <button className={styles.iconBtn} onClick={() => setOpen(true)}>⚙</button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>Widgets</div>
            <div className={styles.controlRow}>
              <button className={styles.smallBtn} onClick={() => enableAllWidgets()}>Enable all</button>
              <button className={styles.smallBtn} onClick={() => disableAllWidgets()}>Disable all</button>
              <button className={styles.smallBtn} onClick={() => resetWidgets()}>Reset defaults</button>
            </div>
            <div className={styles.list}>
              {availableWidgets.map(w => {
                const enabledIndex = widgets.findIndex(x => x.id === w.id);
                const enabled = isEnabled(w.id);
                return (
                  <label key={w.id} className={styles.item}>
                    <input type="checkbox" checked={enabled} onChange={() => toggleWidget(w.id)} />
                    <span className={styles.name}>{w.id}</span>
                    <span className={styles.comp}>{w.component}</span>
                    {enabled && (
                      <div className={styles.reorder}>
                        <button className={styles.smallBtn} onClick={() => moveWidget(w.id, 'up')} disabled={enabledIndex <= 0} aria-label={`Move ${w.id} up`}>▲</button>
                        <button className={styles.smallBtn} onClick={() => moveWidget(w.id, 'down')} disabled={enabledIndex === -1 || enabledIndex >= widgets.length - 1} aria-label={`Move ${w.id} down`}>▼</button>
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
            <div className={styles.footer}>
              <button className={styles.close} onClick={() => setOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

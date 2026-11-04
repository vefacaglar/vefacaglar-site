import React from "react";
import styles from "../jobs.module.css";
import ds from "../../../../lib/dashboard-strings";
import type { StreamConn } from "../hooks/useJobStream";

const CLASS: Record<StreamConn, string> = {
  connecting: styles.connWaiting,
  reconnecting: styles.connWaiting,
  live: styles.connLive,
  polling: styles.connPolling,
  ended: styles.connEnded,
};

export default function ConnectionIndicator({ conn }: { conn: StreamConn }) {
  return (
    <span className={`${styles.conn} ${CLASS[conn]}`} title={ds.jobs.detail.connectionHint[conn]} role="status">
      <span className={styles.connDot} aria-hidden="true" />
      {ds.jobs.detail.connection[conn]}
    </span>
  );
}

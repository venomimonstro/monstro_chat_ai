export type EmbedAppearance = {
  primaryColor?: string;
  textColor?: string;
  buttonShape?: 'round' | 'square';
  position?: 'bottom-right' | 'bottom-left';
  offsetX?: number;
  offsetY?: number;
  hideOnMobile?: boolean;
  launcherAnimation?: 'none' | 'gentle' | 'pulse' | 'active';
  launcherLabel?: string;
  showLauncherLabel?: boolean;
  launcherOnlineIndicator?: boolean;
};

export function injectLauncherStyles() {
  if (document.getElementById('aicw-launcher-styles')) return;
  const style = document.createElement('style');
  style.id = 'aicw-launcher-styles';
  style.textContent = `
@keyframes aicw-gentle-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
@keyframes aicw-ring-pulse {
  0% { box-shadow: 0 0 0 0 rgba(239,43,52,.45); }
  70% { box-shadow: 0 0 0 12px rgba(239,43,52,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,43,52,0); }
}
@keyframes aicw-active-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  25% { transform: translateY(-3px) scale(1.06); }
  50% { transform: translateY(0) scale(1.02); }
}
#aicw-launcher-wrap {
  position: fixed;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.35s ease;
}
#aicw-launcher-wrap.aicw-visible { opacity: 1; }
#aicw-launcher-wrap.aicw-left { flex-direction: row-reverse; }
#aicw-launcher-label {
  pointer-events: none;
  background: #fff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  padding: 8px 12px;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(15,23,42,.12);
  max-width: min(220px, 45vw);
}
#aicw-launcher {
  pointer-events: auto;
  position: relative;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: 0 6px 20px rgba(239,43,52,.28);
  transition: transform 0.2s ease;
}
#aicw-launcher:hover { transform: scale(1.06); }
#aicw-launcher svg { width: 22px; height: 22px; }
#aicw-launcher.aicw-anim-gentle { animation: aicw-gentle-pulse 2.4s ease-in-out infinite; }
#aicw-launcher.aicw-anim-pulse { animation: aicw-ring-pulse 1.8s ease-out infinite; }
#aicw-launcher.aicw-anim-active {
  animation: aicw-active-bounce 1.6s ease-in-out infinite, aicw-ring-pulse 1.8s ease-out infinite;
}
#aicw-launcher-online {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid #fff;
  box-sizing: border-box;
}
`;
  document.head.appendChild(style);
}

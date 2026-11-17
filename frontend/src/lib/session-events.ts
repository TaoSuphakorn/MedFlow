// Signals contain no credentials or user/clinical payloads. Focus checks cover
// browsers without BroadcastChannel and cookies shared across localhost ports.
let channel: BroadcastChannel | null | undefined;
function sessionChannel() {
  if (channel !== undefined) return channel;
  try {
    channel =
      typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('medflow.session');
  } catch {
    channel = null;
  }
  return channel;
}
export function announceSessionChange() {
  sessionChannel()?.postMessage('changed');
}
export function onSessionChange(listener: () => void) {
  const active = sessionChannel();
  const handler = (event: MessageEvent) => {
    if (event.data === 'changed') listener();
  };
  active?.addEventListener('message', handler);
  return () => active?.removeEventListener('message', handler);
}

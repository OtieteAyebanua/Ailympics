// Live match viewer — renders agenticfoot's broadcast (sealed frames streamed
// from the VPS via the Supabase broadcast-stream relay). The simulation runs
// server-side; this tab only renders what it receives.
import MatchBroadcast from '../components/broadcast/MatchBroadcast';

export default function Matches() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="tab-section">
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--muted)',
          letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
        }}>
          Live Broadcast
        </div>
        <MatchBroadcast height="480px" />
      </div>
    </div>
  );
}

/**
 * MatchBroadcast — React port of agenticfoot's broadcast viewer (apps/web).
 *
 * The match starts on load: connect to the SSE broadcast stream (via the
 * Supabase broadcast-stream relay), buffer sealed 15fps frames, interpolate to
 * render fps, and let the presentation Director pace banners, replays,
 * commentary, and crowd from sealed cues. Zero match-truth simulation lives
 * here — the client only renders sealed frames received from the server.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BroadcastScene, CEREMONY_TOTAL, ceremonyPhase, type SceneCameraMode } from './scene';
import { FramePlayback } from './playback';
import { Director } from './director';
import { StadiumAudio } from './audio';
import { connectBroadcast, fetchManifest } from './stream';
import type { SecondPayload } from './stream';
import { playerDisplay, prettifyText } from './roster';
import {
  audioEnabled, banner, bufferSeconds, commentary, connection, debugMode,
  feed, feedCollapsed, replay, restartNotice, scorebug,
} from './stores';
import type { Writable } from './store';
import './broadcast.css';

const FEED_LIMIT = 24;

function useStore<T>(store: Writable<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

function focusLabel(id: string): string {
  const p = playerDisplay(id);
  return p ? `#${p.number} ${p.displayName}` : id;
}

export default function MatchBroadcast({ height = '480px' }: { height?: string }) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const possessionRef  = useRef<HTMLDivElement>(null);
  const debugRef       = useRef<HTMLDivElement>(null);
  const audioRef       = useRef<StadiumAudio>(null);

  // Store-driven HUD (re-renders only when these change).
  const sb        = useStore(scorebug);
  const conn      = useStore(connection);
  const feedItems = useStore(feed);
  const bnr       = useStore(banner);
  const restart   = useStore(restartNotice);
  const comment   = useStore(commentary);
  const rep       = useStore(replay);
  const buffer    = useStore(bufferSeconds);
  const audioOn   = useStore(audioEnabled);
  const collapsed = useStore(feedCollapsed);
  const debug     = useStore(debugMode);

  // Low-frequency local state.
  const [matchup, setMatchup]                 = useState<string>();
  const [ceremonyActive, setCeremonyActive]   = useState(false);
  const [ceremonyCaption, setCeremonyCaption] = useState<{ title: string; sub?: string }>();
  const [tvMode, setTvMode]                   = useState(true);
  const [wiping, setWiping]                   = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene    = new BroadcastScene(canvas);
    const playback = new FramePlayback();
    const audio    = new StadiumAudio();
    const director = new Director(playback, audio);
    audioRef.current = audio;

    const resize = () => scene.resize();
    resize();
    window.addEventListener('resize', resize);

    let ended = false;
    let activeSegment: string | undefined;
    let playheadSecond = 0;

    fetchManifest()
      .then(({ teams }) => {
        scene.setTeams(teams);
        setMatchup(`${teams.home.name} vs ${teams.away.name}`);
      })
      .catch(() => { /* default kit colors stay */ });

    // Pre-match ceremony only runs for viewers present at kickoff.
    const CEREMONY_MAX_KICKOFF_SECOND = 8;
    let ceremonyStarted = false;
    let ceremonyDone = false;
    let ceremonyStart = 0;
    let anthemFired = false;
    let lastCeremonyPhase: string | undefined;
    let ceremonyOn = false;

    const seenCues = new Set<string>();
    let pendingFeed: SecondPayload['cues'] = [];
    let pendingScorebugs: Array<{ second: number; bug: SecondPayload['scorebug'] }> = [];

    const onSecond = (payload: SecondPayload) => {
      playback.push(payload);
      director.ingest(payload);
      pendingScorebugs.push({ second: payload.second, bug: payload.scorebug });

      if (!ceremonyStarted && !ceremonyDone) {
        ceremonyStarted = true;
        const frame = payload.frames[0];
        if (frame && payload.second <= CEREMONY_MAX_KICKOFF_SECOND && frame.players.length >= 4) {
          scene.beginCeremony(
            frame.players.map((p) => ({
              playerId: p.playerId,
              teamId: p.teamId,
              position: { x: p.position.x, z: p.position.z },
            })),
          );
          ceremonyStart = performance.now();
          ceremonyOn = true;
          setCeremonyActive(true);
        } else {
          ceremonyDone = true;
        }
      }
      for (const cue of payload.cues) {
        if (seenCues.has(cue.id)) continue;
        seenCues.add(cue.id);
        pendingFeed.push(cue);
      }
    };

    const disconnect = connectBroadcast({
      onStatus: (s) => { if (!ended) connection.set(s); },
      onSync: (packet) => {
        bufferSeconds.set(packet.bufferSeconds);
        activeSegment = packet.activeSegmentId;
        scene.setViewerCount(packet.viewers ?? 0);
      },
      onSecond,
      onEnd: ({ scorebug: finalBug }) => {
        scorebug.set(finalBug);
        ended = true;
        connection.set('fulltime');
      },
    });

    // Possession-tag latch (kept out of React state to avoid per-frame renders).
    let focusPlayer: string | undefined;
    let focusPos: { x: number; y: number } | undefined;
    let rawFocus: string | undefined;
    let rawFocusSince = 0;
    let focusLostAt = 0;

    let wasReplaying = false;
    let actionsFrom: number | undefined;
    let raf = 0;

    const loop = () => {
      const now = performance.now();

      // Ceremony owns the picture until kickoff, then hands off to the live edge.
      if (ceremonyOn) {
        const elapsed = (now - ceremonyStart) / 1000;
        const phase = ceremonyPhase(elapsed);
        if (phase !== lastCeremonyPhase) {
          lastCeremonyPhase = phase;
          if (phase === 'walkout') setCeremonyCaption({ title: 'The teams emerge from the tunnel', sub: matchup });
          else if (phase === 'lineup') setCeremonyCaption({ title: 'Lining up at the halfway line', sub: matchup });
          else if (phase === 'anthem') setCeremonyCaption({ title: '🎵  The anthems ring out around the stadium' });
          else setCeremonyCaption({ title: 'Kick-off is moments away…' });
        }
        if (phase === 'anthem' && !anthemFired) {
          anthemFired = true;
          audio.anthem(9);
        }
        scene.renderCeremony(elapsed);
        if (elapsed >= CEREMONY_TOTAL) {
          scene.endCeremony();
          playback.pinPlayhead(playback.oldestSecond ?? 0, now);
          ceremonyOn = false;
          ceremonyDone = true;
          setCeremonyActive(false);
          setCeremonyCaption(undefined);
          connection.set('live');
        }
        raf = requestAnimationFrame(loop);
        return;
      }

      const live = playback.sample(now);
      playheadSecond = live?.matchSecond ?? 0;

      // Reveal feed cues as the playhead reaches them.
      if (pendingFeed.length > 0) {
        const due: SecondPayload['cues'] = [];
        pendingFeed = pendingFeed.filter((c) => {
          if (c.matchSecond <= playheadSecond) { due.push(c); return false; }
          return true;
        });
        if (due.length > 0) {
          feed.update((f) => [...due.reverse(), ...f].slice(0, FEED_LIMIT));
        }
      }

      // Reveal the scorebug for the playhead second.
      if (pendingScorebugs.length > 0) {
        let latest: { second: number; bug: SecondPayload['scorebug'] } | undefined;
        const rest: Array<{ second: number; bug: SecondPayload['scorebug'] }> = [];
        for (const entry of pendingScorebugs) {
          if (entry.second <= playheadSecond) {
            if (!latest || entry.second > latest.second) latest = entry;
          } else {
            rest.push(entry);
          }
        }
        pendingScorebugs = rest;
        if (latest) scorebug.set(latest.bug);
      }

      // Buffering distinct from connection loss.
      if (!ended) {
        connection.update((c) =>
          c === 'reconnecting' || c === 'connecting'
            ? c
            : playback.isStalled(now) ? 'buffering' : 'live',
        );
      }

      const { camera, replaySecond, replayEndSign } = director.tick(playheadSecond, now);
      const replayingNow = replaySecond !== undefined;
      scene.setReplayEndSign(replayingNow ? replayEndSign : undefined);
      if (replayingNow !== wasReplaying) {
        scene.cut();
        setWiping(true);
        window.setTimeout(() => setWiping(false), 450);
        wasReplaying = replayingNow;
      }
      scene.setCameraMode(camera as SceneCameraMode);

      const sample = replayingNow ? playback.sampleAt(replaySecond) : live;
      let actions: ReturnType<typeof playback.actionsBetween> = [];
      if (sample) {
        const t = sample.matchSecond;
        if (actionsFrom === undefined || t < actionsFrom || t - actionsFrom > 1.5) {
          actionsFrom = Math.max(t - 0.25, 0);
        }
        actions = playback.actionsBetween(actionsFrom, t);
        actionsFrom = t;
      }
      scene.render(sample, actions);

      // Possession tag — imperative DOM update (no React re-render).
      const focus = replayingNow ? undefined : scene.focusPlayerId;
      if (focus !== rawFocus) { rawFocus = focus; rawFocusSince = now; }
      if (focus !== undefined) {
        focusLostAt = now;
        if (focus !== focusPlayer && now - rawFocusSince > 250) focusPlayer = focus;
      } else if (focusPlayer !== undefined && now - focusLostAt > 600) {
        focusPlayer = undefined;
      }
      focusPos = focusPlayer && focusPlayer === focus ? scene.focusScreenPos : focusPos;
      if (!focusPlayer) focusPos = undefined;

      const tag = possessionRef.current;
      if (tag) {
        if (focusPlayer && focusPos && !replayingNow) {
          tag.style.display = 'block';
          tag.style.left = `${focusPos.x}px`;
          tag.style.top = `${focusPos.y}px`;
          tag.textContent = focusLabel(focusPlayer);
        } else {
          tag.style.display = 'none';
        }
      }

      if (debugRef.current) {
        debugRef.current.textContent =
          `t ${playheadSecond.toFixed(1)}s · buf ${bufferSeconds.get()}s · seg ${activeSegment ?? '—'}`;
      }

      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      disconnect();
      scene.dispose();
      void audio.disable();
      audioRef.current = null;
      // Reset shared stores so a remount starts clean.
      scorebug.set(undefined);
      connection.set('connecting');
      feed.set([]);
      banner.set(undefined);
      restartNotice.set(undefined);
      commentary.set(undefined);
      replay.set(undefined);
      bufferSeconds.set(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !audioEnabled.get();
    audioEnabled.set(next);
    try {
      if (next) await audio.enable();
      else await audio.disable();
    } catch (err) {
      console.warn('stadium audio unavailable', err);
      audioEnabled.set(false);
    }
  }, []);

  const rootClass = `afb${tvMode ? ' afb--tv' : ''}${rep ? ' afb--replaying' : ''}`;

  return (
    <div className={rootClass} style={{ height, borderRadius: 12 }}>
      <canvas ref={canvasRef} />
      <div className="afb-vignette" aria-hidden />
      {tvMode && <><div className="afb-tv-glass" aria-hidden /><div className="afb-tv-scanlines" aria-hidden /></>}
      {wiping && <div className="afb-wipe" aria-hidden />}

      {/* Scorebug */}
      <header className={`afb-scorebug${!sb || ceremonyActive ? ' afb-hidden' : ''}`}>
        {sb && (
          <>
            <span className="afb-wordmark">AF</span>
            <span className="afb-team" style={{ ['--kit' as string]: sb.home.color }}>
              <i className="afb-kit" />{sb.home.shortName}
            </span>
            <span className="afb-score">{sb.home.score}<em>–</em>{sb.away.score}</span>
            <span className="afb-team" style={{ ['--kit' as string]: sb.away.color }}>
              <i className="afb-kit" />{sb.away.shortName}
            </span>
            <span className="afb-clock">{sb.clock}</span>
            <span className="afb-phase">{sb.phase}</span>
            {rep ? <span className="afb-chip replay-chip">REPLAY</span>
              : conn === 'live' ? <span className="afb-chip live">LIVE</span>
              : conn === 'fulltime' ? <span className="afb-chip ft">FT</span>
              : <span className="afb-chip wait">●●●</span>}
          </>
        )}
      </header>

      {restart && (
        <div className="afb-restart-strip">
          <span>{restart.title}</span>
          <strong>{prettifyText(restart.reason)}</strong>
        </div>
      )}

      {/* Event feed */}
      <aside className={`afb-feed${collapsed ? ' collapsed' : ''}${feedItems.length === 0 ? ' afb-hidden' : ''}`}>
        <button className="afb-feed-toggle" onClick={() => feedCollapsed.update((v) => !v)}>
          {collapsed ? '◂ FEED' : 'FEED ▸'}
        </button>
        {!collapsed && (
          <div className="afb-feed-list">
            {feedItems.map((cue) => (
              <div key={cue.id} className={`afb-cue${cue.importance >= 1 ? ' major' : ''}`}>
                {prettifyText(cue.text)}
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Major-moment banner */}
      {bnr && (
        <div className={`afb-banner afb-kind-${bnr.kind}`}>
          <div className="afb-banner-title">{bnr.title}</div>
          {bnr.subtitle && <div className="afb-banner-sub">{prettifyText(bnr.subtitle)}</div>}
        </div>
      )}

      {/* Replay flag */}
      {rep && (
        <div className="afb-replay-flag">
          <span className="afb-replay-dot" />{rep.label}
          <span className="afb-replay-speed">
            {rep.playbackSpeed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}×
          </span>
        </div>
      )}

      {/* Lower-third commentary */}
      {comment && (
        <div className={`afb-lower-third${comment.intensity >= 0.7 ? ' hot' : ''}`}>
          {prettifyText(comment.text)}
        </div>
      )}

      {/* Possession tag (positioned imperatively) */}
      <div ref={possessionRef} className="afb-possession-tag" style={{ display: 'none' }} />

      {/* Viewer controls */}
      <div className="afb-controls">
        <button className={`afb-ctl${tvMode ? ' on' : ''}`} onClick={() => setTvMode((v) => !v)} title="TV mode">📺</button>
        <button className={`afb-ctl${audioOn ? ' on' : ''}`} onClick={toggleAudio} title="Stadium audio">{audioOn ? '🔊' : '🔇'}</button>
      </div>

      {/* Debug readout (?debug) */}
      {debug && (
        <div className="afb-debug">
          <div>conn {conn}</div>
          <div ref={debugRef} />
          <div>buf {buffer}s</div>
        </div>
      )}

      {/* Pre-match ceremony caption */}
      {ceremonyActive && ceremonyCaption && (
        <div className="afb-ceremony">
          <div className="afb-ceremony-badge">● PRE-MATCH</div>
          <div className="afb-ceremony-title">{ceremonyCaption.title}</div>
          {ceremonyCaption.sub && <div className="afb-ceremony-sub">{ceremonyCaption.sub}</div>}
        </div>
      )}

      {/* Connection states */}
      {!ceremonyActive && (
        conn === 'connecting' ? <div className="afb-overlay"><span>{matchup ?? 'Tuning to the broadcast…'}</span></div>
        : conn === 'reconnecting' ? <div className="afb-overlay"><span>Signal lost — re-tuning…</span></div>
        : conn === 'buffering' ? <div className="afb-overlay thin"><span>Holding for the live picture…</span></div>
        : conn === 'fulltime' ? <div className="afb-overlay subtle"><span>FULL TIME</span></div>
        : null
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { IconDoc, LaidOutScreen, LayoutEngine, Theme } from '@shared/lib/layout-engine';
import { SceneRenderer } from '../lib/framebuffer';
import {
  DeviceConnection,
  FrameParser,
  encodeFrame,
  frameToImageData,
  type Frame,
  type ParserEvent,
} from '../lib/serial';

interface Props {
  laid: LaidOutScreen;
  theme: Theme;
  icons: IconDoc;
  engine: LayoutEngine;
  onTap: (x: number, y: number) => void;
}

export default function DevicePanel({ laid, theme, icons, engine, onTap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const laidRef = useRef(laid);
  const connRef = useRef<DeviceConnection | null>(null);
  const mockTimer = useRef<number | null>(null);
  const mockParser = useRef(new FrameParser());
  const [mocking, setMocking] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [lastFrame, setLastFrame] = useState<{ w: number; h: number; at: number } | null>(null);
  const [frameCount, setFrameCount] = useState(0);

  laidRef.current = laid;

  const appendLog = (line: string) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 60));
  };

  const paint = (frame: Frame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = frame.width;
    canvas.height = frame.height;
    ctx.putImageData(frameToImageData(frame), 0, 0);
    setLastFrame({ w: frame.width, h: frame.height, at: Date.now() });
    setFrameCount((n) => n + 1);
  };

  const handleEvent = (event: ParserEvent) => {
    if (event.type === 'frame') {
      paint(event.frame);
    } else if (event.type === 'tap') {
      appendLog(`device tap ${event.tap.x},${event.tap.y}`);
    } else if (event.type === 'text') {
      appendLog(event.text);
    }
  };

  const stopMock = () => {
    if (mockTimer.current !== null) {
      window.clearInterval(mockTimer.current);
      mockTimer.current = null;
    }
    setMocking(false);
  };

  const startMock = () => {
    stopMock();
    mockParser.current = new FrameParser();
    setMocking(true);
    setStatus('connected');
    setError('');
    appendLog('mock link started (RLE565 frames)');
    mockTimer.current = window.setInterval(() => {
      const renderer = new SceneRenderer(theme, icons, engine);
      renderer.draw(laidRef.current);
      const bytes = encodeFrame(renderer.fb);
      for (const event of mockParser.current.push(bytes)) handleEvent(event);
    }, 500);
  };

  const connect = async () => {
    setStatus('connecting');
    setError('');
    try {
      const conn = new DeviceConnection();
      await conn.connect();
      connRef.current = conn;
      setStatus('connected');
      appendLog('serial connected');
      void conn
        .start(handleEvent)
        .catch((err) => {
          setStatus('error');
          setError(String(err));
          appendLog(`read error: ${String(err)}`);
        });
    } catch (err) {
      setStatus('error');
      setError(String(err));
      appendLog(`connect failed: ${String(err)}`);
    }
  };

  const disconnect = async () => {
    stopMock();
    if (connRef.current) {
      await connRef.current.disconnect();
      connRef.current = null;
      appendLog('serial disconnected');
    }
    setStatus('idle');
  };

  const tapMirror = async (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * canvas.height);
    onTap(x, y);
    appendLog(`host tap ${x},${y}`);
    if (connRef.current) await connRef.current.sendTap(x, y);
  };

  useEffect(() => {
    return () => {
      stopMock();
      void connRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!mocking) return;
    if (status !== 'connected') setStatus('connected');
  }, [mocking, status]);

  return (
    <div className="device-panel">
      <div className="device-actions">
        <button className="btn" disabled={!DeviceConnection.supported || status === 'connecting' || status === 'connected'} onClick={connect}>
          {status === 'connecting' ? 'Connecting...' : 'Connect serial'}
        </button>
        <button className="btn" disabled={status === 'idle' && !mocking} onClick={disconnect}>
          Disconnect
        </button>
        <button className={`btn ${mocking ? 'active' : ''}`} onClick={() => (mocking ? stopMock() : startMock())}>
          {mocking ? 'Stop mock' : 'Mock device'}
        </button>
      </div>

      {!DeviceConnection.supported && <p className="panel-note warn-text">Web Serial is unavailable. Use Chrome or Edge over HTTPS/localhost, or use the mock link.</p>}
      {error && <p className="panel-note error-text">{error}</p>}

      <div className="mirror-frame">
        <canvas ref={canvasRef} width={320} height={240} onClick={tapMirror} />
        {frameCount === 0 && (
          <div className="mirror-empty">
            <span>NO FRAME</span>
            <small>Connect the board or start the mock link</small>
          </div>
        )}
      </div>

      <div className="mirror-stats">
        <span className={`status-dot ${status === 'connected' ? 'ok' : status === 'error' ? 'bad' : 'idle'}`} />
        <strong>{status.toUpperCase()}</strong>
        <span className="mono">{frameCount} frames</span>
        <span className="mono">{lastFrame ? `${lastFrame.w}x${lastFrame.h}` : '--x--'}</span>
      </div>

      <div className="protocol-card">
        <div className="eyebrow">Mirror protocol</div>
        <code>MLF1</code> frame + w/h + RLE565 pairs
        <br />
        <code>MLT1</code> tap + x/y from host
        <p>Tap the mirror to inject a touch at device coordinates. Mock mode runs the exact frame parser the board will use.</p>
      </div>

      <div className="log-console">
        {log.length === 0 ? <span className="dim">No device events yet.</span> : log.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}

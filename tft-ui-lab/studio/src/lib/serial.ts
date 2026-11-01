import type { Framebuffer } from './framebuffer';

const FRAME_MAGIC = [0x4d, 0x4c, 0x46, 0x31]; // MLF1
const TAP_MAGIC = [0x4d, 0x4c, 0x54, 0x31]; // MLT1

export interface Frame {
  width: number;
  height: number;
  pixels: Uint16Array;
}

export interface Tap {
  x: number;
  y: number;
}

export type ParserEvent =
  | { type: 'frame'; frame: Frame }
  | { type: 'tap'; tap: Tap }
  | { type: 'text'; text: string };

function magicAt(buf: Uint8Array, at: number, magic: number[]) {
  if (at + magic.length > buf.length) return false;
  for (let i = 0; i < magic.length; i++) if (buf[at + i] !== magic[i]) return false;
  return true;
}

export class FrameParser {
  private buf = new Uint8Array(0);
  private text = '';

  push(chunk: Uint8Array): ParserEvent[] {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    this.buf = merged;
    return this.drain();
  }

  private drain(): ParserEvent[] {
    const out: ParserEvent[] = [];
    for (;;) {
      if (this.buf.length < 4) break;
      if (magicAt(this.buf, 0, FRAME_MAGIC)) {
        if (this.buf.length < 8) break;
        const width = this.buf[4] | (this.buf[5] << 8);
        const height = this.buf[6] | (this.buf[7] << 8);
        const total = width * height;
        if (!width || !height || total > 320 * 240 * 4) {
          // Bad header: drop one byte and resync.
          this.buf = this.buf.slice(1);
          continue;
        }
        const pixels = new Uint16Array(total);
        let pos = 8;
        let count = 0;
        let complete = true;
        while (count < total) {
          if (pos + 3 > this.buf.length) {
            complete = false;
            break;
          }
          const run = this.buf[pos];
          const value = this.buf[pos + 1] | (this.buf[pos + 2] << 8);
          pos += 3;
          if (run === 0) {
            complete = false;
            break;
          }
          const end = Math.min(total, count + run);
          pixels.fill(value, count, end);
          count = end;
        }
        if (!complete) break;
        out.push({ type: 'frame', frame: { width, height, pixels } });
        this.buf = this.buf.slice(pos);
        continue;
      }
      if (magicAt(this.buf, 0, TAP_MAGIC)) {
        if (this.buf.length < 8) break;
        const x = this.buf[4] | (this.buf[5] << 8);
        const y = this.buf[6] | (this.buf[7] << 8);
        out.push({ type: 'tap', tap: { x, y } });
        this.buf = this.buf.slice(8);
        continue;
      }
      // Unframed text: emit complete lines, then resync at the next magic.
      const next = this.findMagic();
      if (next < 0) {
        const keep = Math.min(this.buf.length, 3);
        const textPart = this.buf.slice(0, this.buf.length - keep);
        if (textPart.length) this.emitText(textPart, out);
        this.buf = this.buf.slice(this.buf.length - keep);
        break;
      }
      if (next > 0) {
        this.emitText(this.buf.slice(0, next), out);
        this.buf = this.buf.slice(next);
      }
    }
    return out;
  }

  private findMagic(): number {
    for (let i = 1; i < this.buf.length; i++) {
      if (magicAt(this.buf, i, FRAME_MAGIC) || magicAt(this.buf, i, TAP_MAGIC)) return i;
    }
    return -1;
  }

  private emitText(bytes: Uint8Array, out: ParserEvent[]) {
    this.text += new TextDecoder().decode(bytes);
    const lines = this.text.split(/\r?\n/);
    this.text = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) out.push({ type: 'text', text: line });
    }
  }
}

export function frameToImageData(frame: Frame): ImageData {
  const data = new Uint8ClampedArray(frame.width * frame.height * 4);
  for (let i = 0; i < frame.pixels.length; i++) {
    const c = frame.pixels[i];
    data[i * 4] = ((c >> 11) & 31) * 255 / 31;
    data[i * 4 + 1] = ((c >> 5) & 63) * 255 / 63;
    data[i * 4 + 2] = (c & 31) * 255 / 31;
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, frame.width, frame.height);
}

export function encodeFrame(fb: Framebuffer): Uint8Array {
  const out: number[] = [...FRAME_MAGIC, fb.width & 255, fb.width >> 8, fb.height & 255, fb.height >> 8];
  const px = fb.pixels;
  let i = 0;
  while (i < px.length) {
    const value = px[i];
    let run = 1;
    while (i + run < px.length && px[i + run] === value && run < 255) run++;
    out.push(run, value & 255, value >> 8);
    i += run;
  }
  return new Uint8Array(out);
}

export function encodeTap(x: number, y: number): Uint8Array {
  return new Uint8Array([...TAP_MAGIC, x & 255, x >> 8, y & 255, y >> 8]);
}

export type LinkStatus = 'idle' | 'connecting' | 'connected' | 'error';

export class DeviceConnection {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private parser = new FrameParser();
  private closed = false;
  status: LinkStatus = 'idle';

  static get supported() {
    return typeof navigator !== 'undefined' && !!navigator.serial;
  }

  async connect(baudRate = 921600) {
    if (!navigator.serial) throw new Error('Web Serial is not available in this browser');
    this.status = 'connecting';
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate });
    this.closed = false;
    this.status = 'connected';
    if (this.port.writable) {
      this.writer = this.port.writable.getWriter();
    }
    return this.port.getInfo();
  }

  async start(onEvent: (event: ParserEvent) => void) {
    if (!this.port?.readable) throw new Error('Serial port is not readable');
    this.reader = this.port.readable.getReader();
    const decoder = new TextDecoder();
    try {
      while (!this.closed) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          for (const event of this.parser.push(value)) onEvent(event);
          void decoder;
        }
      }
    } catch (err) {
      if (!this.closed) throw err;
    } finally {
      this.reader.releaseLock();
      this.reader = null;
    }
  }

  async sendTap(x: number, y: number) {
    if (!this.writer) return false;
    await this.writer.write(encodeTap(Math.round(x), Math.round(y)));
    return true;
  }

  async disconnect() {
    this.closed = true;
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    try {
      this.writer?.releaseLock();
    } catch {
      /* ignore */
    }
    this.writer = null;
    try {
      await this.port?.close();
    } catch {
      /* ignore */
    }
    this.port = null;
    this.status = 'idle';
  }
}

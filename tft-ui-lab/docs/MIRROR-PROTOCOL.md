# Device mirror protocol (`MLF1` / `MLT1`)

The **Device** tab in the studio can show what a real panel is displaying, not a
re-render of the layout. Any device that streams the RGB565 framebuffer it
pushed to its display over a serial port can use this protocol; the studio
decodes it and draws the exact pixels.

Transport: USB CDC or a UART bridge. All multi-byte integers are
**little-endian**. The baud rate is whatever the transport needs (USB CDC
ignores it).

## Device → host: frame (`MLF1`)

```
offset  size  field
0       4     ASCII "MLF1"
4       2     width  (uint16 LE)   = 320
6       2     height (uint16 LE)   = 240
8       ...   RLE records until width*height pixels have been produced
```

Each RLE record:

```
size  field
1     run    (uint8, 1..255; 0 is invalid)
2     color  (uint16 LE RGB565)
```

There is no frame length, checksum or CRC. A frame is complete when exactly
`width * height` pixels have been emitted. The host parser is stateful and
resumes at the next `MLF1`/`MLT1` magic after a truncated frame.

Example pixels `[0x1234, 0x1234, 0xF800]`:

```
34 12 02  00 F8 01      # run=2 color=0x1234, run=1 color=0xF800
```

Worst case is 3 bytes/pixel (~230 KB for 320x240). A flat, instrument-panel
style UI usually compresses to 10–40 KB/frame. Throttle to a few frames per
second: the studio only needs enough to stay current.

## Host → device: tap (`MLT1`)

```
offset  size  field
0       4     ASCII "MLT1"
4       2     x (uint16 LE)
6       2     y (uint16 LE)
```

The device should inject the tap into the same hit-testing path as its touch
panel. Taps outside the display bounds are invalid. There is no acknowledgement;
a changed frame is the feedback.

## Text log lines

Any bytes that are **not** inside an `MLF1`/`MLT1` frame are UTF-8 text. Lines
are newline-terminated (`\n`, optional `\r`). The studio accumulates partial
text between frames and only logs complete lines.

```
UI LAB 0.1.0 READY
320x240 RGB565 | 40 MHz SPI
run: start suite=2 passes=2
run: PASS in 4512 ms | 0 errors
```

Text has no reserved magic prefix, so avoid emitting a literal `MLF1` or
`MLT1` at the start of a log line.

## References

- Parser/encoder: `studio/src/lib/serial.ts` (`FrameParser`, `encodeFrame`)
- Device panel: `studio/src/components/DevicePanel.tsx`

## Flow control

- Send a frame only when the host is connected; drop frames rather than
  blocking the render loop.
- Keep two buffers so encoding a frame never stalls the UI thread; drop a new
  frame when both are busy.
- The channel is one-way for pixels and accepts taps only: no commands, no
  firmware update.

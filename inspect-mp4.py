#!/usr/bin/env python3
"""
내보낸 mp4가 실제로 어떤 값인지 본다.

App Store Connect가 "파일 크기가 유효하지 않습니다" 라고 할 때,
그 '크기'가 용량인지 해상도인지 알 수 없어서 직접 확인해야 한다.

    python3 inspect-mp4.py 파일.mp4
"""
import struct
import sys
from pathlib import Path


def walk(buf, start, end, out):
    i = start
    while i + 8 <= end:
        size = struct.unpack(">I", buf[i:i + 4])[0]
        typ = buf[i + 4:i + 8].decode("latin-1", "replace")
        if size == 0:
            size = end - i
        if size == 1:
            size = struct.unpack(">Q", buf[i + 8:i + 16])[0]
        if size < 8:
            break

        if typ == "mvhd":
            ver = buf[i + 8]
            off = i + 12 + (16 if ver == 1 else 8)
            if ver == 0:
                ts, dur = struct.unpack(">II", buf[off:off + 8])
            else:
                ts, dur = struct.unpack(">IQ", buf[off:off + 12])
            out["duration"] = dur / ts if ts else 0

        if typ == "tkhd":
            w, h = struct.unpack(">II", buf[i + size - 8:i + size])
            w, h = w >> 16, h >> 16
            if w and h:
                out["tracks"].append(("video", w, h))

        if typ == "hdlr":
            kind = buf[i + 16:i + 20].decode("latin-1", "replace")
            if kind == "soun":
                out["audio"] = True

        if typ in ("avc1", "mp4a", "hev1", "hvc1"):
            out["codecs"].add(typ)

        if typ in ("moov", "trak", "mdia", "minf", "stbl", "stsd", "edts"):
            inner = i + 8
            if typ == "stsd":
                inner = i + 16
            walk(buf, inner, i + size, out)

        i += size


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    path = Path(sys.argv[1]).expanduser()
    if not path.exists():
        sys.exit(f"파일이 없습니다: {path}")

    data = path.read_bytes()
    out = {"tracks": [], "codecs": set(), "audio": False, "duration": 0}
    walk(data, 0, len(data), out)

    mb = path.stat().st_size / 1_000_000
    print(f"파일     {path.name}")
    print(f"용량     {mb:.1f} MB")
    print(f"길이     {out['duration']:.1f}초")
    print(f"코덱     {', '.join(sorted(out['codecs'])) or '알 수 없음'}")
    print(f"소리     {'있음' if out['audio'] else '없음'}")

    for _, w, h in out["tracks"]:
        print(f"해상도   {w} x {h}")

    if mb > 500:
        print("\n⚠ 앱 미리보기 상한인 500MB를 넘었습니다.")


if __name__ == "__main__":
    main()

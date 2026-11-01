'use strict';

// When a JPEG photo was taken: EXIF DateTimeOriginal, with OffsetTimeOriginal when the camera
// wrote one (phones do). Used for photos that arrive over WebDAV, e.g. from PhotoSync.
// The browser does the same for uploads it sends (public/js/kit.js).

function takenFromJpeg(buf) {
    try {
        if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;
        for (let o = 2; o < buf.length - 10; ) {
            const marker = buf.readUInt16BE(o);
            const len = buf.readUInt16BE(o + 2);
            if (marker === 0xffe1 && buf.toString('latin1', o + 4, o + 8) === 'Exif') {
                const t = o + 10;
                const le = buf.readUInt16BE(t) === 0x4949;
                const u16 = p => (le ? buf.readUInt16LE(t + p) : buf.readUInt16BE(t + p));
                const u32 = p => (le ? buf.readUInt32LE(t + p) : buf.readUInt32BE(t + p));
                const find = (ifd, tag) => {
                    for (let i = 0, n = u16(ifd); i < n; i++) if (u16(ifd + 2 + i * 12) === tag) return ifd + 2 + i * 12;
                    return null;
                };
                const ascii = (entry, n) => buf.toString('latin1', t + u32(entry + 8), t + u32(entry + 8) + n);
                const exif = find(u32(4), 0x8769);
                if (!exif) return null;
                const ifd = u32(exif + 8);
                const at = find(ifd, 0x9003);
                if (!at) return null;
                const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)$/.exec(ascii(at, 19));
                if (!m) return null;
                const off = find(ifd, 0x9011); // "+02:00"
                const zone = off && /^[+-]\d\d:\d\d$/.test(ascii(off, 6)) ? ascii(off, 6) : 'Z';
                const time = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${zone}`);
                return Number.isFinite(time) ? time : null;
            }
            if ((marker & 0xff00) !== 0xff00) break;
            o += 2 + len;
        }
    } catch {
        // not readable: the upload time is used instead
    }
    return null;
}

module.exports = { takenFromJpeg };

const express = require('express');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_CHARS = 4000;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/tts', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }
  if (text.length > MAX_CHARS) {
    return res.status(400).json({ error: `Text must be ${MAX_CHARS} characters or fewer.` });
  }

  const outputPath = path.join(os.tmpdir(), `tts-${randomUUID()}.wav`);
  const espeak = spawn('espeak-ng', ['-w', outputPath, '--stdin']);

  let stderr = '';
  espeak.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  espeak.on('error', (err) => {
    console.error('Failed to start espeak-ng:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Speech engine is unavailable.' });
    }
  });

  espeak.on('close', (code) => {
    if (code !== 0) {
      console.error('espeak-ng exited with code', code, stderr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate speech.' });
      }
      fs.unlink(outputPath, () => {});
      return;
    }

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', 'inline; filename="speech.wav"');

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on('close', () => {
      fs.unlink(outputPath, () => {});
    });
    stream.on('error', () => {
      fs.unlink(outputPath, () => {});
    });
  });

  espeak.stdin.write(text);
  espeak.stdin.end();
});

app.listen(PORT, () => {
  console.log(`TTS modal listening on port ${PORT}`);
});

const express = require('express');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_CHARS = 4000;

const PIPER_BIN = process.env.PIPER_BIN || path.join(__dirname, 'piper', 'piper');
const ESPEAK_DATA = process.env.PIPER_ESPEAK_DATA || path.join(__dirname, 'piper', 'espeak-ng-data');
const VOICES_DIR = process.env.PIPER_VOICES_DIR || path.join(__dirname, 'voices');

const VOICES = [
  { id: 'en_US-lessac-medium', label: 'Lessac — US, warm male' },
  { id: 'en_US-amy-medium', label: 'Amy — US, female' },
  { id: 'en_US-ryan-medium', label: 'Ryan — US, male' },
  { id: 'en_US-kristin-medium', label: 'Kristin — US, female' },
  { id: 'en_GB-alan-medium', label: 'Alan — UK, male' },
  { id: 'en_GB-jenny_dioco-medium', label: 'Jenny — UK, female' },
];
const VOICE_IDS = new Set(VOICES.map((v) => v.id));
const DEFAULT_VOICE = VOICES[0].id;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/voices', (req, res) => {
  res.json(VOICES.map(({ id, label }) => ({ id, label })));
});

app.post('/api/tts', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const voice = VOICE_IDS.has(req.body?.voice) ? req.body.voice : DEFAULT_VOICE;

  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }
  if (text.length > MAX_CHARS) {
    return res.status(400).json({ error: `Text must be ${MAX_CHARS} characters or fewer.` });
  }

  const modelPath = path.join(VOICES_DIR, `${voice}.onnx`);
  const configPath = path.join(VOICES_DIR, `${voice}.onnx.json`);
  const outputPath = path.join(os.tmpdir(), `tts-${randomUUID()}.wav`);

  const piper = spawn(PIPER_BIN, [
    '-m', modelPath,
    '-c', configPath,
    '-f', outputPath,
    '--espeak_data', ESPEAK_DATA,
  ]);

  let stderr = '';
  piper.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  piper.on('error', (err) => {
    console.error('Failed to start piper:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Speech engine is unavailable.' });
    }
  });

  piper.on('close', (code) => {
    if (code !== 0) {
      console.error('piper exited with code', code, stderr);
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

  piper.stdin.write(text);
  piper.stdin.end();
});

app.listen(PORT, () => {
  console.log(`TTS modal listening on port ${PORT}`);
});

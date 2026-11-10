const MIMES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4',
  'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
];

export function recorderSupported() {
  return typeof MediaRecorder !== 'undefined' && MIMES.some((t) => MediaRecorder.isTypeSupported(t));
}

// Records a canvas + the audio engine's mix. Returns { stop() -> Promise<{blob,url,ext}> }.
export function startRecording(canvas, audioStream, fps = 30) {
  const mime = MIMES.find((t) => MediaRecorder.isTypeSupported(t));
  const stream = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...audioStream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const parts = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  const finished = new Promise((resolve) => {
    rec.onstop = () => {
      const type = rec.mimeType.split(';')[0];
      const blob = new Blob(parts, { type });
      resolve({ blob, url: URL.createObjectURL(blob), ext: type.includes('mp4') ? 'mp4' : 'webm' });
    };
  });
  rec.start(250);
  return { stop: () => { if (rec.state !== 'inactive') rec.stop(); return finished; } };
}

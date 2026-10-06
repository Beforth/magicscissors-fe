export function captureWatermarkedPhoto(video, { latitude, longitude, accuracy }) {
  const maxW = 640
  const scale = Math.min(1, maxW / (video.videoWidth || maxW))
  const w = Math.round((video.videoWidth || maxW) * scale)
  const h = Math.round((video.videoHeight || 480) * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, w, h)

  const stamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
  const lines = [
    stamp + ' IST',
    `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy)} m)`,
  ]
  ctx.font = '14px sans-serif'
  const barH = lines.length * 20 + 10
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, h - barH, w, barH)
  ctx.fillStyle = '#fff'
  lines.forEach((t, i) => ctx.fillText(t, 8, h - barH + 22 + i * 20))

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not capture photo'))), 'image/jpeg', 0.7)
  )
}

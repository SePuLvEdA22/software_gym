import { useEffect, useRef, useState } from 'react'
import { Icons } from './Icons'

interface CameraCaptureProps {
  onCapture: (base64: string) => void
  onClose: () => void
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Permiso de cámara denegado. Verifica que la cámara no esté siendo usada por otra aplicación y concede el permiso cuando el sistema lo solicite.')
      } else if (err.name === 'NotFoundError') {
        setError('No se detectó ninguna cámara en el equipo.')
      } else {
        setError('Error al acceder a la cámara: ' + err.message)
      }
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
    setCaptured(base64)
    stopCamera()
  }

  const retake = () => {
    setCaptured(null)
    startCamera()
  }

  const accept = () => {
    if (captured) {
      onCapture(captured)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">Tomar Foto</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>
        <div className="modal-body">
          {error ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 48, color: 'var(--color-error)', marginBottom: 16 }}>
                <Icons.X />
              </div>
              <p style={{ color: 'var(--color-error)', marginBottom: 16 }}>{error}</p>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          ) : captured ? (
            <div style={{ textAlign: 'center' }}>
              <div className="camera-preview">
                <img
                  src={`data:image/jpeg;base64,${captured}`}
                  alt="Foto capturada"
                  className="camera-captured-img"
                />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={retake}>
                  <Icons.Refresh /> Volver a Tomar
                </button>
                <button type="button" className="btn btn-primary" onClick={accept}>
                  <Icons.Check /> Usar Foto
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div className="camera-preview">
                <video ref={videoRef} autoPlay playsInline className="camera-video" />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 8 }}>
                Asegúrate de que el rostro esté bien iluminado y centrado
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={capture}
                style={{ marginTop: 12 }}
              >
                <Icons.Camera /> Tomar Foto
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

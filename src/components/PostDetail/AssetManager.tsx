import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { PostAsset } from '../../types'
import { Upload, Video, Image as ImageIcon, ExternalLink, AlertCircle, X, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import './AssetManager.css'

interface AssetManagerProps {
  assets: PostAsset[]
  videoUrl: string | null
  isTeam: boolean
  postId: string
  onUpdateAssets: (assets: PostAsset[]) => void
  onUpdateVideo: (url: string | null) => void
}

export default function AssetManager({ assets, videoUrl, isTeam, postId, onUpdateAssets, onUpdateVideo }: AssetManagerProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [videoMode, setVideoMode] = useState(!!videoUrl && assets.length === 0)
  const [videoInput, setVideoInput] = useState(videoUrl ?? '')
  const [videoError, setVideoError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Keep activeIndex in bounds when assets change
  const safeIndex = Math.min(activeIndex, Math.max(0, assets.length - 1))

  async function uploadFiles(files: FileList | File[]) {
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!fileArr.length) return

    setUploading(true)
    setTotalCount(fileArr.length)
    setUploadCount(0)

    const newAssets: PostAsset[] = []
    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i]
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `posts/${postId}/${Date.now()}-${i}.${ext}`
      const { error } = await supabase.storage.from('post-assets').upload(path, file, { upsert: true })
      
      if (error) {
        console.error('Upload error:', error)
        alert(`Failed to upload ${file.name}: ${error.message}`)
      } else {
        const { data: { publicUrl } } = supabase.storage.from('post-assets').getPublicUrl(path)
        const type: 'image' | 'gif' = file.type === 'image/gif' ? 'gif' : 'image'
        newAssets.push({ url: publicUrl, type })
      }
      setUploadCount(i + 1)
    }

    const updated = [...assets, ...newAssets]
    onUpdateAssets(updated)
    setActiveIndex(updated.length - newAssets.length) // jump to first new asset
    setUploading(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files)
    e.target.value = '' // reset so same files can be selected again
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
  }

  function removeAsset(index: number) {
    const updated = assets.filter((_, i) => i !== index)
    onUpdateAssets(updated)
    setActiveIndex(Math.min(safeIndex, Math.max(0, updated.length - 1)))
  }

  function applyVideoLink() {
    const streamUrl = videoInput.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1')
    onUpdateVideo(streamUrl.trim() || null)
  }

  const current = assets[safeIndex]

  return (
    <div className="asset-manager">
      {/* Mode toggle */}
      {isTeam && (
        <div className="asset-mode-toggle">
          <button
            className={`btn btn-sm ${!videoMode ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setVideoMode(false)}
          >
            <ImageIcon size={13} /> Images / GIF
          </button>
          <button
            className={`btn btn-sm ${videoMode ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setVideoMode(true)}
          >
            <Video size={13} /> MP4 / Video
          </button>
        </div>
      )}

      {/* ── Image carousel mode ── */}
      {!videoMode && (
        <>
          {/* Main viewer */}
          {assets.length > 0 ? (
            <div className="asset-carousel">
              {/* Main image */}
              <div className="carousel-viewer">
                <img
                  src={current.url}
                  alt={`Asset ${safeIndex + 1}`}
                  className="carousel-img"
                />
                {isTeam && (
                  <button
                    className="carousel-remove-btn"
                    onClick={() => removeAsset(safeIndex)}
                    title="Remove this image"
                  >
                    <X size={14} />
                  </button>
                )}
                {/* Prev / Next arrows */}
                {assets.length > 1 && (
                  <>
                    <button
                      className="carousel-nav carousel-nav-prev"
                      onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                      disabled={safeIndex === 0}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      className="carousel-nav carousel-nav-next"
                      onClick={() => setActiveIndex(i => Math.min(assets.length - 1, i + 1))}
                      disabled={safeIndex === assets.length - 1}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
              </div>

              {/* Dot indicators */}
              {assets.length > 1 && (
                <div className="carousel-dots">
                  {assets.map((_, i) => (
                    <button
                      key={i}
                      className={`carousel-dot ${i === safeIndex ? 'active' : ''}`}
                      onClick={() => setActiveIndex(i)}
                    />
                  ))}
                </div>
              )}

              {/* Thumbnail strip + add button */}
              <div className="carousel-thumbs">
                {assets.map((a, i) => (
                  <button
                    key={i}
                    className={`carousel-thumb ${i === safeIndex ? 'active' : ''}`}
                    onClick={() => setActiveIndex(i)}
                  >
                    <img src={a.url} alt={`Thumb ${i + 1}`} />
                  </button>
                ))}
                {isTeam && (
                  <button
                    className="carousel-thumb carousel-thumb-add"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title="Add more images"
                  >
                    {uploading ? (
                      <span className="upload-progress-tiny">{uploadCount}/{totalCount}</span>
                    ) : (
                      <Plus size={16} />
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Empty drop zone */
            isTeam ? (
              <div
                className="upload-drop-zone"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={24} strokeWidth={1.5} />
                {uploading ? (
                  <p>Uploading {uploadCount} of {totalCount}…</p>
                ) : (
                  <>
                    <p>Drop images here, or click to browse</p>
                    <p className="upload-hint">Select multiple files for a carousel · JPG, PNG, GIF · max 20MB each</p>
                  </>
                )}
              </div>
            ) : (
              <p className="no-asset-placeholder">No images uploaded yet.</p>
            )
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </>
      )}

      {/* ── Video link mode ── */}
      {videoMode && (
        <div className="video-section">
          {isTeam && (
            <div className="video-input-row">
              <input
                className="form-input"
                placeholder="Paste Dropbox MP4 link (dl=0 or raw=1)"
                value={videoInput}
                onChange={e => { setVideoInput(e.target.value); setVideoError(false) }}
              />
              <button className="btn btn-outlined btn-sm" onClick={applyVideoLink} disabled={!videoInput.trim()}>
                Apply
              </button>
            </div>
          )}
          {videoUrl && (
            <div className="video-player-wrapper">
              <video
                src={videoUrl}
                controls
                onError={() => setVideoError(true)}
                className="video-player"
                preload="metadata"
              />
              {videoError && (
                <div className="video-error">
                  <AlertCircle size={16} />
                  <span>Video failed to load. </span>
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="video-fallback-link">
                    Open original link <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

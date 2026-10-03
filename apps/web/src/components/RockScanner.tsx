"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Info, Mountain, Plus, X } from "lucide-react";
export default function RockScanner() {
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]),
    [error, setError] = useState(""),
    [texture, setTexture] = useState(""),
    [luster, setLuster] = useState("");
  const photoUrls = useRef<string[]>([]);
  useEffect(() => {
    photoUrls.current = [
      ...new Set([...photoUrls.current, ...photos.map((p) => p.url)]),
    ];
  }, [photos]);
  useEffect(
    () => () => {
      photoUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  function upload(files: FileList | null) {
    if (!files) return;
    const accepted = [...files].filter(
      (f) =>
        ["image/jpeg", "image/png", "image/webp"].includes(f.type) &&
        f.size <= 10 * 1024 * 1024,
    );
    if (accepted.length !== files.length)
      setError("Use JPEG, PNG or WebP photos smaller than 10 MB.");
    else setError("");
    setPhotos((old) =>
      [
        ...old,
        ...accepted
          .slice(0, Math.max(0, 3 - old.length))
          .map((f) => ({ url: URL.createObjectURL(f), name: f.name })),
      ].slice(0, 3),
    );
  }
  return (
    <section className="page-section">
      <div className="eyebrow">A CLOSER LOOK</div>
      <h1>Every rock has a story.</h1>
      <p className="page-intro">
        Start with what you can see. Record the details that help a geologist
        understand your sample.
      </p>
      <div className="scanner-grid">
        <article className="card">
          <div className="card-title">
            <h2>Identify a rock</h2>
            <span className="badge neutral">Photo workspace</span>
          </div>
          <p>
            Photograph 2–3 angles in natural light. Include a ruler or another
            scale reference.
          </p>
          <label className="upload-zone">
            <span className="camera-disc">
              <Camera size={36} />
            </span>
            <h3>A new perspective on your sample</h3>
            <p>Drop in the details, one angle at a time.</p>
            <span className="secondary">
              <ImagePlus size={17} />
              Choose photos
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => upload(e.target.files)}
            />
            <small>JPG, PNG, WebP · Up to 10 MB each · 3 photos</small>
          </label>
          {photos.length > 0 && (
            <div className="photo-grid">
              {photos.map((p, i) => (
                <div key={p.url}>
                  <img src={p.url} alt={`Rock angle ${i + 1}`} />
                  <button
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setPhotos(photos.filter((_, j) => i !== j))}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="notice">
            <Info size={18} />
            <span>
              Photo identification is not connected yet. Photos stay in this
              browser view and are not uploaded or saved. No mineral
              identification has been made.
            </span>
          </div>
        </article>
        <div className="stack">
          <article className="card">
            <span className="mini-icon">
              <Mountain size={21} />
            </span>
            <h3>Observe before you interpret</h3>
            <div className="form-stack">
              <label>
                Visible texture
                <select
                  value={texture}
                  onChange={(e) => setTexture(e.target.value)}
                >
                  <option value="">Choose a texture</option>
                  <option>Coarse grains</option>
                  <option>Fine grains</option>
                  <option>Glassy</option>
                  <option>Layered or banded</option>
                  <option>Not sure</option>
                </select>
              </label>
              <label>
                Surface appearance
                <select
                  value={luster}
                  onChange={(e) => setLuster(e.target.value)}
                >
                  <option value="">Choose an appearance</option>
                  <option>Metallic</option>
                  <option>Glassy</option>
                  <option>Dull or earthy</option>
                  <option>Pearly</option>
                  <option>Not sure</option>
                </select>
              </label>
            </div>
            {(texture || luster) && (
              <p className="observation-summary">
                <strong>Your observations</strong>
                <br />
                {[texture, luster].filter(Boolean).join(" · ")}
                <br />
                <small>These traits alone cannot confirm a mineral.</small>
              </p>
            )}
          </article>
          <article className="dark-card">
            <Plus size={23} />
            <h3>A photograph is a starting point.</h3>
            <p>
              Composition and valuable metal content require appropriate
              laboratory testing. A camera cannot detect buried minerals.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

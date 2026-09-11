import React, { useRef, useState } from "react";
import Icon from "./icons";
export default function PhotoDropzone({ onUpload, busy }) {
  const input = useRef(null),
    [dragging, setDragging] = useState(false);
  return (
    <div
      className={`photo-dropzone ${dragging ? "is-dragging" : ""}`}
      aria-busy={busy}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy && e.dataTransfer.files[0]) onUpload(e.dataTransfer.files[0]);
      }}
    >
      <Icon name="upload" size={32} />
      <strong>{busy ? "Uploading photo…" : "Drag your photo here"}</strong>
      <span>or choose a file from your device</span>
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Icon name="plus" />
        {busy ? "Uploading…" : "Choose photo"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        disabled={busy}
        aria-label="Choose photo file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUpload(file);
        }}
      />
      <small>
        JPG, PNG or WebP · up to 8 MB
        <br />
        Automatically resized and compressed to WebP.
      </small>
    </div>
  );
}

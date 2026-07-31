"use client";

import { useEffect, useState } from "react";

export default function PrintToolbar({ withPhotos }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Track photo loading so we can tell the user when the preview is complete.
    // Printing is never triggered automatically — the user decides when.
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go);
    const fallback = setTimeout(go, 4000);
    return () => {
      window.removeEventListener("load", go);
      clearTimeout(fallback);
    };
  }, []);

  const switchTo = (foto) => {
    const u = new URL(window.location.href);
    u.searchParams.set("foto", foto);
    window.location.href = u.toString();
  };

  return (
    <div className="no-print" style={bar}>
      <span style={{ fontSize: 13, color: "#57534e" }}>
        {ready ? "Dokument gotowy." : "Wczytywanie zdjęć…"}
      </span>

      <div style={seg}>
        <button onClick={() => switchTo("1")} style={withPhotos ? segOn : segOff}>
          Ze zdjęciami
        </button>
        <button onClick={() => switchTo("0")} style={!withPhotos ? segOn : segOff}>
          Bez zdjęć
        </button>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button onClick={() => window.print()} style={primary}>
          Drukuj / Zapisz PDF
        </button>
        <button onClick={() => window.close()} style={secondary}>
          Zamknij
        </button>
      </div>
    </div>
  );
}

const bar = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "10px 18px",
  borderBottom: "1px solid #e7e5e4",
  background: "#fafaf9",
  fontFamily: "system-ui, sans-serif",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const seg = {
  display: "flex",
  background: "#e7e5e4",
  borderRadius: 10,
  padding: 3,
  gap: 3,
};

const segBase = {
  border: "none",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

const segOn = { ...segBase, background: "#fff", color: "#0f766e", boxShadow: "0 1px 2px rgba(0,0,0,.12)" };
const segOff = { ...segBase, background: "transparent", color: "#57534e" };

const primary = {
  background: "#0d9488",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondary = {
  background: "#fff",
  color: "#44403c",
  border: "1px solid #d6d3d1",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

import { useState, useEffect } from "react";

const VERSION = "2.1.0";

export default function LoadingScreen({ status, isLoaded }) {
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setFadeOut(true);
      const t = setTimeout(() => setHidden(true), 800);
      return () => clearTimeout(t);
    }
  }, [isLoaded]);

  if (hidden) 
    return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#050d1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.8s ease",
        pointerEvents: fadeOut ? "none" : "all",
      }}
    >
      <Stars />
      <div style={{ position: "relative", marginBottom: "40px" }}>
        <PulseRings />
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #1a4a7a, #0a1e3a 60%, #050d1a)",
            border: "1.5px solid rgba(0,207,255,0.4)",
            boxShadow: "0 0 0 1px rgba(0,207,255,0.15)",
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "110%",
              height: "1px",
              background: "rgba(0,207,255,0.2)",
              transform: "rotate(-30deg)",
            }}
          />
          <OrbitingDot />
        </div>
      </div>
      <div
        style={{
          fontFamily: "'Share Tech', 'Courier New', monospace",
          fontSize: "20px",
          textTransform: "uppercase",
          letterSpacing: "6px",
          color: "rgba(0,207,255,0.6)",
          marginBottom: "8px",
        }}
      >
        Satmon: Orbital Tracker
      </div>
      <div
        style={{
          fontFamily: "'Share Tech', 'Courier New', monospace",
          fontSize: "15px",
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.5px",
          minHeight: "20px",
          transition: "opacity 0.3s ease",
        }}
      >
      {status}
      </div>
      <div
        style={{
          marginTop: "5px",
          width: "200px",
          height: "1px",
          background: "rgba(0,207,255,0.1)",
          borderRadius: "1px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "rgba(0,207,255,0.5)",
            animation: "scanline 2s ease-in-out infinite",
          }}
        />
      </div>
      <div style={{
        marginTop: "16px",
        fontFamily: "'Share Tech', 'Courier New', monospace",
        fontSize: "13px",
        color: "hsla(0, 0%, 100%, 0.20)",
        letterSpacing: "2px",
        textTransform: "uppercase",
      }}>
        v{VERSION}
      </div>

      <style>{`
        @keyframes scanline {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(46px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(46px) rotate(-360deg); }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function OrbitingDot() {
  return (
    <div
      style={{
        position: "absolute",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "#00cfff",
        boxShadow: "0 0 4px rgba(0,207,255,0.8)",
        animation: "orbit 3s linear infinite",
        top: "50%",
        left: "50%",
        marginTop: "-3px",
        marginLeft: "-3px",
        transformOrigin: "3px 3px",
      }}
    />
  );
}

function PulseRings() {
  return (
    <>
      {[0, 0.8, 1.6].map((delay, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px solid rgba(0,207,255,0.3)",
            animation: `pulseRing 2.4s ease-out ${delay}s infinite`,
            zIndex: 1,
          }}
        />
      ))}
    </>
  );
}

const stars = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.5 + 0.5,
    opacity: Math.random() * 0.5 + 0.1,
}));


function Stars() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {stars.map((s) => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            borderRadius: "50%",
            background: "white",
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  );
}
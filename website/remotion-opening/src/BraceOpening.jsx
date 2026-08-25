import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

const points = Array.from({length: 36}, (_, index) => ({
  x: 8 + random(`x-${index}`) * 84,
  y: 9 + random(`y-${index}`) * 82,
  radius: index % 9 === 0 ? 4 : 1.5 + random(`r-${index}`) * 1.8,
  violet: index % 4 === 0,
}));

const links = points.slice(0, 25).map((point, index) => ({
  from: point,
  to: points[(index * 7 + 9) % points.length],
}));

const GlassCard = ({label, title, side, delay}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 18, 108, 128], [0, 0.9, 0.9, 0], {...clamp, easing: ease});
  const travel = interpolate(frame, [delay, delay + 22], [side === "left" ? -70 : 70, 0], {...clamp, easing: ease});
  return (
    <div style={{
      position: "absolute",
      top: side === "left" ? 218 : 492,
      left: side === "left" ? 118 : undefined,
      right: side === "right" ? 118 : undefined,
      width: 330,
      padding: "21px 23px",
      border: "1px solid rgba(198,220,255,.2)",
      borderRadius: 22,
      background: "linear-gradient(145deg,rgba(19,35,57,.76),rgba(8,16,29,.62))",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.14),0 28px 90px rgba(0,3,12,.55)",
      opacity,
      translate: `${travel}px 0`,
    }}>
      <div style={{fontSize: 11, letterSpacing: "0.16em", color: side === "left" ? "#c4b5fd" : "#7dd3fc", fontWeight: 750}}>{label}</div>
      <div style={{marginTop: 10, color: "#f5f8ff", fontSize: 22, fontWeight: 680, letterSpacing: "-0.025em"}}>{title}</div>
      <div style={{display: "flex", alignItems: "center", gap: 8, marginTop: 14, color: "#7f91aa", fontSize: 11}}><i style={{width: 6, height: 6, borderRadius: 99, background: "#6ee7b7", boxShadow: "0 0 16px #6ee7b7"}} /> VERIFIED LOCALLY</div>
    </div>
  );
};

export const BraceOpening = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  const networkIn = interpolate(frame, [0, 48], [0, 1], {...clamp, easing: ease});
  const networkOut = interpolate(frame, [112, 146], [1, 0.16], {...clamp, easing: ease});
  const logoScale = interpolate(frame, [18, 62], [0.62, 1], {...clamp, easing: Easing.out(Easing.back(1.2))});
  const logoOpacity = interpolate(frame, [12, 42], [0, 1], {...clamp, easing: ease});
  const titleOpacity = interpolate(frame, [48, 74, 126, 148], [0, 1, 1, 0], {...clamp, easing: ease});
  const titleY = interpolate(frame, [48, 78], [34, 0], {...clamp, easing: ease});
  const iris = interpolate(frame, [118, 149], [0, 100], {...clamp, easing: ease});

  return (
    <AbsoluteFill style={{overflow: "hidden", backgroundColor: "#05080f", color: "white", fontFamily: 'Inter, "SF Pro Display", "Segoe UI", sans-serif'}}>
      <AbsoluteFill style={{background: "radial-gradient(circle at 50% 46%,rgba(47,125,178,.2),transparent 27%),radial-gradient(circle at 32% 62%,rgba(105,74,174,.13),transparent 29%),linear-gradient(145deg,#05080f,#08111e 58%,#05080f)"}} />
      <div style={{position: "absolute", inset: 0, opacity: networkIn * networkOut}}>
        <svg width={width} height={height} style={{position: "absolute", inset: 0}}>
          {links.map((link, index) => (
            <line key={index} x1={`${link.from.x}%`} y1={`${link.from.y}%`} x2={`${link.to.x}%`} y2={`${link.to.y}%`} stroke={index % 3 ? "#7dd3fc" : "#c4b5fd"} strokeOpacity={0.055 + index % 4 * 0.012} strokeWidth="1" />
          ))}
        </svg>
        {points.map((point, index) => {
          const drift = interpolate(frame, [0, 150], [0, (index % 2 ? 1 : -1) * (4 + index % 5)]);
          return <i key={index} style={{position: "absolute", left: `${point.x}%`, top: `${point.y}%`, width: point.radius * 2, height: point.radius * 2, borderRadius: 99, background: point.violet ? "#c4b5fd" : "#7dd3fc", boxShadow: `0 0 ${point.radius * 5}px currentColor`, opacity: 0.34 + index % 3 * 0.1, translate: `0 ${drift}px`}} />;
        })}
      </div>

      {!portrait && <GlassCard label="SOURCE EVIDENCE" title="Architecture Decisions.md" side="left" delay={23} />}
      {!portrait && <GlassCard label="DURABLE MEMORY" title="Keep sources canonical" side="right" delay={32} />}

      {[380, 500, 628].map((size, index) => (
        <div key={size} style={{position: "absolute", left: "50%", top: portrait ? "40%" : "46%", width: portrait ? size * 1.05 : size, height: portrait ? size * 1.05 : size, border: `1px solid rgba(${index === 1 ? "196,181,253" : "125,211,252"},${0.12 - index * 0.018})`, borderRadius: "50%", opacity: logoOpacity * networkOut, translate: "-50% -50%", scale: interpolate(frame, [18 + index * 4, 90], [0.72, 1 + index * 0.03], {...clamp, easing: ease})}} />
      ))}

      <div style={{position: "absolute", left: "50%", top: portrait ? "38%" : "43%", width: portrait ? 230 : 190, height: portrait ? 230 : 190, opacity: logoOpacity, translate: "-50% -50%", scale: logoScale, filter: "drop-shadow(0 28px 55px rgba(56,189,248,.22))"}}>
        <Img src={staticFile("brace-logo.svg")} style={{width: "100%", height: "100%"}} />
      </div>

      <div style={{position: "absolute", left: portrait ? 48 : 0, right: portrait ? 48 : 0, top: portrait ? 900 : 535, textAlign: "center", opacity: titleOpacity, translate: `0 ${titleY}px`}}>
        <div style={{fontSize: 22, fontWeight: 780, letterSpacing: "0.42em", textIndent: "0.42em"}}>BRACE</div>
        <div style={{marginTop: portrait ? 28 : 18, fontSize: portrait ? 66 : 58, lineHeight: 0.98, fontWeight: 720, letterSpacing: "-0.055em"}}>One memory.{portrait && <br />} Every AI.</div>
        <div style={{margin: portrait ? "34px auto 0" : "20px auto 0", maxWidth: portrait ? 500 : undefined, color: "#94a6bd", fontSize: portrait ? 18 : 16, lineHeight: portrait ? 2 : 1, letterSpacing: "0.06em"}}>LOCAL BY DEFAULT <span style={{margin: "0 12px", color: "#40516a"}}>·</span> EVIDENCE ATTACHED <span style={{margin: "0 12px", color: "#40516a"}}>·</span> YOURS TO KEEP</div>
      </div>

      <div style={{position: "absolute", inset: 0, background: "#05080f", opacity: interpolate(frame, [0, 8], [1, 0], clamp)}} />
      <div style={{position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 50%,transparent 0,transparent 48%,rgba(2,4,9,.68) 100%)"}} />
      <div style={{position: "absolute", inset: 0, background: "#dff6ff", clipPath: `circle(${iris}% at 50% 46%)`, opacity: interpolate(frame, [132, 149], [0, 0.08], clamp), mixBlendMode: "screen"}} />
    </AbsoluteFill>
  );
};

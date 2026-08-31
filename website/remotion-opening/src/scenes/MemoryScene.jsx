import {Easing, Img, interpolate, staticFile, useCurrentFrame} from "remotion";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
const nodes = [{label: "FILES", x: 18, y: 68}, {label: "MEMORY", x: 50, y: 35}, {label: "EVERY AI", x: 82, y: 68}];

export const MemoryScene = ({portrait}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12, 72], [0, 1, 1], clamp);
  const spread = interpolate(frame, [0, 38], [0.3, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const logo = interpolate(frame, [12, 46], [0.72, 1], {...clamp, easing: Easing.out(Easing.back(1.08))});
  const positions = portrait ? [{label:"FILES",x:27,y:69},{label:"MEMORY",x:50,y:35},{label:"EVERY AI",x:73,y:69}] : nodes;
  return (
    <div style={{position: "absolute", inset: 0, opacity}}>
      <svg width="100%" height="100%" style={{position: "absolute", inset: 0, overflow: "visible"}}>
        {positions.filter((node) => node.label !== "MEMORY").map((node) => <line key={node.label} x1="50%" y1="48%" x2={`${50 + (node.x - 50) * spread}%`} y2={`${48 + (node.y - 48) * spread}%`} stroke="rgba(255,255,255,.74)" strokeWidth={portrait ? 2 : 1.5} strokeDasharray="6 12" />)}
      </svg>
      {positions.map((node, index) => {
        const x = 50 + (node.x - 50) * spread;
        const y = 48 + (node.y - 48) * spread;
        const central = index === 1;
        return <div key={node.label} style={{position: "absolute", left: `${x}%`, top: `${y}%`, width: central ? (portrait ? 190 : 205) : (portrait ? 150 : 180), aspectRatio: "1", borderRadius: central ? 54 : 999, transform: `translate(-50%,-50%) scale(${central ? logo : 0.84 + spread * 0.16})`, display: "grid", placeItems: "center", color: "#12396e", background: "linear-gradient(145deg,rgba(255,255,255,.88),rgba(230,245,255,.4))", border: "1px solid rgba(255,255,255,.95)", boxShadow: "inset 0 1px white,inset 0 -18px 38px rgba(61,131,225,.12),0 38px 100px rgba(25,77,157,.2)", backdropFilter: "blur(25px)"}}>
          {central ? <Img src={staticFile("brace-logo.svg")} style={{width: "72%", height: "72%", borderRadius: 42}} /> : <span style={{fontSize: portrait ? 16 : 15, fontWeight: 850, letterSpacing: ".16em", textAlign: "center"}}>{node.label}</span>}
        </div>;
      })}
    </div>
  );
};

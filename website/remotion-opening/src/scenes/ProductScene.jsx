import {Easing, Img, interpolate, staticFile, useCurrentFrame} from "remotion";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const ProductScene = ({portrait}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 30], [portrait ? 116 : 180, 0], {...clamp, easing: ease});
  const opacity = interpolate(frame, [0, 18, 78, 102], [0, 1, 1, 0], {...clamp, easing: ease});
  const rotate = interpolate(frame, [0, 38], [portrait ? -3 : -6, portrait ? 0 : -1], {...clamp, easing: ease});
  const clearX = interpolate(frame, [10, 76], [-25, 125], {...clamp, easing: ease});
  const cardWidth = portrait ? 612 : 1040;
  return (
    <div style={{position: "absolute", inset: 0, opacity}}>
      <div style={{position: "absolute", left: "50%", top: portrait ? "46%" : "50%", width: cardWidth, borderRadius: portrait ? 34 : 30, padding: portrait ? 12 : 14, transform: `translate(-50%,-50%) translateY(${enter}px) rotate(${rotate}deg)`, background: "linear-gradient(145deg,rgba(255,255,255,.82),rgba(226,243,255,.46))", border: "1px solid rgba(255,255,255,.94)", boxShadow: "inset 0 1px 1px white,inset 0 -22px 46px rgba(58,125,219,.14),0 70px 150px rgba(24,76,154,.28)", backdropFilter: "blur(28px)"}}>
        <div style={{height: portrait ? 46 : 38, display: "flex", alignItems: "center", gap: 9, padding: "0 12px"}}>
          {["#ffffff", "#dceeff", "#b7d7ff"].map((color) => <i key={color} style={{width: 9, height: 9, borderRadius: 99, background: color, boxShadow: "0 1px 4px rgba(33,84,153,.24)"}} />)}
          <span style={{marginLeft: 10, color: "rgba(16,48,96,.68)", fontSize: portrait ? 15 : 12, fontWeight: 800, letterSpacing: "0.14em"}}>BRACE / MEMORY SIGNAL</span>
        </div>
        <div style={{overflow: "hidden", borderRadius: portrait ? 25 : 21, aspectRatio: portrait ? "1.04" : "1.5", background: "#071021", position: "relative"}}>
          <Img src={staticFile("app-overview.png")} style={{width: "100%", height: "100%", objectFit: "cover", objectPosition: portrait ? "28% center" : "center"}} />
          <div style={{position: "absolute", inset: 0, left: `${clearX}%`, width: "34%", background: "linear-gradient(90deg,rgba(235,248,255,0),rgba(255,255,255,.55),rgba(235,248,255,0))", mixBlendMode: "screen", filter: "blur(18px)", transform: "skewX(-12deg)"}} />
        </div>
      </div>
      {!portrait && <div style={{position: "absolute", right: 88, top: 98, width: 260, padding: "20px 22px", borderRadius: 24, color: "#123669", background: "rgba(255,255,255,.62)", border: "1px solid rgba(255,255,255,.86)", boxShadow: "0 28px 80px rgba(28,79,156,.15)", backdropFilter: "blur(20px)", transform: `translateY(${enter * -0.18}px)`}}><small style={{fontSize: 11, letterSpacing: ".14em", fontWeight: 800}}>SOURCE ATTACHED</small><div style={{marginTop: 9, fontSize: 18, fontWeight: 760}}>Architecture Decisions.md</div></div>}
    </div>
  );
};

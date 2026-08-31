import {Easing, Img, interpolate, staticFile, useCurrentFrame} from "remotion";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const LogoScene = ({portrait}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16, 64, 86], [0, 1, 1, 0], {...clamp, easing: ease});
  const scale = interpolate(frame, [0, 44], [0.72, 1], {...clamp, easing: Easing.out(Easing.back(1.08))});
  const ring = interpolate(frame, [0, 72], [0.48, 1.22], {...clamp, easing: ease});
  return (
    <div style={{position: "absolute", inset: 0, opacity}}>
      {[0, 1, 2].map((index) => <div key={index} style={{position: "absolute", left: "50%", top: portrait ? "42%" : "48%", width: (portrait ? 330 : 440) + index * (portrait ? 130 : 180), aspectRatio: "1", borderRadius: "50%", border: "1px solid rgba(255,255,255,.7)", boxShadow: "inset 0 0 42px rgba(255,255,255,.16),0 24px 100px rgba(35,92,175,.12)", transform: `translate(-50%,-50%) scale(${ring - index * 0.06})`}} />)}
      <div style={{position: "absolute", left: "50%", top: portrait ? "42%" : "48%", width: portrait ? 248 : 238, aspectRatio: "1", transform: `translate(-50%,-50%) scale(${scale})`, filter: "drop-shadow(0 32px 60px rgba(21,72,151,.25))"}}>
        <div style={{position: "absolute", inset: -22, borderRadius: 62, background: "linear-gradient(145deg,rgba(255,255,255,.82),rgba(255,255,255,.24))", border: "1px solid rgba(255,255,255,.86)", boxShadow: "inset 0 1px 1px white,inset 0 -20px 45px rgba(95,151,226,.18),0 34px 90px rgba(31,88,172,.2)", backdropFilter: "blur(22px)"}} />
        <Img src={staticFile("brace-logo.svg")} style={{position: "relative", width: "100%", height: "100%", borderRadius: 54}} />
      </div>
    </div>
  );
};

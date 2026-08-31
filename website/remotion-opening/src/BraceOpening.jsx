import {AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {FrostWorld} from "./components/FrostWorld";
import {LogoScene} from "./scenes/LogoScene";
import {ProductScene} from "./scenes/ProductScene";
import {MemoryScene} from "./scenes/MemoryScene";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

export const BraceOpening = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  const clarity = interpolate(frame, [0, 72, 126, 206], [0.18, 0.64, 0.9, 1], clamp);
  const sheen = interpolate(frame, [0, 105, 210], [-32, 42, 128], clamp);

  return (
    <AbsoluteFill style={{overflow: "hidden", backgroundColor: "#78aef9", fontFamily: 'Arial, "Segoe UI", sans-serif'}}>
      <FrostWorld frame={frame} clarity={clarity} portrait={portrait} />
      <Sequence from={0} durationInFrames={88} premountFor={20}><LogoScene portrait={portrait} /></Sequence>
      <Sequence from={58} durationInFrames={104} premountFor={24}><ProductScene portrait={portrait} /></Sequence>
      <Sequence from={136} durationInFrames={74} premountFor={18}><MemoryScene portrait={portrait} /></Sequence>
      <AbsoluteFill style={{pointerEvents: "none", mixBlendMode: "screen", opacity: 0.42}}>
        <div style={{position: "absolute", top: "-30%", bottom: "-30%", left: `${sheen}%`, width: portrait ? 210 : 360, rotate: "18deg", background: "linear-gradient(90deg,transparent,rgba(255,255,255,.72),transparent)", filter: "blur(32px)"}} />
      </AbsoluteFill>
      <AbsoluteFill style={{pointerEvents: "none", boxShadow: "inset 0 0 160px rgba(12,65,154,.16), inset 0 1px rgba(255,255,255,.9)"}} />
      <div style={{position: "absolute", left: portrait ? 28 : 54, right: portrait ? 28 : 54, bottom: portrait ? 34 : 30, display: "flex", justifyContent: "space-between", color: "rgba(13,48,101,.62)", fontSize: portrait ? 14 : 12, fontWeight: 700, letterSpacing: "0.16em"}}>
        <span>LOCAL FIRST</span><span>BRACE / MEMORY FILM</span>
      </div>
    </AbsoluteFill>
  );
};

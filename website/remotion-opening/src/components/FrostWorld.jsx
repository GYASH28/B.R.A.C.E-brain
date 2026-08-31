import {interpolate, random} from "remotion";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
const drops = Array.from({length: 34}, (_, index) => ({
  x: 2 + random(`frost-x-${index}`) * 96,
  y: -20 + random(`frost-y-${index}`) * 130,
  length: 22 + random(`frost-l-${index}`) * 72,
  width: 1 + random(`frost-w-${index}`) * 2.4,
  speed: 0.45 + random(`frost-s-${index}`) * 1.2,
  opacity: 0.12 + random(`frost-o-${index}`) * 0.35,
}));

export const FrostWorld = ({frame, clarity, portrait}) => {
  const orbShift = interpolate(frame, [0, 210], [-5, 8], clamp);
  return (
    <div style={{position: "absolute", inset: 0, overflow: "hidden"}}>
      <div style={{position: "absolute", inset: 0, background: "linear-gradient(142deg,#dff2ff 0%,#9ac8ff 34%,#5c98ed 72%,#8dbdf8 100%)"}} />
      <div style={{position: "absolute", width: portrait ? 700 : 980, height: portrait ? 700 : 980, left: portrait ? "-48%" : "-18%", top: `${-35 + orbShift}%`, borderRadius: "50%", background: "radial-gradient(circle at 66% 62%,rgba(255,255,255,.96),rgba(217,240,255,.58) 34%,rgba(255,255,255,0) 71%)", filter: "blur(4px)"}} />
      <div style={{position: "absolute", width: portrait ? 560 : 820, height: portrait ? 560 : 820, right: portrait ? "-46%" : "-12%", bottom: `${-39 - orbShift * 0.35}%`, borderRadius: "44% 56% 63% 37%", background: "radial-gradient(circle at 35% 28%,rgba(247,252,255,.9),rgba(68,129,226,.32) 46%,rgba(35,100,204,0) 72%)", filter: "blur(18px)", rotate: `${frame * 0.08}deg`}} />
      <div style={{position: "absolute", inset: 0, opacity: 0.58, backgroundImage: "radial-gradient(circle at 24% 18%,rgba(255,255,255,.7) 0 1px,transparent 2px),radial-gradient(circle at 76% 68%,rgba(255,255,255,.45) 0 1px,transparent 2px)", backgroundSize: "86px 86px,112px 112px"}} />
      {drops.map((drop, index) => {
        const travel = ((drop.y + frame * drop.speed) % 140) - 20;
        const focus = 0.38 + clarity * 0.62;
        return <i key={index} style={{position: "absolute", left: `${drop.x}%`, top: `${travel}%`, width: drop.width, height: drop.length, borderRadius: 999, opacity: drop.opacity * focus, background: "linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.92) 44%,rgba(232,247,255,.2))", boxShadow: "0 0 1px rgba(255,255,255,.95),1px 0 3px rgba(21,75,155,.18)", transform: `skewX(-${2 + index % 4}deg)`}} />;
      })}
      <div style={{position: "absolute", inset: 0, background: `rgba(235,247,255,${0.35 * (1 - clarity)})`, backdropFilter: `blur(${interpolate(clarity, [0, 1], [24, 2])}px)`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.48)"}} />
    </div>
  );
};

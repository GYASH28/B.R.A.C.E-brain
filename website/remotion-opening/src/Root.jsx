import {Composition} from "remotion";
import {BraceOpening} from "./BraceOpening";

export const RemotionRoot = () => (
  <>
    <Composition
      id="BraceOpening"
      component={BraceOpening}
      durationInFrames={210}
      fps={30}
      width={1440}
      height={810}
    />
    <Composition
      id="BraceOpeningPortrait"
      component={BraceOpening}
      durationInFrames={210}
      fps={30}
      width={720}
      height={1560}
    />
  </>
);

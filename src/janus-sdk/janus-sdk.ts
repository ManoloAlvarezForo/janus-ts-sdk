import JanusVideoRoom from "./videoroom/janusVideoRoom";
import { Janus } from "../janus";

const features: { [index: string]: any } = { videoroom: JanusVideoRoom };

/**
 * Janus SDK instance.
 */
const JanusSdk = {
  getInstance: (type: string) => {
    return new features[type](Janus);
  },
  types: {
    VIDEO_ROOM: "videoroom",
  },
};

export default JanusSdk;

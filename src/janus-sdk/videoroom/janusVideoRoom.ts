/**
 * Janus video room class that handles the janus.js sdk.
 */
export default class JanusVideoRoom {
  /**
   * Janus plugin video room string constant name.
   */
  JANUS_PLUGIN_VIDEO_ROOM = "janus.plugin.videoroom";

  /**
   * Join  string constant of janus video room.
   */
  JOIN = "join";

  /**
   * Publisher string constant  of janus video room.
   */
  PUBLISHER = "publisher";

  /**
   * Server  of janus video room.
   */
  server?: string;

  /**
   * Janus instance of janus video room.
   */
  janusInstance?: any;

  /**
   * Janus sdk of janus video room.
   */
  janusSdk?: any;

  /**
   * Sfutest  of janus video room
   */
  sfutest?: any;

  /**
   * Opaque id of janus video room
   */
  opaqueId?: string;

  /**
   * Myid  of janus video room.
   */
  myid?: string | undefined;

  /**
   * Stream  of janus video room.
   */
  stream?: any;

  /**
   * Mypvtid  of janus video room.
   */
  mypvtid?: string | undefined;

  /**
   * Feeds  of janus video room.
   */
  feeds?: any = [];

  /**
   * Bitrate timer of janus video room.
   */
  bitrateTimer?: any = [];

  /**
   * Attached  of janus video room.
   */
  attached?: any;

  /**
   * Plugin  of janus video room.
   */
  plugin?: string;

  /**
   * Myusername  of janus video room.
   */
  myusername?: string | undefined;

  /**
   * Myroom  of janus video room.
   */
  myroom?: number;

  /**
   * Creates an instance of janus video room.
   *
   * @param janusJs Janus.js object.
   */
  constructor(janusJs: any) {
    this.janusSdk = janusJs;
    this.opaqueId = "videoroom-" + this.janusSdk.randomString(12);
  }

  /**
   * Init  of janus video room.
   */
  private init = async () => {
    return new Promise((resolve, reject) => {
      this.janusSdk.init({
        debug: "true",
        callback: () => {
          this.janusInstance = new this.janusSdk({
            server: this.server,
            success: () => {
              // Attach to VideoRoom plugin
              this.janusInstance.attach({
                plugin: this.JANUS_PLUGIN_VIDEO_ROOM,
                opaqueId: this.opaqueId,
                success: (pluginHandle: any) => {
                  this.sfutest = pluginHandle;
                  console.log(
                    "Plugin attached! (" +
                      this.sfutest.getPlugin() +
                      ", id=" +
                      this.sfutest.getId() +
                      ")"
                  );
                  console.log("  -- This is a publisher/manager");
                  resolve(true);
                  // Prepare the myusername registration
                },
                error: (error: any) => {
                  console.log("  -- Error attaching plugin...", error);
                  console.log("Error attaching plugin... " + error);
                },
                consentDialog: (on: any) => {
                  console.log(
                    "Consent dialog should be " + (on ? "on" : "off") + " now"
                  );
                },
                mediaState: (medium: any, on: any) => {
                  console.log(
                    "Janus " +
                      (on ? "started" : "stopped") +
                      " receiving our " +
                      medium
                  );
                },
                webrtcState: (on: any) => {
                  console.log(
                    "Janus says our WebRTC PeerConnection is " +
                      (on ? "up" : "down") +
                      " now"
                  );

                  this.sfutest.send({
                    message: { request: "configure" },
                  });
                  return false;
                },
                onmessage: (msg: any, jsep: any) => {
                  console.log(" ::: Got a message (publisher) :::");
                  console.log(msg);
                  let event = msg["videoroom"];
                  console.log("Event: " + event);
                  if (event !== undefined && event != null) {
                    if (event === "joined") {
                      // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                      this.myid = msg["id"];
                      this.mypvtid = msg["private_id"];
                      console.log(
                        "Successfully joined room " +
                          msg["room"] +
                          " with myid " +
                          this.myid
                      );
                      this.publishOwnFeed(true);
                      // Any new feed to attach to?
                      if (
                        msg["publishers"] !== undefined &&
                        msg["publishers"] !== null
                      ) {
                        let list = msg["publishers"];
                        console.log(
                          "Got a list of available publishers/feeds:"
                        );
                        console.log(list);
                        for (let f in list) {
                          let id = list[f]["id"];
                          let display = list[f]["display"];
                          let audio = list[f]["audio_codec"];
                          let video = list[f]["video_codec"];
                          console.log(
                            "  >> [" +
                              id +
                              "] " +
                              display +
                              " (audio: " +
                              audio +
                              ", video: " +
                              video +
                              ")"
                          );
                          this.newRemoteFeed(id, display, audio, video);
                        }
                      }
                    } else if (event === "destroyed") {
                      // The room has been destroyed
                      console.log("The room has been destroyed!");
                    } else if (event === "event") {
                      // Any new feed to attach to?
                      if (
                        msg["publishers"] !== undefined &&
                        msg["publishers"] !== null
                      ) {
                        let list = msg["publishers"];
                        console.log(
                          "Got a list of available publishers/feeds:"
                        );
                        console.log(list);
                        for (let f in list) {
                          let id = list[f]["id"];
                          let display = list[f]["display"];
                          let audio = list[f]["audio_codec"];
                          let video = list[f]["video_codec"];
                          console.log(
                            "  >> [" +
                              id +
                              "] " +
                              display +
                              " (audio: " +
                              audio +
                              ", video: " +
                              video +
                              ")"
                          );
                          this.newRemoteFeed(id, display, audio, video);
                        }
                      } else if (
                        msg["leaving"] !== undefined &&
                        msg["leaving"] !== null
                      ) {
                        // One of the publishers has gone away?
                        let leaving = msg["leaving"];
                        console.log("Publisher left: " + leaving);
                        let remoteFeed = null;
                        for (let i = 1; i < 6; i++) {
                          if (
                            this.feeds[i] !== null &&
                            this.feeds[i] !== undefined &&
                            this.feeds[i].rfid === leaving
                          ) {
                            remoteFeed = this.feeds[i];
                            break;
                          }
                        }
                        if (remoteFeed != null) {
                          console.log(
                            "Feed " +
                              remoteFeed.rfid +
                              " (" +
                              remoteFeed.rfdisplay +
                              ") has left the room, detaching"
                          );
                          this.feeds[remoteFeed.rfindex] = null;
                          remoteFeed.detach();
                        }
                      } else if (
                        msg["unpublished"] !== undefined &&
                        msg["unpublished"] !== null
                      ) {
                        // One of the publishers has unpublished?
                        let unpublished = msg["unpublished"];
                        console.log("Publisher left: " + unpublished);
                        if (unpublished === "ok") {
                          // That's us
                          this.sfutest.hangup();
                          return;
                        }
                        let remoteFeed = null;
                        for (let i = 1; i < 6; i++) {
                          if (
                            this.feeds[i] !== null &&
                            this.feeds[i] !== undefined &&
                            this.feeds[i].rfid === unpublished
                          ) {
                            remoteFeed = this.feeds[i];
                            break;
                          }
                        }
                        if (remoteFeed != null) {
                          console.log(
                            "Feed " +
                              remoteFeed.rfid +
                              " (" +
                              remoteFeed.rfdisplay +
                              ") has left the room, detaching"
                          );
                          this.feeds[remoteFeed.rfindex] = null;
                          remoteFeed.detach();
                        }
                      } else if (
                        msg["error"] !== undefined &&
                        msg["error"] !== null
                      ) {
                        if (msg["error_code"] === 426) {
                          // This is a "no such room" error: give a more meaningful description
                          console.log(
                            "<p>Apparently room <code>" +
                              this.myroom +
                              "</code> (the one this demo uses as a test room) " +
                              "does not exist...</p><p>Do you have an updated <code>janus.plugin.videoroom.jcfg</code> " +
                              "configuration file? If not, make sure you copy the details of room <code>" +
                              this.myroom +
                              "</code> " +
                              "from that sample in your current configuration file, then restart Janus and try again."
                          );
                        } else {
                          console.log(msg["error"]);
                        }
                      }
                    }
                  }
                  if (jsep !== undefined && jsep !== null) {
                    console.log("Handling SDP as well...");
                    console.log(jsep);
                    this.sfutest.handleRemoteJsep({ jsep: jsep });
                  }
                },
                onlocalstream: (stream: any) => {
                  console.log(" ::: Got a local stream :::");
                  this.stream = stream;
                  console.log(stream);
                },
                onremotestream: (stream: any) => {
                  // The publisher stream is sendonly, we don't expect anything here
                },
                oncleanup: function () {
                  console.log(
                    " ::: Got a cleanup notification: we are unpublished now :::"
                  );
                  this.stream = null;
                },
              });
            },
            error: (error: any) => {
              console.log(error);
              reject();
            },
            destroyed: () => {},
          });
        },
        error: this.janusErrorCallBack,
        destroyed: this.janusDestroyCallBack,
      });
    });
  };

  /**
   * Janus error call back of janus video room
   */
  private janusErrorCallBack = (cause: any) => {
    console.log(`Error to Init Janus:  ${cause}`);
  };

  /**
   * Janus destroy call back of janus video room.
   */
  private janusDestroyCallBack = () => {
    console.log("Destroyed method.");
  };

  /**
   * New remote feed of janus video room.
   */
  private newRemoteFeed = (
    id: string,
    display: any,
    audio: any,
    video: any
  ) => {
    // A new feed has been published, create a new plugin handle and attach to it as a subscriber
    let remoteFeed: any = null;
    this.janusInstance.attach({
      plugin: this.JANUS_PLUGIN_VIDEO_ROOM,
      opaqueId: this.opaqueId,
      success: (pluginHandle: any) => {
        remoteFeed = pluginHandle;
        remoteFeed.simulcastStarted = false;
        console.log(
          "Plugin attached! (" +
            remoteFeed.getPlugin() +
            ", id=" +
            remoteFeed.getId() +
            ")"
        );
        console.log("  -- This is a subscriber");
        // We wait for the plugin to send us an offer
        let subscribe = {
          request: "join",
          room: this.myroom,
          ptype: "subscriber",
          feed: id,
          private_id: this.mypvtid,
        };
        // In case you don't want to receive audio, video or data, even if the
        // publisher is sending them, set the 'offer_audio', 'offer_video' or
        // 'offer_data' properties to false (they're true by default), e.g.:
        // 		subscribe["offer_video"] = false;
        // For example, if the publisher is VP8 and this is Safari, let's avoid video
        // if (Janus.webRTCAdapter.browserDetails.browser === "safari" &&
        //   (video === "vp9" || (video === "vp8" && !Janus.safariVp8))) {
        //   if (video)
        //     video = video.toUpperCase()
        //   console.log("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
        //   subscribe["offer_video"] = false;
        // }
        remoteFeed.videoCodec = video;
        remoteFeed.send({ message: subscribe });
      },
      error: (error: any) => {
        console.log("  -- Error attaching plugin...", error);
        console.log("Error attaching plugin... " + error);
      },
      onmessage: (msg: any, jsep: any) => {
        console.log(" ::: Got a message (subscriber) :::");
        console.log(msg);
        let event = msg["videoroom"];
        console.log("Event: " + event);
        if (msg["error"] !== undefined && msg["error"] !== null) {
          console.log(msg["error"]);
        } else if (event !== undefined && event != null) {
          if (event === "attached") {
            // Subscriber created and attached
            for (let i = 1; i < 6; i++) {
              if (this.feeds[i] === undefined || this.feeds[i] === null) {
                this.feeds[i] = remoteFeed;
                remoteFeed.rfindex = i;
                break;
              }
            }
            remoteFeed.rfid = msg["id"];
            remoteFeed.rfdisplay = msg["display"];
            console.log(
              "Successfully attached to feed " +
                remoteFeed.rfid +
                " (" +
                remoteFeed.rfdisplay +
                ") in room " +
                msg["room"]
            );
          } else if (event === "event") {
            // Check if we got an event on a simulcast-related event from this publisher
            let substream = msg["substream"];
            let temporal = msg["temporal"];
            if (
              (substream !== null && substream !== undefined) ||
              (temporal !== null && temporal !== undefined)
            ) {
              if (!remoteFeed.simulcastStarted) {
                remoteFeed.simulcastStarted = true;
                // Add some new buttons
              }
              // We just received notice that there's been a switch, update the buttons
            }
          } else {
            // What has just happened?
          }
        }
        if (jsep !== undefined && jsep !== null) {
          console.log("Handling SDP as well...");
          console.log(jsep);
          // Answer and attach
          remoteFeed.createAnswer({
            jsep: jsep,
            // Add data:true here if you want to subscribe to datachannels as well
            // (obviously only works if the publisher offered them in the first place)
            media: { audioSend: false, videoSend: false }, // We want recvonly audio/video
            success: (jsep: any) => {
              console.log("Got SDP!");
              console.log(jsep);
              let body = { request: "start", room: this.myroom };
              remoteFeed.send({ message: body, jsep: jsep });
            },
            error: (error: any) => {
              console.log("WebRTC error:", error);
              console.log("WebRTC error... " + JSON.stringify(error));
            },
          });
        }
      },
      webrtcState: (on: any) => {
        console.log(
          "Janus says this WebRTC PeerConnection (feed #" +
            remoteFeed.rfindex +
            ") is " +
            (on ? "up" : "down") +
            " now"
        );
      },
      onlocalstream: (stream: any) => {
        // The subscriber stream is recvonly, we don't expect anything here
      },
      onremotestream: (stream: any) => {
        console.debug("Remote feed #" + remoteFeed.rfindex);
      },
      oncleanup: () => {
        console.log(
          " ::: Got a cleanup notification (remote feed " + id + ") :::"
        );
        remoteFeed.simulcastStarted = false;
      },
    });
  };

  /**
   * Determines whether janus instance is.
   */
  private isJanusInstance = () => {
    return this.janusInstance;
  };

  /**
   * Validate connexion of janus video room.
   */
  private validateConnexion = (callback: any) => {
    const response = this.isConnected();
    if (response) {
      callback();
    } else {
      console.log(`${callback.name} failed connection to Janus Server.`);
    }
    return response;
  };

  /**
   * Destroy  of janus video room.
   */
  destroy = () => {
    if (this.isConnected()) {
      this.janusInstance.destroy();
    } else {
      console.log("Error to destroy janus.");
    }
  };

  /**
   * Determines whether connected is.
   */
  isConnected = () => {
    return this.isJanusInstance() ? this.janusInstance.isConnected() : false;
  };

  /**
   * Connect  of janus video room to janus server.
   */
  connect = async (server: string) => {
    this.server = server;
    return this.init();
  };

  /**
   * Set stream of janus video room.
   */
  setStream = (stream: any) => {
    this.stream = stream;
  };

  /**
   * Set room of janus video room.
   */
  setRoom = (room: number) => {
    this.myroom = room;
  };

  /**
   * Register  of janus video room.
   *
   * @params {string} username string that represent the user name.
   * @params {number} room number that provides the room number.
   */
  register = (userName: string, room: number) => {
    this.myroom = room;
    const register = (userName: string, room: number) => {
      let register = {
        request: this.JOIN,
        room: this.myroom,
        ptype: this.PUBLISHER,
        display: userName,
      };
      this.myusername = userName;
      this.sfutest.send({ message: register });
    };
    return this.validateConnexion(register);
  };

  /**
   * Unpublish own feed of janus video room.
   */
  unpublishOwnFeed = () => {
    const unpublishOwnFeed = () => {
      let unpublish = { request: "unpublish" };
      this.sfutest.send({ message: unpublish });
    };
    return this.validateConnexion(unpublishOwnFeed);
  };

  /**
   * Publish own feed of janus video room.
   *
   * @params {boolean} useaudio boolean that represent if it use audio.
   */
  publishOwnFeed = (useAudio: boolean) => {
    const response = this.isConnected();

    if (response) {
      this.sfutest.createOffer({
        stream: this.stream,
        // Add data:true here if you want to publish datachannels as well
        // Publishers are sendonly
        // If you want to test simulcasting (Chrome and Firefox only), then
        // pass a ?simulcast=true when opening this demo page: it will turn
        // the following 'simulcast' property to pass to janus.js to true
        simulcast: true,
        simulcast2: true,
        success: (jsep: any) => {
          console.log("Got publisher SDP!");
          console.log(jsep);
          var publish = { request: "configure", audio: useAudio, video: true };
          // You can force a specific codec to use when publishing by using the
          // audiocodec and videocodec properties, for instance:
          // 		publish["audiocodec"] = "opus"
          // to force Opus as the audio codec to use, or:
          // 		publish["videocodec"] = "vp9"
          // to force VP9 as the videocodec to use. In both case, though, forcing
          // a codec will only work if: (1) the codec is actually in the SDP (and
          // so the browser supports it), and (2) the codec is in the list of
          // allowed codecs in a room. With respect to the point (2) above,
          // refer to the text in janus.plugin.videoroom.jcfg for more details
          this.sfutest.send({ message: publish, jsep: jsep });
        },
        error: function (error: any) {
          this.janusInstance.error("WebRTC error:", error);
          // if (useAudio) {
          //   this.publishOwnFeed(false);
          // } else {
          //   this.ublishOwnFeed(true);
          // }
        },
      });
    } else {
      console.log(
        "publishOwnFeed failed there is not a connection to Janus Server."
      );
    }
    return response;
  };
}

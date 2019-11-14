const AgoraRecordingSDK = require("../record/AgoraRecordSdk");
const path = require("path");
const fs = require("fs");
const uuidv4 = require('uuid/v4');

class RecordManager{
    constructor() {
        this.recorders = {};
        //initialize output folder
        const output = path.resolve(__dirname, "./output");
        if (!fs.existsSync(output)){
            fs.mkdirSync(output);
        }
    }

    //find existing recorder
    find(sid) {
        return this.recorders[sid];
    }

    initStorage(appid, channel, sid) {
        return new Promise((resolve, reject) => {
            const storagePath = path.resolve(__dirname, `./output/${sid}`);
            fs.mkdir(storagePath, {recursive: true}, err => {
                if(err){
                    throw err;
                }
                resolve(storagePath);
            });
        })
    }

    start(key, appid, channel) {
        return new Promise((resolve, reject) => {
            const sid = uuidv4();
            this.initStorage(appid, channel, sid).then(storagePath => {
                let sdk = new AgoraRecordingSDK();

                let layout = {
                    "canvasWidth": 640,
                    "canvasHeight": 480,
                    "backgroundColor": "#00ff00",
                    "regions": []
                }
                let recorder = {
                    appid: appid,
                    channel: channel,
                    sdk: sdk,
                    sid: sid,
                    layout: layout
                };
                sdk.setMixLayout(layout);

                sdk.joinChannel(key || null, channel, 0, appid, storagePath).then(() => {
                    this.subscribeEvents(recorder);
                    this.recorders[sid] = recorder;
                    console.log(`recorder started ${appid} ${channel} ${sid}`)
                    resolve(recorder);
                }).catch(e => {
                    reject(e);
                });
            });
        });
    }

    subscribeEvents(recorder) {
        let { sdk, sid, appid, channel } = recorder;
        sdk.on("error", (err, stat) => {
            console.error(`sdk stopped due to err code: ${err} stat: ${stat}`);
            console.log(`stop recorder ${appid} ${channel} ${sid}`)
            //clear recorder if error received
            this.onCleanup(sid)
        });
        sdk.on("userleave", (uid) => {
            console.log(`user leave ${uid}`);
            //rearrange layout when user leaves

            let recorder = this.find(sid);

            if(!recorder) {
                console.error("no reocrder found");
                return;
            }
            let {layout} = recorder;
            layout.regions = layout.regions.filter((region) => {
                return region.uid !== uid
            })
            sdk.setMixLayout(layout);
        });
        sdk.on("userjoin", (uid) => {
            //rearrange layout when new user joins
            console.log(`user join ${uid}`);
            let region = {
                "x": 0,
                "y": 0,
                "width": 640,
                "height": 480,
                "zOrder": 1,
                "alpha": 1,
                "uid": uid
            }
            let recorder = this.find(sid);

            if(!recorder) {
                console.error("no reocrder found");
                return;
            }

            let {layout} = recorder;
            switch(layout.regions.length) {
                case 0:  //1拠点目
                    region.x = 0;
                    region.y = 0;
                    region.width = 640;
                    region.height = 480;
                    break;
                case 1:  //2拠点目                   
                    layout.regions[0].x = 0;
                    layout.regions[0].y = 0;
                    layout.regions[0].width = 320;
                    layout.regions[0].height = 480;	            
                    region.x = 320;
                    region.y = 0;
                    region.width = 320;
                    region.height = 480;
                    break;
                case 2:  //3拠点目                       
                    layout.regions[0].x = 0;
                    layout.regions[0].y = 0;
                    layout.regions[0].width = 320;
                    layout.regions[0].height = 240;	            
                    layout.regions[1].x = 320;
                    layout.regions[1].y = 0;
                    layout.regions[1].width = 320;
                    layout.regions[1].height = 240;	            
                    region.x = 0;
                    region.y = 240;
                    region.width = 320;
                    region.height = 240;
                    break;
                case 3:  //4拠点目                       
                    region.x = 320;
                    region.y = 240;
                    region.width = 320;
                    region.height = 240;
                    break;
                default:
                    break;
            }
            layout.regions.push(region);
            sdk.setMixLayout(layout);
        });
    }

    stop(sid) {
        let recorder = this.recorders[sid];
        if(recorder) {
            let {appid, channel} = recorder;
            console.log(`stop recorder ${appid} ${channel} ${sid}`)
            this.onCleanup(sid);
        } else {
            throw new Error('recorder not exists');
        }
    }

    onCleanup(sid) {
        let recorder = this.recorders[sid];
        if(recorder) {
            let {sdk} = recorder;
            console.log(`releasing ${sid}`)
            sdk.leaveChannel()
            sdk.release()
            delete this.recorders[`${sid}`];
        } else {
            throw new Error('recorder not exists');
        }
    }
}



module.exports = new RecordManager();

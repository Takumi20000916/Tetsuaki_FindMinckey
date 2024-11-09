// import { ObjectDetector, FilesetResolver } from "../node_modules/@mediapipe/tasks-vision/vision_bundle.js";
import { ObjectDetector, FilesetResolver } from "./vision_bundle.mjs";
var objectDetector;
let runningMode = "IMAGE";
// Initialize the object detector
const initializeObjectDetector = async () => {
    // const vision = await FilesetResolver.forVisionTasks("./node_modules/@mediapipe/tasks-vision/wasm");
    const vision = await FilesetResolver.forVisionTasks("./wasm");
    objectDetector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
            // modelAssetPath: `./models/model_fp16.tflite`,
            modelAssetPath: `./models/MobileNetV2_320I_Mickey_fp16.tflite`,
            delegate: "GPU"
        },
        scoreThreshold: 0.35,
        runningMode: runningMode
    });

    enableCam();
    document.querySelector('#loading').style.display = 'none';


};
initializeObjectDetector();


/********************************************************************
 // Demo 2: Continuously grab image from webcam stream and detect it.
 ********************************************************************/
let video = document.getElementById("webcam");
let enableWebcamButton;

// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
// Keep a reference of all the child elements we create
// so we can remove them easilly on each render.
var children = [];
// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    // enableWebcamButton = document.getElementById("webcamButton");
    // enableWebcamButton.addEventListener("click", enableCam);
}
else {
    console.warn("getUserMedia() is not supported by your browser");
}
// Enable the live webcam view and start detection.
async function enableCam(event) {
    if (!objectDetector) {
        console.log("Wait! objectDetector not loaded yet.");
        return;
    }

    // もし localStorage に cameraId が保存されていたら、それを使う
    const cameraId = localStorage.getItem('cameraId');
    // getUsermedia parameters
    const constraints = {
        video: {
            deviceId: cameraId,
            facingMode: 'environment',
            width: { max: 1920 },
            height: { max: 1080 },
            aspectRatio: { ideal: 1.0 }
        }
    };
    // Activate the webcam stream.
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(function (stream) {
            video.srcObject = stream;
            window.currentStream = stream;

            // 解像度などの詳細情報を取得して表示
            let videoTrack = stream.getVideoTracks()[0];
            let settings = videoTrack.getSettings();
            let capabilities = videoTrack.getCapabilities();

            // ズーム機能を表示したいときには下のコメントを外してデバッグする
            capabilities.zoom = { min: 1, max: 10, step: 0.1 };
            settings.zoom = 5;
            // ズームUIを表示
            if (capabilities.zoom) {
                if (!capabilities.zoom.step) {
                    capabilities.zoom.step = 0.1;
                }
                document.getElementById('zoom_ui').innerHTML = `
                    <div class="row mt-2 mb-2">
                        <div class="col-2 text-end fs-4">
                            <i class="bi bi-zoom-out"></i>
                        </div>  
                        <div class="col-8 text-center">
                            <input type="range" class="form-range" min="${capabilities.zoom.min}" max="${capabilities.zoom.max}" value="${settings.zoom}" step="${capabilities.zoom.step}" id="zoom_ui_input">
                        </div>
                        <div class="col-2 text-start fs-4">
                            <i class="bi bi-zoom-in"></i>
                        </div>
                    </div>
                    `;
                document.getElementById('zoom_ui_input').addEventListener('input', (event) => {
                    videoTrack.applyConstraints({ advanced: [{ zoom: parseFloat(event.target.value) }] });
                });

            }

            video.addEventListener("loadeddata", predictWebcam);
        })
        .catch((err) => {
            console.error(err);
            /* handle the error */
        });
}
let lastVideoTime = -1;
async function predictWebcam() {
    // if image mode is initialized, create a new classifier with video runningMode
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await objectDetector.setOptions({ runningMode: "VIDEO" });
    }
    let nowInMs = Date.now();
    // Detect objects using detectForVideo
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const detections = await objectDetector.detectForVideo(video, nowInMs);

        //displayVideoDetections(detections);
        gotDetections(detections);
    }
    // Call this function again to keep predicting when the browser is ready
    window.requestAnimationFrame(predictWebcam);
}

document.querySelector('#input_confidence_threshold').addEventListener('change', changedConfidenceThreshold);

function changedConfidenceThreshold(e) {
    console.log(e.srcElement.value);
    // e.srcElement.valueをfloatにキャスティング
    let confidenceThreshold = parseFloat(e.srcElement.value);
    objectDetector.setOptions(
        {
            scoreThreshold: confidenceThreshold
        }
    )
    document.querySelector('#confidence_threshold').innerHTML = e.srcElement.value;
}


async function listCameras() {
    try {
        const selectCamera = document.getElementById('select_camera');
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                console.log(devices);
                devices.forEach(device => {
                    if (device.kind === 'videoinput') {
                        const option = document.createElement('option');
                        option.text = device.label || `camera ${selectCamera.length + 1}`;
                        option.value = device.deviceId;
                        // もし localStorage に cameraId が保存されていたら、それを選択状態にする
                        const cameraId = localStorage.getItem('cameraId');
                        if (cameraId === device.deviceId) {
                            option.selected = true;
                        }
                        selectCamera.appendChild(option);
                    }
                });
            });
    } catch (err) {
        console.error('Error accessing media devices.', err);
    }
}
await listCameras();

document.querySelector('#button_refresh_camera').addEventListener('click', async () => {
    try {
        // 仮のカメラアクセスをリクエストしてユーザーの許可を取得
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true });
        // デバイス一覧を取得
        document.querySelector('#select_camera').innerHTML = '';
        await listCameras();
        // ストリームを停止してカメラをクローズ
        if (initialStream) {
            initialStream.getTracks().forEach(track => track.stop());
        }
    } catch (err) {
        console.error('Error accessing media devices.', err);
    }
})

document.getElementById('select_camera').addEventListener('change', changedCamera);
function changedCamera() {
    const selectCamera = document.getElementById('select_camera');
    const constraints = {
        video: {
            deviceId: selectCamera.value,
            facingMode: 'environment',
            width: { max: 1920 },
            height: { max: 1080 },
            aspectRatio: { ideal: 1.0 }
        }
    };
    // selectCamera.value をlocalStorageに保存
    localStorage.setItem('cameraId', selectCamera.value);

    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(function (stream) {
            video.srcObject = stream;
            video.addEventListener("loadeddata", predictWebcam);
        })
        .catch((err) => {
            console.error(err);
            /* handle the error */
        });
}
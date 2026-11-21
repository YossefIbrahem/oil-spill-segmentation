"""Oil spill segmentation API used by the mobile app.

Run:   python app.py          (or: uvicorn app:app --host 0.0.0.0 --port 8000)

Endpoints
  GET  /health              server status and loaded models
  GET  /models              info + metrics of every model in weights/
  GET  /classes             class names and colours
  GET  /samples             test images placed in samples/images
  GET  /samples/{name}      one sample image
  POST /predict             {"model": "deeplab", "image_base64": "..."}  or  {"model": "unet", "sample": "img_0001.jpg"}
"""
import base64
import math
import socket
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from model_defs import CLASS_COLORS, CLASS_NAMES, load_model

BASE_DIR = Path(__file__).parent
WEIGHTS_DIR = BASE_DIR / "weights"
SAMPLE_IMAGES = BASE_DIR / "samples" / "images"
SAMPLE_LABELS = BASE_DIR / "samples" / "labels"
MAX_SIDE = 1280            # bigger photos are scaled down first (keeps responses small)
OIL_ALERT_PERCENT = 0.1    # "oil detected" if at least this % of the pixels are oil
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
OIL = 1

app = FastAPI(title="Oil Spill Segmentation API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ------------------------------------------------------------------ load models once at start-up
MODELS = {}
for path in sorted(WEIGHTS_DIR.glob("*.pth")):
    MODELS[path.stem] = load_model(path, DEVICE)
    print(f"loaded model '{path.stem}' ({MODELS[path.stem][1]['experiment']}) on {DEVICE}")
if not MODELS:
    print("⚠️  No models in backend/weights/. Copy unet.pth and deeplab.pth there (see README).")


# ------------------------------------------------------------------ helpers
def clean(value):
    """Make a value JSON-safe: NaN -> None, numpy numbers -> Python numbers."""
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        return None if math.isnan(value) else float(value)
    return value


def to_hex(rgb):
    return "#{:02x}{:02x}{:02x}".format(*[int(v) for v in rgb])


def model_info(key, meta):
    test = meta.get("test_metrics") or {}
    if meta["model_type"] == "unet":
        name = "U-Net"
        detail = "Built from scratch"
    else:
        name = "DeepLabV3+"
        detail = f"{meta['encoder_name']} · ImageNet pretrained"
    return clean({
        "id": key, "name": name, "detail": detail, "architecture": meta["model_type"],
        "experiment": meta.get("experiment"), "best_epoch": meta.get("epoch"),
        "val_miou": meta.get("val_miou"), "test_miou": test.get("miou"),
        "test_pixel_acc": test.get("pixel_acc"), "test_iou": test.get("iou"), "test_dice": test.get("dice"),
        "input_size": meta["img_size"],
    })


def decode_base64_image(data):
    if "," in data[:100]:                        # strip "data:image/jpeg;base64,"
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data)
    except Exception:
        raise HTTPException(400, "image_base64 is not valid base64")
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Could not read the image (use JPG or PNG)")
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def sample_path(folder, name):
    """Find a file in a samples folder safely (no ../ tricks). Matches by file name without extension."""
    stem = Path(name).stem
    for p in folder.glob(stem + ".*"):
        if p.parent.resolve() == folder.resolve():
            return p
    return None


def rgb_mask_to_class(mask_rgb):
    diff = mask_rgb[:, :, None, :].astype(np.int32) - CLASS_COLORS[None, None, :, :].astype(np.int32)
    return (diff ** 2).sum(axis=-1).argmin(axis=-1).astype(np.uint8)


def encode_png(rgb):
    ok, buf = cv2.imencode(".png", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    return "data:image/png;base64," + base64.b64encode(buf).decode()


def encode_jpg(rgb):
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()


def overlay(image, mask, alpha=0.55):
    out = image.copy()
    m = mask > 0
    out[m] = (alpha * CLASS_COLORS[mask][m] + (1 - alpha) * image[m]).astype(np.uint8)
    return out


def iou_per_class(gt, pred):
    ious = []
    for c in range(len(CLASS_NAMES)):
        union = np.logical_or(gt == c, pred == c).sum()
        ious.append(float("nan") if union == 0 else np.logical_and(gt == c, pred == c).sum() / union)
    return ious


@torch.no_grad()
def segment(model, meta, image):
    """Same preprocessing as in the notebook: resize -> normalise -> model -> upsample logits -> argmax."""
    h, w = image.shape[:2]
    in_h, in_w = meta["img_size"]
    interp = cv2.INTER_AREA if (w > in_w or h > in_h) else cv2.INTER_LINEAR
    small = cv2.resize(image, (in_w, in_h), interpolation=interp)
    x = (small.astype(np.float32) / 255.0 - np.array(meta["mean"], np.float32)) / np.array(meta["std"], np.float32)
    x = torch.from_numpy(x.transpose(2, 0, 1).copy())[None].to(DEVICE)
    logits = F.interpolate(model(x).float(), size=(h, w), mode="bilinear", align_corners=False)
    probs = logits.softmax(dim=1)[0]
    confidence, pred = probs.max(dim=0)
    return pred.cpu().numpy().astype(np.uint8), confidence.cpu().numpy()


# ------------------------------------------------------------------ endpoints
@app.get("/health")
def health():
    return {"status": "ok", "device": DEVICE, "models": list(MODELS)}


@app.get("/models")
def list_models():
    return [model_info(key, meta) for key, (_, meta) in MODELS.items()]


@app.get("/classes")
def list_classes():
    return [{"id": i, "name": n, "color": to_hex(CLASS_COLORS[i])} for i, n in enumerate(CLASS_NAMES)]


@app.get("/samples")
def list_samples():
    if not SAMPLE_IMAGES.exists():
        return []
    files = [p for p in sorted(SAMPLE_IMAGES.iterdir()) if p.suffix.lower() in {".jpg", ".jpeg", ".png"}]
    return [{"name": p.name, "url": f"/samples/{p.name}", "has_label": sample_path(SAMPLE_LABELS, p.name) is not None}
            for p in files]


@app.get("/samples/{name}")
def get_sample(name: str):
    path = sample_path(SAMPLE_IMAGES, name)
    if path is None:
        raise HTTPException(404, "sample not found")
    return FileResponse(path)


class PredictRequest(BaseModel):
    model: str
    image_base64: Optional[str] = None
    sample: Optional[str] = None


@app.post("/predict")
def predict(req: PredictRequest):
    if not MODELS:
        raise HTTPException(503, "No trained models on the server. Copy unet.pth / deeplab.pth into backend/weights.")
    if req.model not in MODELS:
        raise HTTPException(404, f"Unknown model '{req.model}'. Available: {list(MODELS)}")

    # 1) read the input image (uploaded, or one of the server samples)
    gt = None
    if req.image_base64:
        image = decode_base64_image(req.image_base64)
    elif req.sample:
        path = sample_path(SAMPLE_IMAGES, req.sample)
        if path is None:
            raise HTTPException(404, "sample not found")
        image = cv2.cvtColor(cv2.imread(str(path), cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)
        label_path = sample_path(SAMPLE_LABELS, req.sample)
        if label_path is not None:
            gt = rgb_mask_to_class(cv2.cvtColor(cv2.imread(str(label_path), cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB))
    else:
        raise HTTPException(400, "Send either image_base64 or sample")

    # 2) very large photos are scaled down first
    scale = MAX_SIDE / max(image.shape[:2])
    if scale < 1:
        size = (round(image.shape[1] * scale), round(image.shape[0] * scale))
        image = cv2.resize(image, size, interpolation=cv2.INTER_AREA)
    if gt is not None and gt.shape != image.shape[:2]:
        gt = cv2.resize(gt, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_NEAREST)

    # 3) run the model
    model, meta = MODELS[req.model]
    t0 = time.perf_counter()
    pred, confidence = segment(model, meta, image)
    inference_ms = (time.perf_counter() - t0) * 1000

    # 4) statistics for the app
    counts = np.bincount(pred.ravel(), minlength=len(CLASS_NAMES))
    percents = 100 * counts / counts.sum()
    oil_pixels = pred == OIL
    result = {
        "model": model_info(req.model, meta),
        "inference_ms": round(inference_ms, 1),
        "width": int(image.shape[1]), "height": int(image.shape[0]),
        "classes": [{"id": i, "name": n, "color": to_hex(CLASS_COLORS[i]), "pixels": int(counts[i]),
                     "percent": float(percents[i])} for i, n in enumerate(CLASS_NAMES)],
        "oil_percent": float(percents[OIL]),
        "oil_detected": bool(percents[OIL] >= OIL_ALERT_PERCENT),
        "oil_confidence": float(confidence[oil_pixels].mean()) if oil_pixels.any() else None,
        "mean_confidence": float(confidence.mean()),
        "image": encode_jpg(image),
        "mask": encode_png(CLASS_COLORS[pred]),
        "overlay": encode_jpg(overlay(image, pred)),
        "ground_truth": None,
    }
    if gt is not None:
        ious = iou_per_class(gt, pred)
        result["ground_truth"] = {"mask": encode_png(CLASS_COLORS[gt]), "iou": ious,
                                  "miou": float(np.nanmean(ious)), "pixel_acc": float((gt == pred).mean())}
    return clean(result)


def lan_ip():
    """The computer's address on the local network (what the phone must use)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))   # no packet is sent; this only picks the right network interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    import uvicorn
    print(f"\n📱 In the app, set the server URL to:  http://{lan_ip()}:8000\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)

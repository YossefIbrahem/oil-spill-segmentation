# Oil Spill Detection — Semantic Segmentation of SAR Images

Assignment 2: U-Net (from scratch) vs DeepLabV3+ (ImageNet-pretrained) on the
Oil Spill Detection Dataset (Krestenitis et al., *Remote Sensing* 2019), plus a mobile app that runs the trained models.

```
oil-spill-segmentation/
├── notebook/oil_spill_segmentation.ipynb   ← the assignment: data, models, 5 experiments, evaluation (run on Kaggle)
├── backend/                                ← small Python server that runs the trained models
│   ├── app.py            API: /models, /samples, /predict
│   ├── model_defs.py     U-Net (same code as the notebook) + checkpoint loader
│   ├── weights/          unet.pth and deeplab.pth go here (download them from the GitHub Release, see step 2)
│   └── samples/          8 test images with ground truth, shown in the app
├── mobile/                                 ← Expo (React Native) app: iPhone, Android and web
│   ├── App.tsx           switches between the 3 screens
│   └── src/              api.ts, theme.ts, components.tsx, screens/
├── results/                                ← outputs of the real Kaggle run: tables, curves, confusion matrices, figures
└── report/REPORT_TEMPLATE.md               ← report structure from the assignment, with places for your numbers
```

How the pieces fit: the **notebook** trains the models on Kaggle and exports `export.zip`. The two model files go into
`backend/weights/`, the **backend** runs them, and the **mobile app** sends images to the backend and shows the result.

## Results (real Kaggle run, GPU T4, 40 epochs per experiment)

Test set = the 110 untouched test images, evaluated at full resolution (1250 × 650). Best epoch = highest validation mIoU.

| Experiment | Best epoch | Val mIoU | **Test mIoU** | Pixel acc | IoU sea | IoU oil | IoU look-alike | IoU ship | IoU land | Train time |
|---|---|---|---|---|---|---|---|---|---|---|
| `unet_ce` | 34 | 0.414 | 0.429 | 0.918 | 0.919 | 0.227 | 0.304 | 0.000 | 0.695 | 21 min |
| `unet_wce_dice` | 38 | 0.571 | 0.513 | 0.911 | 0.908 | 0.416 | 0.344 | 0.254 | 0.642 | 21 min |
| `deeplab_frozen` | 31 | 0.666 | 0.638 | 0.954 | 0.952 | 0.532 | 0.509 | 0.327 | 0.872 | 7 min |
| `deeplab_finetune` | 38 | 0.687 | **0.677** | 0.962 | 0.960 | 0.556 | 0.583 | 0.363 | 0.924 | 12 min |
| `deeplab_focal_dice` | 35 | **0.712** | 0.655 | 0.958 | 0.956 | 0.548 | 0.558 | 0.374 | 0.838 | 12 min |

The app uses the best experiment of each model **chosen by validation mIoU**: `unet_wce_dice` and `deeplab_focal_dice`.
All figures (curves, confusion matrices, per-class IoU, qualitative results, failure cases) are in [`results/`](results/).

---

## 1. Train the models on Kaggle (the actual assignment)

1. Go to kaggle.com → **Create → New Notebook** → **File → Import Notebook** → upload `notebook/oil_spill_segmentation.ipynb`.
2. Right panel → **Add Input** → search **`nabilsherif/oil-spill`** → add it.
3. Settings → **Accelerator: GPU T4** and **Internet: On**. Internet is needed for `pip install` and the ImageNet weights.
4. First do a quick test: run the cells one by one up to Section 8. Every check prints ✅.
5. **Save Version → Save & Run All (Commit)**. This runs the whole notebook in the background, so you can close the browser.
6. When the version finishes, open it → **Output** → download `outputs/export.zip` (and anything else you need for the report).

What the notebook does (it follows the assignment's sections):

| Assignment requirement | Where in the notebook |
|---|---|
| Inspect structure, sizes, **exact RGB → class mapping** | Section 2 (colour table checks every colour against the 5 classes) |
| Visualise image/mask pairs, convert masks to class IDs | Section 3 |
| Reproducible train/val split, test set untouched | Section 3 (`split.json` saved, seed 42) |
| Normalisation (ImageNet for DeepLab, dataset stats for U-Net) | Section 3 |
| Class imbalance (pixel shares, class weights, Dice, Focal) | Sections 3 and 6 |
| Augmentation on image + mask together | Section 4 (with a preview) |
| **U-Net from scratch** (encoder, bottleneck, decoder, skip connections, 5-class output, shape check) | Section 5 |
| **DeepLabV3+ with pretrained weights** (with a check that the weights really are pretrained) | Section 5 |
| **≥ 2 approaches per model** (5 experiments) | Section 8 |
| Loss/metric curves, best-epoch rule, overfitting discussion, training time | Sections 7 and 9 |
| mIoU, per-class IoU and Dice, pixel accuracy, confusion matrices | Section 10 |
| Qualitative results and failure cases (oil vs look-alike, missed ships) | Section 11 |
| Checkpoints saved during training, resume after interruption | Section 7 (`last.pth` every epoch, `best.pth`) |

The 5 experiments (each pair changes **one** thing):

| Experiment | Model | Change | Loss |
|---|---|---|---|
| `unet_ce` | U-Net | baseline | Cross-Entropy |
| `unet_wce_dice` | U-Net | loss | weighted CE + Dice |
| `deeplab_frozen` | DeepLabV3+ (ResNet-34) | backbone frozen the whole run | weighted CE + Dice |
| `deeplab_finetune` | DeepLabV3+ (ResNet-34) | frozen 5 epochs, then full fine-tuning (encoder LR × 0.1) | weighted CE + Dice |
| `deeplab_focal_dice` | DeepLabV3+ (ResNet-34) | loss | Focal + Dice |

> Estimated run time on a T4 with 40 epochs per experiment: roughly 2–3 hours in total (an estimate; the notebook records
> the real time for each experiment). Each experiment saves `history.csv` and checkpoints every epoch, so a run that stops
> early does not lose finished experiments. Rerunning the notebook skips experiments that are already done.

**Tip:** to check the whole pipeline in a few minutes, set the environment variable `QUICK_TEST=1` (2 epochs, small images).
Don't use those numbers in the report.

---

## 2. Run the backend (on your computer)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Download the trained models (too big for git, so they are attached to the
[GitHub Release](https://github.com/YossefIbrahem/oil-spill-segmentation/releases/tag/v1.0)):

```bash
cd weights
curl -LO https://github.com/YossefIbrahem/oil-spill-segmentation/releases/download/v1.0/unet.pth
curl -LO https://github.com/YossefIbrahem/oil-spill-segmentation/releases/download/v1.0/deeplab.pth
cd ..
```

If you trained your own models instead, unzip `export.zip` from Kaggle and copy `export/weights/unet.pth` and
`export/weights/deeplab.pth` into `backend/weights/` (and `export/samples/*` into `backend/samples/` if you want).

Start the server:

```bash
python app.py
```

It prints the address the phone should use, e.g. `📱 In the app, set the server URL to: http://192.168.1.5:8000`.
Check it in a browser at `http://localhost:8000/docs`.

---

## 3. Run the mobile app (Expo)

You need Node.js and the **Expo Go** app on your phone (App Store / Google Play).

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the camera (iPhone) or with Expo Go (Android). The phone and computer must be on the **same Wi-Fi**.
The app guesses the server address automatically (same computer as Expo, port 8000). If it shows **Server offline**,
open ⚙️ Settings, type the address that `python app.py` printed, then press **Test connection** and **Save**.

You can also run it in a browser: `npx expo start --web`.

App features:
* choose **U-Net** or **DeepLabV3+** (each card shows its test mIoU)
* pick an image from the **gallery**, take a **photo**, or tap a **test sample** from the dataset
* see the result as **overlay / mask / original / ground truth**, with an **oil-spill alert**, a **class-by-class breakdown**,
  inference time and confidence
* for test samples, the **IoU against the ground truth** for that image
* **Compare** the same image with the other model in one tap

---

## What was tested

* The full notebook ran start to finish on Kaggle (GPU T4) on the **real dataset**: all 5 experiments, evaluation, figures
  and export (results above). Before that it was run quickly (`QUICK_TEST=1`) on the real data and on a synthetic copy,
  and resuming from a corrupted checkpoint was tested.
* The backend loads the exported checkpoints. Its masks matched the notebook's predictions on 100% of pixels. Error
  cases (bad image, unknown model, missing sample, no models) return clear messages.
* The app passes `tsc`, `expo lint` and `expo-doctor` (20/20), bundles for iOS and Android, and every screen was tested in a
  browser against the running backend.
* **Not tested here:** running the app on a physical phone (it was tested in the web version).

Dataset: Krestenitis et al., *Oil Spill Identification from Satellite Images Using Deep Neural Networks*, Remote Sensing
11(15), 2019. The sample images in `backend/samples/` come from its test set.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Dataset not found` in the notebook | Add the `nabilsherif/oil-spill` input (Section 1, step 2). |
| `pip install` or weight download fails on Kaggle | Turn **Internet On** in the notebook settings. |
| CUDA out of memory | Lower `BATCH_SIZE` to 4 in the configuration cell. |
| App says "Server offline" | Run `python app.py`, use the printed address in Settings, same Wi-Fi, allow Python through the firewall. |
| App says "no trained models" | Download `unet.pth` / `deeplab.pth` into `backend/weights/` (step 2) and restart the server. |
| Expo Go says the SDK is not supported | Update Expo Go from the app store (this project uses Expo SDK 58). |

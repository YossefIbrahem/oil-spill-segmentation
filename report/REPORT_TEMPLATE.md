# Oil Spill Detection Using Semantic Segmentation — Report

**Team:** _name 1, name 2, name 3, name 4 (, name 5)_ · **Kaggle notebook:** _link_ · **Date:** _date_

> Fill every `_…_` from **your own Kaggle run**. The notebook writes `outputs/results_table.md` (paste it into Section 8)
> and saves every figure in `outputs/`. Do not copy numbers that did not come from your run.

## 1. Introduction and objective
Goal: classify every pixel of a SAR image as sea, oil spill, look-alike, ship or land, and compare a U-Net trained from
scratch with an ImageNet-pretrained DeepLabV3+. Focus: the small, important classes (oil spill, ship), not only pixel accuracy.

## 2. Paper summary and dataset
* Krestenitis et al. (2019), *Oil Spill Identification from Satellite Images Using Deep Neural Networks*, Remote Sensing 11(15), 1762.
* Sentinel-1 SAR images, 1,112 annotated images: 1,002 train / 110 test, size _W × H_ (Section 2 output).
* Main difficulty: oil spills and look-alikes are both dark, smooth patches in SAR.

## 3. Class mapping, imbalance analysis and preprocessing
* Verified RGB → class table (Section 2 colour table): _all colours exact? yes/no_
* Pixel share per class (figure `class_imbalance.png`): sea _%_, oil _%_, look-alike _%_, ship _%_, land _%_
* Class weights (square-root median frequency): _values_
* Split: 902 train / 100 validation (seed 42) / 110 test, untouched until final evaluation.
* Resizing to 320 × 640 (image: area interpolation, mask: nearest neighbour).
* Normalisation: ImageNet mean/std for DeepLabV3+, training-set mean/std for U-Net (_values_).
* Augmentation: flips, random zoom (geometric, applied to image and mask together), brightness/contrast and speckle noise (image only).

## 4. U-Net architecture and experiments
* Encoder 32→64→128→256, bottleneck 512, decoder with transposed convolutions and **skip connections**, 1×1 conv → 5 classes; _N_ M parameters.
* Why skip connections: _your explanation_
* A1 `unet_ce` vs A2 `unet_wce_dice`: only the loss changes.

## 5. DeepLabV3+ pretrained setup and fine-tuning experiments
* Backbone: ResNet-34, ImageNet weights (`encoder_weights="imagenet"`, segmentation-models-pytorch 0.5.0). The notebook checks the weights are really pretrained.
* Head replaced for 5 classes (randomly initialised).
* B1 frozen encoder for the whole run · B2 frozen 5 epochs then full fine-tuning, encoder LR × 0.1 · B3 = B2 with Focal + Dice.

## 6. Loss functions and augmentation strategies
_Why each loss may help or hurt (table in notebook Section 6) and what your results show._

## 7. Training curves and overfitting analysis
For each experiment: curves figure (`outputs/<experiment>/curves.png`), best epoch, rule (highest validation mIoU), training time,
and whether the curves show over- or underfitting, unstable training, or reasonable convergence.

| Experiment | Best epoch | Training time (min) | Curve behaviour |
|---|---|---|---|
| unet_ce | _ | _ | _ |
| unet_wce_dice | _ | _ | _ |
| deeplab_frozen | _ | _ | _ |
| deeplab_finetune | _ | _ | _ |
| deeplab_focal_dice | _ | _ | _ |

## 8. Quantitative and qualitative evaluation
_Paste `outputs/results_table.md` here (mIoU, per-class IoU and Dice, pixel accuracy)._

Figures: `per_class_iou.png`, `confusion_matrices.png`, `qualitative_results.png`, `failures_oil_vs_lookalike.png`, `failures_missed_ships.png`.

## 9. Comparison, limitations and conclusion
* Best model per class and overall, and why.
* Why high pixel accuracy can hide poor rare-class performance (use your confusion matrices).
* Limitations: downscaling to 320 × 640 shrinks small ships; oil vs look-alike ambiguity; a single split; GPU non-determinism; limited epochs.
* Conclusion.

## 10. Team member contributions and references
| Member | Contribution |
|---|---|
| _name_ | _e.g. data inspection, preprocessing, augmentation_ |
| _name_ | _e.g. U-Net implementation and experiments_ |
| _name_ | _e.g. DeepLabV3+ fine-tuning experiments_ |
| _name_ | _e.g. evaluation, figures, failure analysis_ |
| _name_ | _e.g. report, mobile app and backend demo_ |

References: Krestenitis et al. 2019; Ronneberger et al. 2015 (U-Net); Chen et al. 2018 (DeepLabV3+); Lin et al. 2017 (Focal loss); segmentation-models-pytorch.

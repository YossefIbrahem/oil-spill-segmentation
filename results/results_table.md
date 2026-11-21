| experiment | model | loss | best_epoch | val_mIoU | test_mIoU | test_pixel_acc | IoU_sea | IoU_oil | IoU_lookalike | IoU_ship | IoU_land | Dice_sea | Dice_oil | Dice_lookalike | Dice_ship | Dice_land | train_min |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| unet_ce | U-Net | ce | 34 | 0.414 | 0.429 | 0.918 | 0.919 | 0.227 | 0.304 | 0.000 | 0.695 | 0.958 | 0.370 | 0.467 | 0.000 | 0.820 | 20.967 |
| unet_wce_dice | U-Net | wce_dice | 38 | 0.571 | 0.513 | 0.911 | 0.908 | 0.416 | 0.344 | 0.254 | 0.642 | 0.952 | 0.588 | 0.512 | 0.405 | 0.782 | 21.471 |
| deeplab_frozen | DeepLabV3+ | wce_dice | 31 | 0.666 | 0.638 | 0.954 | 0.952 | 0.532 | 0.509 | 0.327 | 0.872 | 0.975 | 0.694 | 0.674 | 0.493 | 0.932 | 6.778 |
| deeplab_finetune | DeepLabV3+ | wce_dice | 38 | 0.687 | 0.677 | 0.962 | 0.960 | 0.556 | 0.583 | 0.363 | 0.924 | 0.979 | 0.715 | 0.737 | 0.532 | 0.960 | 11.672 |
| deeplab_focal_dice | DeepLabV3+ | focal_dice | 35 | 0.712 | 0.655 | 0.958 | 0.956 | 0.548 | 0.558 | 0.374 | 0.838 | 0.977 | 0.708 | 0.716 | 0.545 | 0.912 | 11.807 |
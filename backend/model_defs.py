"""Model definitions used by the backend.

The U-Net code is identical to the one in the Kaggle notebook, so the saved weights load directly.
DeepLabV3+ comes from segmentation-models-pytorch (same version as in the notebook).
"""
import numpy as np
import torch
import torch.nn as nn

CLASS_NAMES = ["Sea surface", "Oil spill", "Look-alike", "Ship", "Land"]
CLASS_COLORS = np.array([[0, 0, 0], [0, 255, 255], [255, 0, 0], [153, 76, 0], [0, 153, 0]], dtype=np.uint8)


class DoubleConv(nn.Module):
    """(3x3 conv -> BatchNorm -> ReLU) x 2"""
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.block(x)


class UNet(nn.Module):
    def __init__(self, in_channels=3, num_classes=5, base=32):
        super().__init__()
        c1, c2, c3, c4, c5 = base, base * 2, base * 4, base * 8, base * 16
        # encoder
        self.enc1 = DoubleConv(in_channels, c1)
        self.enc2 = DoubleConv(c1, c2)
        self.enc3 = DoubleConv(c2, c3)
        self.enc4 = DoubleConv(c3, c4)
        self.pool = nn.MaxPool2d(2)
        # bottleneck
        self.bottleneck = DoubleConv(c4, c5)
        # decoder: upsample, concatenate the skip connection, then DoubleConv
        self.up4, self.dec4 = nn.ConvTranspose2d(c5, c4, 2, stride=2), DoubleConv(c4 * 2, c4)
        self.up3, self.dec3 = nn.ConvTranspose2d(c4, c3, 2, stride=2), DoubleConv(c3 * 2, c3)
        self.up2, self.dec2 = nn.ConvTranspose2d(c3, c2, 2, stride=2), DoubleConv(c2 * 2, c2)
        self.up1, self.dec1 = nn.ConvTranspose2d(c2, c1, 2, stride=2), DoubleConv(c1 * 2, c1)
        # 1x1 conv -> one score per class for every pixel
        self.head = nn.Conv2d(c1, num_classes, kernel_size=1)

    def forward(self, x):
        s1 = self.enc1(x)
        s2 = self.enc2(self.pool(s1))
        s3 = self.enc3(self.pool(s2))
        s4 = self.enc4(self.pool(s3))
        b = self.bottleneck(self.pool(s4))
        d4 = self.dec4(torch.cat([self.up4(b), s4], dim=1))
        d3 = self.dec3(torch.cat([self.up3(d4), s3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), s2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), s1], dim=1))
        return self.head(d1)


def load_model(path, device="cpu"):
    """Load a checkpoint saved by the notebook. Returns (model, metadata)."""
    ck = torch.load(path, map_location=device, weights_only=True)
    if ck["model_type"] == "unet":
        model = UNet(in_channels=3, num_classes=ck["num_classes"], base=ck["unet_base"])
    else:
        import segmentation_models_pytorch as smp
        # encoder_weights=None: the trained weights (including the fine-tuned encoder) come from the checkpoint
        model = smp.DeepLabV3Plus(encoder_name=ck["encoder_name"], encoder_weights=None,
                                  in_channels=3, classes=ck["num_classes"])
    model.load_state_dict(ck["state_dict"])
    model.to(device).eval()
    meta = {k: v for k, v in ck.items() if k != "state_dict"}
    return model, meta

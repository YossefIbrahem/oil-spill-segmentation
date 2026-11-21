Put the trained models here. Download them from the GitHub Release (see the main README, step 2),
or take them from `export.zip` produced by your own Kaggle run:

- `unet.pth`
- `deeplab.pth`

Every `.pth` file in this folder is loaded when `python app.py` starts. The file name (without `.pth`) is the model id the app uses.

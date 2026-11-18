import json
import sys

from PIL import Image, ImageDraw


for font in json.load(sys.stdin):
    box = font["bounds"]
    width = box["right"] - box["left"]
    height = box["bottom"] - box["top"]
    scale = min(360 / max(1, width), 126 / max(1, height))
    left = (400 - width * scale) / 2
    top = (154 - height * scale) / 2
    image = Image.new("RGB", (400, 154), "#f4f1e9")
    draw = ImageDraw.Draw(image)
    for x1, y1, x2, y2 in font["segments"]:
        draw.line((
            left + (x1 - box["left"]) * scale,
            top + (y1 - box["top"]) * scale,
            left + (x2 - box["left"]) * scale,
            top + (y2 - box["top"]) * scale,
        ), fill="#1b6661", width=2)
    image.resize((240, 92), Image.Resampling.LANCZOS).save(f'dist/client/fonts/{font["id"]}.webp', quality=88)

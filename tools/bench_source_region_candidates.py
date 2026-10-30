"""Offline, raster-only source-region benchmark. No AI, worker or deployment.

The CC0 source SVGs were rendered to PNG in fixture preparation. This program
never opens their vector geometry. This is not embroidery acceptance.
Optional dependencies are isolated in tools/requirements-vectorise.txt.
"""
import argparse
from pathlib import Path
import io
import json
import re
import time
import importlib.metadata
from xml.etree import ElementTree as ET

import numpy as np
import cv2
import cairosvg
import vtracer
from PIL import Image

CONFIGS = {
    'colour_cutout16': dict(mode='polygon', hierarchical='cutout', max_colors=16),
    'watershed_cutout16': dict(clustering='watershed', mode='polygon',
                             hierarchical='cutout', max_colors=16, watershed_detail=128),
    'watershed_cutout32': dict(clustering='watershed', mode='polygon',
                             hierarchical='cutout', max_colors=32, watershed_detail=128),
}


def matte(rgba):
    alpha = rgba[:, :, 3:4] / 255.0
    return np.rint(rgba[:, :, :3] * alpha + 255 * (1 - alpha)).astype(np.uint8)


def edges(rgb):
    return np.any(np.stack([cv2.Canny(rgb[:, :, c], 40, 100) > 0 for c in range(3)]), axis=0)


def measure(truth, rendered, svg):
    # Measure the unmodified vector render, before any source-alpha preview clip.
    a, b = matte(truth), matte(rendered)
    foreground = truth[:, :, 3] > 60
    distance = np.linalg.norm(a.astype(float) - b.astype(float), axis=2)
    ea, eb = edges(a), edges(b)
    da = cv2.distanceTransform(np.uint8(~ea), cv2.DIST_L2, 5)
    db = cv2.distanceTransform(np.uint8(~eb), cv2.DIST_L2, 5)
    paths = list(ET.fromstring(svg).iter('{http://www.w3.org/2000/svg}path'))
    commands = [len(re.findall('[MLCQSTHVZmlcqsthvz]', p.get('d', ''))) for p in paths]
    rings = [len(re.findall('[Mm]', p.get('d', ''))) for p in paths]
    return dict(
        foreground_pixels=int(foreground.sum()),
        source_colour_support_within_60_rgb=round(float((distance[foreground] <= 60).mean()), 5),
        mean_rgb_error_on_source=round(float(np.abs(a.astype(float) - b.astype(float))[foreground].mean()), 3),
        edge_recall_within_2px=round(float((db[ea] <= 2).mean()), 5),
        edge_precision_within_2px=round(float((da[eb] <= 2).mean()), 5),
        outside_source_nonwhite_pixels=int((np.any(b < 245, axis=2) & ~foreground).sum()),
        svg_paths=len(paths), multi_ring_paths=int(sum(x > 1 for x in rings)),
        total_path_commands=sum(commands), largest_path_commands=max(commands, default=0),
        within_numeric_budgets_only=(len(paths) <= 128 and sum(commands) <= 5000
                                     and max(commands, default=0) <= 512),
        compound_path_contract_supported=False, machine_approved=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inputs', type=Path, default=Path('tests/fixtures/artwork-evaluation'))
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    rows = []
    for source in json.loads((args.inputs / 'manifest.json').read_text())['samples']:
        name = source['id']
        image = Image.open(args.inputs / source['raster_file']).convert('RGBA')
        a = np.array(image)
        Image.fromarray(matte(a)).save(args.output / f'{name}-source.png')
        # Do not let invisible RGB under alpha=0 influence the candidate palette.
        model_pixels = np.dstack((matte(a), np.full(a.shape[:2], 255, np.uint8)))
        for label, parameters in CONFIGS.items():
            config = vtracer.Config(**parameters)
            times, outputs = [], []
            for _ in range(2):
                start = time.perf_counter()
                svg = config.convert_pixels(model_pixels.tobytes(), image.width, image.height)
                times.append(round((time.perf_counter() - start) * 1000, 2))
                outputs.append(svg)
            svg = outputs[0]
            (args.output / f'{name}-{label}.svg').write_text(svg)
            png = cairosvg.svg2png(bytestring=svg.encode(), output_width=image.width,
                                  output_height=image.height)
            rendered = np.array(Image.open(io.BytesIO(png)).convert('RGBA'))
            row = dict(id=name, algorithm=label, parameters=parameters, input_size=image.size,
                       times_ms=times, deterministic=outputs[0] == outputs[1],
                       **measure(a, rendered, svg))
            # PNG is an honest inspection preview. This clip is NOT native geometry.
            rendered[:, :, 3] = a[:, :, 3]
            Image.fromarray(matte(rendered)).save(args.output / f'{name}-{label}.png')
            rows.append(row)
            print(json.dumps(row), flush=True)
    report = dict(
        scope='Automatic raster-derived vector candidates. No AI semantics, hand-authored target regions, stitches or machine files. Sources are licensed vector-origin illustrations rendered to raster, not paintings.',
        metric_scope='All metrics use the unmodified vector render; RGB support uses Euclidean RGB distance <=60 on source alpha>60. Edge matching uses 2px tolerance. These are image metrics, not stitch quality or semantic acceptance.',
        preview_scope='Preview PNGs clip alpha to the source for comparison. SVG geometry has not been clipped to the source; it is NOT safe machine input.',
        environment={m: importlib.metadata.version(m) for m in [
            'vtracer', 'opencv-python-headless', 'numpy', 'Pillow', 'CairoSVG']}, rows=rows)
    (args.output / 'candidate-report.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()

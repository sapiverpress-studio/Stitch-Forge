"""Stitch Forge offline source-colour audit (NOT embroidery digitising).

Bounded, deterministic source-pixel experiment. No OpenAI, hosted worker,
PES/DST generation, or machine-approval claims. Do not wire into the website
or native machine worker without a separate acceptance and safety review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape

import cv2
import numpy as np
from PIL import Image

MAX_PIXELS = 750_000
MAX_VERTICES = 800_000
MAX_COMPONENTS = 60_000


def prepare(source: Image.Image, *, max_dim: int = 768, colors: int = 12,
            background_distance: float = 24):
    if not 2 <= colors <= 24:
        raise ValueError('palette size must be 2..24')
    if not 64 <= max_dim <= 1024:
        raise ValueError('max_dim must be 64..1024')
    rgb = source.convert('RGB')
    ow, oh = rgb.size
    if ow < 2 or oh < 2 or ow * oh > 40_000_000:
        raise ValueError('invalid/oversized source')
    scale = min(1.0, max_dim/max(ow, oh), (MAX_PIXELS/(ow*oh)) ** 0.5)
    size = (max(2, round(ow*scale)), max(2, round(oh*scale)))
    arr = cv2.resize(np.asarray(rgb), size, interpolation=cv2.INTER_AREA)
    border = np.concatenate([arr[0], arr[-1], arr[:, 0], arr[:, -1]], axis=0)
    bg = np.median(border.astype(np.float32), axis=0)
    med_error = float(np.median(np.linalg.norm(border.astype(np.float32)-bg, axis=1)))
    if med_error > 30:
        raise ValueError('complex_border_background_not_supported')
    candidate = np.linalg.norm(arr.astype(np.float32)-bg, axis=2) > background_distance
    if int(candidate.sum()) < 64:
        raise ValueError('no_supported_foreground')
    lab = cv2.cvtColor(arr, cv2.COLOR_RGB2LAB)
    px = lab[candidate].astype(np.float32)
    rng = np.random.default_rng(17)
    picked = rng.choice(len(px), size=min(45000, len(px)), replace=False)
    cv2.setRNGSeed(17)
    _, _, centers = cv2.kmeans(px[picked], colors, None,
            (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 25, .25),
            3, cv2.KMEANS_PP_CENTERS)
    palette = cv2.cvtColor(centers.astype('uint8').reshape(1, colors, 3),
                           cv2.COLOR_LAB2RGB).reshape(colors, 3)
    chosen = np.full(candidate.shape, -1, dtype=np.int16)
    # Chunk the palette-distance computation to bound transient memory.
    for y in range(0, arr.shape[0], 48):
        block = arr[y:y+48].astype(np.int32)
        distances = ((block[:, :, None, :] - palette[None, None, :, :].astype(np.int32))**2).sum(axis=3)
        chosen[y:y+48][candidate[y:y+48]] = np.argmin(distances, axis=2)[candidate[y:y+48]]
    preview = np.full(arr.shape, 255, dtype=np.uint8)
    preview[candidate] = palette[chosen[candidate]]
    return arr, candidate, chosen, palette, preview, med_error


def paths_svg(chosen: np.ndarray, palette: np.ndarray):
    """Lossless pixel-run geometry for source audit, NOT sewable regions."""
    height, width = chosen.shape
    elements, manifest = [], []
    total_components = total_vertices = tiny_components = 0
    for index, rgb in enumerate(palette):
        mask = np.uint8(chosen == index) * 255
        contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        total_components += len(contours)
        tiny_components += sum(1 for c in contours if cv2.contourArea(c) < 3)
        commands = []
        for y in range(height):
            row = chosen[y]
            x = 0
            while x < width:
                if row[x] != index:
                    x += 1
                    continue
                end = x+1
                while end < width and row[end] == index:
                    end += 1
                commands.append(f'M{x} {y}h{end-x}v1h-{end-x}Z')
                x = end
        total_vertices += len(commands)*4
        if total_components > MAX_COMPONENTS or total_vertices > MAX_VERTICES:
            raise ValueError('source_geometry_complexity_limit')
        color = '#'+''.join(f'{int(v):02x}' for v in rgb)
        if commands:
            elements.append(f'<path fill="{color}" d="{escape(" ".join(commands))}"/>')
        manifest.append({'color': color, 'pixels': int(np.count_nonzero(mask)),
                         'contour_rings': len(contours), 'pixel_runs': len(commands)})
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
           f'viewBox="0 0 {width} {height}" data-status="PIXEL_EXACT_GEOMETRY_NOT_DIGITISED">'
           + ''.join(elements) + '</svg>')
    return svg, manifest, total_components, total_vertices, tiny_components


def run(source_path: str, output_dir: str) -> dict:
    path = Path(source_path)
    with Image.open(path) as source:
        arr, foreground, chosen, palette, preview, border_error = prepare(source)
    svg, regions, components, vertices, tiny = paths_svg(chosen, palette)
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(preview).save(out/'source-colour-preview-NOT-STITCHES.png')
    (out/'source-colour-regions-NOT-DIGITISED.svg').write_text(svg, encoding='utf-8')
    report = {
        'status': 'SOURCE_GEOMETRY_EXPERIMENT_NOT_MACHINE_APPROVED',
        'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'dimensions': [int(arr.shape[1]), int(arr.shape[0])],
        'foreground_pixels': int(foreground.sum()),
        'represented_source_pixels': int(np.count_nonzero(chosen >= 0)),
        'coverage': float(np.count_nonzero(chosen >= 0) / foreground.sum()),
        'palette_size': len(regions),
        'contour_rings': components, 'vertices': vertices,
        'tiny_contours_under_3px': tiny, 'border_median_error': border_error,
        'regions_by_colour': regions,
        'machine_eligible': False, 'machine_files_generated': False,
        'hold_reasons': [
            'missing_stitch_semantics_and_routing',
            'tiny_and_short_fragments_need_safe_clustering',
            'colour_match_not_verified_against_thread_palette',
            'fabric_and_real_machine_not_tested'
        ]
    }
    (out/'source-geometry-audit.json').write_text(json.dumps(report, indent=2))
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('image')
    p.add_argument('outdir')
    args = p.parse_args()
    result = run(args.image, args.outdir)
    print(json.dumps({k: v for k, v in result.items()
                      if k != 'regions_by_colour'}, indent=2))

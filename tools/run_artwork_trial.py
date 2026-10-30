"""Original local PNG -> app preparation -> real native engineering trial.

Requires explicitly installed free local tooling. Does not call a hosted worker,
model or deployment, and never claims these research files are machine approved.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'services/digitiser'))
from artwork_trial import run_trial, texture_trial, checked_masks


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--image',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--engine',type=Path,required=True)
    p.add_argument('--width-mm',type=float,default=80)
    p.add_argument('--engine-timeout',type=int,choices=range(1,181),default=60)
    p.add_argument('--texture-window-mm',type=float,default=None,help='Optional local research pass, 0.05–0.25mm axis radius; feature/likeness review remains mandatory')
    a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
    try:
        with Image.open(a.image) as original:
            if original.width*original.height>45000000:raise ValueError('Image exceeds 45 megapixels')
            original_size=original.size
            image=original.convert('RGBA');factor=min(1,768/max(image.size))
            image=image.resize((round(image.width*factor),round(image.height*factor)),Image.Resampling.LANCZOS)
        with TemporaryDirectory() as tmp:
            raw=Path(tmp)/'source.rgba';raw.write_bytes(image.tobytes())
            subprocess.run(['node',str(ROOT/'tools/prepare_artwork_trial.cjs'),str(raw),str(image.width),str(image.height),str(a.width_mm),str(a.output.resolve()),str(original_size[0]),str(original_size[1])],cwd=ROOT,check=True)
        plan=json.loads((a.output/'source-object-plan.json').read_text())
        if a.texture_window_mm is not None:
            plan=texture_trial(plan,a.texture_window_mm)
            (a.output/'texture-trial-plan.json').write_text(json.dumps(plan))
            masks,_=checked_masks(plan)
            import numpy as np
            pixels=np.zeros((image.height,image.width,4),dtype=np.uint8)
            for color,mask in masks.items():pixels[mask]=[int(color[i:i+2],16) for i in (1,3,5)]+[255]
            Image.fromarray(pixels).save(a.output/'texture-trial-NOT-STITCHES.png')
        result=run_trial(plan,a.engine,a.output,a.engine_timeout)
        print(json.dumps({'status':result['status'],'nativePaths':result['nativePaths'],'unresolvedObjects':result['unresolvedObjects'],
            'decoded':[{'format':r['format'],'needleStitches':r['needleStitches'],'outsidePoints':r['needlePointsOutsideWorkingColour'],
            'outsideSegments':r['needleSegmentsOutsideWorkingColour']} for r in result['decoded']]}))
    except Exception as error:
        (a.output/'trial-failure.json').write_text(json.dumps({'status':'ARTWORK_TRIAL_FAILED_NO_APPROVAL','error':str(error),'machineEligible':False},indent=2)+'\n')
        raise


if __name__=='__main__':main()

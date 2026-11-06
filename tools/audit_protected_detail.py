#!/usr/bin/env python3
"""Private, source-grounded detail loss review; never posts the original PNG."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'digitiser'))
from protected_detail_audit import audit_protected_details


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--original',type=Path,required=True)
    parser.add_argument('--windows',type=Path,required=True,
                        help="Local JSON array of pixel rectangles selected by the artist")
    parser.add_argument('--comparison',type=Path,
                        help="Optional matching palettised/prepared PNG; NOT a stitch simulation")
    parser.add_argument('--width-mm',type=float,default=80)
    parser.add_argument('--output',type=Path,required=True)
    a=parser.parse_args()
    windows_file=a.windows.read_bytes()
    if len(windows_file)>8192:
        raise ValueError('Excessive private window definition')
    report=audit_protected_details(a.original,json.loads(windows_file),
          width_mm=a.width_mm,comparison_png=a.comparison)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'sourceSha256':report['sourcePngSha256'],
                      'features':report['featureWindows'],'output':str(a.output)},indent=2))


if __name__=='__main__':main()

#!/usr/bin/env python3
"""Inspect an existing project locally; no engine invocation, network or charges."""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/digitiser'))
from project_bridge import convert_project
from stitch_planning import inspect_plan
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('project',type=Path)
 args=parser.parse_args()
 print(json.dumps(inspect_plan(convert_project(args.project.read_bytes())),indent=2))

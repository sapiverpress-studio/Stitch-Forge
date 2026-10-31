"""Realistic-art engineering trials, also used by an explicitly enabled route.

Source masks, geometry preparation, native stitches and physical quality are
different evidence. This module never grants machine/export approval. It can
generate real trial files, retain rejected output for diagnosis, and measure
every decoded needle/segment against independently rebuilt source-colour masks.
Optional open-source imaging dependencies are local evaluation tools only.
"""
from collections import defaultdict
from dataclasses import asdict
from hashlib import sha256
from io import BytesIO
import json
from math import atan2, degrees, hypot, isfinite,ceil
from pathlib import Path
import re
import struct
import zipfile
from xml.etree import ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, label, uniform_filter
from shapely import Polygon, LineString, Point, box, union_all, make_valid, covers, prepare,points as shape_points
from skimage.morphology import skeletonize
import pyembroidery
from inkstitch_cli import export_trusted_svg, _run_engine, DigitiserError
from format_audit import audit_zip

INK = '{http://inkstitch.org/namespace}'
ET.register_namespace('inkstitch', INK[1:-1])


def validate_native_payload(fmt, raw):
    """Readers can synthesize END on EOF; verify native framing first."""
    if not isinstance(raw,bytes) or not 32<=len(raw)<=20000000:
        raise ValueError('Invalid native machine payload size')
    if fmt=='dst':
        if (not raw.startswith(b'LA:') or len(raw)<515 or (len(raw)-512)%3
                or raw[-3:]!=b'\x00\x00\xf3'):
            raise ValueError('Incomplete native DST command frame or END')
    elif fmt=='pes':
        if not raw.startswith(b'#PES0060') or len(raw)<12:
            raise ValueError('Expected complete native PES6')
        offset=int.from_bytes(raw[8:12],'little')
        if offset<12 or offset+528>=len(raw):raise ValueError('Invalid PES PEC offset')
        length=int.from_bytes(raw[offset+514:offset+517],'little');end=offset+512+length
        colors=raw[offset+48]+1;graphics=raw[offset+34]*raw[offset+35]*(colors+1)
        # Pinned native PES6 writer: 128-byte colour-index addendum,
        # 144+3 bytes per RGB entry, then a two-byte footer. This is an
        # intentionally narrow native-output contract, not a PES importer.
        expected=end+graphics+128+147*colors+2
        if (length<17 or end>len(raw) or raw[end-1]!=255 or not graphics
                or expected!=len(raw) or raw[-2:]!=b'\x00\x00'):
            raise ValueError('Incomplete PES stitch block, END, graphics or addendum')
    else:raise ValueError('Unsupported native payload format')


def checked_masks(plan):
    if (not isinstance(plan, dict) or plan.get('schema') not in ('stitch-forge-source-object-plan-v1','stitch-forge-local-texture-trial-v1')
            or plan.get('machineEligible') is not False):
        raise ValueError('Expected an unapproved source object plan')
    w, h = plan['source']['width'], plan['source']['height']
    mm = plan['physical']['imageWidthMm']
    if (any(isinstance(v, bool) or not isinstance(v, int) or v < 48 for v in (w, h)) or w*h > 750000
            or isinstance(mm, bool) or not isinstance(mm, (int, float)) or not isfinite(mm) or not 10 <= mm <= 250
            or mm*h/w > 296 or not re.fullmatch('[0-9a-f]{64}', plan['source']['sha256'])):
        raise ValueError('Invalid artwork dimensions or identity')
    if not isinstance(plan.get('regions'), list) or not 1 <= len(plan['regions']) <= 12:
        raise ValueError('Invalid source palette')
    occupied = np.zeros((h, w), dtype=bool)
    masks, runs = {}, 0
    for region in plan['regions']:
        color = region.get('color')
        if not isinstance(color, str) or not re.fullmatch('#[0-9A-F]{6}', color) or color in masks:
            raise ValueError('Invalid source colour')
        record = region['ledger']
        if record.get('width') != w or record.get('height') != h:
            raise ValueError('Source mask dimensions differ')
        mask = np.zeros((h, w), dtype=bool)
        for component in record['components']:
            count = 0
            for run in component['runs']:
                runs += 1
                if (runs > 200000 or not isinstance(run, list) or len(run) != 3
                        or any(isinstance(n, bool) or not isinstance(n, int) for n in run)):
                    raise ValueError('Invalid source run budget/coordinates')
                y, x0, x1 = run
                if not (0 <= y < h and 0 <= x0 < x1 <= w) or mask[y, x0:x1].any():
                    raise ValueError('Source runs overlap or leave image')
                mask[y, x0:x1] = True
                count += x1-x0
            if count != component['pixelArea']:
                raise ValueError('Source component accounting differs')
        if occupied[mask].any() or int(mask.sum()) != record['foregroundPixels']:
            raise ValueError('Source colour accounting differs')
        occupied |= mask
        masks[color] = mask
    if int(occupied.sum()) != plan['summary']['sourcePixels']:
        raise ValueError('Source foreground accounting differs')
    return masks, mm/w


def texture_trial(plan, window_radius_mm):
    """One physically bounded colour-mode pass; reference masks stay separate.

    This deliberately trades fine texture for fewer objects. It NEVER proves
    feature preservation. Lost working components and recolouring are counted,
    with a permanent export/likeness-review blocker. No downsampling or chained
    iterative smoothing is performed; all votes read the same original masks.
    """
    if (isinstance(window_radius_mm,bool) or not isinstance(window_radius_mm,(int,float))
            or not isfinite(window_radius_mm) or not .05<=window_radius_mm<=.25):
        raise ValueError('Texture trial radius must be 0.05–0.25mm')
    masks,scale=checked_masks(plan);colors=list(masks);stack=np.array([masks[c] for c in colors]);fg=stack.any(axis=0)
    radius=min(4,int(window_radius_mm/scale));size=2*radius+1
    old=stack.argmax(axis=0)
    votes=np.array([uniform_filter(m.astype(float),size=size,mode='constant') for m in stack])
    winner=votes.argmax(axis=0);best=np.take_along_axis(votes,winner[None,...],axis=0)[0]
    original_votes=np.take_along_axis(votes,old[None,...],axis=0)[0]
    # Preserve the original colour on ties, including detached one-pixel marks.
    new=np.where(best>original_votes+1e-12,winner,old)
    regions=[];lost=[];total_parts=0
    for i,color in enumerate(colors):
        mask=(new==i)&fg;labels,count=label(mask);groups=[{'id':'component-'+str(j+1),'runs':[],'pixelArea':0} for j in range(count)]
        for y,row in enumerate(labels):
            start=0
            while start<len(row):
                value=int(row[start]);end=start+1
                while end<len(row) and row[end]==value:end+=1
                if value:
                    group=groups[value-1];group['runs'].append([y,start,end]);group['pixelArea']+=end-start
                start=end
        original_labels,original_count=label(masks[color])
        remaining=np.bincount(original_labels[mask],minlength=original_count+1)
        areas=np.bincount(original_labels.ravel(),minlength=original_count+1)
        for j in range(1,original_count+1):
            if not remaining[j]:lost.append({'color':color,'sourceWorkingComponent':j,'pixels':int(areas[j])})
        if groups:
            total_parts+=count;regions.append({'color':color,'ledger':{'width':mask.shape[1],'height':mask.shape[0],
                'foregroundPixels':int(mask.sum()),'components':groups}})
    changed=int(((old!=new)&fg).sum())
    record={'algorithm':'single_physical_colour_mode_MD-2.48','requestedAxisRadiusMm':window_radius_mm,
        'actualAxisRadiusPixels':radius,'actualAxisRadiusMm':radius*scale,'maxTargetSampleDistanceMm':2**.5*radius*scale,
        'recolouredPixelsRelativeToInputPlan':changed,'inputWorkingParts':plan['summary']['workingParts'],'outputWorkingParts':total_parts,
        'lostWorkingComponents':lost,'lostWorkingComponentPixels':sum(o['pixels'] for o in lost),
        'selectedForegroundUnchanged':True,'criticalFeaturePreservationVerified':False,'humanLikenessVerified':False}
    result={'schema':'stitch-forge-local-texture-trial-v1','source':plan['source'],'physical':plan['physical'],
        'sourcePlanSignature':sha256(json.dumps({'parent':plan['sourcePlanSignature'],'radius':window_radius_mm,'algorithm':record['algorithm']},sort_keys=True).encode()).hexdigest(),
        'regions':regions,'summary':{**plan['summary'],'workingParts':total_parts,'recolouredPixels':changed,'protectedPartsRecoloured':None},
        'textureApproximation':record,'machineEligible':False,'status':'TEXTURE_APPROXIMATION_REQUIRES_LIKENESS_REVIEW'}
    checked_masks(result)
    return result


def skeleton_paths(mask):
    """Trace every skeleton graph edge; branch paths/cycles stay explicit."""
    sk = skeletonize(mask)
    pixels = set(map(tuple, np.argwhere(sk)))
    def adjacent(p):
        y, x = p
        # Do not introduce diagonal shortcuts when an orthogonal connection exists.
        return sorted(q for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                      if (dy or dx) and (q := (y+dy, x+dx)) in pixels
                      and not (dy and dx and ((y+dy, x) in pixels or (y, x+dx) in pixels)))
    neighbours = {p: adjacent(p) for p in pixels}
    visited, paths = set(), []
    edge = lambda p, q: tuple(sorted((p, q)))
    starts = sorted(pixels, key=lambda p: (len(neighbours[p]) == 2, p))
    for start in starts:
        for nxt in neighbours[start]:
            if edge(start, nxt) in visited:
                continue
            chain, previous, current = [start], start, nxt
            visited.add(edge(previous, current))
            while True:
                chain.append(current)
                if len(neighbours[current]) != 2 or current == start:
                    break
                after = next(q for q in neighbours[current] if q != previous)
                if edge(current, after) in visited:
                    break
                visited.add(edge(current, after))
                previous, current = current, after
            paths.append([(x+.5, y+.5) for y, x in chain])
    return paths, len(pixels), sum(not neighbours[p] for p in pixels)


def route_skeleton_branches(paths):
    """Join connected branch chains, walking each edge at most twice.

    No straight shortcut is introduced. Pure isolated cycles are walked once.
    Retracing is an explicit research choice; decoded density remains bounded.
    """
    adjacency=defaultdict(list)
    for i,path in enumerate(paths):
        adjacency[tuple(path[0])].append(i);adjacency[tuple(path[-1])].append(i)
    used=set();routes=[]
    for start in sorted(adjacency,key=lambda p:(len(adjacency[p])!=1,p)):
        if all(i in used for i in adjacency[start]):continue
        route=[start];stack=[(start,iter(adjacency[start]),None)]
        while stack:
            node,edges,incoming=stack[-1]
            next_edge=next((i for i in edges if i not in used),None)
            if next_edge is None:
                stack.pop()
                if incoming is not None:route.extend(list(reversed(incoming))[1:])
                continue
            used.add(next_edge);chain=paths[next_edge]
            if tuple(chain[0])!=node:chain=list(reversed(chain))
            route.extend(chain[1:]);end=tuple(chain[-1])
            if end!=node:stack.append((end,iter(adjacency[end]),chain))
        routes.append(route)
    return routes


def component_axis(component):
    """Geometric axis only; no feather/fur/petal semantic claim."""
    n=component['pixelArea'];sx=sy=sxx=syy=sxy=0.
    for y,x0,x1 in component['runs']:
        count=x1-x0;xx=np.arange(x0,x1,dtype=float)+.5;yy=y+.5
        sx+=float(xx.sum());sy+=count*yy;sxx+=float((xx*xx).sum());syy+=count*yy*yy;sxy+=float(xx.sum())*yy
    xx=sxx/n-(sx/n)**2;yy=syy/n-(sy/n)**2;xy=sxy/n-sx*sy/(n*n)
    spread=hypot(xx-yy,2*xy);major=(xx+yy+spread)/2;minor=max(0.,(xx+yy-spread)/2)
    if major/max(minor,1e-9)<1.5:return 0,False
    angle=round((-degrees(atan2(2*xy,xx-yy))/2)/15)*15
    return angle,True


def order_source_components(components):
    """Reorder same-colour components for shorter geometric travel only.

    Each original source component index is retained for repair receipts and
    decoded audit attribution. No shapes or colours are merged by this step.
    Nearest-centre is a bounded heuristic, NOT a sew-out routing proof.
    """
    todo={}
    for i,component in enumerate(components):
        bounds=component['bounds']
        cx=bounds['x']+bounds['w']/2
        cy=bounds['y']+bounds['h']/2
        todo[i]=(component,(cx,cy))
    result=[];last=(0.,0.)
    while todo:
        index=min(todo,key=lambda i:(
            (todo[i][1][0]-last[0])**2+(todo[i][1][1]-last[1])**2,i))
        component,centre=todo.pop(index)
        result.append((index,component));last=centre
    return result


def fill_underlay_eligible(piece,scale):
    """Stabilise larger, genuinely wide fills; don't underlay feather specks.

    Conservative 8 mm² / 1.4 mm interior threshold. All inset stitching is
    subsequently checked against the original mask in the native stitch audit.
    No fabric-specific compensation is implied.
    """
    return (piece.area*scale*scale>=8.0 and
            not piece.buffer(-.7/scale).is_empty)


def bounded_fill_parts(poly,scale):
    """Partition only complex native input, retaining its exact polygon union.

    8mm source-frame grid and >500-vertex threshold bound native routing work;
    they are not stitch density/fabric settings. No manually emitted stitches.
    """
    vertices=len(poly.exterior.coords)+sum(len(r.coords) for r in poly.interiors)
    if vertices<=500:return [poly]
    step=8/scale;x0,y0,x1,y1=poly.bounds;parts=[]
    for y in np.arange(np.floor(y0/step)*step,y1,step):
        for x in np.arange(np.floor(x0/step)*step,x1,step):
            piece=poly.intersection(box(x,y,x+step,y+step))
            candidates=[piece] if piece.geom_type=='Polygon' else list(piece.geoms) if hasattr(piece,'geoms') else []
            parts.extend(p for p in candidates if p.geom_type=='Polygon' and not p.is_empty and p.area>0)
    if not parts or abs(sum(p.area for p in parts)-poly.area)>max(1e-7,poly.area*1e-10) or union_all(parts).symmetric_difference(poly).area>1e-7:
        raise ValueError('Native fill partition changed source geometry')
    return parts


def without_collinear_steps(points):
    """Remove redundant straight pixel steps without moving the source path.

    Preserve reversals/retraced skeleton edges. This changes representation
    size only; it does not generalise, skip corners or emit needle commands.
    """
    result=[]
    for point in points:
        while len(result)>=2:
            a,b=result[-2:];u=(b[0]-a[0],b[1]-a[1]);v=(point[0]-b[0],point[1]-b[1])
            if u[0]*v[1]!=u[1]*v[0] or u[0]*v[0]+u[1]*v[1]<=0:break
            result.pop()
        result.append(point)
    return result


def build_trial_svg(plan,partition_fills=False,running_overrides=()):
    running_overrides=frozenset(running_overrides)
    if len(running_overrides)>12:raise ValueError("Native repair object budget exceeded")
    masks, scale = checked_masks(plan)
    contour_tolerance=.02 if partition_fills else .04
    running_tolerance=.01 if partition_fills else .03
    precision=4 if partition_fills else 6
    w, h = plan['source']['width'], plan['source']['height']
    width, height = w*scale+4, h*scale+4
    root = ET.Element('svg', {'xmlns': 'http://www.w3.org/2000/svg', 'width': f'{width:.6f}mm',
        'height': f'{height:.6f}mm', 'viewBox': f'0 0 {width:.6f} {height:.6f}'})
    metadata=ET.SubElement(root, 'metadata')
    ET.SubElement(metadata, INK+'inkstitch_svg_version').text = '4'
    ET.SubElement(metadata, INK+'collapse_len_mm').text = '0'
    ET.SubElement(metadata, INK+'min_stitch_len_mm').text = '0.05'
    defs = ET.SubElement(root, 'defs')
    ET.SubElement(defs, 'symbol', {'id':'inkstitch_origin'})
    ET.SubElement(root, 'use', {'{http://www.w3.org/1999/xlink}href':'#inkstitch_origin',
        'x':f'{width/2:.6f}', 'y':f'{height/2:.6f}'})
    records, path_count, total_vertices = [], 0, 0
    underlay_count=0;running_branches=0;routed_walks=0
    fill_pieces=[];repaired=[]
    def add_path(color, points, closed=False, holes=(),angle=0,underlay=False):
        nonlocal path_count, total_vertices,underlay_count
        if partition_fills and not closed:points=without_collinear_steps(points)
        total_vertices += len(points)+sum(map(len, holes))
        path_count += 1
        if path_count > 1500 or total_vertices > 150000:
            raise ValueError('Native artwork trial exceeds path/vertex budget')
        def commands(ring):
            return 'M '+' L '.join(f'{2+x*scale:.{precision}f},{2+y*scale:.{precision}f}' for x, y in ring)
        attrs = {'id': f'artwork-{path_count}', 'd':commands(points)+(' Z' if closed else ''),
            INK+'random_seed':'stitch-forge-artwork-trial', INK+'running_stitch_length_mm':'1.5',
            INK+'running_stitch_tolerance_mm':str(running_tolerance),
            INK+'lock_start':'back_forth', INK+'lock_end':'back_forth',
            INK+'lock_start_scale_mm':'0.2', INK+'lock_end_scale_mm':'0.2'}
        if closed:
            attrs.update({'fill':color, 'fill-rule':'evenodd','stroke':'none', INK+'fill_method':'tatami_fill',
                INK+'angle':str(angle), INK+'row_spacing_mm':'0.5', INK+'max_stitch_length_mm':'3.5',
                INK+'fill_underlay':'true' if underlay else 'false',
                INK+'fill_underlay_angle':str((angle+90)%180),
                INK+'fill_underlay_row_spacing_mm':'1.5',
                INK+'fill_underlay_max_stitch_length_mm':'3.5',
                INK+'fill_underlay_inset_mm':'0.35',
                INK+'staggers':'4',
                INK+'underpath':'true', INK+'pull_compensation_mm':'0',
                INK+'pull_compensation_percent':'0', INK+'expand_mm':'0'})
            if underlay:underlay_count+=1
            attrs['d'] += ''.join(' '+commands(ring)+' Z' for ring in holes)
        else:
            attrs.update({'fill':'none','stroke':color,'stroke-width':'0.1',INK+'stroke_method':'running_stitch'})
        ET.SubElement(root,'path',attrs)
    for region in sorted(plan['regions'], key=lambda r:r['color']):
        color = region['color']
        # Bounds/rings are derived independently from runs, not trusted JSON topology.
        for index, component in order_source_components(region['ledger']['components']):
            xs = [x for _, x0, x1 in component['runs'] for x in (x0, x1)]
            ys = [y for y, _, _ in component['runs']]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)+1
            local = np.zeros((y1-y0+2, x1-x0+2), dtype=bool)
            rectangles = []
            for y, left, right in component['runs']:
                local[y-y0+1, left-x0+1:right-x0+1] = True
                rectangles.append(box(left,y,right,y+1))
            area = component['pixelArea']*scale*scale
            identity = color[1:]+'-'+str(index)
            record = {'id':identity,'color':color,'pixels':component['pixelArea'],'areaMm2':area,'nativePaths':0}
            previous = path_count
            if area < .025:
                record['action'] = 'unresolved_subneedle_texture'
            elif area >= .8 and max(0.,float(distance_transform_edt(local).max())-2**-.5)*scale >= .4:
                shape = union_all(rectangles)
                smooth = shape.simplify(contour_tolerance/scale, preserve_topology=True)
                if not smooth.is_valid or shape.hausdorff_distance(smooth)*scale > contour_tolerance+.001:
                    raise ValueError('Contour generalisation exceeded its source bound')
                polygons = [] if smooth.is_empty else [smooth] if smooth.geom_type == 'Polygon' else list(smooth.geoms)
                angle,directional=component_axis(component)
                piece_index=0
                for poly in polygons:
                    if poly.geom_type != 'Polygon' or poly.is_empty:
                        raise ValueError('Invalid native fill polygon')
                    angle,directional=component_axis(component)
                    pieces=bounded_fill_parts(poly,scale) if partition_fills else [poly]
                    for piece in pieces:
                        piece_id=identity+'-p'+str(piece_index);piece_index+=1
                        entry={'id':piece_id,'sourceObjectId':identity,'color':color,'pixels':ceil(piece.area),'areaMm2':piece.area*scale*scale}
                        if piece_id in running_overrides:
                            yy,xx=np.nonzero(local);selected=covers(piece,shape_points(xx+x0-.5,yy+y0-.5))
                            mask=np.zeros_like(local);mask[yy[selected],xx[selected]]=True
                            paths,_,_=skeleton_paths(mask);before=path_count
                            for points in route_skeleton_branches(paths):
                                if sum(hypot(b[0]-a[0],b[1]-a[1])*scale for a,b in zip(points,points[1:]))>=.2:
                                    add_path(color,[(x+x0-1,y+y0-1) for x,y in points])
                            if before==path_count:raise ValueError('Native repair has no source-supported running path')
                            repaired.append(entry)
                        else:
                            use_underlay=fill_underlay_eligible(piece,scale)
                            add_path(color,list(piece.exterior.coords)[:-1],True,[list(r.coords)[:-1] for r in piece.interiors],angle,use_underlay)
                            fill_pieces.append({**entry,'nativePathId':'artwork-'+str(path_count),
                                                'fillUnderlay':use_underlay})
                record['action'] = 'native_fill_trial'
                record['fillAngleDeg']=angle;record['geometryAxisUsed']=directional;record['semanticDirectionVerified']=False
                record['contourHausdorffMm'] = shape.hausdorff_distance(smooth)*scale
            else:
                paths, count, dots = skeleton_paths(local)
                branch_count=len(paths)
                # Connect only branches that share EXACT source-skeleton endpoints.
                # This is geometry-preserving region consolidation: no shortcuts,
                # no new colour pixels, and each skeleton edge walked at most twice.
                paths=route_skeleton_branches(paths)
                running_branches+=branch_count;routed_walks+=len(paths)
                for points in paths:
                    translated = [(x+x0-1,y+y0-1) for x,y in points]
                    # Small graph branches remain in the manifest; no artificial dot stitches.
                    if sum(hypot(b[0]-a[0],b[1]-a[1])*scale for a,b in zip(points,points[1:])) >= .2:
                        add_path(color,translated)
                record.update(action='native_running_trial' if path_count>previous else 'unresolved_short_detail',
                              skeletonPixels=count,isolatedSkeletonPixels=dots,sourceSkeletonBranches=branch_count,
                              routedConnectedBranchWalks=True,consolidatedSourceBranches=branch_count-len(paths))
            record['nativePaths'] = path_count-previous
            records.append(record)
    if {o['id'] for o in repaired}!=running_overrides or sum(o['pixels'] for o in repaired)>plan['summary']['sourcePixels']*.02:
        raise ValueError('Native repair exceeds source area or identity bound')
    if not path_count:
        raise ValueError('No physically resolvable native artwork paths')
    svg = ET.tostring(root,encoding='utf-8',xml_declaration=True)
    if len(svg)>2000000:
        raise ValueError('Native SVG exceeds engine input budget')
    manifest = {'status':'LOCAL_ARTWORK_ENGINEERING_TRIAL_NOT_MACHINE_APPROVED','machineEligible':False,
        'source':plan['source'],'sourcePlanSignature':plan['sourcePlanSignature'],'scaleMmPerPixel':scale,
        'originMm':[width/2,height/2],'widthMm':width,'heightMm':height,'objects':records,'nativePaths':path_count,
        'nativeFillPieces':fill_pieces,'nativeRepairObjects':repaired,
        'regionConsolidation':{'method':'connected_skeleton_edge_walk_and_same_colour_nearest_centre',
            'originalRunningBranches':running_branches,'connectedRunningWalks':routed_walks,
            'colourPixelsReassigned':0,'sourceGeometryChanged':False},
        'underlayFillPaths':underlay_count,
        'algorithm':'source_preserving_routed_tatami_MD-2.55','settings':{'fillDirection':'component_axis_in_15_degree_steps_or_horizontal_if_isotropic',
                     'fillRowSpacingMm':.5,'fillMaxStitchMm':3.5,'fillUnderlay':'selective_inset_on_wide_fills',
                     'fillUnderlayMinAreaMm2':8.,'fillUnderlayMinInteriorWidthMm':1.4,
                     'fillUnderlayInsetMm':.35,'fillUnderlayAngleDeltaDeg':90,
                     'fillUnderlayRowSpacingMm':1.5,'fillUnderlayMaxStitchMm':3.5,
                     'tatamiStaggers':4,'connectedSkeletonBranchRouting':True,'sameColourNearestCentreOrdering':True,
                    'runningLengthMm':1.5,'runningToleranceMm':running_tolerance,'contourToleranceMm':contour_tolerance,
                    'collapseJumpBelowMm':0,'minimumStitchMm':.05,'nativeLock':'back_forth','nativeLockScaleMm':.2,
                    'complexFillPartitionEnabled':partition_fills,'complexFillPartitionGridMm':8 if partition_fills else None,
                    'nativeFillInteriorTravel':True,'boundedNativeRepairMaxSourceFraction':.02},
        'limitations':['Shape-based fill/running trials; no AI semantics or satin planning.',
          'Geometric-axis fill and selective underlay are controlled trials, not semantic directions or fabric presets.',
          'Skeleton branches are not proven feather/vein intent. Unresolved tiny details are explicit.',
          'Connected skeleton branches may retrace; colour fragments remain unmodified and unresolved.',
           'Layer, routing, local density, thread palette and physical fabric quality require review.']}
    return svg, manifest, masks


def audit_trial(pattern, manifest, masks, fmt, translation):
    """Use independently decoded commands and RLE-derived colour geometry."""
    scale = manifest['scaleMmPerPixel']
    colors = sorted({o['color'] for o in manifest['objects'] if o['nativePaths']})
    allowed = {}
    for color in colors:
        mask = masks[color]
        runs = []
        for y,row in enumerate(mask):
            transitions = np.diff(np.pad(row.astype(np.int8),(1,1)))
            for x0,x1 in zip(np.flatnonzero(transitions==1),np.flatnonzero(transitions==-1)):
                runs.append(box(2+x0*scale,2+y*scale,2+x1*scale,2+(y+1)*scale))
        allowed[color] = union_all(runs).buffer(.11)
        prepare(allowed[color])
    if len(pattern.stitches)>125000:
        raise ValueError('Decoded command budget exceeded')
    moves,points = defaultdict(list),defaultdict(list)
    needle_points = []
    block=0; previous=None; max_length=0.; count=0; jumps=trims=changes=0
    density=defaultdict(int)
    for x,y,flags in pattern.stitches:
        command=flags & pyembroidery.COMMAND_MASK
        point=(x/10+translation[0],y/10+translation[1])
        if not all(isfinite(v) for v in point):raise ValueError('Non-finite needle coordinates')
        if command==pyembroidery.COLOR_CHANGE:changes+=1;block+=1
        elif command==pyembroidery.JUMP:jumps+=1
        elif command==pyembroidery.TRIM:trims+=1
        elif command==pyembroidery.STITCH:
            if block>=len(colors):raise ValueError('Unexpected decoded colour block')
            color=colors[block];count+=1;needle_points.append(point);points[color].append(Point(point))
            density[(int(point[0]),int(point[1]))]+=1
            if previous is not None:
                length=hypot(point[0]-previous[0],point[1]-previous[1]);max_length=max(max_length,length)
                if length>1e-9:moves[color].append(LineString((previous,point)))
        previous=point
    if (not pattern.stitches or pattern.stitches[-1][2]&pyembroidery.COMMAND_MASK!=pyembroidery.END
            or changes!=len(colors)-1 or count<3):
        raise ValueError('Incomplete END/needle/colour sequence')
    if fmt=='pes':
        actual=['#'+t.hex_color().lstrip('#').upper() for t in pattern.threadlist]
        if actual != colors:
            raise ValueError('Decoded PES colour order differs from artwork')
    failures=[]
    point_fail=sum(int(np.count_nonzero(~covers(allowed[c],items))) for c,items in points.items())
    segment_fail=0
    for c,items in moves.items():
        failed=np.flatnonzero(~covers(allowed[c],items));segment_fail+=len(failed)
        for i in failed[:max(0,12-len(failures))]:
            failures.append({'color':c,'fromMm':list(items[i].coords[0]),'toMm':list(items[i].coords[-1])})
    if max_length>3.65:raise ValueError('Decoded stitch-length bound exceeded')
    if max(density.values(),default=0)>120:raise ValueError('Decoded local-command-density bound exceeded')
    coverage={}
    direction={o['id']:{'requestedAngleDeg':o['fillAngleDeg'],'attributedLongSegmentMm':0.,'alignedWithin8DegMm':0.}
               for o in manifest['objects'] if o['action']=='native_fill_trial'}
    for c,mask in masks.items():
        labels,_=label(mask)
        im=Image.new('1',(mask.shape[1],mask.shape[0]));draw=ImageDraw.Draw(im)
        for line in moves[c]:
            xy=[((x-2)/scale,(y-2)/scale) for x,y in line.coords]
            draw.line(xy,fill=1,width=max(1,round(.5/scale)))
            a,b=list(line.coords);length=line.length
            mx,my=int(((a[0]+b[0])/2-2)/scale),int(((a[1]+b[1])/2-2)/scale)
            if length>=1 and 0<=my<mask.shape[0] and 0<=mx<mask.shape[1] and labels[my,mx]:
                identity=c[1:]+'-'+str(labels[my,mx]-1)
                if identity in direction:
                    d=direction[identity];d['attributedLongSegmentMm']+=length
                    angle=degrees(atan2(-(b[1]-a[1]),b[0]-a[0]));error=abs((angle-d['requestedAngleDeg']+90)%180-90)
                    if error<=8:d['alignedWithin8DegMm']+=length
        hit=int((np.asarray(im,dtype=bool)&mask).sum())
        coverage[c]={'selectedPixels':int(mask.sum()),'pixelsNearDecodedPath':hit,'fractionNearDecodedPath':hit/int(mask.sum())}
    for d in direction.values():d['alignedLongSegmentFraction']=d['alignedWithin8DegMm']/d['attributedLongSegmentMm'] if d['attributedLongSegmentMm'] else None
    xs,ys=zip(*needle_points)
    return {'format':fmt,'needleStitches':count,'colourChanges':changes,'jumps':jumps,'trims':trims,
        'boundsMm':[max(xs)-min(xs),max(ys)-min(ys)],'maxNeedleMoveMm':max_length,'maxNeedlesInOneMmSquare':max(density.values()),
        'needlePointsOutsideWorkingColour':point_fail,'needleSegmentsOutsideWorkingColour':segment_fail,
        'firstOutsideSegments':failures,
        'sourceBoundaryToleranceMm':.11,'coverageProxy':coverage,'coverageProxyRadiusMm':.25,
        'fillDirectionAudit':direction,'fillDirectionAuditMethod':'source-component midpoint attribution, length >=1mm, 8 degree coordinate-quantisation allowance; underpath segments remain in denominator',
        'coverageProxyMethod':'analysis-pixel raster of actual decoded segments; not physical thread/fabric coverage',
        'requestedColourOrder':colors,'translationToSourceMm':translation},moves,needle_points


def run_trial(plan, executable, output, timeout_seconds=60, native_outputs=None,partition_fills=False,running_overrides=()):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    svg,manifest,masks=build_trial_svg(plan,partition_fills=partition_fills,running_overrides=running_overrides)
    (output/'native-artwork-input.svg').write_bytes(svg)
    (output/'native-intent-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    if native_outputs is not None:
        if not isinstance(native_outputs,dict) or set(native_outputs)!={'pes','dst'}:raise ValueError('Complete native outputs required')
        buffer=BytesIO()
        with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as final:
            for fmt in ('pes','dst'):final.writestr('native-artwork.'+fmt,native_outputs[fmt])
        payload=buffer.getvalue()
    else:
        payload=_export_dual_native(output,executable,timeout_seconds)
    (output/'ENGINEERING-TRIAL-NOT-APPROVED.zip').write_bytes(payload)
    structural=audit_zip(payload)
    patterns,raws={},{}
    with zipfile.ZipFile(BytesIO(payload)) as z:
        for fmt in ('dst','pes'):
            raw=z.read(next(n for n in z.namelist() if n.lower().endswith('.'+fmt)))
            validate_native_payload(fmt,raw)
            raws[fmt]=raw
            patterns[fmt]=(pyembroidery.read_dst if fmt=='dst' else pyembroidery.read_pes)(BytesIO(raw))
    return _finish_trial(plan,output,manifest,masks,patterns,raws,structural)


def _export_dual_native(output,executable,timeout_seconds):
    engine=export_trusted_svg(output/'native-artwork-input.svg',executable=Path(executable),timeout_seconds=timeout_seconds)
    # The ZIP extension uses PES1, whose fixed PEC palette can badly shift
    # neighbouring artwork shades. Use the actual engine's Output extension
    # with version=6, preserving RGB and independently checking all needles.
    # No stitch instructions are authored or re-encoded by our preview code.
    (output/'original-engine-pes1.zip').write_bytes(engine.zip_bytes)
    native6=_run_engine([str(Path(executable)), '--extension=output','--format=pes','--version=6',
        str(output/'native-artwork-input.svg')],timeout_seconds=timeout_seconds)
    if native6.returncode or not native6.stdout.startswith(b'#PES0060'):
        raise DigitiserError('Native engine did not return PES version 6')
    buffer=BytesIO()
    with zipfile.ZipFile(BytesIO(engine.zip_bytes)) as original,zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as final:
        for name in original.namelist():
            final.writestr(name,native6.stdout if name.lower().endswith('.pes') else original.read(name))
    payload=buffer.getvalue()
    return payload


def _finish_trial(plan,output,manifest,masks,patterns,raws,structural):
    needles={fmt:[(x/10,y/10) for x,y,f in pat.stitches if f&pyembroidery.COMMAND_MASK==pyembroidery.STITCH] for fmt,pat in patterns.items()}
    if not needles['dst'] or len(needles['dst'])!=len(needles['pes']):raise ValueError('PES/DST needle counts differ')
    origin=manifest['originMm'];pes_offset=[origin[i]+needles['dst'][0][i]-needles['pes'][0][i] for i in (0,1)]
    if any(any(abs(a[i]+origin[i]-b[i]-pes_offset[i])>.11 for i in (0,1)) for a,b in zip(needles['dst'],needles['pes'])):
        raise ValueError('PES/DST needle coordinates differ after translation')
    reports=[]
    for fmt in ('dst','pes'):
        report,moves,_=audit_trial(patterns[fmt],manifest,masks,fmt,origin if fmt=='dst' else pes_offset)
        report['sha256']=sha256(raws[fmt]).hexdigest();reports.append(report)
        (output/('ENGINEERING-TRIAL-NOT-APPROVED.'+fmt)).write_bytes(raws[fmt])
        lines=''.join('<path stroke="'+color+'" d="M '+ ' L '.join(f'{x:.3f},{y:.3f}' for x,y in line.coords)+'"/>' for color,items in moves.items() for line in items)
        (output/('actual-decoded-'+fmt+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="840" height="840" viewBox="0 0 {manifest["widthMm"]} {manifest["heightMm"]}"><g fill="none" stroke-width="0.15">'+lines+'</g></svg>')
        if fmt=='pes':
            palette=sorted(moves)
            preview={'schema':'stitch-forge-decoded-preview-v1','widthMm':manifest['widthMm'],'heightMm':manifest['heightMm'],'palette':palette,
                'segments':[[round(a[0],6),round(a[1],6),round(b[0],6),round(b[1],6),index]
                   for index,color in enumerate(palette) for line in moves[color] for a,b in [list(line.coords)]]}
            (output/'decoded-preview.json').write_text(json.dumps(preview,separators=(',',':')))
    unresolved=[o for o in manifest['objects'] if not o['nativePaths']]
    blockers=['stitch_intent_semantics_unverified','fabric_underlay_density_routing_unverified','physical_quality_unverified']
    if unresolved or any(o.get('unresolvedDetailObjects',0) for o in manifest['objects']):blockers.append('unresolved_small_source_details')
    if any(r['needlePointsOutsideWorkingColour'] or r['needleSegmentsOutsideWorkingColour'] for r in reports):blockers.append('decoded_movements_outside_working_colour')
    if any(d['attributedLongSegmentMm']>=3 and d['alignedLongSegmentFraction']<.45 for r in reports for d in r['fillDirectionAudit'].values()):blockers.append('fill_direction_dominance_requires_review')
    if manifest.get('nativeRepairObjects'):blockers.append('repaired_fill_changed_to_running_requires_likeness_review')
    if plan.get('textureApproximation'):blockers.append('texture_simplification_requires_likeness_and_feature_review')
    result={'status':'REAL_ARTWORK_ENGINE_TRIAL_NOT_MACHINE_APPROVED','engine':'Ink/Stitch 3.3.0','reader':'pyembroidery 1.5.1',
        'source':plan['source'],'imageWidthMm':plan['physical']['imageWidthMm'],'objectSummary':plan['summary'],'nativePaths':manifest['nativePaths'],'pesVersion':6,
        'nativeRepairObjects':manifest.get('nativeRepairObjects',[]),
        'stitchPlanning':{'settings':manifest['settings'],
            'families':'native_fill_and_source_skeleton_running','semanticStitchIntentVerified':False},
        'unresolvedObjects':len(unresolved)+sum(o.get('unresolvedDetailObjects',0) for o in manifest['objects']),
        'unresolvedPixels':sum(o['pixels'] for o in unresolved)+sum(o.get('unresolvedDetailPixels',0) for o in manifest['objects']),
        'decoded':reports,'structuralAudit':[asdict(r) for r in structural],'blockers':blockers,
        'machineEligible':False,'physicalQualityVerified':False,'automaticAISemanticsVerified':False,
        'limitations':manifest['limitations']}
    if plan.get('textureApproximation'):result['textureApproximation']=plan['textureApproximation']
    (output/'machine-report.json').write_text(json.dumps(result,indent=2)+'\n')
    return result

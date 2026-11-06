"""MD-2.76: independently authenticated original-source running-detail proposals.

Only local, private opt-in. The full-resolution PNG is verified against the
EXACT prepared RGBA fingerprint and original-vs-reduced V2 source check.
Proposals are actual pixel-supported running geometry, not inferred anatomy.
An unsupported feature returns a clear refusal rather than invented stitches.
"""
from __future__ import annotations

import base64
from hashlib import sha256
from io import BytesIO
from math import hypot, ceil, isfinite
import struct

import numpy as np
from PIL import Image
from scipy.ndimage import label as components
from skimage.measure import find_contours
from shapely.geometry import Polygon

from original_png_contract import verify_original_png, MAX_ORIGINAL_PNG_BYTES
from artwork_packet import foreground
from artwork_trial import checked_masks

MAX_FEATURES = 6
MAX_POINTS_PER_DETAIL = 250
MAX_DETAIL_LENGTH_MM = 45.0
MAX_DETAILS_TOTAL_MM = 140.0


def bind_private_original(plan, original_png: bytes, working_rgba: bytes):
    """Bind both images to the same previously validated source-object plan.

    Untrusted source-plan content is independently validated by checked_masks;
    original SHA/bytes, prepared dimensions, foreground and source-to-reduced
    colour agreement are validated by the existing MD-2.70 V2 oracle.
    """
    masks, scale = checked_masks(plan)
    w, h = plan["source"]["width"], plan["source"]["height"]
    if (not isinstance(original_png, bytes)
            or not 100 <= len(original_png) <= MAX_ORIGINAL_PNG_BYTES
            or not isinstance(working_rgba, bytes)
            or len(working_rgba) != w*h*4):
        raise ValueError("Invalid original or prepared image byte lengths")
    working_hash = sha256(struct.pack(">II",w,h)+working_rgba).hexdigest()
    if working_hash != plan["source"]["sha256"]:
        raise ValueError("Prepared RGBA does not match source plan SHA256")
    rgba = np.frombuffer(working_rgba,np.uint8).reshape((h,w,4))
    proof = verify_original_png(base64.b64encode(original_png).decode("ascii"),
        {"sha256":sha256(original_png).hexdigest(),"bytes":len(original_png)},rgba)
    if proof["originalPixelDimensionsVerified"] != [
        plan["source"]["originalWidth"],plan["source"]["originalHeight"]]:
        raise ValueError("Full-resolution PNG dimensions differ from signed source plan")
    # The V2 browser gate tolerates modest resizing differences, which is
    # acceptable for transport but NOT strong enough to add needle geometry.
    # This offline trial requires an EXACT, reproducible LANCZOS reduction.
    # Browser-specific reductions must first be converted to a separately
    # proven deterministic source recipe; otherwise refuse the detail pass.
    with Image.open(BytesIO(original_png)) as checked_image:
        exact=np.asarray(checked_image.convert("RGBA").resize(
            (w,h),Image.Resampling.LANCZOS),dtype=np.uint8)
    if not np.array_equal(exact,rgba):
        raise ValueError("Original PNG pixels do not reproduce exact prepared RGBA")

    covered=np.zeros((h,w),dtype=bool)
    for mask in masks.values():
        covered |= mask
    if not np.array_equal(covered,foreground(rgba)):
        raise ValueError("Prepared foreground does not match source-object colour ledgers")
    with Image.open(BytesIO(original_png)) as image:
        original=np.asarray(image.convert("RGBA"),dtype=np.uint8)
    return original,rgba,masks,scale,{
        "originalSourceSha256Verified":True,
        "originalPngSha256":sha256(original_png).hexdigest(),
        "preparedSourceSha256Verified":True,
        "preparedSourcePlanSignature":plan["sourcePlanSignature"],
        "preparedForegroundMatchesColourLedger":True,
        "originalToWorkingPixelReductionExact":True,
        "sourceToReducedForegroundIoU":proof["foregroundIntersectionOverUnion"],
        "sourceToReducedMeanRgbDifference":proof["sourceToReducedMeanAbsoluteRgb"],
        "machineStitchQualityVerified":False,
    }


def _windows(requests, original, masks):
    H,W=original.shape[:2]
    if not isinstance(requests,list) or not 1 <= len(requests) <= MAX_FEATURES:
        raise ValueError("Expected 1-6 explicit original-image detail windows")
    seen=set()
    for item in requests:
        if not isinstance(item,dict) or set(item)!={"id","rect","color"}:
            raise ValueError("Unexpected original-detail request fields")
        ident,rect,color=item["id"],item["rect"],item["color"]
        if (not isinstance(ident,str) or not 1<=len(ident)<=32
                or not all(c.isascii() and (c.isalnum() or c in "-_") for c in ident)
                or ident in seen or not isinstance(rect,list) or len(rect)!=4
                or any(type(x)!=int for x in rect)
                or not isinstance(color,str) or color not in masks):
            raise ValueError("Unknown detail source colour, ID or rectangle")
        x0,y0,x1,y1=rect
        if not (0<=x0<x1<=W and 0<=y0<y1<=H
                and x1-x0>=12 and y1-y0>=12
                and (x1-x0)*(y1-y0)<=150000):
            raise ValueError("Original source detail rectangle exceeds bounds")
        seen.add(ident)


def _phys_point_allowed(x,y, original, working_mask, target_rgb, mm_per_orig):
    H,W=original.shape[:2]
    wh,ww=working_mask.shape
    xi,yi=int(round(x)),int(round(y))
    if not (0<=xi<W and 0<=yi<H):
        return False
    pixel=original[yi,xi]
    if int(pixel[3])<220:
        return False
    # Local original pigment is required, not just a nearby same-colour mask.
    if np.linalg.norm(pixel[:3].astype(float)-target_rgb) > 65:
        return False
    wx=int(round((x+.5)*ww/W-.5));wy=int(round((y+.5)*wh/H-.5))
    if not (0<=wx<ww and 0<=wy<wh and bool(working_mask[wy,wx])):
        return False
    return True


def propose_authenticated_running_details(plan, original_png: bytes,
                                           working_rgba: bytes, windows: list):
    """Source-backed, conservative automatic contour candidates within ROIs.

    The ROIs and target working colours are explicit review choices.
    Neither human anatomy nor a 'missing eye' is inferred automatically.
    """
    original,working,masks,scale,proof=bind_private_original(
        plan,original_png,working_rgba)
    _windows(windows,original,masks)
    H,W=original.shape[:2]
    wh,ww=working.shape[:2]
    mm_orig=plan["physical"]["imageWidthMm"]/W
    proposed=[];rejected=[];total_length=0.
    for request in windows:
        ident,color=request["id"],request["color"]
        x0,y0,x1,y1=request["rect"]
        roi=original[y0:y1,x0:x1]
        rgb=np.array([int(color[i:i+2],16) for i in (1,3,5)],dtype=np.float32)
        diff=np.linalg.norm(roi[...,:3].astype(np.float32)-rgb,axis=2)
        ink=(roi[...,3]>=220)&(diff<=65)
        labelled,count=components(ink,np.ones((3,3),dtype=np.uint8))
        choices=[]
        for index in range(1,count+1):
            local=labelled==index
            if (local.sum()<20 or local[0].any() or local[-1].any()
                    or local[:,0].any() or local[:,-1].any()):
                continue
            contours=find_contours(np.pad(local,1),.5)
            for contour in contours:
                if len(contour)<10:
                    continue
                coords=[(float(x0+x-1),float(y0+y-1)) for y,x in contour]
                shape=Polygon(coords)
                if not shape.is_valid or shape.area<=0:
                    continue
                # Inset physical seam provides conservative colour ownership.
                inset=shape.buffer(-max(.28/mm_orig,.9),resolution=6)
                if inset.geom_type!="Polygon" or inset.is_empty or not inset.is_valid:
                    continue
                smooth=inset.simplify(.055/mm_orig,preserve_topology=True)
                line=list(smooth.exterior.coords)
                if not 6<=len(line)<=MAX_POINTS_PER_DETAIL:
                    continue
                length=smooth.exterior.length*mm_orig
                if not 2.5<=length<=MAX_DETAIL_LENGTH_MM:
                    continue
                perimeter_ok=True
                for a,b in zip(line,line[1:]):
                    segment=hypot(b[0]-a[0],b[1]-a[1])
                    for i in range(ceil(segment*mm_orig/.06)+1):
                        t=i/max(1,ceil(segment*mm_orig/.06))
                        xx=a[0]+t*(b[0]-a[0])
                        yy=a[1]+t*(b[1]-a[1])
                        if not _phys_point_allowed(xx,yy,original,masks[color],rgb,mm_orig):
                            perimeter_ok=False
                            break
                    if not perimeter_ok:
                        break
                if perimeter_ok:
                    choices.append((length,line))
        if not choices:
            rejected.append({"id":ident,"reason":"NO_COMPLETE_ORIGINAL_AND_WORKING_COLOUR_CONTOUR"})
            continue
        # The biggest physically plausible source-supported feature is only a
        # geometry candidate. It may be the wrong thing visually.
        length,line=sorted(choices,key=lambda v:-v[0])[0]
        if total_length+length>MAX_DETAILS_TOTAL_MM:
            rejected.append({"id":ident,"reason":"DETAIL_PATH_BUDGET_EXCEEDED"})
            continue
        # Original physical coordinates mapped through source-bound working
        # pixels. Revalidation inside native SVG builder remains mandatory.
        points=[[round((x+.5)*ww/W-.5,5),round((y+.5)*wh/H-.5,5)]
                for x,y in line]
        total_length+=length
        proposed.append({"id":ident,"color":color,
            "sourceOriginalPngSha256":proof["originalPngSha256"],
            "sourcePlanSignature":plan["sourcePlanSignature"],
            "points":points,"lengthMm":round(length,3),
            "sourceSegmentsValidatedAtMm":.06,
            "nativeMachineStitchTestPerformed":False,
            "semanticFeatureIdentified":False})
    return {"status":"ORIGINAL_VERIFIED_RUNNING_CANDIDATES_NOT_SEWN",
        "sourceBinding":proof,"candidateCount":len(proposed),
        "candidates":proposed,"rejected":rejected,
        "physicalSewoutVerified":False,
        "sourceSemanticFeatureLikenessVerified":False}

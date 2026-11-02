"""MD-2.66 isolated candidate -> existing strict source/colour packet contract.

This OFFLINE bridge does not invoke the native engine or send a network request.
The existing worker independently decodes/rechecks the exact raw source RGBA,
the complete foreground and the assigned working colour masks.
No semantic, needle-path or sew-out approval follows from this check.
"""
import base64
import gzip
from hashlib import sha256
import json
import struct
from PIL import Image
import numpy as np
from artwork_packet import decode_packet
from hybrid_home import reconstruct


def prepare_verified_packet(image, *, colours=9, visible_width_mm=80):
    if not isinstance(image, Image.Image):
        raise ValueError('Expected a local source image')
    ow, oh = image.size
    if ow < 48 or oh < 48 or ow*oh > 45_000_000:
        raise ValueError('Unacceptable source image dimensions')
    labels, palette, proposal = reconstruct(
        image, colours=colours, design_width_mm=visible_width_mm)
    h,w = labels.shape
    source_rgba = np.asarray(image.convert('RGBA').resize(
        (w,h), Image.Resampling.LANCZOS), dtype=np.uint8)
    foreground = source_rgba[:, :, 3] > 60
    if not np.array_equal(foreground, labels > 0):
        raise ValueError('Candidate changed original working foreground')
    if not 1 <= len(palette) <= 12 or len(np.unique(labels[foreground])) != len(palette):
        raise ValueError('Candidate palette is incomplete')
    hexes=['#'+''.join(f'{int(c):02X}' for c in rgb) for rgb in palette]
    if len(set(hexes)) != len(hexes):
        raise ValueError('Duplicate native colour produced by palette quantisation')
    ordered=sorted(hexes)
    assignment=np.zeros_like(labels, dtype=np.uint8)
    for index, colour in enumerate(hexes, 1):
        assignment[labels == index] = ordered.index(colour)+1
    if not np.array_equal(assignment > 0, foreground):
        raise ValueError('Sorted colour mapping changed source foreground')
    occupied_x=np.where(foreground)[1]
    content_width=int(occupied_x.max()-occupied_x.min()+1)
    frame_width=round(visible_width_mm*w/content_width, 6)
    if frame_width > 250 or frame_width*h/w > 296:
        raise ValueError('Candidate physical frame is larger than supported dimensions')
    raw=source_rgba.tobytes(order='C')
    assigned=assignment.tobytes(order='C')
    fingerprint=sha256(struct.pack('>II',w,h)+raw).hexdigest()
    header=json.dumps({
        'schema':'stitch-forge-artwork-request-v1',
        'source':{'sha256':fingerprint,'width':w,'height':h,
                  'originalWidth':ow,'originalHeight':oh},
        'imageWidthMm':frame_width,
        'palette':ordered,
        'foregroundPixels':int(foreground.sum()),
        'preparationSignature':sha256(b'ISOLATED_MD266_HOME_CANDIDATE_V1'
             + bytes.fromhex(fingerprint)+assigned).hexdigest(),
        'texturePolicy':'if_needed'
    },separators=(',',':'))
    identity=sha256(header.encode()+raw+assigned).hexdigest()
    packet={
        'header':header,
        'rgbaGzip':base64.b64encode(gzip.compress(raw,mtime=0)).decode('ascii'),
        'labelsGzip':base64.b64encode(gzip.compress(assigned,mtime=0)).decode('ascii'),
        'requestId':identity,
        'phase':'pes'
    }
    # Re-run exactly the independent existing worker-contract decoder;
    # no trust in the candidate's unverified shape/palette evidence.
    native_plan,meta,request_id,binding=decode_packet(packet)
    if (request_id!=identity or native_plan['summary']['sourcePixels']!=int(foreground.sum())
            or native_plan['summary']['workingParts']!=proposal['hybridComponents']
            or not binding['foregroundIndependentlyVerified']):
        raise ValueError('Hybrid candidate failed independent source/colour binding')
    return packet, {
        'schema':'stitch-forge-hybrid-worker-compatibility-v1',
        'requestId':identity,
        'sourceSha256':fingerprint,
        'originalImageWidth':ow,'originalImageHeight':oh,
        'workingWidth':w,'workingHeight':h,
        'requestedVisibleWidthMm':visible_width_mm,
        'nativeFrameWidthMm':frame_width,
        'sourceForegroundPixels':int(foreground.sum()),
        'nativeConnectedParts':native_plan['summary']['workingParts'],
        'threadColourCount':len(ordered),
        'meanSourceRgbDistance':binding['sourceMeanRgbDistance'],
        'sourcePixelsBeyondRgb60':binding['sourcePixelsBeyondRgb60'],
        'foregroundIndependentlyVerified':True,
        'machineFileGenerated':False,
        'physicalQualityVerified':False,
        'approval':'HOLD_FOR_DETAIL_LIKENESS_NATIVE_STITCH_AUDIT_AND_SEWOUT'
    }

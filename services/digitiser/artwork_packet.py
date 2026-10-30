"""Bounded original-pixel/label contract for the explicitly enabled trial route.

No SVG, model text, URL or approval flag is accepted. The source fingerprint,
independent foreground, physical size and exact byte binding are recomputed.
Client labels remain proposals; this contract never verifies semantic features.
"""
import base64
from hashlib import sha256
import json
from math import isfinite
import re
import struct
import zlib
import numpy as np
from scipy.ndimage import label


def strict_json(raw):
    def pairs(items):
        result={}
        for k,v in items:
            if k in result:raise ValueError('Duplicate JSON key')
            result[k]=v
        return result
    return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('Nonfinite JSON')))


def encoded(raw,max_bytes):
    if not isinstance(raw,str) or len(raw)>((max_bytes+2)//3)*4:raise ValueError('Encoded input exceeds limit')
    try:value=base64.b64decode(raw,validate=True)
    except Exception as error:raise ValueError('Invalid base64') from error
    if len(value)>max_bytes:raise ValueError('Encoded input exceeds limit')
    return value


def inflate(raw,size):
    blob=encoded(raw,size+65536);stream=zlib.decompressobj(31)
    try:value=stream.decompress(blob,size+1)
    except zlib.error as error:raise ValueError('Invalid compressed pixels') from error
    if len(value)!=size or not stream.eof or stream.unused_data or stream.unconsumed_tail:
        raise ValueError('Incomplete or oversized compressed pixels')
    return value


def foreground(rgba):
    """Independent Python implementation of the app's documented border rule."""
    h,w,_=rgba.shape
    border=[]
    for x in range(w):border.extend((x,(h-1)*w+x))
    for y in range(1,h-1):border.extend((y*w,y*w+w-1))
    sample=rgba.reshape((-1,4))[border[::max(1,len(border)//512)]].astype(float)
    opaque=sample[sample[:,3]>245];transparent=sample[sample[:,3]<25]
    if not len(transparent) and len(opaque)>=len(sample)*.9:
        mean=opaque[:,:3].mean(axis=0);maxdist=float(np.sqrt(((opaque[:,:3]-mean)**2).sum(axis=1)).max())
        if maxdist>45:raise ValueError('Complex background')
        threshold=min(55,max(9,8+maxdist*1.25))
        return (rgba[:,:,3]>50)&(np.sqrt(((rgba[:,:,:3].astype(float)-mean)**2).sum(axis=2))>=threshold)
    if len(transparent)>=len(sample)*.9:return rgba[:,:,3]>60
    raise ValueError('Uncertain background')


def regions_from_labels(labels,palette):
    h,w=labels.shape;regions=[];parts=runs=0
    for i,color in enumerate(palette):
        mask=labels==i+1;owners,count=label(mask)
        if not count:raise ValueError('Unused working palette colour')
        groups=[{'id':'component-'+str(k+1),'runs':[],'pixelArea':0} for k in range(count)]
        for y,row in enumerate(owners):
            changes=np.flatnonzero(np.diff(np.pad(row,(1,1))))
            for x0,x1 in zip(changes[:-1],changes[1:]):
                owner=int(row[x0])
                if owner:
                    group=groups[owner-1];group['runs'].append([y,int(x0),int(x1)]);group['pixelArea']+=int(x1-x0);runs+=1
                    if runs>200000:raise ValueError('Source run budget exceeded')
        parts+=count
        if parts>50000:raise ValueError('Source part budget exceeded')
        regions.append({'color':color,'ledger':{'width':w,'height':h,'foregroundPixels':int(mask.sum()),'components':groups}})
    return regions,parts


def decode_packet(obj):
    required={'header','rgbaGzip','labelsGzip','requestId','phase'}
    phase=obj.get('phase') if isinstance(obj,dict) else None
    allowed=required|({'receipt','pesBase64'} if phase=='dst' else set())
    if isinstance(obj,dict) and 'repairReceipt' in obj:allowed.add('repairReceipt')
    if not isinstance(obj,dict) or phase not in ('pes','dst') or set(obj)!=allowed:raise ValueError('Unsupported artwork request')
    header=obj['header']
    if not isinstance(header,str) or len(header)>2000:raise ValueError('Oversized artwork header')
    meta=strict_json(header)
    if not isinstance(meta,dict) or set(meta)!={'schema','source','imageWidthMm','palette','foregroundPixels','preparationSignature','texturePolicy'} or meta['schema']!='stitch-forge-artwork-request-v1':
        raise ValueError('Unsupported artwork header')
    source=meta['source']
    if not isinstance(source,dict) or set(source)!={'sha256','width','height','originalWidth','originalHeight'}:raise ValueError('Invalid source identity')
    w,h,ow,oh=[source[k] for k in ('width','height','originalWidth','originalHeight')]
    if (any(isinstance(v,bool) or not isinstance(v,int) or v<1 for v in (w,h,ow,oh)) or min(w,h)<48 or w*h>750000
            or ow*oh>45000000 or w>ow or h>oh or abs(w/h-ow/oh)>2/h
            or not isinstance(source['sha256'],str) or not re.fullmatch('[0-9a-f]{64}',source['sha256'])):raise ValueError('Invalid source dimensions')
    mm=meta['imageWidthMm'];palette=meta['palette']
    if isinstance(mm,bool) or not isinstance(mm,(float,int)) or not isfinite(mm) or not 10<=mm<=250 or mm*h/w>296:raise ValueError('Invalid physical dimensions')
    if (not isinstance(palette,list) or not 1<=len(palette)<=12 or any(not isinstance(c,str) or not re.fullmatch('#[0-9A-F]{6}',c) for c in palette)
            or sorted(set(palette))!=palette or meta['texturePolicy'] not in ('off','if_needed')
            or not isinstance(meta['preparationSignature'],str) or not re.fullmatch('[0-9a-f]{64}',meta['preparationSignature'])):raise ValueError('Invalid palette/preparation policy')
    raw=inflate(obj['rgbaGzip'],w*h*4);label_bytes=inflate(obj['labelsGzip'],w*h)
    if isinstance(meta['foregroundPixels'],bool) or not isinstance(meta['foregroundPixels'],int) or not 1<=meta['foregroundPixels']<=w*h:raise ValueError('Invalid source pixel count')
    if sha256(struct.pack('>II',w,h)+raw).hexdigest()!=source['sha256']:raise ValueError('Source fingerprint mismatch')
    identity=sha256(header.encode()+raw+label_bytes).hexdigest()
    if obj['requestId']!=identity:raise ValueError('Source/geometry byte binding mismatch')
    rgba=np.frombuffer(raw,np.uint8).reshape((h,w,4));labels=np.frombuffer(label_bytes,np.uint8).reshape((h,w))
    expected=foreground(rgba)
    if labels.max()>len(palette) or not np.array_equal(labels>0,expected) or int(expected.sum())!=meta['foregroundPixels'] or not expected.any():
        raise ValueError('Source foreground/colour accounting mismatch')
    regions,parts=regions_from_labels(labels,palette)
    assigned=np.array([[int(c[i:i+2],16) for i in (1,3,5)] for c in palette])[labels[expected]-1]
    distances=np.sqrt(((rgba[:,:,:3][expected].astype(float)-assigned)**2).sum(axis=1))
    plan={'schema':'stitch-forge-source-object-plan-v1','source':source,'physical':{'imageWidthMm':mm,'imageHeightMm':mm*h/w,'scaleMmPerPixel':mm/w},
        'sourcePlanSignature':identity,'regions':regions,'summary':{'sourceParts':parts,'workingParts':parts,'sourcePixels':int(expected.sum()),
          'representedPixels':int(expected.sum()),'recolouredPixels':None,'protectedParts':None,'protectedPartsRecoloured':None,'omittedPixels':0},'machineEligible':False}
    evidence={'sourcePixelsVerified':True,'foregroundIndependentlyVerified':True,'clientObjectAlgorithmRecomputed':False,
       'clientPreparationSignature':meta['preparationSignature'],'sourceMeanRgbDistance':float(distances.mean()),'sourcePixelsBeyondRgb60':int((distances>60).sum()),
       'sourceSemanticFeaturesVerified':False}
    return plan,meta,identity,evidence

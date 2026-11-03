"""Source-grounded, physical-scale local texture direction evidence (MD-2.69).

Experimental only. Retains original PNG bytes and samples its gradients on a
0.08--0.25 mm working grid to propose local *guides* for later embroidery
planning. No automatic anatomical classification, stitch file or commercial
quality claim. No network, secrets, image persistence or paid models.
"""
from __future__ import annotations
from hashlib import sha256
from io import BytesIO
import math
import numpy as np
from PIL import Image, UnidentifiedImageError
from scipy.ndimage import distance_transform_edt, gaussian_filter, sobel
from skimage.color import rgb2gray

PNG_MAGIC=b'\x89PNG\r\n\x1a\n'


def analyse_source_png(png:bytes, *, image_width_mm:float=80.,
                       analysis_mm_per_pixel:float=.12,
                       max_source_bytes=4000000,
                       max_source_pixels=12000000):
    """Return bounded source-bound local-direction observations, NOT stitches."""
    if not isinstance(png,bytes) or not png.startswith(PNG_MAGIC) or not 100<=len(png)<=max_source_bytes:
        raise ValueError('Invalid or oversized original PNG')
    if (not isinstance(image_width_mm,(float,int)) or isinstance(image_width_mm,bool)
            or not math.isfinite(image_width_mm) or not 10<=image_width_mm<=250):
        raise ValueError('Invalid physical design width')
    if not .08<=analysis_mm_per_pixel<=.25:
        raise ValueError('Invalid physical-resolution planning budget')
    try:
        im=Image.open(BytesIO(png))
        if im.format!='PNG':
            raise ValueError('Only PNG originals supported')
        w,h=im.size
        if w<80 or h<80 or w*h>max_source_pixels:
            raise ValueError('Source pixel budget exceeded')
        src=np.asarray(im.convert('RGBA'),dtype=np.uint8)
    except (OSError,UnidentifiedImageError) as error:
        raise ValueError('Malformed original PNG') from error
    if np.count_nonzero(src[:,:,3]>60)<100:
        raise ValueError('No supported source foreground')
    physical_height=image_width_mm*h/w
    if physical_height>296:
        raise ValueError('Design physical height exceeds trial bounds')
    ew=int(round(image_width_mm/analysis_mm_per_pixel))
    eh=max(48,int(round(physical_height/analysis_mm_per_pixel)))
    if max(ew,eh)>2400 or ew*eh>3000000:
        raise ValueError('Analysis-grid memory budget exceeded')
    resized=np.asarray(Image.fromarray(src,'RGBA').resize(
        (ew,eh),Image.Resampling.LANCZOS),dtype=np.uint8)
    mask=resized[:,:,3]>60
    inside=distance_transform_edt(mask)*analysis_mm_per_pixel>=.6
    rgb=resized[:,:,:3].astype(np.float32)/255
    gray=rgb2gray(rgb)
    blur=gaussian_filter(gray,sigma=max(1,.22/analysis_mm_per_pixel))
    dx=sobel(blur,axis=1)
    dy=sobel(blur,axis=0)
    sigma=max(1,.55/analysis_mm_per_pixel)
    xx=gaussian_filter(dx*dx,sigma)
    yy=gaussian_filter(dy*dy,sigma)
    xy=gaussian_filter(dx*dy,sigma)
    total=xx+yy
    coherence=np.sqrt((xx-yy)**2+4*xy*xy)/np.maximum(total,1e-8)
    tangent=(np.degrees(.5*np.arctan2(2*xy,xx-yy))+90)%180
    grid=max(8,round(3.0/analysis_mm_per_pixel))
    guides=[]
    for y0 in range(0,eh,grid):
        for x0 in range(0,ew,grid):
            y1=min(eh,y0+grid);x1=min(ew,x0+grid)
            good=inside[y0:y1,x0:x1] & (coherence[y0:y1,x0:x1]>=.64)
            if good.size<12 or good.mean()<.30:
                continue
            energy=total[y0:y1,x0:x1][good]
            if np.median(energy)<.002:
                continue
            angles=np.deg2rad(tangent[y0:y1,x0:x1][good])*2
            weight=energy/np.maximum(energy.sum(),1e-8)
            cs=float((np.cos(angles)*weight).sum())
            sn=float((np.sin(angles)*weight).sum())
            consistency=math.hypot(cs,sn)
            if consistency<.7:
                continue
            angle=(.5*math.degrees(math.atan2(sn,cs)))%180
            guides.append({'xMm':round((x0+x1)*analysis_mm_per_pixel/2,2),
                           'yMm':round((y0+y1)*analysis_mm_per_pixel/2,2),
                           'textureTangentDeg':round(angle,1),
                           'directionCoherence':round(consistency,3)})
    if len(guides)>900:
        raise ValueError('Source-guide count exceeds source budget')
    return {'schema':'stitch-forge-full-source-direction-evidence-v1',
            'sourceSha256':sha256(png).hexdigest(),'originalPixels':[w,h],
            'requestedImageWidthMm':image_width_mm,
            'analysisGridPx':[ew,eh],
            'analysisResolutionMmPerPixel':analysis_mm_per_pixel,
            'candidateLocalGuides':guides,
            'guideCount':len(guides),
            'sourcePixelsReducedBeforeAnalysis':False,
            'sourceIsBoundByOriginalByteHash':True,
            'sourceGeometryWasModified':False,
            'semanticObjectsIdentified':False,
            'nativePESDSTGenerated':False,'machineApproved':False,
            'physicalSewoutVerified':False}

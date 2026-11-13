#!/usr/bin/env python3
"""
Generate a fully SYNTHETIC head phantom and write it as two DICOM series:

    sample_data/demo/cbct/   - a noisy, low-contrast "CBCT" (the input)
    sample_data/demo/ct/     - a clean "planning CT" of the same phantom (for comparison mode)

There is NO real patient data anywhere in this repo. The phantom is built from
ellipsoids + procedural noise, so it is safe to publish. Both series share geometry
(spacing, FrameOfReferenceUID) so the comparison mode lines them up.

Run:
    python sample_data/make_dummy_data.py
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

# DICOM written with pydicom
import pydicom
from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
from pydicom.uid import generate_uid, ExplicitVRLittleEndian, CTImageStorage

HU_AIR = -1000.0
RESCALE_INTERCEPT = -1024.0


def _ellipsoid(shape, center, radii):
    z, y, x = np.ogrid[:shape[0], :shape[1], :shape[2]]
    cz, cy, cx = center
    rz, ry, rx = radii
    return ((z - cz) / rz) ** 2 + ((y - cy) / ry) ** 2 + ((x - cx) / rx) ** 2 <= 1.0


def build_ct_phantom(depth=44, size=140, seed=7) -> np.ndarray:
    """A clean CT-like head phantom in HU."""
    rng = np.random.default_rng(seed)
    vol = np.full((depth, size, size), HU_AIR, dtype=np.float32)
    cz, cy, cx = depth / 2, size / 2, size / 2

    # outer head (soft tissue ~ 35 HU)
    head = _ellipsoid(vol.shape, (cz, cy, cx), (depth * 0.46, size * 0.40, size * 0.34))
    vol[head] = 35.0

    # skull ring = head minus an eroded inner head -> bone ~ 1100 HU
    inner = _ellipsoid(vol.shape, (cz, cy, cx), (depth * 0.42, size * 0.36, size * 0.30))
    vol[head & ~inner] = 1100.0

    # brain interior (~ 30 HU) and two ventricles (CSF ~ 12 HU)
    vol[inner] = 30.0
    for dy in (-0.07, 0.07):
        vent = _ellipsoid(vol.shape, (cz, cy + dy * size, cx), (depth * 0.18, size * 0.06, size * 0.04))
        vol[vent & inner] = 12.0

    # a small dense structure (e.g., calcification ~ 350 HU) and a sinus air cavity
    calc = _ellipsoid(vol.shape, (cz - depth * 0.05, cy + size * 0.12, cx), (depth * 0.05, size * 0.03, size * 0.03))
    vol[calc & inner] = 350.0
    sinus = _ellipsoid(vol.shape, (cz + depth * 0.18, cy - size * 0.18, cx), (depth * 0.08, size * 0.05, size * 0.05))
    vol[sinus & head] = -700.0

    # mild texture inside soft tissue so it isn't flat
    soft = inner & (vol < 60)
    vol[soft] += rng.normal(0, 6, size=vol.shape)[soft].astype(np.float32)
    return np.clip(vol, -1024, 3071)


def degrade_to_cbct(ct_hu: np.ndarray, seed=11) -> np.ndarray:
    """Make a CBCT-like version: heavier noise, cupping, lower bone contrast, slight blur."""
    from scipy.ndimage import gaussian_filter
    rng = np.random.default_rng(seed)
    cb = ct_hu.copy()

    # lower bone/soft contrast (CBCT HU are poorly calibrated)
    cb = np.where(cb > 300, 300 + (cb - 300) * 0.55, cb)          # compress bone
    cb = np.where((cb > -200) & (cb < 200), cb * 0.85 + 8, cb)    # squash soft toward a shifted mean

    # radial "cupping" artifact (darker center)
    d, h, w = cb.shape
    yy, xx = np.ogrid[:h, :w]
    r = np.sqrt(((yy - h / 2) / (h / 2)) ** 2 + ((xx - w / 2) / (w / 2)) ** 2)
    cup = (1.0 - 0.18 * np.clip(1.0 - r, 0, 1))[None]            # up to -18% toward center
    body = cb > -500
    cb = np.where(body, cb * cup, cb)

    cb = gaussian_filter(cb, sigma=(0.4, 0.8, 0.8))              # slight blur
    cb = cb + rng.normal(0, 45, size=cb.shape).astype(np.float32)  # CBCT noise
    return np.clip(cb, -1024, 3071)


def write_series(vol_hu: np.ndarray, out_dir: Path, *, series_desc: str, modality: str,
                 spacing_zyx=(3.0, 1.5, 1.5), study_uid: str, frame_uid: str,
                 series_number: int):
    out_dir.mkdir(parents=True, exist_ok=True)
    series_uid = generate_uid()
    dz, dy, dx = spacing_zyx
    depth = vol_hu.shape[0]

    stored = np.clip(vol_hu - RESCALE_INTERCEPT, 0, 65535).astype(np.uint16)  # HU -> stored
    for i in range(depth):
        meta = FileMetaDataset()
        meta.MediaStorageSOPClassUID = CTImageStorage
        sop_uid = generate_uid()
        meta.MediaStorageSOPInstanceUID = sop_uid
        meta.TransferSyntaxUID = ExplicitVRLittleEndian

        ds = FileDataset(None, {}, file_meta=meta, preamble=b"\0" * 128)
        ds.SOPClassUID = CTImageStorage
        ds.SOPInstanceUID = sop_uid
        ds.Modality = modality
        ds.PatientName = "PHANTOM^SYNTHETIC"
        ds.PatientID = "DEMO-PHANTOM-001"
        ds.PatientBirthDate = ""
        ds.StudyInstanceUID = study_uid
        ds.SeriesInstanceUID = series_uid
        ds.FrameOfReferenceUID = frame_uid
        ds.SeriesNumber = series_number
        ds.InstanceNumber = i + 1
        ds.SeriesDescription = series_desc
        ds.ImageComments = "SYNTHETIC PHANTOM - RESEARCH / NOT FOR DIAGNOSIS"
        ds.ImageType = ["DERIVED", "SECONDARY"]

        ds.Rows, ds.Columns = vol_hu.shape[1], vol_hu.shape[2]
        ds.PixelSpacing = [f"{dy:.4f}", f"{dx:.4f}"]
        ds.SliceThickness = f"{dz:.4f}"
        ds.ImageOrientationPatient = ["1", "0", "0", "0", "1", "0"]
        ds.ImagePositionPatient = [f"{-dx * ds.Columns / 2:.4f}",
                                   f"{-dy * ds.Rows / 2:.4f}",
                                   f"{i * dz:.4f}"]
        ds.SliceLocation = f"{i * dz:.4f}"

        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 0
        ds.RescaleIntercept = f"{RESCALE_INTERCEPT:.1f}"
        ds.RescaleSlope = "1"
        ds.RescaleType = "HU"
        ds.WindowCenter = "40"
        ds.WindowWidth = "400"
        ds.PixelData = stored[i].tobytes()

        ds.is_little_endian = True
        ds.is_implicit_VR = False
        ds.save_as(out_dir / f"slice_{i + 1:04d}.dcm", enforce_file_format=True)
    print(f"  [OK] wrote {depth} slices -> {out_dir}  ({series_desc})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(Path(__file__).parent / "demo"))
    ap.add_argument("--depth", type=int, default=44)
    ap.add_argument("--size", type=int, default=140)
    args = ap.parse_args()

    out = Path(args.out)
    ct = build_ct_phantom(args.depth, args.size)
    cbct = degrade_to_cbct(ct)

    study_uid = generate_uid()
    frame_uid = generate_uid()
    print("Generating synthetic phantom DICOM (no real patient data):")
    write_series(cbct, out / "cbct", series_desc="DEMO CBCT (synthetic phantom)", modality="CT",
                 study_uid=study_uid, frame_uid=frame_uid, series_number=1)
    write_series(ct, out / "ct", series_desc="DEMO planning CT (synthetic phantom)", modality="CT",
                 study_uid=study_uid, frame_uid=frame_uid, series_number=2)
    print(f"[DONE] demo data in {out}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Merge a folder of BodyParts3D OBJ files into one OBJ, applying a shared
mm->cm + axis-remap + recenter transform so all head groups stay aligned.

Usage:
  merge_obj_group.py <input_dir> <output_obj> [--crop-to cx,cy,cz,r] [--center cx,cy,cz]

BodyParts3D source convention (observed from raw vertex data): mm units,
X = left/right, Y = anterior(-)/posterior(+), Z = up (height above floor).

Target convention (MediaPipe canonical face space): cm units, +Y up,
+Z toward the viewer (anterior).

  three.x =  bp.x
  three.y =  bp.z
  three.z = -bp.y
"""
import sys
import os
import glob
import argparse

SCALE = 0.1  # mm -> cm


def remap(x, y, z):
    return (x * SCALE, z * SCALE, -y * SCALE)


def read_obj_verts_faces(path):
    verts = []
    faces = []
    with open(path, "r", errors="ignore") as f:
        for line in f:
            if line.startswith("v "):
                p = line.split()
                verts.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith("f "):
                p = line.split()[1:]
                idx = [int(tok.split("/")[0]) for tok in p]
                faces.append(idx)
    return verts, faces


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input_dir")
    ap.add_argument("output_obj")
    ap.add_argument("--center", default=None, help="cx,cy,cz in transformed space to subtract")
    ap.add_argument("--print-center", action="store_true")
    ap.add_argument("--crop-radius", type=float, default=None, help="drop faces whose centroid is farther than this from --center")
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.input_dir, "*.obj")))
    if not files:
        print("no OBJ files found in", args.input_dir, file=sys.stderr)
        sys.exit(1)

    all_verts = []
    all_faces = []
    offset = 0
    for fp in files:
        verts, faces = read_obj_verts_faces(fp)
        verts = [remap(*v) for v in verts]
        all_verts.extend(verts)
        for f in faces:
            all_faces.append([i + offset for i in f])
        offset += len(verts)

    center = None
    if args.center:
        center = tuple(float(c) for c in args.center.split(","))
        all_verts = [(x - center[0], y - center[1], z - center[2]) for x, y, z in all_verts]

    if args.crop_radius is not None:
        kept_faces = []
        for f in all_faces:
            cx = sum(all_verts[i - 1][0] for i in f) / len(f)
            cy = sum(all_verts[i - 1][1] for i in f) / len(f)
            cz = sum(all_verts[i - 1][2] for i in f) / len(f)
            if (cx * cx + cy * cy + cz * cz) ** 0.5 <= args.crop_radius:
                kept_faces.append(f)
        all_faces = kept_faces

    xs = [v[0] for v in all_verts]
    ys = [v[1] for v in all_verts]
    zs = [v[2] for v in all_verts]
    bbox_center = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2)

    if args.print_center:
        print("%.6f,%.6f,%.6f" % bbox_center)
        return

    os.makedirs(os.path.dirname(args.output_obj) or ".", exist_ok=True)
    with open(args.output_obj, "w") as out:
        out.write("# merged by merge_obj_group.py\n")
        for v in all_verts:
            out.write("v %.6f %.6f %.6f\n" % v)
        for f in all_faces:
            out.write("f " + " ".join(str(i) for i in f) + "\n")

    print("wrote", args.output_obj, "verts=%d faces=%d" % (len(all_verts), len(all_faces)))


if __name__ == "__main__":
    main()

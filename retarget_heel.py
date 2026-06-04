"""
Blender headless: 別リグ(Meshy "Newton")のヒールリフトを Mixamo スケルトンへ
ワールド空間デルタ方式でリターゲットし、アニメのみのFBXとして書き出す。

両リグはレストのボーン軸が大きく異なる（多くが反転）ため、絶対回転コピーでは破綻する。
そこで「ソースボーンが自身のレストから世界空間でどれだけ回ったか(delta)」を求め、
それをターゲットボーンのレスト世界姿勢に適用する。ローカル回転チャンネルとして焼き込むため
平行移動は親から自然に伝播し、回転のみのリターゲットになる（=ゲーム側の挙動と一致）。

Usage: blender --background --python retarget_heel.py -- <src.fbx> <target_skeleton.fbx> <out.fbx>
"""
import bpy
import sys
import os
from mathutils import Matrix

# Newton(ソース) -> Mixamo(ターゲット) ボーン名対応（回転のみ転送）
BONE_MAP = {
    "Hips": "mixamorig:Hips",
    "Spine1": "mixamorig:Spine", "Spine2": "mixamorig:Spine1", "Spine3": "mixamorig:Spine2",
    "Neck": "mixamorig:Neck", "Head": "mixamorig:Head",
    "LeftShoulder": "mixamorig:LeftShoulder", "LeftArm": "mixamorig:LeftArm",
    "LeftForeArm": "mixamorig:LeftForeArm", "LeftHand": "mixamorig:LeftHand",
    "RightShoulder": "mixamorig:RightShoulder", "RightArm": "mixamorig:RightArm",
    "RightForeArm": "mixamorig:RightForeArm", "RightHand": "mixamorig:RightHand",
    "LeftThigh": "mixamorig:LeftUpLeg", "LeftShin": "mixamorig:LeftLeg",
    "LeftFoot": "mixamorig:LeftFoot", "LeftToe": "mixamorig:LeftToeBase",
    "RightThigh": "mixamorig:RightUpLeg", "RightShin": "mixamorig:RightLeg",
    "RightFoot": "mixamorig:RightFoot", "RightToe": "mixamorig:RightToeBase",
}


def find_armatures():
    return [o for o in bpy.data.objects if o.type == "ARMATURE"]


def bone_depth(bone):
    d, p = 0, bone.parent
    while p:
        d, p = d + 1, p.parent
    return d


def main():
    sep = sys.argv.index("--")
    src_path, tgt_path, out_path = sys.argv[sep + 1: sep + 4]

    bpy.ops.wm.read_factory_settings(use_empty=True)

    # ターゲット骨格（Mixamo・アニメのみFBX）を読み込み
    bpy.ops.import_scene.fbx(filepath=tgt_path, use_anim=True, ignore_leaf_bones=False)
    tgt = find_armatures()[0]
    tgt.animation_data_clear()  # 元のidleアクションを除去

    # ソース（Newtonリグのヒールリフト）を読み込み
    bpy.ops.import_scene.fbx(filepath=src_path, use_anim=True, ignore_leaf_bones=False)
    src = next(a for a in find_armatures() if a is not tgt)

    src_action = src.animation_data.action
    f_start, f_end = (int(round(v)) for v in src_action.frame_range)
    print(f"Source frames: {f_start}..{f_end}")

    # 対応の取れるペアだけ抽出（親→子の順に処理する）
    pairs = []
    for s_name, t_name in BONE_MAP.items():
        if s_name in src.pose.bones and t_name in tgt.pose.bones:
            pairs.append((s_name, t_name))
        else:
            print(f"  skip (missing): {s_name} -> {t_name}")
    pairs.sort(key=lambda p: bone_depth(tgt.data.bones[p[1]]))

    # レスト世界姿勢（回転）を事前計算
    src_rest_w = {s: (src.matrix_world @ src.data.bones[s].matrix_local) for s, _ in pairs}
    tgt_rest_w = {t: (tgt.matrix_world @ tgt.data.bones[t].matrix_local) for _, t in pairs}

    tgt_mw_rot = tgt.matrix_world.to_3x3()
    tgt_mw_rot_inv = tgt_mw_rot.inverted()

    for pb in tgt.pose.bones:
        pb.rotation_mode = "QUATERNION"

    for f in range(f_start, f_end + 1):
        bpy.context.scene.frame_set(f)
        for s_name, t_name in pairs:
            s_pb = src.pose.bones[s_name]
            t_pb = tgt.pose.bones[t_name]

            # ソースが世界空間でレストからどれだけ回ったか
            s_pose_w = (src.matrix_world @ s_pb.matrix).to_3x3()
            delta = s_pose_w @ src_rest_w[s_name].to_3x3().inverted()
            # ターゲットの望ましい世界回転
            rw = delta @ tgt_rest_w[t_name].to_3x3()
            # 世界回転 -> ターゲットアーマチュア空間の回転
            m_as_rot = tgt_mw_rot_inv @ rw

            # 親の現在ポーズ(アーマチュア空間) と レスト相対 から ローカル回転チャンネルを逆算
            tb = tgt.data.bones[t_name]
            if tb.parent:
                pp = t_pb.parent.matrix  # 既に当該フレームで設定済み（親優先処理）
                rl = tb.parent.matrix_local.inverted() @ tb.matrix_local
            else:
                pp = Matrix.Identity(4)
                rl = tb.matrix_local
            base = (pp @ rl).to_3x3().inverted() @ m_as_rot
            t_pb.rotation_quaternion = base.to_quaternion()
            t_pb.keyframe_insert(data_path="rotation_quaternion", frame=f)

    # ターゲットアクションのフレーム範囲を整える
    if tgt.animation_data and tgt.animation_data.action:
        tgt.animation_data.action.name = "heel"
    bpy.context.scene.frame_start = f_start
    bpy.context.scene.frame_end = f_end

    # ソース＆メッシュを削除し、ターゲット骨格＋アニメのみ残す
    for o in list(bpy.data.objects):
        if o is not tgt:
            bpy.data.objects.remove(o, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.fbx(
        filepath=out_path,
        use_selection=False,
        add_leaf_bones=False,
        bake_anim=True,
        bake_anim_use_all_actions=True,
        bake_anim_use_nla_strips=False,
        bake_anim_force_startend_keying=True,
        bake_anim_simplify_factor=0.0,
        path_mode="COPY",
        embed_textures=False,
    )
    size_kb = os.path.getsize(out_path) / 1024
    print(f"Exported: {out_path} ({size_kb:.0f}KB)")


main()

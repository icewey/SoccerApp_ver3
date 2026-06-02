"""
Blender headless script: FBX からメッシュを除去してアニメーションのみ残す
Usage: blender --background --python strip_skin.py -- <input.fbx> <output.fbx>
"""
import bpy
import sys
import os

def main():
    argv = sys.argv
    try:
        sep = argv.index("--")
        args = argv[sep + 1:]
    except ValueError:
        print("Usage: blender --background --python strip_skin.py -- <input.fbx> <output.fbx>")
        sys.exit(1)

    input_path  = args[0]
    output_path = args[1]

    print(f"Input : {input_path}")
    print(f"Output: {output_path}")

    # 空シーンから開始
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # FBX インポート
    bpy.ops.import_scene.fbx(filepath=input_path, use_anim=True, ignore_leaf_bones=False)

    before = len(bpy.data.objects)
    print(f"Objects before: {[(o.name, o.type) for o in bpy.data.objects]}")

    # MESH オブジェクトを削除
    mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
    for obj in mesh_objs:
        bpy.data.objects.remove(obj, do_unlink=True)

    # 残ったメッシュデータも削除
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)

    # 未使用マテリアル・テクスチャも削除（ファイルサイズ削減）
    for mat in bpy.data.materials:
        bpy.data.materials.remove(mat)
    for img in bpy.data.images:
        bpy.data.images.remove(img)

    after = len(bpy.data.objects)
    print(f"Objects after : {[(o.name, o.type) for o in bpy.data.objects]}")
    print(f"Removed {before - after} mesh object(s)")

    # FBX エクスポート（アニメーション込み）
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.export_scene.fbx(
        filepath=output_path,
        use_selection=False,
        add_leaf_bones=False,
        bake_anim=True,
        bake_anim_use_all_actions=True,
        bake_anim_use_nla_strips=False,
        bake_anim_force_startend_keying=True,
        bake_anim_simplify_factor=0.0,
        path_mode='COPY',
        embed_textures=False,
    )

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"Exported: {output_path} ({size_mb:.1f}MB)")

main()

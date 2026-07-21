"""Export the reviewed System 3 Blender scene for the interactive website."""
import bpy

MODEL = r"C:\Users\mrunmai khumkar\Documents\mahle\models\system_03_arduino_hid_indexer.blend"
MODEL_GLB = r"C:\Users\mrunmai khumkar\Documents\mahle\models\system_03_arduino_hid_indexer.glb"
PUBLIC_GLB = r"C:\Users\mrunmai khumkar\Documents\mahle\public\models\rolling_lvdt_indexer.glb"

bpy.ops.wm.open_mainfile(filepath=MODEL)
bpy.context.scene.frame_set(90)

for obj in bpy.context.scene.objects:
    obj.select_set(not obj.hide_render)

options = dict(
    export_format='GLB',
    export_materials='EXPORT',
    export_cameras=True,
    export_lights=True,
    export_apply=True,
    use_selection=True,
)
bpy.ops.export_scene.gltf(filepath=MODEL_GLB, **options)
bpy.ops.export_scene.gltf(filepath=PUBLIC_GLB, **options)
print('SYSTEM3_WEB_ASSETS_EXPORTED')

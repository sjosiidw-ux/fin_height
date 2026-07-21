"""Make the supplied System 3 LVDT a visible, profile-following roller station."""
import math
import bpy
from mathutils import Euler, Quaternion

MODEL = r"C:\Users\mrunmai khumkar\Documents\mahle\models\system_03_arduino_hid_indexer_roller_corrected.blend"
MODEL_GLB = r"C:\Users\mrunmai khumkar\Documents\mahle\models\system_03_arduino_hid_indexer.glb"
PUBLIC_GLB = r"C:\Users\mrunmai khumkar\Documents\mahle\public\models\rolling_lvdt_indexer.glb"
PUBLIC_BLEND = r"C:\Users\mrunmai khumkar\Documents\mahle\public\models\system_03_arduino_hid_indexer.blend"

bpy.ops.wm.open_mainfile(filepath=MODEL)
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 180

# System 3 must stand alone: the laser route's red datum rail is not part of
# a rolling-contact station and otherwise reads as an impossible probe arm.
datum_rail = bpy.data.objects.get('Precision datum rail')
if datum_rail:
    datum_rail.hide_render = True
    datum_rail.hide_viewport = True

tray = bpy.data.objects['MOVING_RADIATOR_PALLET__CONVEYOR_DRIVEN']
slide = bpy.data.objects['ANIMATED_LVDT_VERTICAL_SLIDE']
body = bpy.data.objects['Peak-drop LVDT fixed body']
rod = bpy.data.objects['Peak probe moving rod']
roller = bpy.data.objects['Black rubber roller tip']
hub = bpy.data.objects['Roller tip steel hub']
axle = bpy.data.objects['Roller tip axle']
rim = bpy.data.objects['Visible roller rim']

# A 0.36-unit rolling wheel reads clearly yet remains narrower than the gap
# between folds.  Its centre is always lifted by its radius above the sheet.
for wheel_part in (roller, hub, rim):
    wheel_part.scale.x = 1.38
    wheel_part.scale.y = 1.38
roller_radius = .18

for animated in (tray, slide, rod, roller, hub, axle, rim):
    animated.animation_data_clear()

body_bottom = body.location.z - body.dimensions.z / 2
base_orientation = Euler((math.radians(90), 0, 0)).to_quaternion()
spin_axis = Quaternion((0, -1, 0), 0)

for frame in range(1, 181):
    progress = (frame - 1) / 179
    # A cosine shuttle returns to its starting point at frame 180, avoiding
    # the visible position jump that the website's looping player used to show.
    shuttle = (1 - math.cos(progress * math.tau)) / 2
    tray_x = -5.2 + shuttle * 10.4
    tray.location.x = tray_x
    tray.keyframe_insert(data_path='location', index=0, frame=frame)

    # Smooth C1-continuous rise/fall in the folded profile, not a jump from
    # valley to crest. This follows the sheet instead of entering it.
    fold = ((1 - math.cos(((tray_x + 5.2) / .95) * math.tau)) / 2) ** .9
    sheet_height = 4.08 + fold * .45
    wheel_centre = sheet_height + roller_radius
    slide.location.z = wheel_centre - 6.08
    slide.keyframe_insert(data_path='location', index=2, frame=frame)

    probe_length = max(.45, body_bottom - wheel_centre)
    rod.location.z = wheel_centre + probe_length / 2
    rod.scale.z = probe_length / .86
    rod.keyframe_insert(data_path='location', index=2, frame=frame)
    rod.keyframe_insert(data_path='scale', index=2, frame=frame)

    wheel_angle = (tray_x + 5.2) / roller_radius
    for wheel_part in (roller, hub, axle, rim):
        wheel_part.rotation_mode = 'QUATERNION'
        wheel_part.rotation_quaternion = Quaternion((0, -1, 0), wheel_angle) @ base_orientation
        wheel_part.keyframe_insert(data_path='rotation_quaternion', frame=frame)

# Blender's current action-slot API stores interpolation curves differently
# across versions. The keyed cosine profile is already continuous and the
# default Bezier interpolation preserves a smooth follower motion.

scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=MODEL)
bpy.ops.wm.save_as_mainfile(filepath=PUBLIC_BLEND, copy=True)

for obj in scene.objects:
    obj.select_set(not obj.hide_render)
export_options = dict(
    export_format='GLB', export_materials='EXPORT', export_cameras=True,
    export_lights=True, export_apply=True, use_selection=True,
)
bpy.ops.export_scene.gltf(filepath=MODEL_GLB, **export_options)
bpy.ops.export_scene.gltf(filepath=PUBLIC_GLB, **export_options)
print('SYSTEM3_PROFILE_FOLLOWING_CONTACT_READY')

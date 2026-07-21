"""Create three production-style inspection stations from the approved fin stack.

Every station starts from the approved original conveyor model.  The only
common geometry change is converting the solid triangular fin prisms into
open folded-sheet zig-zag fins mounted to the existing moving pallet.
"""
import bpy
import math
import os
from mathutils import Euler, Quaternion

SOURCE = r"C:\Users\mrunmai khumkar\Documents\Codex\2026-07-13\computer-plugin-computer-use-openai-bundled\outputs\industrial_radiator_fin_inspection.blend"
MODELS = r"C:\Users\mrunmai khumkar\Documents\mahle\models"
PUBLIC = r"C:\Users\mrunmai khumkar\Documents\mahle\public\models"


def mat(name, color, metal=0.0, rough=.35, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = 3.0
    return m


def materials():
    return {
        'carbon': mat('Carbon black', (.012, .02, .028), .8, .2),
        'steel': mat('Machined stainless', (.36, .46, .53), .9, .18),
        'laser': mat('Laser cyan', (.02, .72, 1.0), .15, .12, (.02, .72, 1.0)),
        'laser_red': mat('Laser red', (1.0, .015, .025), .08, .12, (1.0, .004, .01)),
        'signal': mat('Signal green', (.12, .95, .48), .1, .18, (.12, .95, .48)),
        'amber': mat('Encoder amber', (1.0, .29, .03), .15, .22, (1.0, .2, .02)),
        'violet': mat('Automation violet', (.45, .25, 1.0), .15, .2, (.45, .25, 1.0)),
        'pcb': mat('Industrial PCB', (.015, .2, .12), .0, .42),
        'tray': mat('Support tray polymer', (.03, .28, .3), .1, .36),
        'red': mat('Probe ruby', (.95, .035, .04), .15, .16, (.9, .02, .02)),
    }


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def link(obj, col):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    col.objects.link(obj)
    return obj


def cube(name, loc, dim, material, col, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = dim
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    link(o, col)
    if bevel:
        b = o.modifiers.new('Edge radius', 'BEVEL')
        b.width = bevel
        b.segments = 3
    return o


def cyl(name, loc, radius, depth, material, col, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth,
                                       location=loc, rotation=rotation)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    link(o, col)
    return o


def text(name, body, loc, size, material, col):
    bpy.ops.object.text_add(location=loc, rotation=(math.radians(74), 0, 0))
    o = bpy.context.object
    o.name = name
    o.data.body = body
    o.data.align_x = 'CENTER'
    o.data.size = size
    o.data.extrude = .007
    o.data.materials.append(material)
    link(o, col)
    return o


def open_folded_fin(source_fin, col):
    # Vertices of the original solid prism: left/apex/right at front and back.
    lf, af, rf, lb, ab, rb = [tuple(v.co) for v in source_fin.data.vertices]
    mesh = bpy.data.meshes.new(source_fin.name.replace('Triangular', 'Open folded') + ' mesh')
    mesh.from_pydata([lf, af, rf, lb, ab, rb], [], [(0, 1, 4, 3), (1, 2, 5, 4)])
    mesh.materials.append(source_fin.data.materials[0])
    o = bpy.data.objects.new(source_fin.name.replace('Triangular', 'Open folded'), mesh)
    col.objects.link(o)
    o.parent = source_fin.parent
    o.matrix_local = source_fin.matrix_local.copy()
    solid = o.modifiers.new('0.8 mm formed sheet', 'SOLIDIFY')
    solid.thickness = .026
    solid.offset = 0
    b = o.modifiers.new('Fold radius', 'BEVEL')
    b.width = .018
    b.segments = 2
    return o


def base_station(label):
    bpy.ops.wm.open_mainfile(filepath=SOURCE)
    # Always open the deliverable on its inspection-ready first frame, not in
    # the middle of the tray travel animation.
    bpy.context.scene.frame_set(1)
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.context.scene.render.resolution_x = 1600
    bpy.context.scene.render.resolution_y = 900
    bpy.context.scene.render.resolution_percentage = 100
    m = materials()
    col = collection(label)
    # Keep the original brushed-aluminium appearance that makes the folded
    # cavities legible, while increasing its metallic sheen for the final twin.
    fin_material = bpy.data.materials.get('Brushed aluminium') or m['steel']
    if fin_material.use_nodes:
        bsdf = fin_material.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            bsdf.inputs['Metallic'].default_value = .92
            bsdf.inputs['Roughness'].default_value = .16

    # Retain every original fin's size/pitch, only make the triangular wedge an
    # open folded sheet.  The pallet remains the sole animated object.
    for src in [o for o in bpy.context.scene.objects if o.name.startswith('Triangular fin')]:
        fin = open_folded_fin(src, col)
        fin.data.materials.clear()
        fin.data.materials.append(fin_material)
        src.hide_render = True
        src.hide_viewport = True

    # Clear the pallet travel corridor: the upright supports move to y=+/-2.7,
    # outside the y=+/-1.9 folded-fin envelope.  Gauge stays fixed overhead.
    a = bpy.data.objects.get('Fixed C-frame post')
    b = bpy.data.objects.get('Fixed C-frame post.001')
    beam = bpy.data.objects.get('Fixed measurement crossbeam')
    if a and b and beam:
        a.location = (0, -2.70, a.location.z)
        b.location = (0, 2.70, b.location.z)
        beam.location = (0, 0, beam.location.z)
        beam.rotation_euler[2] = math.radians(90)
    # The rendered station has an on-screen inspection dashboard; remove the
    # redundant physical fin-height board from both digital-twin variants.
    remove_names(['HMI housing', 'HMI pedestal', 'HMI screen'])
    return m, col


def hide_names(parts):
    for o in bpy.context.scene.objects:
        if any(p.lower() in o.name.lower() for p in parts):
            o.hide_render = True
            o.hide_viewport = True


def remove_names(parts):
    for o in list(bpy.context.scene.objects):
        if any(p.lower() in o.name.lower() for p in parts):
            bpy.data.objects.remove(o, do_unlink=True)


def add_inline_laser(m, col):
    hide_names(['LVDT carriage', 'LVDT body', 'LVDT core', 'Ruby ball', 'Laser measurement plane'])
    # Damped optical head on the fixed overhead beam.
    cube('Laser isolation plate', (0, 0, 9.94), (1.45, .68, .16), m['carbon'], col, .05)
    for x in (-.48, .48): cyl('Tuned mass damper', (x, 0, 9.70), .14, .22, m['steel'], col)
    cube('ZX2-LD50L laser bracket', (0, 0, 9.32), (.33, .62, .68), m['steel'], col, .05)
    cube('Omron ZX2-LD50L CMOS laser head', (0, 0, 8.95), (.82, .70, .42), m['carbon'], col, .08)
    cyl('Optical line lens', (0, -.38, 8.95), .14, .045, m['laser'], col, (math.radians(90), 0, 0))
    # One clear red optical path: the projected line is the measurement signal.
    # No fan rays are modeled, so nothing can be mistaken for a fin or guide.
    cyl('Visible red laser beam', (0, 0, 6.70), .06, 4.18, m['laser_red'], col)
    cube('Red line laser on fin crest', (0, 0, 4.45), (.12, 5.5, .045), m['laser_red'], col, .0)
    light_data = bpy.data.lights.new('Laser head cyan glow', 'POINT')
    light_data.color = (1.0, .01, .02)
    light_data.energy = 260
    light_data.shadow_soft_size = .25
    light = bpy.data.objects.new('Laser head cyan glow', light_data)
    light.location = (0, -.42, 8.95)
    col.objects.link(light)
    # Air purge prevents dust from contaminating the optical window.
    cyl('Positive-pressure air purge nozzle', (.48, -.16, 9.10), .095, .5, m['steel'], col, (math.radians(58), 0, 0))
    # Encoder is fixed to a conveyor guide wheel, giving position-triggered scans.
    cyl('Incremental encoder housing', (-8.2, -2.85, .68), .34, .24, m['carbon'], col, (math.radians(90), 0, 0))
    cyl('Encoder shaft wheel', (-8.2, -3.00, .68), .22, .05, m['amber'], col, (math.radians(90), 0, 0))
    cube('PLC scan-buffer enclosure', (7.8, -2.85, 1.55), (1.35, .44, 1.5), m['carbon'], col, .08)
    cube('PLC status panel', (7.8, -3.09, 1.60), (.88, .02, .78), m['laser'], col, .01)
    text('System 1 identifier', 'SYSTEM 1  |  LINE LASER + ENCODER', (0, -3.18, 5.7), .16, m['laser'], col)


def add_zero_crush_qa(m, col):
    # Offline controlled-force station.  The moving pallet is stopped at the
    # datum while a separate narrow QA carriage supports the selected fin row.
    pallet = bpy.data.objects.get('MOVING_RADIATOR_PALLET__CONVEYOR_DRIVEN')
    if pallet: pallet.animation_data_clear()
    hide_names(['Laser measurement plane', 'LVDT carriage fixed', 'LVDT body', 'LVDT core', 'Ruby ball'])
    cube('Zero-crush datum saddle', (0, 0, 1.06), (2.35, 4.25, .18), m['tray'], col, .07)
    for y in (-1.82, 1.82): cube('Passive support edge', (0, y, 1.34), (2.2, .12, .42), m['tray'], col, .04)
    # Pneumatic press is mounted on the corrected outboard portal.
    cube('Controlled-force press bridge', (0, 0, 8.6), (1.1, 4.9, .28), m['carbon'], col, .07)
    cyl('Pneumatic low-force actuator', (0, 0, 7.95), .38, .95, m['steel'], col)
    cyl('Low-force LVDT body', (0, 0, 6.75), .20, 1.1, m['carbon'], col)
    cyl('LVDT ceramic probe', (0, 0, 5.95), .045, .76, m['steel'], col)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=.095, location=(0, 0, 5.54))
    ball = bpy.context.object; ball.name = 'Ruby contact ball'; ball.data.materials.append(m['red']); link(ball, col)
    cube('Force regulator + gauge', (-1.35, -2.66, 3.2), (.55, .30, .84), m['carbon'], col, .05)
    cyl('Pressure regulator dial', (-1.35, -2.83, 3.28), .16, .03, m['signal'], col, (math.radians(90), 0, 0))
    text('System 2 identifier', 'SYSTEM 2  |  ZERO-CRUSH LVDT BATCH QA', (0, -3.18, 5.7), .16, m['signal'], col)


def add_motor_indexer(m, col):
    hide_names(['Laser measurement plane', 'Precision datum rail', 'LVDT carriage fixed', 'LVDT body', 'LVDT core', 'Ruby ball'])
    # The printed tray is the moving component.  Its front lip and individual
    # locating ribs are intentionally exposed so the mechanism reads clearly.
    pallet = bpy.data.objects.get('MOVING_RADIATOR_PALLET__CONVEYOR_DRIVEN')
    def tray_part(name, loc, dim, material, bevel=.04):
        obj = cube(name, (0, 0, 0), dim, material, col, bevel)
        obj.parent = pallet
        obj.matrix_parent_inverse.identity()
        obj.location = loc
        return obj
    tray_part('3D printed moving tray base', (0, 0, .94), (13.15, 4.36, .24), m['tray'], .08)
    tray_part('3D printed tray front retaining lip', (0, -2.06, 1.15), (13.15, .17, .48), m['tray'], .05)
    tray_part('3D printed tray rear retaining lip', (0, 2.06, 1.15), (13.15, .17, .48), m['tray'], .05)
    for i in range(13):
        tray_part('Printed fin locating rib %02d' % (i + 1), (-5.70 + i * .95, -1.90, 1.28), (.16, .24, .34), m['tray'], .025)

    # Static linear guide and lead screw drive the tray in indexed steps.
    for y in (-2.48, 2.48): cube('Indexer linear guide', (0, y, .82), (18.5, .12, .12), m['steel'], col, .02)
    cyl('Precision lead screw', (0, -2.72, .99), .065, 18.0, m['steel'], col, (0, math.radians(90), 0))
    cube('NEMA 17 stepper motor', (-8.9, -2.98, 1.08), (.88, .88, .88), m['carbon'], col, .10)
    cyl('Stepper shaft', (-8.42, -2.98, 1.08), .11, .38, m['amber'], col, (0, math.radians(90), 0))
    cyl('Stepper flexible coupler', (-8.16, -2.72, .99), .14, .38, m['amber'], col, (0, math.radians(90), 0))
    cube('Lead-screw nut carriage', (.85, -2.72, .99), (.55, .35, .34), m['violet'], col, .06)
    # Compact vertical LVDT sees the peak drop after each index increment.
    # Match the approved source station: the measuring head is centred over
    # the fin stack at X=0, Y=0, with its probe travelling vertically.
    probe_x = 0
    probe_y = 0
    # Guide rods and the LVDT body stay above the workpiece.  Only the rolling
    # follower moves, with a telescopic probe bridging it to the fixed body.
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(probe_x, probe_y, 0))
    slide = bpy.context.object
    slide.name = 'ANIMATED_LVDT_VERTICAL_SLIDE'
    link(slide, col)
    mount = cube('Indexer LVDT fixed upper mount', (probe_x, probe_y, 9.6), (.9, .9, .22), m['carbon'], col, .06)
    body = cyl('Peak-drop LVDT fixed body', (probe_x, probe_y, 8.6), .19, 1.55, m['carbon'], col)
    rod = cyl('Peak probe moving rod', (probe_x, probe_y, 6.55), .043, .86, m['steel'], col)
    roller_radius = .18
    roller = cyl('Black rubber roller tip', (probe_x, probe_y, 6.08), roller_radius, .28, m['carbon'], col,
                 (math.radians(90), 0, 0))
    hub = cyl('Roller tip steel hub', (probe_x, probe_y, 6.08), .065, .30, m['steel'], col,
              (math.radians(90), 0, 0))
    axle = cyl('Roller tip axle', (probe_x, probe_y, 6.08), .032, .42, m['amber'], col,
               (math.radians(90), 0, 0))
    # A bright exposed rim sits on the camera-facing side of the black tyre.
    # It makes the actual rolling contact point legible at the bottom of a fin.
    bpy.ops.mesh.primitive_torus_add(major_radius=.085, minor_radius=.022,
                                    major_segments=32, minor_segments=12,
                                    location=(probe_x, probe_y - .155, 6.08),
                                    rotation=(math.radians(90), 0, 0))
    rim = bpy.context.object
    rim.name = 'Visible roller rim'
    rim.data.materials.append(m['amber'])
    link(rim, col)
    fork_l = cube('Roller fork left', (probe_x - .16, probe_y, 6.17), (.05, .38, .30), m['carbon'], col, .015)
    fork_r = cube('Roller fork right', (probe_x + .16, probe_y, 6.17), (.05, .38, .30), m['carbon'], col, .015)
    for obj in (roller, hub, axle, rim, fork_l, fork_r):
        world = obj.matrix_world.copy()
        obj.parent = slide
        obj.matrix_world = world
    # The mounting body remains fixed while a telescopic follower holds the
    # roller on the folded profile. This is distinct from moving the whole
    # LVDT: only the low-mass contact tip travels vertically.
    body_bottom = 8.6 - (1.55 / 2)
    palette = bpy.data.objects.get('MOVING_RADIATOR_PALLET__CONVEYOR_DRIVEN')
    scene = bpy.context.scene
    for frame in range(1, 181):
        scene.frame_set(frame)
        tray_x = -5.2 + ((frame - 1) / 179) * 10.4
        smooth_fold = ((1 - math.cos(((tray_x + 5.2) / .95) * math.tau)) / 2) ** .9
        contact_z = 4.08 + smooth_fold * .45 + roller_radius
        slide.location.z = contact_z - 6.08
        slide.keyframe_insert(data_path='location', index=2, frame=frame)
        probe_length = max(.45, body_bottom - contact_z)
        rod.location.z = contact_z + probe_length / 2
        rod.scale.z = probe_length / .86
        rod.keyframe_insert(data_path='location', index=2, frame=frame)
        rod.keyframe_insert(data_path='scale', index=2, frame=frame)
        angle = (tray_x + 5.2) / roller_radius
        # The wheel axle is parallel to the fin length (the Y axis). Apply
        # spin about that axis after aligning the cylinder, rather than
        # changing its Euler Y component and accidentally tipping the axle.
        base_orientation = Euler((math.radians(90), 0, 0)).to_quaternion()
        for wheel in (roller, hub, axle, rim):
            wheel.rotation_mode = 'QUATERNION'
            wheel.rotation_quaternion = Quaternion((0, -1, 0), angle) @ base_orientation
            wheel.keyframe_insert(data_path='rotation_quaternion', frame=frame)
    # These are measurement samples, not a smoothed camera move. Linear keys
    # preserve the V profile exactly between frames and prevent the LVDT from
    # overshooting into the folded sheet at a crest or valley.
    for animated in (slide, rod, roller, hub, axle):
        if not (animated.animation_data and animated.animation_data.action):
            continue
        action = animated.animation_data.action
        # Blender 5 stores curves in layered action channel bags; older builds
        # expose them directly on action.fcurves. Support both so the model
        # generator remains portable.
        if hasattr(action, 'fcurves'):
            curves = action.fcurves
        else:
            curves = [curve for layer in action.layers for strip in layer.strips
                      for bag in strip.channelbags for curve in bag.fcurves]
        for curve in curves:
            for key in curve.keyframe_points:
                key.interpolation = 'LINEAR'
    scene.frame_set(1)
    # Arduino Leonardo plus opto-isolated HID trigger: a vertical, front-facing
    # board so its connectors, LEDs and USB cable are visible in the model.
    cube('Arduino Leonardo controller board', (5.9, -3.16, 1.55), (1.75, .12, 1.25), m['pcb'], col, .04)
    cube('Arduino micro USB socket', (5.9, -3.25, .98), (.34, .10, .16), m['steel'], col, .02)
    for x in (-.52, -.18, .18, .52):
        cube('Arduino pin header', (5.9 + x, -3.25, 1.98), (.09, .05, .18), m['steel'], col, .01)
    for x, color in ((-.32, m['signal']), (0, m['amber']), (.32, m['violet'])):
        cyl('Arduino status LED', (5.9 + x, -3.25, 1.45), .065, .025, color, col, (math.radians(90), 0, 0))
    cube('USB HID trigger cable', (4.68, -3.16, 1.10), (1.05, .07, .07), m['violet'], col, .025)
    cube('Opto-isolated HID interface', (4.15, -3.16, 1.48), (.72, .16, .72), m['carbon'], col, .05)
    text('System 3 identifier', 'SYSTEM 3  |  MOTOR INDEXER + LVDT HID', (0, -3.18, 5.7), .16, m['violet'], col)


def export(stem, public_name):
    os.makedirs(MODELS, exist_ok=True)
    os.makedirs(PUBLIC, exist_ok=True)
    blend = os.path.join(MODELS, stem + '.blend')
    glb = os.path.join(MODELS, stem + '.glb')
    # The roller is easiest to inspect midway through the System 3 scan;
    # opening the deliverable there makes the key contact element obvious.
    bpy.context.scene.frame_set(90 if stem.startswith('system_03') else 1)
    # Make the file open on the composed inspection view, not an arbitrary
    # workspace position or a mid-cycle animation frame.
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    bpy.context.scene.render.filepath = os.path.join(MODELS, stem + '.png')
    bpy.ops.render.render(write_still=True)
    for obj in bpy.context.scene.objects: obj.select_set(not obj.hide_render)
    opts = dict(export_format='GLB', export_materials='EXPORT', export_cameras=True,
                export_lights=True, export_apply=True, use_selection=True)
    bpy.ops.export_scene.gltf(filepath=glb, **opts)
    bpy.ops.export_scene.gltf(filepath=os.path.join(PUBLIC, public_name), **opts)
    print('EXPORTED', stem)


which = os.getenv('SOLUTION', 'all')
if which in ('1', 'all'):
    m, c = base_station('SYSTEM_01_INLINE_LASER')
    add_inline_laser(m, c)
    export('system_01_inline_laser_encoder', 'inline_laser_encoder.glb')
if which in ('3', 'all'):
    m, c = base_station('SYSTEM_03_MOTOR_INDEXER')
    add_motor_indexer(m, c)
    export('system_03_arduino_hid_indexer', 'rolling_lvdt_indexer.glb')
